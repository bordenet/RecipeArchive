#!/bin/bash

################################################################################
#
# Quick Extension Test Script
#
# This script provides a quick way to test both Chrome and Safari extensions.
#
# USAGE:
#   ./quick-test.sh
#
# DEPENDENCIES:
#   - Google Chrome
#   - Safari (macOS only)
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

# Quick Extension Test - One command to test both browsers
# Usage: ./scripts/quick-test.sh

echo "🚀 RecipeArchive Extension Quick Test"
echo "==============================================="

open_url() {
    case "$(uname -s)" in
        Darwin)
            open "$1"
            ;;
        Linux)
            xdg-open "$1"
            ;;
        *)
            echo "Unsupported operating system: $(uname -s)"
            ;;
    esac
}

open_browser() {
    case "$(uname -s)" in
        Darwin)
            open -a "$1" "$2"
            ;;
        Linux)
            if [ "$1" == "Google Chrome" ]; then
                google-chrome "$2"
            else
                xdg-open "$2"
            fi
            ;;
        *)
            echo "Unsupported operating system: $(uname -s)"
            ;;
    esac
}

echo ""
echo "🔄 Step 1: Reload Extensions"
echo "Chrome: Opening chrome://extensions/"
open_browser "Google Chrome" "chrome://extensions/"

if [[ "$(uname)" == "Darwin" ]]; then
    echo "Safari: Opening Safari preferences"
    open_browser "Safari"
fi

echo ""
echo "⏱️  Waiting 3 seconds for browsers to load..."
sleep 3

echo ""
echo "🧪 Step 2: Opening Test Recipe Page"
echo "Chrome test page:"
open_browser "Google Chrome" "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"

if [[ "$(uname)" == "Darwin" ]]; then
    echo "Safari test page:"  
    open_browser "Safari" "https://loveandlemons.com/banana-bread-recipe/"
fi

echo ""
echo "✅ Quick Test Setup Complete!"
echo ""
echo "📋 Next Manual Steps (2 minutes total):"
echo "1. Chrome: Reload extension → Test on Smitten Kitchen page"
echo "2. Safari: Toggle extension → Test on Love & Lemons page"
echo ""
echo "🎯 Success Criteria:"
echo "✓ Extension popup opens in <1 second"
echo "✓ Authentication status shows correctly"
echo "✓ Recipe capture completes in <3 seconds"
echo "✓ No JavaScript console errors"