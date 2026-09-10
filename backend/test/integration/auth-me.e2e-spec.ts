import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

describe('GET /api/auth/me (US3)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let token: string;
  let userId: string;

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
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(account);
    token = login.body.accessToken;
    userId = login.body.user.id;
  });

  // spec US3 §1 and §4
  it('returns the caller account and no password material', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe(account.email);
    // Exact key set: a column added later fails here rather than leaking (FR-019).
    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'email', 'id']);
  });

  // spec US3 §2
  it('refuses a call with no credential', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  // spec US3 §3
  it('refuses a tampered token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}x`)
      .expect(401);
  });

  it('refuses a token signed with a different secret', async () => {
    const foreign = new JwtService({ secret: 'a-completely-different-secret-value-32ch' });
    const forged = foreign.sign({ sub: userId, email: account.email, jti: 'x' });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });

  // spec US3 §3 (expiry half) — FR-018
  it('refuses an expired token', async () => {
    const jwt = ctx.moduleRef.get(JwtService);
    const expired = jwt.sign({ sub: userId, email: account.email, jti: 'x' }, { expiresIn: '-1s' });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });
});
