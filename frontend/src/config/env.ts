/**
 * The ONLY module in this codebase that reads `import.meta.env`.
 *
 * `import.meta` is a syntax error under Jest's CommonJS transform, so keeping every environment
 * read here means exactly one file needs a test-time stub (`env.stub.ts`, wired up in
 * jest.config.ts) instead of every module that wants a config value (research.md R-005).
 *
 * Only VITE_-prefixed values reach the bundle, and none of them is a secret — anything in here
 * is readable by every visitor (Principle V).
 */
export const env = {
  apiBasePath: (import.meta.env.VITE_API_BASE_PATH as string | undefined) ?? '/api',
} as const;
