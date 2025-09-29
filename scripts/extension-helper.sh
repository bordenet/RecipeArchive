#!/bin/bash

################################################################################
#
# RecipeArchive Extension Development Helper
#
# This script streamlines testing and reloading for Chrome and Safari extensions.
#
# USAGE:
#   ./extension-helper.sh [command] [browser]
#
# COMMANDS:
#   reload chrome    - Reload Chrome extension (opens chrome://extensions/)
#   reload safari    - Open Safari extension preferences
#   test chrome      - Run Chrome extension manual test
#   test safari      - Run Safari extension manual test
#   logs chrome      - Open Chrome extension console logs
#   logs safari      - Open Safari Web Inspector for extension
#   status           - Show extension development status
#
# DEPENDENCIES:
#   - Google Chrome
#   - Safari (macOS only)
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

# RecipeArchive Extension Development Helper
# Streamlined testing and reloading for Chrome and Safari extensions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROME_EXTENSION_DIR="$SCRIPT_DIR/../extensions/chrome"
SAFARI_EXTENSION_DIR="$SCRIPT_DIR/../extensions/safari"

show_help() {
    echo "RecipeArchive Extension Helper"
    echo ""
    echo "Usage: $0 [command] [browser]"
    echo ""
    echo "Commands:"
    echo "  reload chrome    - Reload Chrome extension (opens chrome://extensions/)"
    echo "  reload safari    - Open Safari extension preferences"
    echo "  test chrome      - Run Chrome extension manual test"
    echo "  test safari      - Run Safari extension manual test"
    echo "  logs chrome      - Open Chrome extension console logs"
    echo "  logs safari      - Open Safari Web Inspector for extension"
    echo "  status           - Show extension development status"
    echo ""
    echo "Examples:"
    echo "  $0 reload chrome"
    echo "  $0 test safari"
    echo "  $0 status"
}

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

reload_chrome() {
    echo "🔄 Chrome Extension Reload Process:"
    echo "1. Opening chrome://extensions/ in Chrome..."
    open_url "chrome://extensions/"
    echo "2. ✨ Manual Steps (30 seconds):"
    echo "   - Click the reload button (🔄) for RecipeArchive Chrome"
    echo "   - Test the extension on any recipe page"
    echo "✅ Chrome extension reload initiated"
}

reload_safari() {
    echo "🔄 Safari Extension Reload Process:"
    echo "1. Opening Safari Extension Preferences..."
    open_url "sfsafari://show-preferences?tab=extensions"
    echo "2. ✨ Manual Steps (30 seconds):"
    echo "   - Safari → Preferences → Extensions"
    echo "   - Toggle RecipeArchive Safari OFF then ON"
    echo "   - Test the extension on any recipe page"
    echo "✅ Safari extension reload initiated"
}

test_chrome() {
    echo "🧪 Chrome Extension Test:"
    echo "1. Opening test recipe page..."
    open_url "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"
    echo "2. ✨ Test Steps:"
    echo "   - Click the RecipeArchive extension icon"
    echo "   - Verify authentication status"
    echo "   - Click 'Capture Recipe' button"
    echo "   - Check for success/error messages"
    echo "✅ Chrome test page opened"
}

test_safari() {
    echo "🧪 Safari Extension Test:"
    echo "1. Opening test recipe page..."
    open_url "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"
    echo "2. ✨ Test Steps:"
    echo "   - Click the RecipeArchive extension icon"
    echo "   - Verify authentication status"
    echo "   - Click 'Capture Recipe' button"
    echo "   - Check for success/error messages"
    echo "✅ Safari test page opened"
}

show_logs_chrome() {
    echo "📋 Chrome Extension Logs:"
    echo "1. Opening Chrome Developer Tools..."
    open_url "chrome://extensions/"
    echo "2. ✨ Manual Steps:"
    echo "   - Find RecipeArchive Chrome extension"
    echo "   - Click 'Inspect views: popup.html'"
    echo "   - Check Console tab for errors/logs"
    echo "✅ Chrome extension debugging initiated"
}

show_logs_safari() {
    echo "📋 Safari Extension Logs:"
    echo "1. Opening Safari Web Inspector..."
    echo "2. ✨ Manual Steps:"
    echo "   - Safari → Develop → Web Extension Background Pages → RecipeArchive Safari"
    echo "   - Or: Safari → Develop → Show Extension Builder"
    echo "   - Check Console for errors/logs"
    echo "✅ Safari extension debugging initiated"
}

show_status() {
    echo "📊 RecipeArchive Extension Development Status:"
    echo ""
    echo "📁 Extension Directories:"
    echo "   Chrome: $CHROME_EXTENSION_DIR"
    echo "   Safari: $SAFARI_EXTENSION_DIR"
    echo ""
    echo "🔍 Recent Changes:"
    cd "$CHROME_EXTENSION_DIR"
    if [[ "$(uname)" == "Darwin" ]]; then
        echo "   Chrome popup.js: $(stat -f '%Sm' popup.js)"
    else
        echo "   Chrome popup.js: $(stat -c %y popup.js)"
    fi
    cd "$SAFARI_EXTENSION_DIR"
    if [[ "$(uname)" == "Darwin" ]]; then
        echo "   Safari popup.js: $(stat -f '%Sm' popup.js)"
    else
        echo "   Safari popup.js: $(stat -c %y popup.js)"
    fi
    echo ""
    echo "⚡ Quick Actions:"
    echo "   ./scripts/extension-helper.sh reload chrome"
    echo "   ./scripts/extension-helper.sh test safari"
    echo ""
    echo "✅ Extensions ready for testing"
}

case "$1" in
    "reload")
        case "$2" in
            "chrome") reload_chrome ;;
            "safari") reload_safari ;;
            *) echo "❌ Usage: $0 reload [chrome|safari]"; exit 1 ;;
        esac
        ;;
    "test")
        case "$2" in
            "chrome") test_chrome ;;
            "safari") test_safari ;;
            *) echo "❌ Usage: $0 test [chrome|safari]"; exit 1 ;;
        esac
        ;;
    "logs")
        case "$2" in
            "chrome") show_logs_chrome ;;
            "safari") show_logs_safari ;;
            *) echo "❌ Usage: $0 logs [chrome|safari]"; exit 1 ;;
        esac
        ;;
    "status") show_status ;;
    "help"|"-h"|"--help"|"") show_help ;;
    *) echo "❌ Unknown command: $1"; show_help; exit 1 ;;
esac