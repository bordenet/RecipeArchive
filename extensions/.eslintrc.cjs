/* eslint-env node */
const path = require("path");

module.exports = {
  extends: [path.resolve(__dirname, "../.eslintrc.cjs")],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  ignorePatterns: [
    "**/typescript-parser-bundle.js",
    "**/env-config.js",
    "node_modules/**",
  ],
  rules: {
    "no-console": "off",
    "no-undef": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
  overrides: [
    {
      // Use default parser for .js files (not TypeScript parser)
      files: ["*.js"],
      parser: "espree",
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
};