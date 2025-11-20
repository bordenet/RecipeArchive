export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  rootDir: "..", // Set root directory to parent since config is now in subdirectory
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/extensions/shared/$1",
    "^cheerio$": "<rootDir>/parsers/tests/__mocks__/cheerio.js",
  },
  transform: {
    // eslint-disable-next-line no-useless-escape
    "^.+\.tsx?$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: {
          module: "commonjs",
        },
      },
    ],
  },
  // eslint-disable-next-line no-useless-escape
  transformIgnorePatterns: ["node_modules/(?!.*\.mjs$)"],
  extensionsToTreatAsEsm: [],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  // setupFilesAfterEnv: ["<rootDir>/extensions/shared/parsers/tests/setup.ts"], // Disabled due to JSDOM compatibility issues
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: [
    "/external-references/RecipeClipper/",
    "/external-references/sharp-recipe-parser/",
    "/tests/automation/extension-tests/",
    "/tests/automation/browser-startup-debug.spec.js",
    "/tests/automation/extension-debug.spec.js",
  ],
  // Only collect coverage from code that should be unit tested
  collectCoverageFrom: [
    "extensions/shared/**/*.{js,ts}",
    "parsers/**/*.{js,ts}",
    "scripts/**/*.{js,ts}",
    "tools/**/*.{js,ts}",
    // Exclude test files, mocks, and generated code
    "!**/*.test.{js,ts}",
    "!**/*.spec.{js,ts}",
    "!**/__tests__/**",
    "!**/__mocks__/**",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/build/**",
    "!**/coverage/**",
    "!**/typescript-parser-bundle.js",
    "!parsers/tests/**",
  ],
};
