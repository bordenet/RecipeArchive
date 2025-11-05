/* eslint-env node */
const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat.config({
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "prettier"],
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:prettier/recommended",
      "plugin:node/recommended",
    ],
    env: {
      browser: true,
      node: true,
      es2021: true,
      jest: true,
      webextensions: true,
    },
    globals: {
      chrome: "readonly",
      browser: "readonly",
      JWTValidator: "readonly",
      SafariCognitoAuth: "readonly",
      CognitoAuth: "readonly",
      ChromeCognitoAuth: "readonly",
      CONFIG: "readonly",
      module: "writable",
      global: "writable",
    },
    parserOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "error",
      "no-console": "off",
      "prettier/prettier": "error",
      "no-empty": "off",
      "node/no-unsupported-features/es-syntax": "off",
      "node/no-unsupported-features/node-builtins": "off",
      "node/no-unsupported-features/es-builtins": "off",
      "node/no-missing-import": [
        "error",
        { allowModules: ["@typescript-eslint/parser"] },
      ],
      "node/no-unpublished-import": "off",
      "node/no-extraneous-import": "off",
      "node/no-extraneous-require": "off",
      "node/no-unpublished-require": "off",
      "node/no-deprecated-api": "warn",
      "node/process-exit-as-throw": "off",
      "node/shebang": "off",
    },
    settings: {
      node: {
        version: "18.0.0",
      },
    },
    ignorePatterns: [
      "**/eslint.config.js",
      "testdata/**",
      "test-tools/**",
      "extensions/**/typescript-parser-bundle.js",
    ],
    overrides: [
      {
        files: ["tools/**/*.js", "tools/**/*.cjs"],
        parser: "espree",
        parserOptions: {
          sourceType: "commonjs",
        },
        env: {
          commonjs: true,
          node: true,
        },
        rules: {
          "node/process-exit-as-throw": "off",
        },
      },
    ],
  }),
];
