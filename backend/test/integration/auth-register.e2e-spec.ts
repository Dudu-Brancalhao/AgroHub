import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

describe('POST /api/auth/register (US1)', () => {
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

  const valid = { email: 'produtor@agrohub.com.br', password: 'SenhaSegura1' };

  // spec US1 §1
  it('creates an account and never echoes password material', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      email: 'produtor@agrohub.com.br',
      createdAt: expect.any(String),
    });

    // Asserting the exact key set, not just "password is absent": a column added later must fail
    // this test rather than leak silently (FR-007).
    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'email', 'id']);
    expect(JSON.stringify(res.body)).not.toContain('SenhaSegura1');
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });

  // spec US1 §2
  it('rejects a duplicate email with 409', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send(valid).expect(201);

    const res = await request(app.getHttpServer()).post('/api/auth/register').send(valid);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Já existe uma conta cadastrada com este e-mail.');
  });

  // spec US1 §3 + edge case: casing and padding must collapse to the same key (FR-004)
  it('treats a differently-cased, padded email as the same account', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send(valid).expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: '  PRODUTOR@AgroHub.com.BR  ', password: 'OutraSenha9' });

    expect(res.status).toBe(409);
  });

  // spec US1 §3 — FR-013: every failing field reported at once, not one at a time
  it('reports both the email and the password error in a single response', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'nao-e-email', password: 'curta' });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });

  // spec US1 §4 — FR-006
  it('rejects unrecognised fields rather than silently dropping them', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...valid, role: 'admin', isAdmin: true });

    // A 201 here would be a security failure even though no role column exists yet: it becomes a
    // privilege-escalation path the moment one does.
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['role', 'isAdmin']));

    // Constitution VIII: this message reaches the API caller, so it is pt-BR - unlike our log
    // lines, which stay English. class-validator's own default here is English.
    const messages = res.body.details.map((d: { message: string }) => d.message).join(' ');
    expect(messages).toContain('não é permitido');
    expect(messages).not.toContain('should not exist');
  });

  // spec US1 §5
  it.each([['joao@'], ['joao agrohub.com.br'], ['joao@@agrohub'], ['']])(
    'rejects malformed email %p',
    async (email) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'SenhaSegura1' });
      expect(res.status).toBe(400);
    },
  );

  // spec US1 §6 — FR-003: format only, no deliverability check, no outbound dependency
  it('accepts a well-formed address whose domain does not exist', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'ninguem@dominio-que-nao-existe-12345.com.br', password: 'SenhaSegura1' });

    expect(res.status).toBe(201);
  });

  // FR-014
  it('rejects an absent body as invalid input rather than empty credentials', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send();
    expect(res.status).toBe(400);
  });
});
