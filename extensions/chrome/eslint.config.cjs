module.exports = [
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        // Chrome Extension APIs
        chrome: "readonly",
        browser: "readonly",
        // Browser globals
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        btoa: "readonly",
        atob: "readonly",
        navigator: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        DOMParser: "readonly",
        // Extension-specific globals
        CONFIG: "readonly",
        ChromeCognitoAuth: "readonly",
        JWTValidator: "readonly",
        // Node.js globals for config files
        module: "readonly",
        exports: "readonly",
        require: "readonly"
      }
    },
    rules: {
      // Error prevention
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "no-redeclare": "off", // Allow CONFIG redeclaration in extension context
      
      // Code quality
      "semi": ["error", "always"],
      "quotes": ["error", "double", { "allowTemplateLiterals": true }],
      "no-console": "off", // Allow console in extensions
      
      // Browser extension best practices
      "no-eval": "error",
      "no-implied-eval": "error"
    }
  }
];