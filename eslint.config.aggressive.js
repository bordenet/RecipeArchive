export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        crypto: 'readonly',
        SubtleCrypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        MutationObserver: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        EventTarget: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        HTMLCollection: 'readonly',
        DOMParser: 'readonly',
        XMLHttpRequest: 'readonly',
        
        // Extension-specific globals
        chrome: 'readonly',
        browser: 'readonly',
        
        // Browser-specific globals
        navigator: 'readonly',
        performance: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        
        // Project-specific globals
        CONFIG: 'writable',
        SafariCognitoAuth: 'writable',
        ChromeCognitoAuth: 'writable',
        CognitoAuth: 'writable',
        JWTValidator: 'readonly',
        ErrorHandler: 'readonly',
        RecipeArchiveConfig: 'readonly',
        
        // Testing globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        fail: 'readonly',
        
        // Node.js globals (only for appropriate files)
        global: 'readonly',
        globalThis: 'readonly'
      }
    },
    rules: {
      // === DEFENSIVE PROGRAMMING RULES ===
      
      // Strict null safety
      'no-undef': 'error',
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],
      'init-declarations': 'off', // Allow uninitialized variables that will be set later
      'no-implicit-globals': 'off', // Allow global functions in browser extensions
      'no-global-assign': 'error',
      'no-implicit-coercion': ['error', {
        'boolean': true,
        'number': true,
        'string': true,
        'disallowTemplateShorthand': true
      }],
      
      // Function safety
      'func-names': 'off', // Allow anonymous functions for event handlers
      'require-await': 'off', // Allow async methods without await for browser compatibility
      'no-await-in-loop': 'warn',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'off', // Allow return in promise executors for callback patterns
      'prefer-promise-reject-errors': 'error',
      
      // Variable safety
      'no-var': 'error',
      'prefer-const': 'error',
      'no-use-before-define': 'off', // Allow hoisting for better organization
      'no-shadow': 'error',
      'no-shadow-restricted-names': 'error',
      'no-delete-var': 'error',
      'no-label-var': 'error',
      'no-redeclare': 'off', // Allow for browser extension global overrides
      'block-scoped-var': 'error',
      
      // Security and safety
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-caller': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-iterator': 'error',
      'no-loop-func': 'error',
      'no-new': 'error',
      'no-new-object': 'error',
      'no-new-wrappers': 'error',
      'no-octal-escape': 'error',
      'no-proto': 'error',
      'no-return-assign': ['error', 'always'],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unused-expressions': ['error', {
        'allowShortCircuit': false,
        'allowTernary': false,
        'allowTaggedTemplates': false
      }],
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-escape': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'no-warning-comments': 'warn',
      'no-with': 'error',
      
      // Code style and readability
      'curly': ['error', 'all'],
      'dot-notation': 'error',
      'eqeqeq': ['error', 'always', { 'null': 'ignore' }],
      'guard-for-in': 'error',
      'no-alert': 'off', // Allow alerts in browser extensions for user feedback
      'no-case-declarations': 'error',
      'no-else-return': 'error',
      'no-empty-function': 'error',
      'no-empty-pattern': 'error',
      'no-fallthrough': 'error',
      'no-floating-decimal': 'error',
      'no-lone-blocks': 'error',
      'no-multi-spaces': 'error',
      'no-multi-str': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
      'no-nested-ternary': 'error',
      'no-new-symbol': 'error',
      'no-regex-spaces': 'error',
      'no-self-assign': 'error',
      'no-trailing-spaces': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'radix': 'off', // Allow parseInt without radix for simple cases
      'semi': ['error', 'always'],
      'space-before-function-paren': ['error', {
        'anonymous': 'never',
        'named': 'never',
        'asyncArrow': 'always'
      }],
      'strict': ['error', 'never'], // Handled by sourceType
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'yoda': 'error'
    }
  },
  {
    // Special rules for browser extension files
    files: ['extensions/**/*.js'],
    rules: {
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
          name: 'exports',
          message: 'exports is a Node.js global. Use ES6 exports or proper browser-compatible export patterns.'
        },
        {
          name: 'require',
          message: 'require is a Node.js function. Use ES6 imports or browser-compatible module loading.'
        },
        {
          name: 'Buffer',
          message: 'Buffer is a Node.js global. Use ArrayBuffer, Uint8Array, or browser-compatible alternatives.'
        },
        {
          name: '__dirname',
          message: '__dirname is a Node.js global. Use browser-compatible path alternatives.'
        },
        {
          name: '__filename',
          message: '__filename is a Node.js global. Use browser-compatible alternatives.'
        }
      ]
    }
  },
  {
    // Special rules for Node.js files
    files: ['tools/**/*.js', 'tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        
        // Additional Node.js
        setImmediate: 'readonly',
        clearImmediate: 'readonly'
      }
    },
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'window is a browser global and not available in Node.js. Use global instead.'
        },
        {
          name: 'document',
          message: 'document is a browser global and not available in Node.js.'
        },
        {
          name: 'navigator',
          message: 'navigator is a browser global and not available in Node.js.'
        },
        {
          name: 'localStorage',
          message: 'localStorage is a browser global and not available in Node.js.'
        },
        {
          name: 'sessionStorage',
          message: 'sessionStorage is a browser global and not available in Node.js.'
        }
      ]
    }
  }
];
