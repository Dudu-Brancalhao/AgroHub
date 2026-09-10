import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';
import { FLOAT_DRIFT_CASES } from '../support/area-fixtures';

describe('Properties (US2, US5)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;
  let producerId: string;

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
    const producer = await request(app.getHttpServer())
      .post('/api/producers')
      .set('Authorization', auth)
      .send({ document: '529.982.247-25', name: 'José Antônio' })
      .expect(201);
    producerId = producer.body.id;
  });

  const base = { farmName: 'Fazenda Santa Helena', city: 'Uberaba', state: 'MG' };

  const addProperty = (body: Record<string, unknown>, id = producerId) =>
    request(app.getHttpServer())
      .post(`/api/producers/${id}/properties`)
      .set('Authorization', auth)
      .send(body);

  it('creates a property with consistent areas (spec US2 §1)', async () => {
    const res = await addProperty({ ...base, totalArea: 100, arableArea: 60, vegetationArea: 30 });

    expect(res.status).toBe(201);
    expect(res.body.producerId).toBe(producerId);
    // Areas come back as strings so a client cannot reintroduce the drift by parsing them.
    expect(res.body.totalArea).toBe('100.00');
    expect(res.body.arableArea).toBe('60.00');
    expect(typeof res.body.totalArea).toBe('string');
  });

  it('rejects parts that exceed the total (spec US2 §2)', async () => {
    const res = await addProperty({ ...base, totalArea: 100, arableArea: 70, vegetationArea: 40 });

    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toMatch(/não pode ultrapassar a área total/);
    expect(await ctx.prisma.property.count()).toBe(0);
  });

  it('accepts parts that exactly consume the total (spec US2 §3)', async () => {
    const res = await addProperty({ ...base, totalArea: 100, arableArea: 60, vegetationArea: 40 });
    expect(res.status).toBe(201);
  });

  /**
   * The case a naive implementation gets wrong. Each of these is a valid farm that
   * `arable + vegetation <= total` in JavaScript rejects, because the addition drifts above the
   * total by ~1e-13 (research.md R-001).
   */
  it.each(FLOAT_DRIFT_CASES)(
    'accepts total=$total arable=$arable vegetation=$vegetation despite float drift',
    async (c) => {
      expect(c.arable + c.vegetation > c.total).toBe(true);

      const res = await addProperty({
        ...base,
        totalArea: c.total,
        arableArea: c.arable,
        vegetationArea: c.vegetation,
      });

      expect(res.status).toBe(201);
      expect(res.body.totalArea).toBe(c.total.toFixed(2));
    },
  );

  it('accepts zero arable and zero vegetation as unused land (FR-015)', async () => {
    const res = await addProperty({ ...base, totalArea: 100, arableArea: 0, vegetationArea: 0 });
    expect(res.status).toBe(201);
  });

  it('rejects negative areas and an invalid state together (spec US2 §4, §7)', async () => {
    const res = await addProperty({
      ...base,
      state: 'XX',
      totalArea: 100,
      arableArea: -5,
      vegetationArea: 0,
    });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['state', 'arableArea']));
  });

  it('rejects a total area of zero (FR-015)', async () => {
    const res = await addProperty({ ...base, totalArea: 0, arableArea: 0, vegetationArea: 0 });
    expect(res.status).toBe(400);
  });

  // FR-018: the parent is addressed by the URL, so its absence is a missing resource.
  it('returns 404 for a property under a non-existent producer (spec US2 §6)', async () => {
    const res = await addProperty(
      { ...base, totalArea: 100, arableArea: 10, vegetationArea: 10 },
      '00000000-0000-0000-0000-000000000000',
    );

    expect(res.status).toBe(404);
    expect(await ctx.prisma.property.count()).toBe(0);
  });

  it('returns an empty list for a producer with no properties (spec US2 §5)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/producers/${producerId}/properties`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns an empty properties array on the producer detail (FR-011)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/producers/${producerId}`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.properties).toEqual([]);
  });

  describe('updates (US5 §3)', () => {
    let propertyId: string;

    beforeEach(async () => {
      const created = await addProperty({
        ...base,
        totalArea: 100,
        arableArea: 60,
        vegetationArea: 30,
      }).expect(201);
      propertyId = created.body.id;
    });

    const patch = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .patch(`/api/properties/${propertyId}`)
        .set('Authorization', auth)
        .send(body);

    /**
     * The most likely way FR-013 gets bypassed after it is implemented.
     *
     * `{"totalArea": 80}` is a perfectly valid number on its own. Only the stored 60 + 30 reveals
     * that it breaks the invariant, so the rule must run against the MERGED record
     * (research.md R-009).
     */
    it('refuses a partial update that breaks the rule against the stored row', async () => {
      const res = await patch({ totalArea: 80 });

      expect(res.status).toBe(400);
      expect(res.body.details[0].field).toBe('totalArea');

      const stored = await ctx.prisma.property.findUnique({ where: { id: propertyId } });
      expect(stored?.totalArea.toFixed(2)).toBe('100.00');
    });

    it('accepts a partial update that still satisfies the rule', async () => {
      const res = await patch({ totalArea: 90 });
      expect(res.status).toBe(200);
      expect(res.body.totalArea).toBe('90.00');
    });

    it('refuses raising a part beyond what the stored total allows', async () => {
      const res = await patch({ arableArea: 80 });
      expect(res.status).toBe(400);
      expect(res.body.details[0].field).toBe('arableArea');
    });

    it('accepts lowering a part', async () => {
      const res = await patch({ arableArea: 10 });
      expect(res.status).toBe(200);
      expect(res.body.arableArea).toBe('10.00');
    });

    it('updates non-area fields without touching the areas', async () => {
      const res = await patch({ farmName: 'Fazenda Nova', city: 'Araxá', state: 'sp' });
      expect(res.status).toBe(200);
      expect(res.body.farmName).toBe('Fazenda Nova');
      expect(res.body.state).toBe('SP');
      expect(res.body.totalArea).toBe('100.00');
    });

    it('returns 404 for an unknown property', async () => {
      await request(app.getHttpServer())
        .patch('/api/properties/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth)
        .send({ farmName: 'X' })
        .expect(404);
    });
  });
});
