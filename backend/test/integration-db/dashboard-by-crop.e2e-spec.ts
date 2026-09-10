import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';

describe('Dashboard — by crop (US3)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;
  let producerId: string;
  let propertyId: string;

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
    const property = await ctx.prisma.property.create({
      data: {
        producerId,
        farmName: 'A',
        city: 'Uberaba',
        state: 'MG',
        totalArea: new Prisma.Decimal('100.00'),
        arableArea: new Prisma.Decimal('60.00'),
        vegetationArea: new Prisma.Decimal('40.00'),
      },
    });
    propertyId = property.id;
  });

  const get = () => request(app.getHttpServer()).get('/api/dashboard').set('Authorization', auth);

  // Setup only. A harvest is created once for the whole registry and names no property; the crop
  // is what carries both ids. Not one assertion below changes, and that is the point: the crop
  // chart never read the harvest or the property, so reshaping them cannot move its numbers.
  const addHarvest = (year: number) =>
    request(app.getHttpServer())
      .post('/api/harvests')
      .set('Authorization', auth)
      .send({ year })
      .expect(201);

  const addCrop = (harvestId: string, name: string, propId = propertyId) =>
    request(app.getHttpServer())
      .post(`/api/properties/${propId}/crops`)
      .set('Authorization', auth)
      .send({ harvestId, name });

  const categories = async () => (await get()).body.byCrop.categories;

  it('returns an empty breakdown when no crop has been recorded (spec US3 §3)', async () => {
    const res = await get();
    expect(res.body.byCrop.unit).toBe('count');
    expect(res.body.byCrop.categories).toEqual([]);
  });

  it('counts two crops in one harvest as two categories (spec US3 §1, FR-014)', async () => {
    const h = await addHarvest(2021);
    await addCrop(h.body.id, 'Soja').expect(201);
    await addCrop(h.body.id, 'Milho').expect(201);

    expect(await categories()).toEqual([
      { key: 'milho', label: 'Milho', value: 1 },
      { key: 'soja', label: 'Soja', value: 1 },
    ]);
  });

  it('counts the same crop in two harvests twice (spec US3 §6, FR-017)', async () => {
    const h1 = await addHarvest(2021);
    const h2 = await addHarvest(2022);
    await addCrop(h1.body.id, 'Soja').expect(201);
    await addCrop(h2.body.id, 'Soja').expect(201);

    expect(await categories()).toEqual([{ key: 'soja', label: 'Soja', value: 2 }]);
  });

  it('collapses spelling variants into one category (spec US3 §4, FR-015)', async () => {
    const h1 = await addHarvest(2021);
    const h2 = await addHarvest(2022);
    const h3 = await addHarvest(2023);
    await addCrop(h1.body.id, 'Soja').expect(201);
    await addCrop(h2.body.id, 'soja').expect(201);
    await addCrop(h3.body.id, 'SOJA').expect(201);

    const result = await categories();
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('soja');
    expect(result[0].value).toBe(3);
  });

  /**
   * The label check. Prisma's _min: { name: true } would return "SOJA" here, because uppercase
   * sorts before lowercase in ASCII - surfacing the spelling used once out of three
   * (research.md R-003).
   */
  it('labels the category with the most-used spelling, not the first alphabetically', async () => {
    const h1 = await addHarvest(2021);
    const h2 = await addHarvest(2022);
    const h3 = await addHarvest(2023);
    await addCrop(h1.body.id, 'Soja').expect(201);
    await addCrop(h2.body.id, 'Soja').expect(201);
    await addCrop(h3.body.id, 'SOJA').expect(201);

    const result = await categories();
    expect(result[0].label).toBe('Soja');
    expect(result[0].label).not.toBe('SOJA');
  });

  it('keeps "Soja" and "Soya" as separate categories (spec US3 §5)', async () => {
    const h = await addHarvest(2021);
    await addCrop(h.body.id, 'Soja').expect(201);
    await addCrop(h.body.id, 'Soya').expect(201);

    expect((await categories()).map((c: { key: string }) => c.key).sort()).toEqual([
      'soja',
      'soya',
    ]);
  });

  it('groups accent variants under one category', async () => {
    const h1 = await addHarvest(2021);
    const h2 = await addHarvest(2022);
    await addCrop(h1.body.id, 'Café').expect(201);
    await addCrop(h2.body.id, 'Cafe').expect(201);

    const result = await categories();
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(2);
  });

  it('orders by count descending, ties by key (SC-007)', async () => {
    const h1 = await addHarvest(2021);
    const h2 = await addHarvest(2022);
    await addCrop(h1.body.id, 'Soja').expect(201);
    await addCrop(h2.body.id, 'Soja').expect(201);
    await addCrop(h1.body.id, 'Milho').expect(201);
    await addCrop(h1.body.id, 'Trigo').expect(201);

    expect((await categories()).map((c: { key: string }) => c.key)).toEqual([
      'soja',
      'milho',
      'trigo',
    ]);
  });

  /**
   * FR-013 — both halves asserted in one response, because the requirement is that they hold
   * simultaneously: the property counts fully in the totals AND contributes nothing to the crops.
   */
  it('counts a property with no crops in the totals but not the crop chart (spec US3 §2)', async () => {
    const h = await addHarvest(2021);
    await addCrop(h.body.id, 'Soja').expect(201);

    // A second property that has planted nothing.
    await ctx.prisma.property.create({
      data: {
        producerId,
        farmName: 'Sem safra',
        city: 'C',
        state: 'SP',
        totalArea: new Prisma.Decimal('400.00'),
        arableArea: new Prisma.Decimal('200.00'),
        vegetationArea: new Prisma.Decimal('100.00'),
      },
    });
    // A third, likewise. Under the shared model there is no longer a "has a harvest but no crop"
    // state to distinguish: what puts a farm on the crop chart is a crop, and nothing else.
    await ctx.prisma.property.create({
      data: {
        producerId,
        farmName: 'Safra vazia',
        city: 'C',
        state: 'BA',
        totalArea: new Prisma.Decimal('50.00'),
        arableArea: new Prisma.Decimal('0.00'),
        vegetationArea: new Prisma.Decimal('0.00'),
      },
    });

    const res = await get();
    expect(res.body.totals.farms).toBe(3);
    expect(res.body.totals.hectares).toBe('550.00');
    expect(res.body.byCrop.categories).toEqual([{ key: 'soja', label: 'Soja', value: 1 }]);
  });

  /**
   * FR-023 — the crop chart counts plantings, the farm count counts farms. They are deliberately
   * incomparable, and a future change that made them match would mean crop records were being
   * dropped.
   */
  it('deliberately does not reconcile with the farm count (spec US3 §7)', async () => {
    const h = await addHarvest(2021);
    for (const crop of ['Soja', 'Milho', 'Trigo', 'Arroz']) {
      await addCrop(h.body.id, crop).expect(201);
    }
    for (const [name, state] of [
      ['B', 'SP'],
      ['C', 'BA'],
    ]) {
      await ctx.prisma.property.create({
        data: {
          producerId,
          farmName: name,
          city: 'C',
          state,
          totalArea: new Prisma.Decimal('10.00'),
          arableArea: new Prisma.Decimal('0.00'),
          vegetationArea: new Prisma.Decimal('0.00'),
        },
      });
    }

    const res = await get();
    const cropTotal = res.body.byCrop.categories.reduce(
      (a: number, c: { value: number }) => a + c.value,
      0,
    );

    expect(res.body.totals.farms).toBe(3);
    expect(cropTotal).toBe(4);
    expect(cropTotal).not.toBe(res.body.totals.farms);
  });
});
