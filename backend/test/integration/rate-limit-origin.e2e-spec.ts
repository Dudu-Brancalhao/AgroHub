import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

describe('Per-origin request limit (US4 §3, FR-021)', () => {
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

  it('throttles a flood across 25 DISTINCT emails', async () => {
    const statuses: number[] = [];

    for (let i = 1; i <= 25; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `user${i}@agrohub.com.br`, password: 'SenhaSegura1' });
      statuses.push(res.status);
    }

    // Every email is different, so the per-identifier limit never fires. If nothing throttles
    // here, rotating the identifier bypasses rate limiting entirely.
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses[24]).toBe(429);
  });
});
