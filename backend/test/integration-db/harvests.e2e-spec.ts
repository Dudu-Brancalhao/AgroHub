import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';

describe('Harvests — shared seasons (US1)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;

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

  beforeEach(() => ctx.truncate());

  const create = (year: unknown) =>
    request(app.getHttpServer()).post('/api/harvests').set('Authorization', auth).send({ year });

  const list = () => request(app.getHttpServer()).get('/api/harvests').set('Authorization', auth);

  // ---- FR-027 -----------------------------------------------------------------------------

  it('refuses every harvest route without a token', async () => {
    await request(app.getHttpServer()).get('/api/harvests').expect(401);
    await request(app.getHttpServer()).post('/api/harvests').send({ year: 2021 }).expect(401);
  });

  // ---- spec US1 §1, §3 --------------------------------------------------------------------

  it('records a harvest once and lists it once', async () => {
    const res = await create(2021);

    expect(res.status).toBe(201);
    expect(res.body.year).toBe(2021);

    const listed = await list();
    expect(listed.body).toHaveLength(1);
  });

  /**
   * The absence is the feature. A harvest belongs to nobody, so there is no property on it — and
   * a response that carried one would mean the old shape survived somewhere.
   */
  it('returns no property field on a harvest (FR-001)', async () => {
    const res = await create(2021);

    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'id', 'updatedAt', 'year']);
    expect(JSON.stringify(res.body)).not.toContain('propertyId');
  });

  it('lists each harvest exactly once however many farms planted in it', async () => {
    const harvest = await create(2021).expect(201);

    // Two farms, both planting in the same shared season.
    const producer = await ctx.prisma.producer.create({
      data: { document: '52998224725', documentType: 'CPF', name: 'X', nameSearch: 'x' },
    });
    for (const farmName of ['A', 'B']) {
      const property = await ctx.prisma.property.create({
        data: {
          producerId: producer.id,
          farmName,
          city: 'C',
          state: 'MG',
          totalArea: new Prisma.Decimal('100.00'),
          arableArea: new Prisma.Decimal('60.00'),
          vegetationArea: new Prisma.Decimal('40.00'),
        },
      });
      await request(app.getHttpServer())
        .post(`/api/properties/${property.id}/crops`)
        .set('Authorization', auth)
        .send({ harvestId: harvest.body.id, name: 'Soja' })
        .expect(201);
    }

    const listed = await list();
    expect(listed.body).toHaveLength(1);
    expect(await ctx.prisma.harvest.count()).toBe(1);
  });

  // ---- spec US1 §2, FR-008 ----------------------------------------------------------------

  it('refuses a second harvest for the same year', async () => {
    await create(2021).expect(201);

    const res = await create(2021);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Já existe uma safra cadastrada para o ano 2021.');
    expect(await ctx.prisma.harvest.count({ where: { year: 2021 } })).toBe(1);
  });

  /**
   * The accepted loss. The old model allowed one property to hold two harvests in the same year,
   * because safra and safrinha — a main crop and a second planting — are both real in Brazil.
   * A globally unique year removes that (research.md R-011). This test inverts the one that
   * previously asserted the opposite, and is here so the removal stays deliberate.
   */
  it('no longer allows safra and safrinha in one calendar year', async () => {
    await create(2021).expect(201);
    await create(2021).expect(409);
  });

  // ---- spec US1 §5, FR-007: unchanged, therefore a regression check ------------------------

  it('applies the same year bounds as before', async () => {
    const nextYear = new Date().getFullYear() + 1;

    await create(1899).expect(400);
    await create(1900).expect(201);
    await create(nextYear).expect(201);
    await create(nextYear + 1).expect(400);
  });

  /**
   * A numeric string is coerced, deliberately: the DTO carries @Type(() => Number) from feature
   * 002 and that behaviour is unchanged here, so the rejected string case is a non-numeric one.
   */
  it.each([[1.5], ['2021abc'], [null], [undefined]])('rejects %p as a year', async (year) => {
    await create(year).expect(400);
  });

  it('coerces a numeric string, as it always has', async () => {
    const res = await create('2021').expect(201);
    expect(res.body.year).toBe(2021);
  });

  // ---- spec US1 §4, FR-009 ----------------------------------------------------------------

  describe('correcting a harvest', () => {
    it('is visible to every property planted in it, touching no property record', async () => {
      const harvest = await create(2021).expect(201);
      const producer = await ctx.prisma.producer.create({
        data: { document: '52998224725', documentType: 'CPF', name: 'X', nameSearch: 'x' },
      });
      const property = await ctx.prisma.property.create({
        data: {
          producerId: producer.id,
          farmName: 'A',
          city: 'C',
          state: 'MG',
          totalArea: new Prisma.Decimal('100.00'),
          arableArea: new Prisma.Decimal('60.00'),
          vegetationArea: new Prisma.Decimal('40.00'),
        },
      });
      await request(app.getHttpServer())
        .post(`/api/properties/${property.id}/crops`)
        .set('Authorization', auth)
        .send({ harvestId: harvest.body.id, name: 'Soja' })
        .expect(201);

      const before = await ctx.prisma.property.findUniqueOrThrow({ where: { id: property.id } });

      await request(app.getHttpServer())
        .patch(`/api/harvests/${harvest.body.id}`)
        .set('Authorization', auth)
        .send({ year: 2020 })
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`/api/producers/${producer.id}`)
        .set('Authorization', auth);
      expect(detail.body.properties[0].harvests[0].year).toBe(2020);

      const after = await ctx.prisma.property.findUniqueOrThrow({ where: { id: property.id } });
      expect(after.updatedAt).toEqual(before.updatedAt);
    });

    it('refuses a correction onto a year that already exists', async () => {
      await create(2021).expect(201);
      const other = await create(2022).expect(201);

      await request(app.getHttpServer())
        .patch(`/api/harvests/${other.body.id}`)
        .set('Authorization', auth)
        .send({ year: 2021 })
        .expect(409);
    });

    it('returns 404 for an unknown harvest', async () => {
      await request(app.getHttpServer())
        .patch('/api/harvests/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth)
        .send({ year: 2021 })
        .expect(404);
    });
  });

  // ---- FR-010, FR-011 ---------------------------------------------------------------------

  describe('deleting a harvest', () => {
    async function seedCrops(harvestId: string, count: number) {
      const producer = await ctx.prisma.producer.create({
        data: { document: '52998224725', documentType: 'CPF', name: 'X', nameSearch: 'x' },
      });
      for (let i = 0; i < count; i += 1) {
        const property = await ctx.prisma.property.create({
          data: {
            producerId: producer.id,
            farmName: `F${i}`,
            city: 'C',
            state: 'MG',
            totalArea: new Prisma.Decimal('100.00'),
            arableArea: new Prisma.Decimal('60.00'),
            vegetationArea: new Prisma.Decimal('40.00'),
          },
        });
        await request(app.getHttpServer())
          .post(`/api/properties/${property.id}/crops`)
          .set('Authorization', auth)
          .send({ harvestId, name: 'Soja' })
          .expect(201);
      }
    }

    /**
     * The most consequential rule in the feature. A harvest is shared, so cascading here would let
     * one request erase a year across every farm in the registry. A 200 means the relation is
     * still cascading (research.md R-005).
     */
    it('refuses while crops reference it, and says how many', async () => {
      const harvest = await create(2021).expect(201);
      await seedCrops(harvest.body.id, 3);

      const res = await request(app.getHttpServer())
        .delete(`/api/harvests/${harvest.body.id}`)
        .set('Authorization', auth);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Não é possível excluir esta safra: existem 3 culturas registradas nela.',
      );

      expect(await ctx.prisma.harvest.count()).toBe(1);
      expect(await ctx.prisma.crop.count()).toBe(3);
    });

    it('says "existe 1 cultura registrada" for a single blocker, not "existem 1 culturas"', async () => {
      const harvest = await create(2021).expect(201);
      await seedCrops(harvest.body.id, 1);

      const res = await request(app.getHttpServer())
        .delete(`/api/harvests/${harvest.body.id}`)
        .set('Authorization', auth);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Não é possível excluir esta safra: existe 1 cultura registrada nela.',
      );
    });

    it('removes a harvest that no crop references', async () => {
      const harvest = await create(1999).expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/api/harvests/${harvest.body.id}`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toEqual({ harvests: 1 });
      expect(await ctx.prisma.harvest.count()).toBe(0);
    });

    it('allows the delete once the blocking crops are gone', async () => {
      const harvest = await create(2021).expect(201);
      await seedCrops(harvest.body.id, 1);

      await request(app.getHttpServer())
        .delete(`/api/harvests/${harvest.body.id}`)
        .set('Authorization', auth)
        .expect(409);

      await ctx.prisma.crop.deleteMany({ where: { harvestId: harvest.body.id } });

      await request(app.getHttpServer())
        .delete(`/api/harvests/${harvest.body.id}`)
        .set('Authorization', auth)
        .expect(200);
    });

    it('returns 404 for an unknown harvest', async () => {
      await request(app.getHttpServer())
        .delete('/api/harvests/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth)
        .expect(404);
    });
  });
});
