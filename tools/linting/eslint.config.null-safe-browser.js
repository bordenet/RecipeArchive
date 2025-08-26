export default [
  {
    files: ['extensions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // Extension-specific globals
        CONFIG: 'readonly',
        SafariCognitoAuth: 'readonly',
        ChromeCognitoAuth: 'readonly',
        JWTValidator: 'readonly',
        ErrorHandler: 'readonly'
      }
    },
    rules: {
      // Core rules
      'no-undef': 'error',
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      
      // Null safety rules (if available)
      'prefer-optional-chaining': 'error',
      'no-unsafe-optional-chaining': 'error',
      
      // Better variable handling
      'init-declarations': ['error', 'always'],
      
      // Function safety
      'func-names': ['warn', 'always'],
      'require-await': 'error',
      
      // Browser compatibility - Node.js globals that shouldn't be used
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'process is a Node.js global and not available in browser extensions. Use browser-specific alternatives.'
        },
        {
          name: 'module',
          message: 'module is a Node.js global. Use ES6 exports or proper browser-compatible export patterns.'
        },
        {
          name: 'require',
          message: 'require is a Node.js function. Use ES6 imports or browser-compatible module loading.'
        },
        {
          name: 'Buffer',
          message: 'Buffer is a Node.js global. Use ArrayBuffer, Uint8Array, or browser-compatible alternatives.'
        }
      ],
      
      // Code style
      'no-implicit-globals': 'error',
      'no-redeclare': 'error',
      'no-eval': 'error',
      'curly': 'error',
      'no-implicit-coercion': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'block-scoped-var': 'error',
      'no-use-before-define': 'error',
      'no-shadow': 'error'
    }
  }
];
