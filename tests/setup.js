// Jest setup file for browser extension tests

// TextEncoder/TextDecoder polyfill for Node.js environment
const { TextEncoder, TextDecoder } = require('util');

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

// Mock chrome extension APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`)
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock browser for Safari extension compatibility
global.browser = global.chrome;

// Mock fetch for tests
global.fetch = jest.fn();

// Console mock for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Load security modules for testing
const fs = require('fs');
const path = require('path');

// Mock crypto.getRandomValues for SecureStorage
global.crypto = {
  getRandomValues: jest.fn((buffer) => {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }),
  subtle: {
    importKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateKey: jest.fn()
  }
};

// Load and evaluate security modules
try {
  const securityValidatorPath = path.join(__dirname, '../extensions/shared/security-validator.js');
  const jwtValidatorPath = path.join(__dirname, '../extensions/shared/jwt-validator.js');
  const secureStoragePath = path.join(__dirname, '../extensions/shared/secure-storage.js');
  
  const securityValidatorCode = fs.readFileSync(securityValidatorPath, 'utf8');
  const jwtValidatorCode = fs.readFileSync(jwtValidatorPath, 'utf8');
  const secureStorageCode = fs.readFileSync(secureStoragePath, 'utf8');
  
  // Execute the code in global context
  eval(securityValidatorCode);
  eval(jwtValidatorCode);
  eval(secureStorageCode);
} catch (error) {
  console.warn('Failed to load security modules:', error.message);
}
