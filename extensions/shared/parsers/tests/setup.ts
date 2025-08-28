// Jest setup file for parser tests
// This file is run before each test suite

// Simple setup without external dependencies
const { JSDOM } = require('jsdom');

// Setup global DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Add any global test setup here
global.console = {
  ...console,
  // Suppress some logs in tests
  log: jest.fn(),
  error: console.error, // Keep errors visible
  warn: console.warn,   // Keep warnings visible
};

// Setup test environment for parser validation
beforeAll(() => {
  // Any global setup for parser tests
});

afterAll(() => {
  // Any global cleanup for parser tests
});