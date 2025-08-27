#!/bin/bash
# RecipeArchive Extension Development Helper
# Streamlined testing and reloading for Chrome and Safari extensions

set -e

CHROME_EXTENSION_DIR="/Users/matt/GitHub/RecipeArchive/extensions/chrome"
SAFARI_EXTENSION_DIR="/Users/matt/GitHub/RecipeArchive/extensions/safari"

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

reload_chrome() {
    echo "🔄 Chrome Extension Reload Process:"
    echo "1. Opening chrome://extensions/ in Chrome..."
    open -a "Google Chrome" "chrome://extensions/"
    echo "2. ✨ Manual Steps (30 seconds):"
    echo "   - Click the reload button (🔄) for RecipeArchive Chrome"
    echo "   - Test the extension on any recipe page"
    echo "✅ Chrome extension reload initiated"
}

reload_safari() {
    echo "🔄 Safari Extension Reload Process:"
    echo "1. Opening Safari Extension Preferences..."
    open -a Safari
    echo "2. ✨ Manual Steps (30 seconds):"
    echo "   - Safari → Preferences → Extensions"
    echo "   - Toggle RecipeArchive Safari OFF then ON"
    echo "   - Test the extension on any recipe page"
    echo "✅ Safari extension reload initiated"
}

test_chrome() {
    echo "🧪 Chrome Extension Test:"
    echo "1. Opening test recipe page..."
    open -a "Google Chrome" "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"
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
    open -a Safari "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"
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
    open -a "Google Chrome" "chrome://extensions/"
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
    echo "   Chrome popup.js: $(stat -f '%Sm' popup.js)"
    cd "$SAFARI_EXTENSION_DIR"  
    echo "   Safari popup.js: $(stat -f '%Sm' popup.js)"
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