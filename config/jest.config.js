export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  rootDir: "..", // Set root directory to parent since config is now in subdirectory
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/extensions/shared/$1",
    "^cheerio$": "<rootDir>/parsers/tests/__mocks__/cheerio.js",
    // Handle .js extensions in TypeScript imports
    "^(\\.{1,2}/.*)\\.js$": "$1",
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
    "^.+\\.(m?js)$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(node-fetch|fetch-blob|formdata-polyfill|data-uri-to-buffer|@exodus/bytes|jsdom|parse5|entities|@asamuzakjp|@csstools|cssstyle|css-tree|nwsapi|rrweb-cssom|whatwg-url|tr46|w3c-xmlserializer|saxes|xml-name-validator|lru-cache|@bramus)/)"
  ],
  extensionsToTreatAsEsm: [],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: [
    "/external-references/RecipeClipper/",
    "/external-references/sharp-recipe-parser/",
    "/tests/automation/extension-tests/",
    "/tests/automation/browser-startup-debug.spec.js",
    "/tests/automation/extension-debug.spec.js",
  ],
  // Only collect coverage from production code (parsers and shared libraries)
  // Excludes: scripts/ (development utilities), tools/ (debugging/testing utilities)
  collectCoverageFrom: [
    "extensions/shared/**/*.{js,ts}",
    "parsers/**/*.{js,ts}",
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
