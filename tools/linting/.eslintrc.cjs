module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script'
  },
  rules: {
    // Core rules
    'no-unused-vars': 'warn',
    'no-console': 'off',
    'prefer-const': 'warn',
    'no-undef': 'warn'
  },
  overrides: [
    {
      // Special configuration for bundled parser files
      files: ['**/typescript-parser-bundle.js', '**/parser-bundle.js'],
      rules: {
        // Disable most rules for bundled files
        'no-unused-vars': 'off',
        'no-undef': 'off',
        'prefer-const': 'off',
        'no-var': 'off',
        'no-redeclare': 'off',
        'no-inner-declarations': 'off'
      }
    },
    {
      // Browser extension files
      files: ['extensions/**/*.js'],
      env: {
        browser: true,
        webextensions: true
      },
      globals: {
        chrome: 'readonly',
        CONFIG: 'readonly',
        ChromeCognitoAuth: 'readonly'
      }
    }
  ]
};
