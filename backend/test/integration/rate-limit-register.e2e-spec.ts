import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

/**
 * The register-only limit (5/min per origin), stricter than the global 20/min.
 *
 * Registration answers 409 for an address that already exists, which is an account-existence
 * oracle costing one request per address - cheaper than login, where enumeration was deliberately
 * closed off. This limit does not remove the oracle; it makes farming it four times more
 * expensive, and nobody legitimate creates accounts in series.
 */
describe('Register-specific rate limit (FR-021a)', () => {
  let ctx: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => ctx.prisma.reset());

  const attempt = (i: number) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `novo${i}@agrohub.com.br`, password: 'SenhaSegura1' });

  it('allows 5 registrations per minute then refuses with 429', async () => {
    const statuses: number[] = [];
    for (let i = 1; i <= 8; i += 1) {
      statuses.push((await attempt(i)).status);
    }

    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses.slice(5)).toEqual([429, 429, 429]);
  });

  it('bites well before the global 20/min limit, which is the whole point', async () => {
    const statuses: number[] = [];
    for (let i = 1; i <= 12; i += 1) {
      statuses.push((await attempt(i)).status);
    }

    // Under the global limit alone, all 12 would have succeeded.
    expect(statuses.filter((s) => s === 429).length).toBe(7);
  });

  it('answers a rate-limited registration exactly like any other limit', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await attempt(i);
    }
    const limited = await attempt(6);

    expect(limited.status).toBe(429);
    expect(limited.body.message).toBe('Muitas tentativas. Tente novamente em alguns minutos.');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('refuses a DUPLICATE-address probe once limited, so the oracle stops answering', async () => {
    const known = { email: 'conhecido@agrohub.com.br', password: 'SenhaSegura1' };
    await request(app.getHttpServer()).post('/api/auth/register').send(known).expect(201);

    // Burn the remaining allowance probing other addresses.
    for (let i = 1; i <= 4; i += 1) {
      await attempt(i);
    }

    // The 6th request would have returned 409 and confirmed the address is taken.
    const probe = await request(app.getHttpServer()).post('/api/auth/register').send(known);
    expect(probe.status).toBe(429);
    expect(probe.body.message).not.toContain('Já existe');
  });
});
