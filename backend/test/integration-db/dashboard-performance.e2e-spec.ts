import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';
import { seedAtScale } from '../support/dashboard-fixtures';

/**
 * SC-002: under 2 seconds at 10,000 properties, 50,000 harvests and 150,000 crops.
 *
 * Measured at roughly 35 ms during planning (research.md R-004), so the assertion is deliberately
 * generous: it exists to catch a structural regression - an accidental N+1, a lost aggregate, a
 * per-row query - rather than to police how fast the CI machine happens to be.
 */
describe('Dashboard performance at scale (SC-002)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;

  jest.setTimeout(300_000);

  beforeAll(async () => {
    ctx = await createDbTestApp();
    app = ctx.app;
    auth = await ctx.authHeader();
    await ctx.truncate();
    await seedAtScale(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.truncate();
    await app.close();
    await ctx.prisma.$disconnect();
  });

  it('returns within the 2-second budget', async () => {
    const counts = {
      properties: await ctx.prisma.property.count(),
      harvests: await ctx.prisma.harvest.count(),
      crops: await ctx.prisma.crop.count(),
    };
    expect(counts.properties).toBe(10_000);
    expect(counts.crops).toBeGreaterThan(100_000);

    const elapsed: number[] = [];
    for (let run = 0; run < 3; run += 1) {
      const started = Date.now();
      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', auth)
        .expect(200);
      elapsed.push(Date.now() - started);
      expect(res.body.totals.farms).toBe(10_000);
    }

    // eslint-disable-next-line no-console
    console.log(
      `    dashboard at ${counts.properties} properties / ${counts.harvests} harvests / ` +
        `${counts.crops} crops -> ${elapsed.join('ms, ')}ms`,
    );

    expect(Math.min(...elapsed)).toBeLessThan(2000);
  });

  it('still reconciles at scale (SC-003)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', auth)
      .expect(200);

    const sum = (cats: Array<{ value: string }>) =>
      cats.reduce((a, c) => a + Number(c.value), 0).toFixed(2);

    expect(sum(res.body.byState.categories)).toBe(Number(res.body.totals.hectares).toFixed(2));
    expect(sum(res.body.byLandUse.categories)).toBe(Number(res.body.totals.hectares).toFixed(2));
    expect(res.body.byState.categories).toHaveLength(27);
  });
});
