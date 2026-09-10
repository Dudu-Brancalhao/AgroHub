import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

describe('POST /api/auth/login (US2)', () => {
  let ctx: TestApp;
  let app: INestApplication;

  const account = { email: 'produtor@agrohub.com.br', password: 'SenhaSegura1' };

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

  // spec US2 §1
  it('issues a token with the documented shape', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send(account);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: expect.any(String),
        email: account.email,
        createdAt: expect.any(String),
      },
    });
    expect(res.body.accessToken.split('.')).toHaveLength(3);
  });

  // spec US2 §2 and §3 together — FR-009. The point is that the two bodies are IDENTICAL, so
  // the endpoint cannot be used to discover which addresses are registered.
  it('returns a byte-identical rejection for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: account.email, password: 'SenhaErrada1' });

    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'fantasma@agrohub.com.br', password: 'SenhaErrada1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe('E-mail ou senha inválidos.');
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error);

    // Everything except the per-request fields must match exactly.
    const strip = (b: Record<string, unknown>) => {
      const { timestamp: _t, requestId: _r, ...rest } = b;
      return rest;
    };
    expect(strip(unknownEmail.body)).toEqual(strip(wrongPassword.body));
  });

  // spec US2 4 - FR-012 still holds (validation runs before any lookup), but the REJECTION is
  // now deliberately opaque: a malformed login is indistinguishable from a failed one, so the
  // endpoint cannot be used to tell "your JSON was wrong" from "your credentials were wrong".
  it('rejects a missing password with the same generic 401 as a failed login', async () => {
    const malformed = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: account.email });

    const wrongCredentials = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: account.email, password: 'SenhaErrada1' });

    expect(malformed.status).toBe(401);
    expect(malformed.body.details).toBeUndefined();
    expect(malformed.body.message).toBe('E-mail ou senha inválidos.');

    const strip = (b: Record<string, unknown>) => {
      const { timestamp: _t, requestId: _r, ...rest } = b;
      return rest;
    };
    expect(strip(malformed.body)).toEqual(strip(wrongCredentials.body));
  });

  it('accepts a differently-cased email for an existing account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: '  PRODUTOR@AgroHub.COM.br ', password: account.password });

    expect(res.status).toBe(200);
  });

  it('never returns password material in the login response', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send(account);

    expect(Object.keys(res.body.user).sort()).toEqual(['createdAt', 'email', 'id']);
    expect(JSON.stringify(res.body)).not.toContain(account.password);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });
});
