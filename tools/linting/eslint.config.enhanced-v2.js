// Enhanced ESLint Configuration with Environment-Specific Rules
// This config combines browser extension and Node.js specific linting rules

import browserExtensionConfig from './eslint.config.browser-extensions.js';
import nodejsConfig from './eslint.config.nodejs.js';

export default [
  // Browser Extension Environment
  ...browserExtensionConfig,
  
  // Node.js Environment  
  ...nodejsConfig,
  
  // Fallback rules for any other files
  {
    files: ['**/*.js'],
    ignores: ['extensions/**/*.js', 'tools/**/*.js', '*.cjs', 'scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'error',
      'no-redeclare': 'error'
    }
  }
];
