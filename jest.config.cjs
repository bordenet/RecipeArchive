module.exports = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  moduleFileExtensions: ["js", "json"],
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
  transformIgnorePatterns: [
    "node_modules/(?!(node-fetch|fetch-blob|formdata-polyfill|data-uri-to-buffer)/)"
  ],
  testTimeout: 10000,
  verbose: true
};
