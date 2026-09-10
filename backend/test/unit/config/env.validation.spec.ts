import { validateEnv } from '../../../src/config/env.validation';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'a-secret-that-is-at-least-32-characters',
  JWT_EXPIRES_IN: '1h',
  BCRYPT_COST: '12',
  THROTTLE_TTL: '60',
  THROTTLE_LIMIT: '20',
  REGISTER_THROTTLE_TTL: '60',
  REGISTER_THROTTLE_LIMIT: '5',
  LOGIN_MAX_ATTEMPTS: '5',
  LOGIN_WINDOW_MINUTES: '15',
};

describe('validateEnv (Constitution V)', () => {
  it('accepts a complete configuration and coerces numerics', () => {
    const result = validateEnv(valid);
    expect(result.BCRYPT_COST).toBe(12);
    expect(result.LOGIN_MAX_ATTEMPTS).toBe(5);
  });

  // The app must not start without a real secret. A default would be a hardcoded secret, because
  // it is what runs whenever the real one fails to load (research.md R-004).
  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['too short', 'short-secret'],
  ])('refuses to boot when JWT_SECRET is %s', (_label, secret) => {
    const env = { ...valid, JWT_SECRET: secret } as Record<string, unknown>;
    if (secret === undefined) delete env.JWT_SECRET;

    expect(() => validateEnv(env)).toThrow(/JWT_SECRET/);
  });

  it('refuses a bcrypt cost outside the safe range', () => {
    expect(() => validateEnv({ ...valid, BCRYPT_COST: '2' })).toThrow(/BCRYPT_COST/i);
    expect(() => validateEnv({ ...valid, BCRYPT_COST: '20' })).toThrow(/BCRYPT_COST/i);
  });

  it('refuses a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = valid;
    expect(() => validateEnv(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('refuses non-integer rate-limit settings', () => {
    expect(() => validateEnv({ ...valid, LOGIN_MAX_ATTEMPTS: 'many' })).toThrow(
      /LOGIN_MAX_ATTEMPTS/i,
    );
  });

  it('requires the register-specific limit, so it cannot be silently dropped', () => {
    // FR-021a is a security control, not a tuning knob: booting without it would quietly fall
    // back to the looser global limit on the endpoint that leaks account existence.
    const { REGISTER_THROTTLE_LIMIT: _omitted, ...withoutRegisterLimit } = valid;
    expect(() => validateEnv(withoutRegisterLimit)).toThrow(/REGISTER_THROTTLE_LIMIT/i);

    const result = validateEnv(valid);
    expect(result.REGISTER_THROTTLE_LIMIT).toBe(5);
    expect(result.REGISTER_THROTTLE_TTL).toBe(60);
  });
});
