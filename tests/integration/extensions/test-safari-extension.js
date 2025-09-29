// Test setup for Safari Web Extension
// Mock browser APIs for cross-browser compatibility testing

// Mock chrome/browser APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  tabs: {
    query: jest.fn((query, callback) => {
      if (callback) callback([{ id: 1, url: 'https://example.com' }]);
      return Promise.resolve([{ id: 1, url: 'https://example.com' }]);
    }),
    sendMessage: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
  },
};

// Mock browser API (Safari uses this)
global.browser = global.chrome;

// Mock Safari-specific APIs if needed
global.safari = {
  extension: {
    baseURI: 'safari-extension://test/',
  },
};

// Suppress console errors during testing
const originalError = console.error;
console.error = (...args) => {
  // Only suppress expected chrome API errors during testing
  if (
    args[0] &&
    args[0].includes &&
    args[0].includes('chrome is not defined')
  ) {
    return;
  }
  originalError(...args);
};
