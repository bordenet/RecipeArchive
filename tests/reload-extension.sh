#!/bin/bash

################################################################################
#
# Chrome Extension Reload Script
#
# This script provides instructions for reloading the Chrome extension during
# development.
#
# USAGE:
#   ./reload-extension.sh
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

# Quick Chrome Extension Reload Script
echo "🔄 Reloading Chrome Extension..."

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
EXTENSION_PATH="$SCRIPT_DIR/../extensions/chrome"

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
echo "• Test page: file://$SCRIPT_DIR/chrome-extension-validation.html"
echo "• Extension popup: Click the extension icon"
echo ""

# Check if Chrome is running with our extension
if pgrep -f "Google Chrome.*load-extension.*chrome" > /dev/null; then
    echo "✅ Chrome is running with extension loaded"
else
    echo "⚠️ Chrome may not be running with extension"
    case "$(uname -s)" in
        Darwin)
            echo "💡 Launch with: open -a 'Google Chrome' --args --load-extension='$EXTENSION_PATH'"
            ;;
        *)
            echo "Unsupported operating system: $(uname -s)"
            ;;
    esac
fi
