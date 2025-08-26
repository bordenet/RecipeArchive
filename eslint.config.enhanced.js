// Enhanced ESLint Configuration with Strict Variable Scoping Rules
// This config WILL catch the tokenResult bug and similar scoping issues

export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: false
        }
      },
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        browserAPI: 'readonly',
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        process: 'readonly',
        global: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        NodeFilter: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        CONFIG: 'readonly',
        SafariCognitoAuth: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        CONFIG: 'readonly',
        SafariCognitoAuth: 'readonly',
        ChromeCognitoAuth: 'readonly',
      },
    },
    rules: {
      // ===== CRITICAL VARIABLE SCOPING RULES =====
      // These would have caught the tokenResult bug!
      
      'no-undef': 'error', // Catch undefined variables - CRITICAL!
      'no-use-before-define': ['error', { 
        functions: false, 
        classes: true, 
        variables: true,
        allowNamedExports: false 
      }], // Prevent using variables before definition
      
      'block-scoped-var': 'error', // Treat var as block-scoped
      'no-redeclare': 'error', // Prevent variable redeclaration
      'no-shadow': ['error', { 
        builtinGlobals: false, 
        hoist: 'functions',
        allow: ['resolve', 'reject', 'done', 'callback', 'cb', 'err', 'error']
      }], // Prevent variable shadowing
      
      'no-unused-vars': [
        'error',
        { 
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_', 
          varsIgnorePattern: 'syncToAPI|extensionAPI', 
          caughtErrorsIgnorePattern: '^_|^e$|^error$|^diagErr$'
        },
      ],
      
      // ===== ASYNC/AWAIT SPECIFIC RULES =====
      'require-await': 'error', // Async functions must use await
      'no-async-promise-executor': 'error', // No async in Promise executor
      'prefer-promise-reject-errors': 'error', // Proper Promise rejection
      
      // ===== BLOCK SCOPE AND HOISTING =====
      'no-var': 'error', // Force let/const instead of var
      'prefer-const': ['error', { destructuring: 'all' }], // Use const when possible
      'one-var': ['error', 'never'], // One variable declaration per line
      'no-implicit-globals': 'error', // Prevent implicit global variables
      
      // ===== TRY/CATCH SPECIFIC RULES =====
      'no-ex-assign': 'error', // No reassigning exceptions in catch clauses
      'no-throw-literal': 'error', // Throw Error objects, not literals
      
      // ===== EXTENSION-SPECIFIC RULES =====
      'no-global-assign': 'error', // Prevent assignment to global variables
      'no-implicit-coercion': 'error', // Prevent implicit type coercion
      'no-eval': 'error', // No eval() usage (security)
      'no-implied-eval': 'error', // No implied eval
      
      // ===== EXISTING RULES (kept) =====
      'no-console': 'off', // Allow console in extensions
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      
      // ===== ADDITIONAL STRICT RULES =====
      'eqeqeq': ['error', 'always'], // Require === and !==
      'curly': ['error', 'multi-line'], // Require braces for multi-line blocks
      'default-case': 'error', // Require default case in switch
      'no-empty': 'error', // No empty blocks
      'no-extra-boolean-cast': 'error', // No unnecessary boolean casts
      'no-unreachable': 'error', // No unreachable code
      'valid-typeof': 'error', // Valid typeof comparisons
    },
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'aws-backend/',
      'wapost-subscription-cookies.json',
      'git_reset.log',
      'tests/results/',
      'extensions/*/node_modules/',
      'test-scoping-lint.js', // Temporary test file
    ],
  },
];
