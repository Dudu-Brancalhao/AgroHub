module.exports = {
  root: true,
  env: { browser: true, es2022: true, jest: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
  rules: {
    // The session token lives in localStorage, so an XSS hole is a session hole.
    // Nothing in this codebase renders server strings as HTML (research.md R-007).
    'react/no-danger': 'error',

    // lib/httpClient.ts is the only module allowed to call fetch (Principle II).
    'no-restricted-globals': [
      'error',
      { name: 'fetch', message: 'Only lib/httpClient.ts may call fetch (Principle II).' },
    ],

    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'warn',
  },
  overrides: [
    {
      // The client itself, and its own test, which stubs the global it wraps.
      files: ['src/lib/httpClient.ts', 'src/lib/httpClient.test.ts'],
      rules: { 'no-restricted-globals': 'off' },
    },
  ],
};
