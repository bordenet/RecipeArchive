#!/bin/bash

################################################################################
#
# Chrome Extension Automation Test Runner
#
# PURPOSE:
#   This script runs comprehensive end-to-end tests for the Chrome extension
#   using Playwright. It ensures that the extension behaves as expected in a
#   real browser environment.
#
# USAGE:
#   ./tests/automation/run-chrome-tests.sh
#
# HOW IT WORKS:
#   1.  Checks if the mock server is running, and starts it if necessary.
#   2.  Installs Playwright and the required browser if they are not already
#       installed.
#   3.  Runs the Playwright tests defined in the configuration file.
#   4.  Generates and opens an HTML report with the test results.
#
# DEPENDENCIES:
#   - Node.js and npm
#   - Go (for the mock server)
#   - Playwright
#
# NOTES:
#   - This script is intended to be run from the root of the monorepo.
#
################################################################################

# Chrome Extension Automation Test Runner
# This script runs comprehensive end-to-end tests for the Chrome extension

set -e

echo "🚀 Starting Chrome Extension Automation Tests"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Check if mock server is running
echo "🔍 Checking mock server status..."
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Mock server is running"
else
    echo "⚠️ Mock server not running - starting it..."
    cd aws-backend/functions/local-server
    go run main.go &
    SERVER_PID=$!
    cd ../../..
    
    # Wait for server to start
    echo "⏳ Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo "✅ Mock server started successfully"
            break
        fi
        sleep 1
    done
    
    if [ $i -eq 30 ]; then
        echo "❌ Failed to start mock server"
        exit 1
    fi
fi

# Install Playwright if not already installed
echo "🔧 Checking Playwright installation..."
if ! npm list @playwright/test > /dev/null 2>&1; then
    echo "📦 Installing Playwright..."
    npm install --save-dev @playwright/test
fi

# Install browsers if needed
echo "🌐 Installing/updating Playwright browsers..."
npx playwright install chromium

# Run the extension tests
echo "🧪 Running Chrome extension tests..."
cd tests/automation
npx playwright test --config=playwright.config.js

# Generate and open test report
echo "📊 Generating test report..."
npx playwright show-report

echo "✅ Test run completed!"
echo ""
echo "📝 Test Results Summary:"
echo "- Check the HTML report that opened in your browser"
echo "- Screenshots and videos of failed tests are in test-results/"
echo "- Mock server logs show API calls made by the extension"
