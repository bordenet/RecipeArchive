export default [
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        browserAPI: 'readonly',
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        process: 'readonly',
        global: 'readonly',
        NodeFilter: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { 
          argsIgnorePattern: '^_', 
          varsIgnorePattern: 'syncToAPI', 
          caughtErrorsIgnorePattern: '^_|^e$|^error$|^diagErr$'
        },
      ],
      'no-console': 'off',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
    ignores: [
      'node_modules/',
      'dist/',
      'aws-backend/',
      'wapost-subscription-cookies.json',
      'git_reset.log',
      'tests/results/',
      'extensions/*/node_modules/',
    ],
  },
];