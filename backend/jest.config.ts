import type { Config } from 'jest';

const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/silence-logger.ts'],
};

const config: Config = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.e2e-spec.ts'],
    },
    {
      // Feature 002 onwards: real disposable Postgres rather than the in-memory Prisma fake.
      // Kept separate from `integration` so feature 001's fast, database-free suite still runs
      // on a machine without Docker (research.md R-008).
      ...base,
      displayName: 'integration-db',
      testMatch: ['<rootDir>/test/integration-db/**/*.e2e-spec.ts'],
      setupFiles: ['<rootDir>/test/setup-env.ts', '<rootDir>/test/setup-env-db.ts'],
    },
    {
      ...base,
      displayName: 'persistence',
      testMatch: ['<rootDir>/test/persistence/**/*.spec.ts'],
    },
    { ...base, displayName: 'security', testMatch: ['<rootDir>/test/security/**/*.spec.ts'] },
  ],
};

export default config;
