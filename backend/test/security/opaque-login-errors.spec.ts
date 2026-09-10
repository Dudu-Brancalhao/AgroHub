import { INestApplication, Logger, LoggerService } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

class CapturingLogger implements LoggerService {
  readonly lines: string[] = [];
  private capture(message: unknown, ...optional: unknown[]): void {
    this.lines.push(JSON.stringify({ message, optional }));
  }
  log = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  error = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  warn = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  debug = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
  verbose = (m: unknown, ...o: unknown[]) => this.capture(m, ...o);
}

/**
 * Login returns a generic rejection; the diagnostic detail goes to the log instead.
 *
 * The detail is not thrown away - a frontend developer sending a malformed payload still needs to
 * find out why - it just moves to a channel the caller cannot read, correlated by requestId.
 *
 * Registration deliberately keeps itemised errors: someone choosing a password needs to be told
 * which rule they missed, and registration is not a credential check.
 */
describe('Login errors are opaque to the caller, detailed in the log', () => {
  let ctx: TestApp;
  let app: INestApplication;
  const logger = new CapturingLogger();

  const account = { email: 'produtor@agrohub.com.br', password: 'SenhaSegura1' };

  /** A genuine credential failure, captured once - see the note in beforeAll. */
  let credentialFailureBody: Record<string, unknown>;

  const strip = (b: Record<string, unknown>) => {
    const { timestamp: _t, requestId: _r, ...rest } = b;
    return rest;
  };

  beforeAll(async () => {
    Logger.overrideLogger(logger);
    ctx = await createTestApp([], logger);
    app = ctx.app;
    await request(app.getHttpServer()).post('/api/auth/register').send(account).expect(201);

    // Captured ONCE. Re-issuing a real credential failure inside every case would burn the
    // 5-per-identifier allowance and the reference itself would start coming back 429 - which is
    // the limiter behaving correctly, and would make this suite test the wrong thing.
    const reference = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'referencia@agrohub.com.br', password: 'SenhaErrada1' });
    expect(reference.status).toBe(401);
    credentialFailureBody = reference.body;
  });

  afterAll(async () => {
    await app.close();
    Logger.overrideLogger(false);
  });

  it.each([
    ['malformed email', { email: 'nao-e-email', password: 'SenhaSegura1' }],
    ['missing password', { email: account.email }],
    ['empty password', { email: account.email, password: '' }],
    ['missing email', { password: 'SenhaSegura1' }],
    ['empty body', {}],
    ['unknown field', { ...account, role: 'admin' }],
  ])('answers %s with the generic 401 and no field detail', async (_label, payload) => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send(payload);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('E-mail ou senha inválidos.');
    expect(res.body.details).toBeUndefined();

    // The real property: the body is byte-identical to a genuine credential failure, so the two
    // are indistinguishable. (Substring checks are useless here - the intended generic message
    // legitimately contains both "mail" and "senha".)
    expect(strip(res.body)).toEqual(strip(credentialFailureBody));
    expect(Object.keys(res.body).sort()).toEqual([
      'error',
      'message',
      'path',
      'requestId',
      'statusCode',
      'timestamp',
    ]);
  });

  it('records the reason server-side so a malformed payload is still diagnosable', async () => {
    const before = logger.lines.length;

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-email', password: '' });

    const captured = logger.lines.slice(before).join('\n');

    // Field name plus constraint key - enough to debug, and impossible to confuse with a value.
    expect(captured).toContain('email:isEmail');
    expect(captured).toContain('password:isNotEmpty');
    expect(captured).toContain('requestId');
  });

  it('logs constraint KEYS, never rendered messages, so no submitted value can be echoed', async () => {
    const before = logger.lines.length;
    const secret = 'MinhaSenhaSecretaX9';

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-email', password: secret });

    const captured = logger.lines.slice(before).join('\n');

    expect(captured).not.toContain(secret);
    // The pt-BR rendered message belongs to the caller-facing channel, not the log.
    expect(captured).not.toContain('Informe um e-mail válido');
  });

  it('keeps itemised errors on REGISTER, where they serve the user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'nao-e-email', password: 'curta' });

    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(2);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });
});
