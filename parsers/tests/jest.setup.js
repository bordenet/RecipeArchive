// Jest setup file for parser tests

// Set test timeout
jest.setTimeout(30000);

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Add custom matchers
expect.extend({
  toHaveValidRecipeStructure(received) {
    const pass =
      received &&
      typeof received.title === 'string' &&
      received.title.length > 0 &&
      Array.isArray(received.ingredients) &&
      received.ingredients.length > 0 &&
      Array.isArray(received.instructions) &&
      received.instructions.length > 0;

    if (pass) {
      return {
        message: () => `expected recipe to not have valid structure`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected recipe to have valid structure (title, ingredients, instructions)`,
        pass: false,
      };
    }
  },
});
