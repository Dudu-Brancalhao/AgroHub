/**
 * Vite builds and serves; Jest tests. They share no transform.
 *
 * The trap this config exists to avoid: `import.meta.env` is a syntax error under Jest's
 * CommonJS transform. Every environment read in the codebase goes through `src/config/env.ts`
 * — the only file mentioning `import.meta` — and the moduleNameMapper below swaps it for a stub
 * at test time, so no other module has to know (research.md R-005).
 *
 * Written as .cjs rather than .ts on purpose: a TypeScript Jest config requires ts-node, and
 * this config carries no logic worth a dependency.
 *
 * styled-components needs no CSS transform: styling is CSS-in-JS, so there are no `.css`
 * imports to stub.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^(.*)/config/env$': '<rootDir>/src/config/env.stub.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          // The app builds with noUnusedLocals; tests legitimately keep unused fixtures.
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
  clearMocks: true,
  restoreMocks: true,
};
