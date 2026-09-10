/**
 * Typed configuration factory.
 *
 * Note the asymmetry: every other key may carry a default here, but `jwt.secret` reads the raw
 * environment with no `??` fallback. Boot validation (env.validation.ts) has already guaranteed it
 * is present and long enough, so a default would only ever mask a misconfiguration
 * (research.md R-004).
 */
export interface AppConfig {
  port: number;
  logLevel: string;
  database: { url: string };
  jwt: { secret: string; expiresIn: string };
  bcrypt: { cost: number };
  throttle: { ttlSeconds: number; limit: number };
  registerThrottle: { ttlSeconds: number; limit: number };
  loginAttempt: { maxAttempts: number; windowMinutes: number };
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  database: {
    url: process.env.DATABASE_URL as string,
  },
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN as string,
  },
  bcrypt: {
    cost: Number(process.env.BCRYPT_COST),
  },
  throttle: {
    ttlSeconds: Number(process.env.THROTTLE_TTL),
    limit: Number(process.env.THROTTLE_LIMIT),
  },
  registerThrottle: {
    ttlSeconds: Number(process.env.REGISTER_THROTTLE_TTL),
    limit: Number(process.env.REGISTER_THROTTLE_LIMIT),
  },
  loginAttempt: {
    maxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS),
    windowMinutes: Number(process.env.LOGIN_WINDOW_MINUTES),
  },
});
