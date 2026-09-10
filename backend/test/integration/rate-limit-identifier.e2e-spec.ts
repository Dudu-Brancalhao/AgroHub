import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

describe('Per-identifier failed-attempt limit (US4, FR-020/FR-023)', () => {
  let ctx: TestApp;
  let app: INestApplication;

  const account = { email: 'produtor@agrohub.com.br', password: 'SenhaSegura1' };
  const wrong = { email: account.email, password: 'SenhaErrada1' };

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    ctx.prisma.reset();
    await request(app.getHttpServer()).post('/api/auth/register').send(account).expect(201);
  });

  // spec US4 §1
  it('allows 5 failures then refuses with 429 and a Retry-After', async () => {
    for (let i = 1; i <= 5; i += 1) {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send(wrong);
      expect(res.status).toBe(401);
    }

    const limited = await request(app.getHttpServer()).post('/api/auth/login').send(wrong);

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.body.message).toBe('Muitas tentativas. Tente novamente em alguns minutos.');
  });

  // FR-023 — the requirement most easily undone by "helpfully" checking the password first.
  it('still refuses the CORRECT password while limited', async () => {
    for (let i = 1; i <= 6; i += 1) {
      await request(app.getHttpServer()).post('/api/auth/login').send(wrong);
    }

    const res = await request(app.getHttpServer()).post('/api/auth/login').send(account);

    // A 200 here would confirm to an attacker that the password was right — which is the entire
    // point of FR-023. It holds only because the limit is checked BEFORE the comparison.
    expect(res.status).toBe(429);
    expect(res.body.message).not.toContain('inválidos');
  });

  it('does not leak whether the account exists when limiting an unknown email', async () => {
    const ghost = { email: 'fantasma@agrohub.com.br', password: 'SenhaErrada1' };
    for (let i = 1; i <= 6; i += 1) {
      await request(app.getHttpServer()).post('/api/auth/login').send(ghost);
    }

    const res = await request(app.getHttpServer()).post('/api/auth/login').send(ghost);
    expect(res.status).toBe(429);
  });
});
