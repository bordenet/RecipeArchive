// RecipeArchive ESLint Configuration (Flat Config for ESLint 9.x)
// Migrated from .eslintrc.cjs

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  // Global ignores
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "**/*.min.js",
      "**/typescript-parser-bundle.js",
      "**/env-config.js",
      ".web-extension-backup/",
    ],
  },

  // Base JavaScript configuration
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        // Browser extension globals loaded via <script> tags
        CONFIG: "readonly",
        ENV_CONFIG: "readonly",
        JWTValidator: "readonly",
        SafariCognitoAuth: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
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
  },

  // TypeScript configuration
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        CONFIG: "readonly",
        ENV_CONFIG: "readonly",
        JWTValidator: "readonly",
        SafariCognitoAuth: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "no-unused-vars": "off", // Use TypeScript version
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
    },
  },

  // Parser files - allow any type
  {
    files: ["parsers/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Test files
  {
    files: ["**/*.test.js", "**/*.test.ts", "**/__tests__/**/*.js", "**/__tests__/**/*.ts", "**/tests/**/*.js", "**/tests/**/*.ts", "tests/setup.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
        fail: "readonly",
      },
    },
  },
];

