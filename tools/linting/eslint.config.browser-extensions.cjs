module.exports = {
  root: true,
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true, // For require() in some files
    jest: true, // For test files
  },
  globals: {
    chrome: 'readonly',
    browser: 'readonly',
    JWTValidator: 'readonly',
    SafariCognitoAuth: 'readonly',
    CognitoAuth: 'readonly',
    ChromeCognitoAuth: 'readonly',
    CONFIG: 'readonly',
    module: 'writable', // For CommonJS modules
    global: 'writable', // For Jest setup
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off', // Allow require() in test files
      },
    }
  ],
  rules: {
    // Browser extension specific rules - focus on errors, not warnings
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_|^error$|^e$|^state$|^forceAuthRefresh$',
      caughtErrorsIgnorePattern: '^_|^error$|^e$'
    }],
    '@typescript-eslint/no-require-imports': 'off', // Allow require() in some contexts
    'no-undef': 'error',
    'no-unused-vars': 'off', // Use TypeScript version instead
    'no-redeclare': 'warn', // Don't fail on redeclarations
    // Allow console.log in browser extensions for debugging
    'no-console': 'off', // Disable console warnings for now
  },
  ignorePatterns: ['**/eslint.config.js', 'extensions/safari-backup/**'],
};
