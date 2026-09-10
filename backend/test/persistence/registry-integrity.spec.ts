import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeForSearch } from '../../src/common/validation/text-normalizer';

/**
 * The guarantees that ARE the database, verified against real Postgres.
 *
 * Nothing here could be shown with a fake: constraint enforcement under concurrent writes,
 * cascade atomicity, and referential integrity are properties of the engine, and a fake that got
 * them subtly wrong would report green while production created orphans (research.md R-008).
 */
describe('Registry integrity (FR-008, FR-025, FR-032, FR-033)', () => {
  const url = process.env.PERSISTENCE_DATABASE_URL ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE crops, harvests, properties, producers RESTART IDENTITY CASCADE',
    );
  });

  const makeProducer = (document: string, name = 'Produtor') =>
    prisma.producer.create({
      data: { document, documentType: 'CPF', name, nameSearch: normalizeForSearch(name) },
    });

  const makeProperty = (producerId: string, farmName = 'F') =>
    prisma.property.create({
      data: {
        producerId,
        farmName,
        city: 'Uberaba',
        state: 'MG',
        totalArea: new Prisma.Decimal(100),
        arableArea: new Prisma.Decimal(60),
        vegetationArea: new Prisma.Decimal(30),
      },
    });

  // ---- FR-008 ------------------------------------------------------------------------------

  describe('unique document under concurrency', () => {
    it('creates exactly one producer when 10 requests race for the same document', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => makeProducer('52998224725')),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(9);
      expect(await prisma.producer.count()).toBe(1);
    });

    it('rejects the losers with P2002, which is what the 409 path depends on', async () => {
      await makeProducer('52998224725');
      await expect(makeProducer('52998224725')).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  // ---- FR-025 ------------------------------------------------------------------------------

  describe('unique crop per farm and harvest under concurrency', () => {
    it('creates exactly one crop when 10 requests race for the same (farm, harvest, name)', async () => {
      const producer = await makeProducer('52998224725');
      const property = await makeProperty(producer.id);
      const harvest = await prisma.harvest.create({ data: { year: 2021 } });

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
          prisma.crop.create({
            data: {
              propertyId: property.id,
              harvestId: harvest.id,
              name: 'Soja',
              nameNormalized: normalizeForSearch('Soja'),
            },
          }),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.crop.count()).toBe(1);
    });

    /**
     * The unique spans all three columns, so loosening any one of them must still be accepted.
     * A test that only proved the rejection would pass just as happily against a unique on
     * (harvestId, nameNormalized) alone - which is the old constraint, and would wrongly stop a
     * second farm from planting soja in 2021.
     */
    it('accepts the same crop for a different farm, and for a different harvest', async () => {
      const producer = await makeProducer('52998224725');
      const farmA = await makeProperty(producer.id, 'A');
      const farmB = await makeProperty(producer.id, 'B');
      const h2021 = await prisma.harvest.create({ data: { year: 2021 } });
      const h2022 = await prisma.harvest.create({ data: { year: 2022 } });

      const soja = (propertyId: string, harvestId: string) =>
        prisma.crop.create({
          data: { propertyId, harvestId, name: 'Soja', nameNormalized: 'soja' },
        });

      await soja(farmA.id, h2021.id);
      await soja(farmB.id, h2021.id);
      await soja(farmA.id, h2022.id);

      expect(await prisma.crop.count()).toBe(3);
      await expect(soja(farmA.id, h2021.id)).rejects.toMatchObject({ code: 'P2002' });
    });

    /** FR-008 for the harvest: the year is what identifies it, across the whole registry. */
    it('creates exactly one harvest when 10 requests race for the same year', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => prisma.harvest.create({ data: { year: 2021 } })),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(9);
      expect(await prisma.harvest.count()).toBe(1);
    });
  });

  // ---- FR-032 ------------------------------------------------------------------------------

  describe('cascade atomicity', () => {
    async function seed() {
      const producer = await makeProducer('52998224725');
      const property = await makeProperty(producer.id);
      const harvest = await prisma.harvest.create({ data: { year: 2021 } });
      await prisma.crop.createMany({
        data: [
          { propertyId: property.id, harvestId: harvest.id, name: 'Soja', nameNormalized: 'soja' },
          { propertyId: property.id, harvestId: harvest.id, name: 'Milho', nameNormalized: 'milho' },
        ],
      });
      return producer.id;
    }

    /**
     * The cascade stops at the crops, and the harvest is left standing. That asymmetry is the
     * whole point of the reshape: a harvest is shared, so if it fell here, deleting one producer
     * would erase a season from every other farm in the registry.
     */
    it('removes producer, properties and crops in one statement, leaving the harvest', async () => {
      const producerId = await seed();
      await prisma.producer.delete({ where: { id: producerId } });

      expect(await prisma.producer.count()).toBe(0);
      expect(await prisma.property.count()).toBe(0);
      expect(await prisma.crop.count()).toBe(0);
      expect(await prisma.harvest.count()).toBe(1);
    });

    it('cascades from the property alone to its crops, and no further', async () => {
      await seed();
      const property = await prisma.property.findFirstOrThrow();

      await prisma.property.delete({ where: { id: property.id } });

      expect(await prisma.property.count()).toBe(0);
      expect(await prisma.crop.count()).toBe(0);
      expect(await prisma.producer.count()).toBe(1);
      expect(await prisma.harvest.count()).toBe(1);
    });

    /**
     * The refusal is enforced by the database, not by the service count. The service counts the
     * blocking crops so it can say HOW MANY, but if onDelete were still Cascade this delete would
     * succeed and the message would be the only thing standing between one request and every
     * farm's 2021 crops.
     */
    it('refuses to delete a harvest that crops still reference', async () => {
      await seed();
      const harvest = await prisma.harvest.findFirstOrThrow();

      await expect(prisma.harvest.delete({ where: { id: harvest.id } })).rejects.toMatchObject({
        code: 'P2003',
      });

      expect(await prisma.harvest.count()).toBe(1);
      expect(await prisma.crop.count()).toBe(2);
    });

    it('allows the harvest to go once nothing references it', async () => {
      await seed();
      const harvest = await prisma.harvest.findFirstOrThrow();

      await prisma.crop.deleteMany({ where: { harvestId: harvest.id } });
      await prisma.harvest.delete({ where: { id: harvest.id } });

      expect(await prisma.harvest.count()).toBe(0);
    });

    /**
     * A partially applied cascade is exactly how the orphans FR-033 forbids get created. Forcing
     * a failure after the delete but inside the transaction must roll EVERYTHING back.
     */
    it('rolls the whole cascade back when the transaction fails part-way', async () => {
      const producerId = await seed();

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.producer.delete({ where: { id: producerId } });
          // Something else in the same unit of work fails.
          throw new Error('forced failure after the cascade');
        }),
      ).rejects.toThrow('forced failure');

      expect(await prisma.producer.count()).toBe(1);
      expect(await prisma.property.count()).toBe(1);
      expect(await prisma.harvest.count()).toBe(1);
      expect(await prisma.crop.count()).toBe(2);
    });

    it('counts taken inside the transaction match what the cascade removed', async () => {
      const producerId = await seed();

      const report = await prisma.$transaction(async (tx) => {
        const properties = await tx.property.count({ where: { producerId } });
        // Crops are reached through the property now; the harvest is not on the path at all, and
        // is not counted, because it is not being removed (research.md R-008).
        const crops = await tx.crop.count({ where: { property: { producerId } } });
        await tx.producer.delete({ where: { id: producerId } });
        return { properties, crops };
      });

      expect(report).toEqual({ properties: 1, crops: 2 });
      expect(await prisma.crop.count()).toBe(0);
    });
  });

  // ---- FR-033 ------------------------------------------------------------------------------

  describe('no orphan on either side', () => {
    const GHOST = '00000000-0000-0000-0000-000000000000';

    it('refuses a property whose producer does not exist', async () => {
      await expect(makeProperty(GHOST)).rejects.toMatchObject({ code: 'P2003' });
    });

    /**
     * A crop has two parents, so it can be orphaned in two ways. Checking only one would leave
     * the other side unguarded, and a crop pointing at a harvest that never existed is just as
     * broken as one pointing at a missing farm.
     */
    it('refuses a crop whose property does not exist', async () => {
      const harvest = await prisma.harvest.create({ data: { year: 2021 } });

      await expect(
        prisma.crop.create({
          data: {
            propertyId: GHOST,
            harvestId: harvest.id,
            name: 'Soja',
            nameNormalized: 'soja',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('refuses a crop whose harvest does not exist', async () => {
      const producer = await makeProducer('52998224725');
      const property = await makeProperty(producer.id);

      await expect(
        prisma.crop.create({
          data: {
            propertyId: property.id,
            harvestId: GHOST,
            name: 'Soja',
            nameNormalized: 'soja',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
  });

  // ---- FR-016 ------------------------------------------------------------------------------

  it('stores and returns areas at exactly two decimal places', async () => {
    const producer = await makeProducer('52998224725');
    const property = await prisma.property.create({
      data: {
        producerId: producer.id,
        farmName: 'F',
        city: 'Uberaba',
        state: 'MG',
        totalArea: new Prisma.Decimal(1500.11),
        arableArea: new Prisma.Decimal(1000),
        vegetationArea: new Prisma.Decimal(500.11),
      },
    });

    const stored = await prisma.property.findUniqueOrThrow({ where: { id: property.id } });

    expect(stored.totalArea.toFixed(2)).toBe('1500.11');
    expect(stored.arableArea.plus(stored.vegetationArea).equals(stored.totalArea)).toBe(true);
  });
});
