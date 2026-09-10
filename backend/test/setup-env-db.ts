/**
 * Throttle limits for the integration-db project only.
 *
 * Feature 001's per-origin limit is 20 requests/minute, and this suite legitimately makes many
 * more from one origin. Raising it here rather than globally keeps feature 001's own rate-limit
 * suites meaningful - they assert the real thresholds and run under the default setup-env.
 *
 * Rate limiting is therefore still tested, just not re-tested by every producer scenario.
 */
process.env.THROTTLE_LIMIT = '100000';
process.env.REGISTER_THROTTLE_LIMIT = '100000';
process.env.LOGIN_MAX_ATTEMPTS = '100000';
