import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';

const CPF = '52998224725';
const CNPJ = '11222333000181';

/**
 * FR-027 / SC-009. The dashboard reports aggregates, and a producer document is personal data
 * under the LGPD - it has no business appearing in a panel payload that will end up cached in a
 * browser and pasted into support tickets.
 */
describe('Dashboard exposes no personal data (FR-027)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;

  beforeAll(async () => {
    ctx = await createDbTestApp();
    app = ctx.app;
    auth = await ctx.authHeader();
    await ctx.truncate();

    for (const [document, name] of [
      [CPF, 'José Antônio de Almeida'],
      [CNPJ, 'Agropecuária Boa Vista'],
    ]) {
      const producer = await ctx.prisma.producer.create({
        data: {
          document,
          documentType: document.length === 11 ? 'CPF' : 'CNPJ',
          name,
          nameSearch: name.toLowerCase(),
        },
      });
      await ctx.prisma.property.create({
        data: {
          producerId: producer.id,
          farmName: 'F',
          city: 'Uberaba',
          state: 'MG',
          totalArea: new Prisma.Decimal('100.00'),
          arableArea: new Prisma.Decimal('60.00'),
          vegetationArea: new Prisma.Decimal('30.00'),
        },
      });
    }
  });

  afterAll(async () => {
    await ctx.truncate();
    await app.close();
    await ctx.prisma.$disconnect();
  });

  it('returns no document, no producer name and no bare 11- or 14-digit run', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', auth)
      .expect(200);

    const body = JSON.stringify(res.body);

    // Sanity: the scan proves nothing if the dashboard returned an empty payload.
    expect(res.body.totals.farms).toBe(2);

    expect(body).not.toContain(CPF);
    expect(body).not.toContain(CNPJ);
    expect(body).not.toContain('529.982.247');
    expect(body).not.toContain('José Antônio');
    expect(body).not.toContain('document');
    expect(body).not.toMatch(/\b\d{11}\b/);
    expect(body).not.toMatch(/\b\d{14}\b/);
  });
});
