// Node.js Specific ESLint Configuration
// This config targets Node.js environments (tools, scripts, tests)

export default [
  {
    files: ['tools/**/*.js', '*.cjs', 'scripts/**/*.js', 'tests/**/*.js', 'extensions/**/tests/**', 'extensions/**/test/**', 'extensions/**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: false
        }
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        exports: 'writable',
        module: 'readonly',
        console: 'readonly',
        
        // Common Node.js modules
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        
        // Testing globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly'
      }
    },
    rules: {
      // ===== CORE VARIABLE SCOPING RULES =====
      'no-undef': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'block-scoped-var': 'error',
      'no-unused-vars': [
        'error',
        { 
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_', 
          caughtErrorsIgnorePattern: '^_|^e$|^error$'
        },
      ],
      
      // ===== NODE.JS SPECIFIC RULES =====
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
        }
      ],
      
      // ===== ASYNC/AWAIT AND PROMISES =====
      'require-await': 'error',
      'no-async-promise-executor': 'error',
      'prefer-promise-reject-errors': 'error',
      
      // ===== STRICT VARIABLE DECLARATIONS =====
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'one-var': ['error', 'never'],
      
      // ===== SCOPE AND HOISTING RULES =====
      'no-redeclare': 'error',
      'no-shadow': 'error',
      'no-shadow-restricted-names': 'error',
      'no-delete-var': 'error',
      'no-label-var': 'error',
      
      // ===== TRY/CATCH SPECIFIC RULES =====
      'no-ex-assign': 'error',
      
      // ===== FUNCTION SCOPING =====
      'func-names': ['error', 'as-needed'],
      'no-loop-func': 'error',
      'no-inner-declarations': 'error',
      
      // ===== CODE QUALITY =====
      'curly': ['error', 'multi-line'],
      'no-implicit-coercion': ['error', { 
        boolean: true, 
        number: true, 
        string: true 
      }],
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-with': 'error'
    }
  }
];
