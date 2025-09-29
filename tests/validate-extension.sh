#!/bin/bash

################################################################################
#
# Chrome Extension Validation Script
#
# This script validates the Chrome extension files. It checks the syntax of
# manifest.json and JavaScript files, and checks for the existence of required
# files.
#
# USAGE:
#   ./validate-extension.sh
#
# DEPENDENCIES:
#   - jq or python3
#   - node
#   - eslint
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
EXTENSION_DIR="$SCRIPT_DIR/../extensions/chrome"

echo "🔍 Validating Chrome extension files in $EXTENSION_DIR..."

cd "$EXTENSION_DIR"

echo "📁 Current directory: $(pwd)"
echo "📄 Files in extension directory:"
ls -la

echo ""
echo "🔧 Checking manifest.json syntax..."
if command -v jq &> /dev/null; then
    if jq . manifest.json > /tmp/validate-extension.log 2>&1; then
        echo "✅ manifest.json syntax is valid"
    else
        echo "❌ manifest.json has syntax errors"
        cat /tmp/validate-extension.log
        exit 1
    fi
else
    echo "⚠️ jq not installed, using python to check JSON"
    if python3 -m json.tool < manifest.json > /tmp/validate-extension.log 2>&1; then
        echo "✅ manifest.json syntax is valid"
    else
        echo "❌ manifest.json has syntax errors"
        cat /tmp/validate-extension.log
        exit 1
    fi
fi

echo ""
echo "🔧 Checking JavaScript files with ESLint..."
if npx eslint . > /tmp/validate-extension.log 2>&1; then
    echo "✅ JavaScript files syntax is valid"
else
    echo "❌ JavaScript files have syntax errors"
    cat /tmp/validate-extension.log
    exit 1
fi

echo ""
echo "🔧 Checking required files exist..."

required_files=("manifest.json" "background.js" "content-safe.js" "popup-test.html")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
        exit 1
    fi
done

echo ""
echo "🔧 Checking icon files..."
icon_files=("icon16.png" "icon32.png" "icon48.png" "icon128.png")
for icon in "${icon_files[@]}"; do
    if [ -f "$icon" ]; then
        echo "✅ $icon exists"
    else
        echo "❌ $icon is missing"
        exit 1
    fi
done

echo ""
echo "🔧 Checking popup HTML..."
if [ -f "popup-test.html" ]; then
    echo "✅ popup-test.html exists"
    # Basic HTML validation
    if grep -q "<html" popup-test.html && grep -q "</html>" popup-test.html; then
        echo "✅ popup-test.html has basic HTML structure"
    else
        echo "❌ popup-test.html missing basic HTML structure"
        exit 1
    fi
else
    echo "❌ popup-test.html is missing"
    exit 1
fi

echo ""
echo "✅ Extension validation complete"
