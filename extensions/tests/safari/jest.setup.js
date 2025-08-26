// Jest setup for Safari Extension tests
// Global configuration and mocks

// Add TextEncoder/TextDecoder for JSDOM compatibility
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock console to reduce noise during tests
global.console = {
  ...console,
  // Suppress console.warn during tests unless explicitly needed
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create mock events
  createMockEvent: (type, properties = {}) => ({
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    target: {
      value: '',
      checked: false,
      ...properties
    },
    ...properties
  }),
  
  // Helper to simulate user input
  simulateInput: (element, value) => {
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  
  // Helper to simulate clicks
  simulateClick: (element) => {
    if (element) {
      element.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }
};

// Mock browser APIs that might be used
if (typeof window !== 'undefined') {
  // Mock requestAnimationFrame
  window.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
  window.cancelAnimationFrame = jest.fn(clearTimeout);
  
  // Mock fetch
  window.fetch = jest.fn();
  
  // Mock notification API
  window.Notification = jest.fn();
  
  // Mock crypto API
  window.crypto = {
    getRandomValues: jest.fn(arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  };
}
