import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

describe('Failure counter resets on success (US4 §4, FR-022)', () => {
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

  it('clears the count so a later run of failures starts from zero', async () => {
    for (let i = 1; i <= 4; i += 1) {
      await request(app.getHttpServer()).post('/api/auth/login').send(wrong).expect(401);
    }

    await request(app.getHttpServer()).post('/api/auth/login').send(account).expect(200);

    // Without the reset these would be cumulative attempts 5-8, and the second of them would be
    // a 429. All four staying 401 is what proves the counter was cleared.
    for (let i = 1; i <= 4; i += 1) {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send(wrong);
      expect(res.status).toBe(401);
    }
  });
});
