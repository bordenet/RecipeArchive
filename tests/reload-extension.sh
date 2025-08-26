#!/bin/bash

# Quick Chrome Extension Reload Script
echo "🔄 Reloading Chrome Extension..."

EXTENSION_PATH="/Users/Matt.Bordenet/GitHub/RecipeArchive/extensions/chrome"

echo "📁 Extension path: $EXTENSION_PATH"

# Check if required files exist
if [ ! -f "$EXTENSION_PATH/manifest.json" ]; then
    echo "❌ manifest.json not found!"
    exit 1
fi

echo "✅ Extension files verified"

# Instructions for manual reload
echo ""
echo "🔄 To reload the extension in Chrome:"
echo "1. Go to chrome://extensions/"
echo "2. Find 'RecipeArchive Chrome Extension'"
echo "3. Click the refresh icon 🔄"
echo ""
echo "Or reload all extensions with: chrome://extensions/"
echo ""
echo "🧪 Test the extension with:"
echo "• Test page: file://$PWD/tests/chrome-extension-test.html"
echo "• Extension popup: Click the extension icon"
echo ""

# Check if Chrome is running with our extension
if pgrep -f "Google Chrome.*load-extension.*chrome" > /dev/null; then
    echo "✅ Chrome is running with extension loaded"
else
    echo "⚠️ Chrome may not be running with extension"
    echo "💡 Launch with: open -a 'Google Chrome' --args --load-extension='$EXTENSION_PATH'"
fi
