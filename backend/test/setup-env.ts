/**
 * Test environment defaults.
 *
 * BCRYPT_COST is 4 here on purpose: a cost-12 hash in every fixture would add minutes to the
 * suite without changing what is under test (research.md R-001).
 */
process.env.JWT_SECRET ??= 'test-secret-value-that-is-long-enough-32chars';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.BCRYPT_COST ??= '4';
process.env.DATABASE_URL ??= 'postgresql://agrohub:agrohub@localhost:5432/agrohub_test';
process.env.THROTTLE_TTL ??= '60';
process.env.THROTTLE_LIMIT ??= '20';
process.env.REGISTER_THROTTLE_TTL ??= '60';
process.env.REGISTER_THROTTLE_LIMIT ??= '5';
process.env.LOGIN_MAX_ATTEMPTS ??= '5';
process.env.LOGIN_WINDOW_MINUTES ??= '15';
process.env.LOG_LEVEL ??= 'silent';
