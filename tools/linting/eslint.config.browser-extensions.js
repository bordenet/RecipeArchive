// Browser Extension Specific ESLint Configuration
// This config specifically targets browser extension environments and restricts Node.js APIs

export default [
  {
    files: ['extensions/**/*.js'],
    ignores: ['extensions/**/tests/**', 'extensions/**/test/**', 'extensions/**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script', // Browser extensions typically use script mode
      parserOptions: {
        ecmaFeatures: {
          jsx: false
        }
      },
      globals: {
        // Browser extension APIs
        chrome: 'readonly',
        browser: 'readonly',
        safari: 'readonly',
        
        // Standard browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        
        // Browser APIs
        atob: 'readonly',
        btoa: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        
        // Browser UI APIs
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        
        // DOM Events
        Event: 'readonly',
        CustomEvent: 'readonly',
        
        // Timer functions
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        
        // Standard JS globals
        Array: 'readonly',
        Object: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        Date: 'readonly',
        RegExp: 'readonly',
        Error: 'readonly',
        Math: 'readonly',
        JSON: 'readonly',
        Promise: 'readonly',
        
        // DOM globals
        NodeFilter: 'readonly',
        
        // Extension-specific globals
        SafariCognitoAuth: 'readonly',
        RecipeArchiveConfig: 'readonly',
        CONFIG: 'readonly',
        JWTValidator: 'readonly',
        ChromeCognitoAuth: 'readonly',
        Node: 'readonly',
        module: 'readonly'
      }
    },
    rules: {
      // ===== CORE VARIABLE SCOPING RULES =====
      'no-undef': 'error',
      'no-use-before-define': ['warn', { functions: false, classes: true, variables: true }],
      'block-scoped-var': 'error',
      'no-unused-vars': [
        'error',
        { 
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_', 
          varsIgnorePattern: 'extensionAPI', 
          caughtErrorsIgnorePattern: '^_|^e$|^error$'
        },
      ],
      
      // ===== BROWSER ENVIRONMENT ENFORCEMENT =====
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'process is a Node.js global and not available in browser extensions. Use browser-specific alternatives.'
        },
        {
          name: 'Buffer',
          message: 'Buffer is a Node.js global and not available in browser extensions. Use ArrayBuffer or Uint8Array instead.'
        },
        {
          name: 'global',
          message: 'global is a Node.js global. Use window or self in browser environments.'
        },
        {
          name: '__dirname',
          message: '__dirname is a Node.js global and not available in browser extensions.'
        },
        {
          name: '__filename',
          message: '__filename is a Node.js global and not available in browser extensions.'
        },
        // Commenting out module restrictions for legacy compatibility
        // {
        //   name: 'require',
        //   message: 'require is a Node.js function. Use ES6 imports or dynamic imports in browser extensions.'
        // },
        // {
        //   name: 'exports',
        //   message: 'exports is a Node.js global. Use ES6 exports or assign to window for browser compatibility.'
        // },
        // {
        //   name: 'module',
        //   message: 'module is a Node.js global. Use ES6 exports or proper browser-compatible export patterns.'
        // }
      ],
      
      // ===== BROWSER EXTENSION SPECIFIC RULES =====
      'no-implicit-globals': 'warn', // Warn instead of error for legacy extension code
      'no-global-assign': 'error',    // Prevent overriding browser globals
      'no-native-reassign': 'off',    // Deprecated, replaced by no-global-assign
      
      // ===== ASYNC/AWAIT AND PROMISES =====
      'require-await': 'warn', // Warn instead of error 
      'no-async-promise-executor': 'error',
      'prefer-promise-reject-errors': 'error',
      
      // ===== STRICT VARIABLE DECLARATIONS =====
      'no-var': 'error',
      'prefer-const': ['warn', { destructuring: 'all' }], // Warn instead of error
      'one-var': ['error', 'never'],
      'init-declarations': ['warn', 'always'], // Warn instead of error
      
      // ===== SCOPE AND HOISTING RULES =====
      'no-redeclare': 'warn', // Warn for redeclare
      'no-shadow': 'warn',    // Warn for shadow
      'no-shadow-restricted-names': 'error',
      'no-delete-var': 'error',
      'no-label-var': 'error',
      
      // ===== TRY/CATCH SPECIFIC RULES =====
      'no-ex-assign': 'error',
      
      // ===== FUNCTION SCOPING =====
      'func-names': ['warn', 'as-needed'], // Warning instead of error for anonymous functions
      'no-loop-func': 'error',
      'no-inner-declarations': 'error',
      
      // ===== BROWSER COMPATIBILITY =====
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      
      // ===== CODE QUALITY =====
      'curly': ['warn', 'multi-line'], // Warn instead of error 
      'no-implicit-coercion': ['warn', { // Warn instead of error
        boolean: true, 
        number: true, 
        string: true 
      }],
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-with': 'error',
      
      // ===== EXTENSION SECURITY =====
      'no-caller': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-invalid-this': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error'
    }
  }
];
