/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    browser: true,
    node: true,
    es2021: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'off',
    'no-undef': 'error',
    'no-unused-vars': 'off',
    'no-redeclare': 'error',
    'no-console': 'warn',
    'prettier/prettier': 'error',
  },
  ignorePatterns: ['**/eslint.config.js', 'testdata/**', 'test-tools/**'],
};
