import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';
import { WORKED_EXAMPLE, seedWorkedExample } from '../support/dashboard-fixtures';

describe('Dashboard (US1–US4)', () => {
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

  const get = () =>
    request(app.getHttpServer()).get('/api/dashboard').set('Authorization', auth);

  const D = (v: string) => new Prisma.Decimal(v);

  // =====================================================================================
  // US1 — headline totals
  // =====================================================================================

  describe('US1 — headline totals', () => {
    it('refuses the request without a token (FR-001)', async () => {
      await request(app.getHttpServer()).get('/api/dashboard').expect(401);
    });

    /**
     * The check that catches the most likely first-day failure. Prisma's _sum returns null - not
     * zero - on an empty table, so reading it directly and formatting it throws and the very first
     * request against a fresh installation returns 500 (research.md R-002).
     */
    it('returns zeroes and empty breakdowns on an empty registry (spec US1 §2, SC-004)', async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body.totals).toEqual({ farms: 0, hectares: '0.00' });
      expect(res.body.byState.categories).toEqual([]);
      expect(res.body.byCrop.categories).toEqual([]);
      expect(res.body.byLandUse.categories).toEqual([]);
    });

    it('still reports zeroes when producers exist but own no property (spec US1 §3)', async () => {
      await ctx.prisma.producer.create({
        data: { document: '52998224725', documentType: 'CPF', name: 'Sem Fazenda', nameSearch: 'sem fazenda' },
      });

      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body.totals).toEqual({ farms: 0, hectares: '0.00' });
    });

    it('reports the farm count and hectare total (spec US1 §1)', async () => {
      await seedWorkedExample(ctx.prisma);

      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body.totals.farms).toBe(WORKED_EXAMPLE.expected.farms);
      expect(res.body.totals.hectares).toBe(WORKED_EXAMPLE.expected.hectares);
    });

    /**
     * 1000.11 + 200 + 500.36 + 25. Summed as JavaScript numbers this produces a value that does
     * not serialise as "1725.47" - which is the whole reason areas are Decimal end to end.
     */
    it('sums decimals exactly (spec US1 §4, SC-005)', async () => {
      await seedWorkedExample(ctx.prisma);

      const res = await get();
      expect(res.body.totals.hectares).toBe('1725.47');
      expect(res.body.totals.hectares).not.toMatch(/00000|99999/);
      expect(typeof res.body.totals.hectares).toBe('string');
    });

    it('drops immediately when a property is deleted (spec US1 §5, FR-004)', async () => {
      const { propertyIds } = await seedWorkedExample(ctx.prisma);
      await ctx.prisma.property.delete({ where: { id: propertyIds[0] } });

      const res = await get();
      expect(res.body.totals.farms).toBe(3);
      expect(res.body.totals.hectares).toBe('725.36'); // 1725.47 − 1000.11
    });
  });

  // =====================================================================================
  // US2 — by state
  // =====================================================================================

  describe('US2 — by state', () => {
    beforeEach(() => seedWorkedExample(ctx.prisma));

    it('reports hectares per federative unit, largest first (spec US2 §1)', async () => {
      const res = await get();

      expect(res.body.byState.unit).toBe('hectares');
      expect(res.body.byState.categories).toEqual([
        { key: 'MG', label: 'MG', value: '1200.11' },
        { key: 'SP', label: 'SP', value: '500.36' },
        { key: 'BA', label: 'BA', value: '25.00' },
      ]);
    });

    it('omits the 24 units with no properties (spec US2 §2, FR-022)', async () => {
      const res = await get();
      expect(res.body.byState.categories).toHaveLength(3);
    });

    /** FR-011: compared in Decimal, since parsing to floats would reintroduce the drift. */
    it('reconciles exactly with the hectare total (spec US2 §5, SC-003)', async () => {
      const res = await get();

      const slices = res.body.byState.categories.reduce(
        (acc: Prisma.Decimal, c: { value: string }) => acc.plus(D(c.value)),
        D('0'),
      );
      expect(slices.toFixed(2)).toBe(res.body.totals.hectares);
    });

    it('groups states differing only in casing or padding into one category (spec US2 §4)', async () => {
      // Written directly to the table: the API would reject these, and FR-010 requires the
      // breakdown to stay correct if data ever arrives another way.
      const producer = await ctx.prisma.producer.findFirstOrThrow();
      await ctx.prisma.$executeRawUnsafe(
        `INSERT INTO properties (id, producer_id, farm_name, city, state, total_area, arable_area, vegetation_area, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'E', 'C', 'mg', 10, 0, 0, now(), now())`,
        producer.id,
      );

      const res = await get();
      const mg = res.body.byState.categories.filter((c: { key: string }) => c.key === 'MG');
      expect(mg).toHaveLength(1);
      expect(mg[0].value).toBe('1210.11');
    });
  });

  // =====================================================================================
  // US4 — by land use
  // =====================================================================================

  describe('US4 — by land use', () => {
    it('reports arable, vegetation and the remainder (spec US4 §1, §3)', async () => {
      await seedWorkedExample(ctx.prisma);

      const res = await get();
      expect(res.body.byLandUse.unit).toBe('hectares');
      expect(res.body.byLandUse.categories).toEqual([
        { key: 'arable', label: 'Área agricultável', value: '1200.36' },
        { key: 'vegetation', label: 'Vegetação', value: '350.00' },
        { key: 'unclassified', label: 'Área não classificada', value: '175.11' },
      ]);
    });

    it('reconciles exactly with the hectare total (SC-003)', async () => {
      await seedWorkedExample(ctx.prisma);

      const res = await get();
      const slices = res.body.byLandUse.categories.reduce(
        (acc: Prisma.Decimal, c: { value: string }) => acc.plus(D(c.value)),
        D('0'),
      );
      expect(slices.toFixed(2)).toBe(res.body.totals.hectares);
    });

    /** FR-022 / SC-011 — the user's own refinement: no empty slice when the land is fully classified. */
    it('omits unclassified entirely when every property classifies its land (spec US4 §2)', async () => {
      const producer = await ctx.prisma.producer.create({
        data: { document: '52998224725', documentType: 'CPF', name: 'X', nameSearch: 'x' },
      });
      await ctx.prisma.property.create({
        data: {
          producerId: producer.id,
          farmName: 'Full',
          city: 'C',
          state: 'MG',
          totalArea: D('100.00'),
          arableArea: D('60.00'),
          vegetationArea: D('40.00'),
        },
      });

      const res = await get();
      expect(res.body.byLandUse.categories.map((c: { key: string }) => c.key)).toEqual([
        'arable',
        'vegetation',
      ]);
    });

    it('leaves a single category when vegetation is zero too', async () => {
      const producer = await ctx.prisma.producer.create({
        data: { document: '52998224725', documentType: 'CPF', name: 'X', nameSearch: 'x' },
      });
      await ctx.prisma.property.create({
        data: {
          producerId: producer.id,
          farmName: 'AllArable',
          city: 'C',
          state: 'SP',
          totalArea: D('100.00'),
          arableArea: D('100.00'),
          vegetationArea: D('0.00'),
        },
      });

      const res = await get();
      expect(res.body.byLandUse.categories.map((c: { key: string }) => c.key)).toEqual(['arable']);
    });

    it('puts the whole area under unclassified when nothing is classified (spec US4 §5)', async () => {
      const producer = await ctx.prisma.producer.create({
        data: { document: '52998224725', documentType: 'CPF', name: 'X', nameSearch: 'x' },
      });
      await ctx.prisma.property.create({
        data: {
          producerId: producer.id,
          farmName: 'Unused',
          city: 'C',
          state: 'BA',
          totalArea: D('80.00'),
          arableArea: D('0.00'),
          vegetationArea: D('0.00'),
        },
      });

      const res = await get();
      expect(res.body.byLandUse.categories).toEqual([
        { key: 'unclassified', label: 'Área não classificada', value: '80.00' },
      ]);
      expect(res.body.totals.hectares).toBe('80.00');
    });
  });

  // =====================================================================================
  // Cross-cutting
  // =====================================================================================

  it('returns identical results for two consecutive requests (SC-007)', async () => {
    await seedWorkedExample(ctx.prisma);

    const [first, second] = await Promise.all([get(), get()]);
    expect(first.body).toEqual(second.body);
  });

  it('never returns a category whose value is zero (FR-022, SC-011)', async () => {
    await seedWorkedExample(ctx.prisma);

    const res = await get();
    for (const breakdown of ['byState', 'byCrop', 'byLandUse'] as const) {
      for (const category of res.body[breakdown].categories) {
        const value = typeof category.value === 'string' ? Number(category.value) : category.value;
        expect(value).not.toBe(0);
      }
    }
  });
});
