// Simple test to verify Jest setup
const { describe, it, expect } = require('@jest/globals');

describe('Test Setup Verification', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to console mocks', () => {
    console.log('test message');
    expect(console.log).toHaveBeenCalled();
  });

  it('should handle globals', () => {
    expect(global.TextEncoder).toBeDefined();
    expect(global.TextDecoder).toBeDefined();
  });
});
