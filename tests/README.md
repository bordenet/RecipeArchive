# RecipeArchive Test Suite

This directory contains all test files for the RecipeArchive project, organized by test type and purpose.

## Directory Structure

```
tests/
├── integration/           # Integration tests (Playwright-based)
│   ├── sites/            # Site-specific recipe extraction tests
│   ├── extensions/       # Browser extension integration tests
│   ├── test-comprehensive-recipes.js    # Cross-site comprehensive tests
│   ├── test-extraction-only.js          # Pure extraction logic tests
│   └── test-payload-compatibility.js    # Data format compatibility tests
├── unit/                 # Unit tests (Jest-based)
│   ├── chrome/          # Chrome extension unit tests
│   └── safari/          # Safari extension unit tests
├── fixtures/            # Test data and fixtures
├── results/             # Test output and result files
└── tools/               # Test utilities and analysis scripts
```

## Test Categories

### Integration Tests (`/integration/`)

#### Site-Specific Tests (`/integration/sites/`)

- `test-washington-post*.js` - Washington Post recipe extraction tests with authentication
- `test-food52*.js` - Food52 recipe extraction tests
- `test-love-lemons-recipes.js` - Love & Lemons recipe extraction tests
- `test-single-recipe.js` - Single recipe extraction test

#### Extension Tests (`/integration/extensions/`)

- `test-chrome-extension.js` - Chrome extension end-to-end tests
- `test-safari-extension.js` - Safari extension end-to-end tests

#### Comprehensive Tests

- `test-comprehensive-recipes.js` - Multi-site extraction validation
- `test-extraction-only.js` - Pure extraction logic without browser automation
- `test-payload-compatibility.js` - Data format consistency across extensions

### Unit Tests (`/unit/`)

- `chrome/` - Jest-based unit tests for Chrome extension components
- `safari/` - Jest-based unit tests for Safari extension components

### Tools (`/tools/`)

- `analyze-*.js` - Site analysis and debugging tools
- `manual-extension-test.html` - Manual testing interface

### Results (`/results/`)

- `*-test-results.json` - Test execution results and performance data

## Running Tests

### Integration Tests

```bash
# Run all integration tests
cd tests/integration
npm test

# Run site-specific tests
cd tests/integration/sites
node test-washington-post.js

# Run extension tests
cd tests/integration/extensions
npm test
```

### Unit Tests

```bash
# Chrome extension unit tests
cd extensions/chrome
npm test

# Safari extension unit tests
cd extensions/safari
npm test
```

## Environment Variables

Some tests require authentication credentials:

```bash
export WAPOST_USERNAME="your-email@domain.com"
export WAPOST_PASSWORD="your-password"
```

## Test Development Guidelines

1. **Site Tests**: Place in `/integration/sites/` with descriptive names
2. **Extension Tests**: Place in `/integration/extensions/` or appropriate `/unit/` directory
3. **Utilities**: Place analysis and debugging tools in `/tools/`
4. **Results**: Test outputs automatically saved to `/results/`
5. **Naming**: Use `test-` prefix for all test files

This organization provides clear separation between test types and makes the codebase more maintainable.
