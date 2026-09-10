import { INestApplication, Logger, LoggerService } from '@nestjs/common';
import request from 'supertest';
import { TestApp, createTestApp } from '../support/create-test-app';

/**
 * FR-025 as a permanent gate.
 *
 * quickstart.md step 16 does this by hand with grep, which means it gets done once and then
 * forgotten. Here every authentication flow runs with logging captured, and the captured output
 * is scanned for the things that must never reach a log. A hit fails the build.
 */
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

const PASSWORD = 'SenhaSuperSecreta1';
const WRONG_PASSWORD = 'SenhaErradaObvia9';

const FORBIDDEN: Array<[string, RegExp]> = [
  ['plaintext password', new RegExp(PASSWORD)],
  ['plaintext wrong password', new RegExp(WRONG_PASSWORD)],
  ['bcrypt hash', /\$2[aby]\$\d{2}\$/],
  ['JWT', /eyJhbGciOi/],
  ['authorization header', /Bearer\s+eyJ/],
  // Feature 002: CPF/CNPJ is personal data under the LGPD. Producers are logged by id (FR-038).
  ['CPF fixture', /52998224725|529\.982\.247/],
  ['CNPJ fixture', /11222333000181|11\.222\.333/],
  ['any bare 11- or 14-digit run', /\b\d{11}\b|\b\d{14}\b/],
];

describe('No credential material reaches the logs (FR-025)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  const logger = new CapturingLogger();

  beforeAll(async () => {
    Logger.overrideLogger(logger);
    ctx = await createTestApp([], logger);
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
    Logger.overrideLogger(false);
  });

  it('exercises every authentication flow and leaks nothing', async () => {
    const server = app.getHttpServer();
    const account = { email: 'auditoria@agrohub.com.br', password: PASSWORD };

    // Registration, success and duplicate.
    await request(server).post('/api/auth/register').send(account).expect(201);
    await request(server).post('/api/auth/register').send(account).expect(409);

    // Validation failure.
    await request(server).post('/api/auth/register').send({ email: 'x', password: 'y' }).expect(400);

    // Login success, then a token-bearing call.
    const login = await request(server).post('/api/auth/login').send(account).expect(200);
    await request(server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    // Failed logins through to the rate limit.
    for (let i = 0; i < 7; i += 1) {
      await request(server)
        .post('/api/auth/login')
        .send({ email: account.email, password: WRONG_PASSWORD });
    }

    // Unauthenticated and tampered-token refusals.
    await request(server).get('/api/auth/me').expect(401);
    await request(server).get('/api/auth/me').set('Authorization', 'Bearer nope.nope.nope').expect(401);

    const captured = logger.lines.join('\n');

    expect(captured.length).toBeGreaterThan(0); // the scan is worthless if nothing was logged

    for (const [label, pattern] of FORBIDDEN) {
      expect({ label, found: pattern.test(captured) }).toEqual({ label, found: false });
    }
  });

  it('still records the business events it is supposed to (FR-026)', async () => {
    const captured = logger.lines.join('\n');

    // The counterpart to the check above: proving nothing leaked would be trivial if nothing were
    // logged at all, so assert the required events are present.
    expect(captured).toContain('user.registered');
    expect(captured).toContain('auth.login.succeeded');
    expect(captured).toContain('auth.login.failed');
    expect(captured).toContain('login rate limit engaged');
  });

  it('logs technical messages in English while the API answers in pt-BR', async () => {
    const captured = logger.lines.join('\n');
    expect(captured).toContain('login failed: credential mismatch');
    expect(captured).not.toContain('E-mail ou senha inválidos');
  });
});
