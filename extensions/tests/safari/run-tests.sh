#!/bin/bash

# Safari Extension Test Runner
# Runs comprehensive tests for Safari browser extension

set -e

echo "🧪 Starting Safari Extension Test Suite"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from the test directory."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing test dependencies..."
    npm install
fi

echo ""
echo "🔧 Running CONFIG tests..."
npm run test:config

echo ""
echo "🎨 Running Popup tests..."
npm run test:popup

echo ""
echo "🔐 Running Authentication tests..."
npm run test:auth

echo ""
echo "📊 Running full test suite with coverage..."
npm run test:coverage

echo ""
echo "✅ All tests completed!"
echo ""
echo "📋 Test Summary:"
echo "- CONFIG initialization and environment handling"
echo "- Popup interface and development controls"
echo "- Cognito authentication flow and session management"
echo ""
echo "📁 Coverage report available in coverage/ directory"
echo "🌐 Open coverage/lcov-report/index.html in browser for detailed report"
