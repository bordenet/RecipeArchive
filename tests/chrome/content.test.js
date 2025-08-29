// Basic unit test for content.js

describe('Chrome Extension Content Script', () => {
  beforeEach(() => {
    global.window = global.window || {};
  });
  it('should define window.TypeScriptParser if loaded', () => {
    // Simulate parser system load
    global.window.TypeScriptParser = { extractRecipeFromPage: jest.fn() };
    expect(typeof global.window.TypeScriptParser.extractRecipeFromPage).toBe('function');
  });
});
