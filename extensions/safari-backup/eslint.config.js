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
        extractRecipeFromSmittenKitchen: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: 'syncToAPI|browserAPI|content|error',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
  },
];
