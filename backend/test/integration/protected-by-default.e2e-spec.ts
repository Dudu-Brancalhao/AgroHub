import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';
import { ScratchModule } from '../support/scratch.module';

describe('Default-deny posture (US3, Constitution V)', () => {
  let ctx: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await createTestApp([ScratchModule]);
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses an undecorated route with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/scratch');
    expect(res.status).toBe(401);
    expect(res.body.reached).toBeUndefined();
  });

  it('allows a route that explicitly opted out with @Public()', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
