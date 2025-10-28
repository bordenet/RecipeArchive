// Jest setup file for Safari extension tests
// This file is executed before each test suite

// Set up global test timeout
jest.setTimeout(10000);

// Suppress console warnings during tests (optional)
global.console = {
  ...console,
  // Uncomment to suppress console methods during tests
  // warn: jest.fn(),
  // error: jest.fn(),
};
