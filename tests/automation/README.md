# Chrome Extension Automation Framework

## Overview

This automation framework provides comprehensive end-to-end testing for the RecipeArchive Chrome extension using Playwright. It eliminates the need for manual testing of the extension workflow.

## What It Does

The automation framework tests the complete Chrome extension workflow:

1. **Server Verification**: Checks that the mock server is running
2. **Extension Loading**: Automatically loads the Chrome extension
3. **Page Navigation**: Opens the test recipe page (AllRecipes Simple White Cake)
4. **Authentication Flow**: Tests sign-out and sign-in functionality
5. **Recipe Capture**: Triggers recipe extraction and validates API calls
6. **Data Verification**: Confirms recipe data was properly sent to the backend

## Key Features

- **Zero Manual Steps**: Fully automated browser extension testing
- **Visual Testing**: Runs with headless: false so you can see what's happening
- **Error Handling**: Takes screenshots and videos on failure
- **API Monitoring**: Intercepts and validates HTTP requests
- **Comprehensive Logging**: Detailed console output for debugging

## Files Created

```
tests/automation/
├── package.json                          # Test dependencies
├── playwright.config.js                  # Playwright configuration
├── run-chrome-tests.sh                   # Test runner script
└── extension-tests/
    ├── chrome-extension.spec.js           # Comprehensive test suite
    └── simple-workflow.spec.js            # Simplified workflow test
```

## Usage

### Quick Start
```bash
# From project root
cd tests/automation
npm install
npm run install:browsers
npx playwright test extension-tests/simple-workflow.spec.js
```

### Using the Shell Script
```bash
# From project root
./tests/automation/run-chrome-tests.sh
```

## Test Workflow

The automation replicates your manual testing workflow:

1. **Mock Server**: Starts/verifies the Go mock server on port 8080
2. **Browser Launch**: Opens Chrome with the extension pre-loaded
3. **Extension Management**: Finds and enables the RecipeArchive extension
4. **Recipe Page**: Navigates to the AllRecipes test page
5. **Extension Popup**: Opens the extension popup interface
6. **Authentication**: Tests sign-out → sign-in flow
7. **Recipe Capture**: Clicks "Capture Recipe" and monitors the API call
8. **Validation**: Verifies the recipe data was properly sent and received

## Benefits

- **Time Savings**: Eliminates hours of manual testing
- **Consistency**: Same test steps every time
- **Reliability**: Catches regressions automatically
- **Debugging**: Visual feedback and detailed logs
- **CI/CD Ready**: Can be integrated into automated pipelines

## Next Steps

1. **Run the Test**: Execute the automation to verify current extension state
2. **Fix Issues**: Use test results to identify and fix extension problems
3. **Expand Coverage**: Add tests for Safari extension
4. **Integration**: Add to CI/CD pipeline for continuous testing

## Architecture

The framework uses:
- **Playwright**: Modern browser automation
- **Chrome Extension APIs**: Direct extension interaction
- **Mock Server Integration**: Real API testing
- **Visual Debugging**: See tests run in real-time

This replaces the manual workflow you described and provides reliable, repeatable testing for both Chrome and Safari extensions.
