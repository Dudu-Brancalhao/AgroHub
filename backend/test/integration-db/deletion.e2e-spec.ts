import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';

/**
 * What a delete reaches, and what it deliberately does not.
 *
 * The producer tree still cascades — producer, properties, crops — but the harvest sits outside
 * it now. Every assertion here that counts harvests AFTER a delete is checking that the reshape
 * held: a harvest is shared by the whole registry, so if it fell with a producer, one request
 * would erase a season from every other farm (FR-017).
 */
describe('Cascading deletion (US5 §4-§7, FR-017)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;
  let harvestIds: string[];

  beforeAll(async () => {
    ctx = await createDbTestApp();
    app = ctx.app;
    auth = await ctx.authHeader();
  });

  afterAll(async () => {
    await ctx.truncate();
    await app.close();
    await ctx.prisma.$disconnect();
  });

  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    await ctx.truncate();

    // The seasons are created ONCE for the whole registry, not once per producer — the year is
    // unique, so a per-producer harvest would be rejected on the second call.
    harvestIds = [];
    for (const year of [2021, 2022]) {
      const harvest = await http()
        .post('/api/harvests')
        .set('Authorization', auth)
        .send({ year })
        .expect(201);
      harvestIds.push(harvest.body.id);
    }
  });

  /** A producer with 2 properties, each planting 2 crops in each of the 2 shared harvests. */
  async function seedTree(document = '529.982.247-25') {
    const producer = await http()
      .post('/api/producers')
      .set('Authorization', auth)
      .send({ document, name: 'José Antônio' })
      .expect(201);

    const propertyIds: string[] = [];

    for (const farmName of ['Fazenda A', 'Fazenda B']) {
      const property = await http()
        .post(`/api/producers/${producer.body.id}/properties`)
        .set('Authorization', auth)
        .send({ farmName, city: 'Uberaba', state: 'MG', totalArea: 100, arableArea: 60, vegetationArea: 30 })
        .expect(201);
      propertyIds.push(property.body.id);

      for (const harvestId of harvestIds) {
        for (const name of ['Soja', 'Milho']) {
          await http()
            .post(`/api/properties/${property.body.id}/crops`)
            .set('Authorization', auth)
            .send({ harvestId, name })
            .expect(201);
        }
      }
    }

    return { producerId: producer.body.id, propertyIds };
  }

  it('deletes a producer with its whole tree and reports the counts (spec US5 §5, FR-034)', async () => {
    const { producerId } = await seedTree();

    const res = await http().delete(`/api/producers/${producerId}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ producers: 1, properties: 2, crops: 8 });
    // No harvest count at all, rather than `harvests: 0`: reporting a zero would say the
    // operation considered them (research.md R-008).
    expect(Object.keys(res.body.deleted)).not.toContain('harvests');

    expect(await ctx.prisma.producer.count()).toBe(0);
    expect(await ctx.prisma.property.count()).toBe(0);
    expect(await ctx.prisma.crop.count()).toBe(0);
    expect(await ctx.prisma.harvest.count()).toBe(2);
  });

  it('leaves other producers untouched', async () => {
    const first = await seedTree('529.982.247-25');
    await seedTree('390.533.447-05');

    await http().delete(`/api/producers/${first.producerId}`).set('Authorization', auth).expect(200);

    expect(await ctx.prisma.producer.count()).toBe(1);
    expect(await ctx.prisma.property.count()).toBe(2);
    expect(await ctx.prisma.crop.count()).toBe(8);
    expect(await ctx.prisma.harvest.count()).toBe(2);
  });

  /**
   * The sharpest version of the rule. Two producers plant in the same 2021, one is deleted, and
   * the other must still have its 2021 crops. Under the old model 2021 was two separate rows, so
   * this could not even be asked.
   */
  it('deleting one producer leaves another producer’s crops in the SAME harvest', async () => {
    const first = await seedTree('529.982.247-25');
    await seedTree('390.533.447-05');

    await http().delete(`/api/producers/${first.producerId}`).set('Authorization', auth).expect(200);

    const remaining = await http()
      .get(`/api/harvests/${harvestIds[0]}/crops`)
      .set('Authorization', auth)
      .expect(200);

    expect(remaining.body).toHaveLength(4);
  });

  it('deletes a property with its crops, keeping the producer and every harvest (spec US5 §4)', async () => {
    const { producerId, propertyIds } = await seedTree();

    const res = await http()
      .delete(`/api/properties/${propertyIds[0]}`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ properties: 1, crops: 4 });
    expect(Object.keys(res.body.deleted)).not.toContain('harvests');

    await http().get(`/api/producers/${producerId}`).set('Authorization', auth).expect(200);
    expect(await ctx.prisma.property.count()).toBe(1);
    expect(await ctx.prisma.crop.count()).toBe(4);
    expect(await ctx.prisma.harvest.count()).toBe(2);
  });

  /**
   * Inverted from feature 002, deliberately. This used to delete the harvest and its crops; now
   * the harvest is shared, and a 200 here would mean one request had just erased 2021 from every
   * farm in the registry (FR-010).
   */
  it('REFUSES to delete a harvest that is in use, and says how many crops block it', async () => {
    await seedTree();

    const res = await http().delete(`/api/harvests/${harvestIds[0]}`).set('Authorization', auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('4');
    expect(await ctx.prisma.crop.count()).toBe(8);
    expect(await ctx.prisma.harvest.count()).toBe(2);
  });

  it('deletes a harvest once nothing plants in it', async () => {
    const res = await http().delete(`/api/harvests/${harvestIds[0]}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ harvests: 1 });
    expect(await ctx.prisma.harvest.count()).toBe(1);
  });

  it('deletes a single crop', async () => {
    await seedTree();
    const crops = await http()
      .get(`/api/harvests/${harvestIds[0]}/crops`)
      .set('Authorization', auth);

    const res = await http()
      .delete(`/api/crops/${crops.body[0].id}`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ crops: 1 });
    expect(await ctx.prisma.crop.count()).toBe(7);
  });

  it('reports zero counts for a producer with nothing beneath it', async () => {
    const producer = await http()
      .post('/api/producers')
      .set('Authorization', auth)
      .send({ document: '529.982.247-25', name: 'Sem Fazenda' })
      .expect(201);

    const res = await http()
      .delete(`/api/producers/${producer.body.id}`)
      .set('Authorization', auth);

    expect(res.body.deleted).toEqual({ producers: 1, properties: 0, crops: 0 });
  });

  it('answers a second delete with 404 rather than failing obscurely (spec US5 §7)', async () => {
    const { producerId } = await seedTree();

    await http().delete(`/api/producers/${producerId}`).set('Authorization', auth).expect(200);
    await http().delete(`/api/producers/${producerId}`).set('Authorization', auth).expect(404);
  });

  // FR-033 / SC-005: the invariant that cascading exists to protect.
  it('leaves no orphans anywhere after a mixed run of deletes', async () => {
    const a = await seedTree('529.982.247-25');
    const b = await seedTree('390.533.447-05');

    await http().delete(`/api/producers/${a.producerId}`).set('Authorization', auth).expect(200);
    await http().delete(`/api/properties/${b.propertyIds[0]}`).set('Authorization', auth).expect(200);

    // Checked in SQL, not through Prisma: an orphan is by definition a row Prisma's relational
    // filters cannot reach, so only a LEFT JOIN can find one.
    //
    // A crop now has two parents, so it can be orphaned two ways and both are checked. Harvests
    // are not checked at all — they have no parent to be orphaned from, which is the change.
    const [orphans] = await ctx.prisma.$queryRawUnsafe<Array<Record<string, bigint>>>(`
      SELECT
        (SELECT count(*) FROM properties p LEFT JOIN producers pr ON pr.id = p.producer_id WHERE pr.id IS NULL) AS orphan_properties,
        (SELECT count(*) FROM crops c LEFT JOIN properties p ON p.id = c.property_id WHERE p.id IS NULL) AS crops_without_property,
        (SELECT count(*) FROM crops c LEFT JOIN harvests h ON h.id = c.harvest_id WHERE h.id IS NULL) AS crops_without_harvest
    `);

    expect(Number(orphans.orphan_properties)).toBe(0);
    expect(Number(orphans.crops_without_property)).toBe(0);
    expect(Number(orphans.crops_without_harvest)).toBe(0);
  });
});
