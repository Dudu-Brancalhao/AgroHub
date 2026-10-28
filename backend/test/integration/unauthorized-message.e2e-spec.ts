import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';
import { ScratchModule } from '../support/scratch.module';

/**
 * Every rejection from the global guard must speak pt-BR and say the same thing.
 *
 * Two requirements meet here. Constitution VIII puts caller-facing text in pt-BR, and Passport's
 * default is the English "Unauthorized". And the message must not vary by reason: telling a
 * caller whether their token was missing, malformed, wrongly signed or merely expired tells an
 * attacker which part of a forged credential to fix next.
 */
describe('Unauthorized responses (Constitution VIII)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let validToken: string;

  const account = { email: 'operador@agrohub.com.br', password: 'SenhaSegura1' };

  beforeAll(async () => {
    ctx = await createTestApp([ScratchModule]);
    app = ctx.app;
    await request(app.getHttpServer()).post('/api/auth/register').send(account).expect(201);
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(account);
    validToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (header?: string) => {
    const req = request(app.getHttpServer()).get('/api/scratch');
    return header ? req.set('Authorization', header) : req;
  };

  it('never returns the English default', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Autenticação necessária.');
    expect(res.body.message).not.toBe('Unauthorized');
  });

  it('answers identically whatever the reason', async () => {
    const expired = ctx.moduleRef
      .get(JwtService)
      .sign({ sub: 'x', email: 'a@b.com', jti: 'x' }, { expiresIn: '-1s' });

    const headers = [
      undefined,
      'Bearer ',
      `Bearer ${validToken}x`,
      validToken,
      `Bearer ${expired}`,
      'Bearer not.a.token',
    ];

    // Sequential on purpose: concurrent supertest calls on an unlistened server each bind
    // their own ephemeral port, which intermittently fails with ECONNRESET on CI.
    for (const header of headers) {
      const res = await call(header);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Autenticação necessária.');
      expect(res.body.details).toBeUndefined();
    }
  });

  it('still lets a valid token through', async () => {
    const res = await call(`Bearer ${validToken}`);
    expect(res.status).toBe(200);
  });

  // Passport accepts the scheme case-insensitively; worth pinning so nobody "fixes" it later.
  it('accepts a lowercase bearer scheme', async () => {
    const res = await call(`bearer ${validToken}`);
    expect(res.status).toBe(200);
  });
});
