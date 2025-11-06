// ESLint configuration for Chrome extension
export default [
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Chrome extension globals
        chrome: "readonly",
        browser: "readonly",
        self: "readonly",

        // Browser globals
        window: "readonly",
        document: "readonly",
        location: "readonly",
        navigator: "readonly",
        console: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Image: "readonly",
        Buffer: "readonly",
        crypto: "readonly",
        btoa: "readonly",
        atob: "readonly",
        TextEncoder: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",

        // Node.js globals (for test files)
        process: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",

        // Custom globals
        ChromeCognitoAuth: "readonly",
        SafariCognitoAuth: "readonly",
        JWTValidator: "readonly",
        CONFIG: "readonly",
        ENV_CONFIG: "readonly",

        // Test globals
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      quotes: ["error", "double"],
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "no-undef": "error",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "node/no-unsupported-features/es-builtins": "off",
      "n/no-unsupported-features/es-builtins": "off",
    },
  },
  {
    // Separate config for generated bundle - less strict
    files: ["typescript-parser-bundle.js"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "node/no-unsupported-features/es-builtins": "off",
      "n/no-unsupported-features/es-builtins": "off",
    },
  },
];
