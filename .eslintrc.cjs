// RecipeArchive ESLint Configuration
// Simple, minimal configuration for JavaScript/TypeScript linting

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true, // Enable chrome, browser globals
  },
  globals: {
    // Browser extension globals loaded via <script> tags
    CONFIG: "readonly",
    ENV_CONFIG: "readonly",
    JWTValidator: "readonly",
    SafariCognitoAuth: "readonly",
  },
  extends: [
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  rules: {
    // Code Quality
    "no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_"
    }],
    "no-console": "off", // Allow console in browser extensions

    // Code Style
    "quotes": ["error", "double"],
    "semi": ["error", "always"],

    // Best Practices
    "no-undef": "error",
    "no-redeclare": "error",
  },
  // Override for TypeScript files
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
      ],
      rules: {
        "@typescript-eslint/no-unused-vars": ["warn", {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }],
        "no-unused-vars": "off", // Use TypeScript version
        "@typescript-eslint/no-explicit-any": "warn", // Warn instead of error
        "@typescript-eslint/no-require-imports": "warn", // Warn instead of error for legacy code
      },
    },
    {
      // Parser files deal with scraped HTML/JSON of unknown structure
      // `any` type is appropriate here as type safety comes from validation after parsing
      files: ["parsers/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
    {
      files: ["**/*.test.js", "**/*.test.ts", "**/__tests__/**/*.js", "**/__tests__/**/*.ts", "**/tests/**/*.js", "**/tests/**/*.ts", "tests/setup.js"],
      env: {
        jest: true, // Enable Jest globals (describe, it, expect, etc.)
      },
      globals: {
        fail: "readonly", // Jest fail function
      },
    },
  ],
  // Ignore patterns
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    "*.min.js",
    "typescript-parser-bundle.js",
    "env-config.js",
  ],
};
