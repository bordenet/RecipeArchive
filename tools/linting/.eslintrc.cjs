// Legacy ESLint config for compatibility
module.exports = {
  extends: ['eslint:recommended'],
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Variable scoping and declaration rules
    'no-undef': 'error',
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    'block-scoped-var': 'error',
    'no-unused-vars': ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: false }],
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Additional safety rules
    'no-implicit-globals': 'error',
    'no-redeclare': 'error',
    'no-shadow': 'error',
    'no-shadow-restricted-names': 'error',
    'init-declarations': ['error', 'always'],
    
    // Try/catch specific rules
    'no-ex-assign': 'error',
    'no-catch-shadow': 'off', // deprecated but keeping for reference
    
    // Function scoping
    'func-names': ['error', 'as-needed'],
    'no-loop-func': 'error'
  },
  globals: {
    chrome: 'readonly',
    browser: 'readonly',
    safari: 'readonly'
  }
};
