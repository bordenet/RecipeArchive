# Recipe Parser Tests

This directory contains the test framework and test suites for recipe parsers.

## Structure

- `parser-test-framework.ts` - Core testing framework and utilities
- `*.test.ts` - Individual parser test files
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Test setup and custom matchers

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific parser tests
npm run test:allrecipes
```

## Writing Tests

### Basic Test Structure

```typescript
import { YourParser } from '../sites/your-parser';
import { ParserTestRunner, ParserTestCase } from './parser-test-framework';

describe('Your Parser', () => {
  let parser: YourParser;
  let testRunner: ParserTestRunner;

  beforeEach(() => {
    parser = new YourParser();
    testRunner = new ParserTestRunner(parser);
  });

  test('should parse basic recipe', async () => {
    const testCase: ParserTestCase = {
      name: 'Basic Recipe Test',
      url: 'https://example.com/recipe',
      htmlFixture: '<html>...</html>',
      expectedRecipe: {
        title: 'Expected Title',
        ingredients: [{ text: 'Expected ingredient' }],
        instructions: [{ stepNumber: 1, text: 'Expected instruction' }],
      },
    };

    const result = await testRunner.runTest(testCase);
    expect(result.passed).toBe(true);
  });
});
```

### Test Case Configuration

- `name`: Descriptive name for the test case
- `url`: The URL this test represents
- `htmlFixture`: Raw HTML content to parse (required)
- `expectedRecipe`: Partial recipe object with expected values
- `skipFields`: Array of field names to skip during validation

### HTML Fixtures

For now, HTML fixtures need to be embedded in test files. In the future, these could be moved to separate `.html` files for better maintainability.

## Custom Matchers

The test framework includes custom Jest matchers:

- `toHaveValidRecipeStructure()` - Validates basic recipe structure (title, ingredients, instructions)

## Coverage

Test coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`.

## Adding New Parser Tests

1. Create a new `[parser-name].test.ts` file
2. Import the parser and test framework
3. Write test cases with HTML fixtures
4. Add the new test file to the package.json scripts if needed

## Future Improvements

- HTML fixture files instead of embedded strings
- Automated HTML fetching for live testing
- Performance benchmarking
- Visual diff testing for parsed recipes
- Integration with CI/CD pipeline
