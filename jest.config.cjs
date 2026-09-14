module.exports = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  moduleFileExtensions: ["js", "mjs", "json"],
  testMatch: [
    "**/tests/**/*.test.js",
    "**/tests/**/*.spec.js"
  ],
  collectCoverageFrom: [
    "extensions/**/*.js",
    "shared/**/*.js",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/build/**"
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
    "^.+\\.mjs$": "babel-jest"
  },
  transformIgnorePatterns: [
    "node_modules/(?!(node-fetch|fetch-blob|formdata-polyfill|data-uri-to-buffer|@exodus/bytes|jsdom|parse5|entities|@asamuzakjp|@csstools|cssstyle|css-tree|nwsapi|rrweb-cssom|whatwg-url|tr46|w3c-xmlserializer|saxes|xml-name-validator|lru-cache|@bramus)/)"
  ],
  testTimeout: 10000,
  verbose: true
};
