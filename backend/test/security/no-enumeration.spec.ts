import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

/**
 * Pins the property that answers "does a validation error reveal anything about the account?"
 *
 * Validation runs in the global ValidationPipe, BEFORE the controller is entered and therefore
 * before any repository lookup or password comparison. So a 400 must depend only on the shape of
 * the submitted JSON, never on server state.
 *
 * These tests would fail the moment someone adds a state-dependent validator - for example an
 * @IsEmailAvailable() decorator that queries the database from inside the pipe, which is exactly
 * the change that would silently turn login into an account-existence oracle.
 */
describe('Validation errors reveal nothing about stored accounts', () => {
  let ctx: TestApp;
  let app: INestApplication;

  const registered = { email: 'existente@agrohub.com.br', password: 'SenhaSegura1' };
  const unregistered = 'inexistente@agrohub.com.br';

  const strip = (body: Record<string, unknown>) => {
    const { timestamp: _t, requestId: _r, path: _p, ...rest } = body;
    return rest;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    ctx.prisma.reset();
    await request(app.getHttpServer()).post('/api/auth/register').send(registered).expect(201);
  });

  it('returns an identical rejection whether or not the email belongs to an account', async () => {
    // Same malformed password, one address that exists and one that does not.
    const existing = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: registered.email, password: '' });

    const missing = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: unregistered, password: '' });

    expect(existing.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(strip(existing.body)).toEqual(strip(missing.body));
  });

  it('returns an identical rejection for a malformed email regardless of stored state', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-email', password: 'qualquer' });

    // Seed several more accounts, then repeat: the response must not move.
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'outro@agrohub.com.br', password: 'SenhaSegura1' });

    const second = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-email', password: 'qualquer' });

    expect(strip(first.body)).toEqual(strip(second.body));
  });

  it('never attaches details to a 401, so a rejection carries no field-level hint', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: registered.email, password: 'SenhaErrada1' });

    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: unregistered, password: 'SenhaErrada1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.details).toBeUndefined();
    expect(unknownEmail.body.details).toBeUndefined();
    expect(Object.keys(wrongPassword.body).sort()).toEqual([
      'error',
      'message',
      'path',
      'requestId',
      'statusCode',
      'timestamp',
    ]);
  });

  it('never names the password as the reason a credential check failed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: registered.email, password: 'SenhaErrada1' });

    const serialised = JSON.stringify(res.body).toLowerCase();
    expect(serialised).not.toContain('senha incorreta');
    expect(serialised).not.toContain('senha inválida');
    expect(serialised).not.toContain('usuário não encontrado');
    expect(res.body.message).toBe('E-mail ou senha inválidos.');
  });

  it('applies no password-policy rule at login, so policy is not probeable', async () => {
    // A password too short for REGISTRATION must still reach the credential check at login and
    // come back as a generic 401 - not a 400 naming the policy. Otherwise an attacker could map
    // the password rules, and worse, distinguish "rejected by policy" from "wrong password".
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: registered.email, password: 'abc' });

    expect(res.status).toBe(401);
    expect(res.body.details).toBeUndefined();
  });
});
