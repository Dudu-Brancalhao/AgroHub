import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';

describe('Crops — the junction (US2)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;
  let producerId: string;
  let farmA: string;
  let farmB: string;
  let h2021: string;
  let h2022: string;

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

  beforeEach(async () => {
    await ctx.truncate();

    const producer = await ctx.prisma.producer.create({
      data: { document: '52998224725', documentType: 'CPF', name: 'José', nameSearch: 'jose' },
    });
    producerId = producer.id;

    const makeFarm = async (farmName: string, state: string) =>
      (
        await ctx.prisma.property.create({
          data: {
            producerId,
            farmName,
            city: 'Uberaba',
            state,
            totalArea: new Prisma.Decimal('100.00'),
            arableArea: new Prisma.Decimal('60.00'),
            vegetationArea: new Prisma.Decimal('40.00'),
          },
        })
      ).id;

    farmA = await makeFarm('Fazenda A', 'MG');
    farmB = await makeFarm('Fazenda B', 'SP');

    const harvest = async (year: number) =>
      (
        await request(app.getHttpServer())
          .post('/api/harvests')
          .set('Authorization', auth)
          .send({ year })
          .expect(201)
      ).body.id;

    h2021 = await harvest(2021);
    h2022 = await harvest(2022);
  });

  const addCrop = (propertyId: string, harvestId: string, name: string) =>
    request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/crops`)
      .set('Authorization', auth)
      .send({ harvestId, name });

  // ---- spec US2 §1, FR-002, FR-003 --------------------------------------------------------

  it('records a crop naming both the farm and the harvest', async () => {
    const res = await addCrop(farmA, h2021, 'Soja');

    expect(res.status).toBe(201);
    expect(res.body.propertyId).toBe(farmA);
    expect(res.body.harvestId).toBe(h2021);
    // The comparison key stays internal.
    expect(Object.keys(res.body)).not.toContain('nameNormalized');
  });

  // ---- spec US2 §2–§5, FR-013 – FR-016 ----------------------------------------------------

  describe('the duplicate rule applies per farm and harvest', () => {
    beforeEach(() => addCrop(farmA, h2021, 'Soja').expect(201));

    it('refuses the same crop for the same farm in the same harvest', async () => {
      const res = await addCrop(farmA, h2021, 'Soja');
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Esta cultura já está registrada para esta fazenda nesta safra.');
    });

    it.each(['SOJA', '  soja  ', 'sojá'])('refuses the variant %p as the same crop', async (name) => {
      await addCrop(farmA, h2021, name).expect(409);
    });

    it('accepts the same crop for a DIFFERENT farm in the same harvest (FR-014)', async () => {
      await addCrop(farmB, h2021, 'Soja').expect(201);
      expect(await ctx.prisma.crop.count({ where: { harvestId: h2021 } })).toBe(2);
    });

    it('accepts the same crop for the same farm in a DIFFERENT harvest (FR-015)', async () => {
      await addCrop(farmA, h2022, 'Soja').expect(201);
      expect(await ctx.prisma.crop.count({ where: { propertyId: farmA } })).toBe(2);
    });

    it('accepts a different crop for the same farm and harvest (FR-016)', async () => {
      await addCrop(farmA, h2021, 'Milho').expect(201);
    });

    it('keeps "Soja" and "Soya" distinct', async () => {
      await addCrop(farmA, h2021, 'Soya').expect(201);
    });
  });

  // ---- spec US2 §6, FR-012 ----------------------------------------------------------------

  describe('both parents must exist', () => {
    // A well-formed v4 id that simply is not in the database. The nil UUID would not do: the
    // body validator is @IsUUID('4'), so a nil id fails validation and returns 400 before the
    // service ever looks it up - which would test the pipe, not the missing parent.
    const GHOST = '9f1c8b3e-7d2a-4c56-9e0b-1a2b3c4d5e6f';

    it('returns 404 from the PATH when the property does not exist', async () => {
      const res = await addCrop(GHOST, h2021, 'Soja');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Propriedade não encontrada.');
    });

    /**
     * The one place this feature bends feature 002's convention: with two parents, only one can be
     * in the path, so a missing harvest is a 404 raised from a body field (research.md R-003).
     */
    it('returns 404 from the BODY when the harvest does not exist', async () => {
      const res = await addCrop(farmA, GHOST, 'Soja');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Safra não encontrada.');
    });

    it('creates no partial record on either failure', async () => {
      await addCrop(GHOST, h2021, 'Soja').expect(404);
      await addCrop(farmA, GHOST, 'Soja').expect(404);
      expect(await ctx.prisma.crop.count()).toBe(0);
    });

    it('rejects a malformed harvestId as invalid input', async () => {
      await addCrop(farmA, 'not-a-uuid', 'Soja').expect(400);
    });
  });

  // ---- spec US2 §7, FR-019 ----------------------------------------------------------------

  describe('reading crops back', () => {
    beforeEach(async () => {
      await addCrop(farmA, h2021, 'Soja').expect(201);
      await addCrop(farmA, h2021, 'Milho').expect(201);
      await addCrop(farmA, h2022, 'Soja').expect(201);
    });

    it('groups a property’s crops by harvest year on the producer detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/producers/${producerId}`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      const farm = res.body.properties.find((p: { id: string }) => p.id === farmA);
      expect(farm.harvests.map((h: { year: number }) => h.year)).toEqual([2021, 2022]);
      expect(farm.harvests[0].crops.map((c: { name: string }) => c.name)).toEqual(['Soja', 'Milho']);
      expect(farm.harvests[1].crops.map((c: { name: string }) => c.name)).toEqual(['Soja']);
    });

    it('returns an empty list for a property with no crops', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/producers/${producerId}`)
        .set('Authorization', auth);

      const farm = res.body.properties.find((p: { id: string }) => p.id === farmB);
      expect(farm.harvests).toEqual([]);
    });

    it('lists a property’s crops grouped by harvest', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/properties/${farmA}/crops`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.map((h: { year: number }) => h.year)).toEqual([2021, 2022]);
    });

    it('lists a harvest’s crops across every farm, each naming its property', async () => {
      await addCrop(farmB, h2021, 'Soja').expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/harvests/${h2021}/crops`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(new Set(res.body.map((c: { propertyId: string }) => c.propertyId))).toEqual(
        new Set([farmA, farmB]),
      );
    });
  });

  // ---- FR-017: the ownership asymmetry ----------------------------------------------------

  describe('ownership', () => {
    beforeEach(async () => {
      await addCrop(farmA, h2021, 'Soja').expect(201);
      await addCrop(farmB, h2021, 'Milho').expect(201);
    });

    it('deleting a property removes its crops and leaves every harvest standing', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/properties/${farmA}`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      // The report no longer carries a harvest count (research.md R-008).
      expect(res.body.deleted).toEqual({ properties: 1, crops: 1 });
      expect(Object.keys(res.body.deleted)).not.toContain('harvests');

      expect(await ctx.prisma.harvest.count()).toBe(2);
      expect(await ctx.prisma.crop.count()).toBe(1);
    });

    it('deleting a producer removes properties and crops, and leaves harvests standing', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/producers/${producerId}`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toEqual({ producers: 1, properties: 2, crops: 2 });
      expect(Object.keys(res.body.deleted)).not.toContain('harvests');

      expect(await ctx.prisma.harvest.count()).toBe(2);
      expect(await ctx.prisma.crop.count()).toBe(0);
    });

    it('deletes a single crop', async () => {
      const crops = await request(app.getHttpServer())
        .get(`/api/harvests/${h2021}/crops`)
        .set('Authorization', auth);

      const res = await request(app.getHttpServer())
        .delete(`/api/crops/${crops.body[0].id}`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toEqual({ crops: 1 });
      expect(await ctx.prisma.crop.count()).toBe(1);
    });
  });
});
