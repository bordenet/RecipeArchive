#!/bin/bash

################################################################################
#
# Chrome Extension Manual Test Script
#
# This script helps with manual testing of the Chrome extension. It checks for
# the existence of required files, validates the syntax of manifest.json and
# JavaScript files, starts a mock server for testing, and provides clear
# instructions for manual testing.
#
# USAGE:
#   ./test-chrome-extension.sh
#
# DEPENDENCIES:
#   - python3
#   - node
#   - eslint
#   - go
#   - Google Chrome
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

# Chrome Extension Manual Test Script
echo "🧪 RecipeArchive Chrome Extension Test Suite"
echo "=============================================="

# Function to open a URL in the default browser
open_url() {
    case "$(uname -s)" in
        Darwin)
            open "$1"
            ;;
        *)
            echo "Unsupported operating system: $(uname -s)"
            ;;
    esac
}

# Check if Chrome extension files exist
echo ""
echo "1️⃣ Checking extension files..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../extensions/chrome"

# Core files check
files_to_check=(
    "manifest.json"
    "background.js"
    "content-safe.js"
    "popup.html"
    "popup.js"
    "icon16.png"
    "icon32.png"
    "icon48.png"
    "icon128.png"
)

all_files_exist=true
for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo "❌ Some required files are missing. Extension will not load."
    exit 1
fi

echo ""
echo "2️⃣ Validating manifest.json syntax..."
if cat manifest.json | python3 -m json.tool > /tmp/test-chrome-extension.log 2>&1; then
    echo "✅ manifest.json syntax is valid"
else
    echo "❌ manifest.json syntax is invalid"
    echo "Error details:"
    cat /tmp/test-chrome-extension.log
    exit 1
fi

echo ""
echo "3️⃣ Checking JavaScript syntax with ESLint..."
if npx eslint . > /tmp/test-chrome-extension.log 2>&1; then
    echo "✅ JavaScript files syntax is valid"
else
    echo "❌ JavaScript files have syntax errors"
    cat /tmp/test-chrome-extension.log
    exit 1
fi

echo ""
echo "4️⃣ Starting mock server for testing..."
cd "$SCRIPT_DIR/../aws-backend/functions/local-server"

# Check if server is already running
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Mock server already running"
else
    echo "🚀 Starting mock server..."
    go run main.go &
    SERVER_PID=$!
    echo "Server PID: $SERVER_PID"
    
    # Wait for server to start
    echo "⏳ Waiting for server to start..."
    for i in {1..10}; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo "✅ Mock server started successfully"
            break
        fi
        echo "   Attempt $i/10..."
        sleep 1
    done
    
    if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "❌ Mock server failed to start"
        exit 1
    fi
fi

# Add a trap to kill the server on exit
trap 'kill $SERVER_PID' EXIT

echo ""
echo "5️⃣ Opening test page and Chrome with extension..."

# Open test page
TEST_PAGE_PATH="$SCRIPT_DIR/chrome-extension-validation.html"
open_url "file://$TEST_PAGE_PATH"

# Launch Chrome with extension
EXTENSION_PATH="$SCRIPT_DIR/../extensions/chrome"
echo "🌐 Launching Chrome with extension..."
case "$(uname -s)" in
    Darwin)
        open -a 'Google Chrome' --args --load-extension="$EXTENSION_PATH" --new-window
        ;;
    *)
        echo "Unsupported operating system: $(uname -s)"
        ;;
esac

echo ""
echo "6️⃣ Manual Testing Instructions:"
echo "================================"
echo ""
echo "A. In Chrome, check the extensions page:"
echo "   1. Go to chrome://extensions/"
echo "   2. Enable Developer mode"
echo "   3. Look for 'RecipeArchive Chrome Extension'"
echo "   4. Check for any error messages"
echo ""
echo "B. Test the extension popup:"
echo "   1. Click the RecipeArchive extension icon in toolbar"
echo "   2. Check if popup opens without errors"
echo "   3. Check browser console for any error messages"
echo ""
echo "C. Test recipe capture:"
echo "   1. Go to the test page that opened"
echo "   2. Open the extension popup"
echo "   3. Click 'Capture Recipe' button"
echo "   4. Verify the recipe data is captured"
echo ""
echo "D. Check browser console:"
echo "   1. Open DevTools (F12)"
echo "   2. Look for RecipeArchive console messages"
echo "   3. Check for any errors in red"
echo ""
echo "✅ Test setup complete!"
echo ""
echo "🔍 Check the following URLs:"
echo "   • Test page: file://$TEST_PAGE_PATH"
echo "   • Extensions: chrome://extensions/"
echo "   • Mock server: http://localhost:8080/health"
echo ""
echo "💡 The mock server will be stopped automatically when you exit this script."
