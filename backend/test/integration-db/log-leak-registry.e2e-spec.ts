import { INestApplication, Logger, LoggerService } from '@nestjs/common';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';

class CapturingLogger implements LoggerService {
  readonly lines: string[] = [];
  private capture(message: unknown, ...optional: unknown[]): void {
    this.lines.push(JSON.stringify({ message, optional }));
  }
  log = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  error = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  warn = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  debug = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  verbose = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
}

const CPF = '52998224725';
const CNPJ = '11222333000181';

/**
 * FR-038 / SC-009 as a permanent gate, for the registry specifically.
 *
 * The auth log-leak suite covers passwords and tokens; this one covers the personal data feature
 * 002 introduces. CPF and CNPJ are personal data under the LGPD, and a log aggregator is exactly
 * where they must not accumulate — so producers are referenced by internal id and never by
 * document (research.md R-012).
 */
describe('No document reaches the logs (FR-038)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  const logger = new CapturingLogger();
  let auth: string;

  beforeAll(async () => {
    Logger.overrideLogger(logger);
    ctx = await createDbTestApp(logger);
    app = ctx.app;
    auth = await ctx.authHeader();
    await ctx.truncate();
  });

  afterAll(async () => {
    await app.close();
    await ctx.prisma.$disconnect();
    Logger.overrideLogger(false);
  });

  it('exercises the whole registry and leaks no document', async () => {
    const http = () => request(app.getHttpServer());

    const producer = await http()
      .post('/api/producers')
      .set('Authorization', auth)
      .send({ document: '529.982.247-25', name: 'José Antônio de Almeida' })
      .expect(201);

    // Duplicate, so the conflict path logs too.
    await http()
      .post('/api/producers')
      .set('Authorization', auth)
      .send({ document: CPF, name: 'Outro' })
      .expect(409);

    // Invalid document, so the validation-failure path logs too.
    await http()
      .post('/api/producers')
      .set('Authorization', auth)
      .send({ document: '111.111.111-11', name: 'Invalido' })
      .expect(400);

    await http()
      .post('/api/producers')
      .set('Authorization', auth)
      .send({ document: '11.222.333/0001-81', name: 'Agropecuária Boa Vista' })
      .expect(201);

    const property = await http()
      .post(`/api/producers/${producer.body.id}/properties`)
      .set('Authorization', auth)
      .send({
        farmName: 'Fazenda Santa Helena',
        city: 'Uberaba',
        state: 'MG',
        totalArea: 100,
        arableArea: 60,
        vegetationArea: 30,
      })
      .expect(201);

    // Setup only: the harvest is created globally and the crop names both parents.
    const harvest = await http()
      .post('/api/harvests')
      .set('Authorization', auth)
      .send({ year: 2021 })
      .expect(201);

    await http()
      .post(`/api/properties/${property.body.id}/crops`)
      .set('Authorization', auth)
      .send({ harvestId: harvest.body.id, name: 'Soja' })
      .expect(201);

    await http()
      .patch(`/api/producers/${producer.body.id}`)
      .set('Authorization', auth)
      .send({ name: 'José A. de Almeida' })
      .expect(200);

    await http()
      .get(`/api/producers?search=${encodeURIComponent(CPF)}`)
      .set('Authorization', auth)
      .expect(200);

    await http()
      .delete(`/api/producers/${producer.body.id}`)
      .set('Authorization', auth)
      .expect(200);

    const captured = logger.lines.join('\n');

    // The scan proves nothing if nothing was logged.
    expect(captured.length).toBeGreaterThan(0);

    expect(captured).not.toContain(CPF);
    expect(captured).not.toContain('529.982.247');
    expect(captured).not.toContain(CNPJ);
    expect(captured).not.toContain('11.222.333');
    expect(captured).not.toMatch(/\b\d{11}\b/);
    expect(captured).not.toMatch(/\b\d{14}\b/);
  });

  it('still records the business events it must (FR-037)', () => {
    const captured = logger.lines.join('\n');

    expect(captured).toContain('producer.created');
    expect(captured).toContain('producer.updated');
    expect(captured).toContain('producer.deleted');
    expect(captured).toContain('property.created');
    expect(captured).toContain('harvest.created');
    expect(captured).toContain('crop.created');
  });

  it('references producers by internal id, which is what makes an event traceable', () => {
    const captured = logger.lines.join('\n');
    expect(captured).toContain('producerId');
    expect(captured).toContain('actorId');
  });

  it('records the cascade counts on a delete, so the blast radius is auditable', () => {
    const captured = logger.lines.join('\n');
    expect(captured).toContain('deleted with cascade');
  });
});
