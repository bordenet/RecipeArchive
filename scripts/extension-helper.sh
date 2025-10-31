#!/usr/bin/env bash

################################################################################
# RecipeArchive Extension Development Helper
################################################################################
# PURPOSE: Streamline testing and reloading for Chrome and Safari extensions
#   - Reload extensions in browsers
#   - Run manual tests with test pages
#   - Show extension logs and debugging tools
#   - Display extension development status
#
# USAGE:
#   ./scripts/extension-helper.sh [command] [browser]
#
# COMMANDS:
#   reload chrome    - Reload Chrome extension
#   reload safari    - Reload Safari extension
#   test chrome      - Run Chrome extension test
#   test safari      - Run Safari extension test
#   logs chrome      - Show Chrome extension logs
#   logs safari      - Show Safari extension logs
#   status           - Show extension development status
#
# EXAMPLES:
#   ./scripts/extension-helper.sh reload chrome
#   ./scripts/extension-helper.sh test safari
#   ./scripts/extension-helper.sh status
#
# DEPENDENCIES:
#   - Google Chrome
#   - Safari (macOS only)
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Paths
readonly REPO_ROOT="$(get_repo_root)"
readonly CHROME_EXTENSION_DIR="$REPO_ROOT/extensions/chrome"
readonly SAFARI_EXTENSION_DIR="$REPO_ROOT/extensions/safari"

# Open URL in default browser
open_url() {
    local url="$1"

    if is_macos; then
        open "$url"
    elif is_linux; then
        xdg-open "$url"
    else
        die "Unsupported operating system: $(uname -s)"
    fi
}

# Reload Chrome extension
reload_chrome() {
    log_section "Chrome Extension Reload"

    log_info "Opening chrome://extensions/ in Chrome..."
    open_url "chrome://extensions/"

    echo ""
    log_info "Manual Steps (30 seconds):"
    echo "  1. Click the reload button (🔄) for RecipeArchive Chrome"
    echo "  2. Test the extension on any recipe page"

    log_success "Chrome extension reload initiated"
}

# Reload Safari extension
reload_safari() {
    log_section "Safari Extension Reload"

    log_info "Opening Safari Extension Preferences..."
    open_url "x-safari-extension://show-preferences?tab=extensions"

    echo ""
    log_info "Manual Steps (30 seconds):"
    echo "  1. Safari → Preferences → Extensions"
    echo "  2. Toggle RecipeArchive Safari OFF then ON"
    echo "  3. Test the extension on any recipe page"

    log_success "Safari extension reload initiated"
}

# Test Chrome extension
test_chrome() {
    log_section "Chrome Extension Test"

    log_info "Opening test recipe page..."
    open_url "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"

    echo ""
    log_info "Test Steps:"
    echo "  1. Click the RecipeArchive extension icon"
    echo "  2. Verify authentication status"
    echo "  3. Click 'Capture Recipe' button"
    echo "  4. Check for success/error messages"

    log_success "Chrome test page opened"
}

# Test Safari extension
test_safari() {
    log_section "Safari Extension Test"

    log_info "Opening test recipe page..."
    open_url "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"

    echo ""
    log_info "Test Steps:"
    echo "  1. Click the RecipeArchive extension icon"
    echo "  2. Verify authentication status"
    echo "  3. Click 'Capture Recipe' button"
    echo "  4. Check for success/error messages"

    log_success "Safari test page opened"
}

# Show Chrome extension logs
show_logs_chrome() {
    log_section "Chrome Extension Logs"

    log_info "Opening Chrome Developer Tools..."
    open_url "chrome://extensions/"

    echo ""
    log_info "Manual Steps:"
    echo "  1. Find RecipeArchive Chrome extension"
    echo "  2. Click 'Inspect views: popup.html'"
    echo "  3. Check Console tab for errors/logs"

    log_success "Chrome extension debugging initiated"
}

# Show Safari extension logs
show_logs_safari() {
    log_section "Safari Extension Logs"

    echo ""
    log_info "Manual Steps:"
    echo "  1. Safari → Develop → Web Extension Background Pages → RecipeArchive Safari"
    echo "  2. Or: Safari → Develop → Show Extension Builder"
    echo "  3. Check Console for errors/logs"

    log_success "Safari extension debugging initiated"
}

# Show extension development status
show_status() {
    log_header "Extension Development Status"

    log_section "Extension Directories"
    echo "  Chrome: $CHROME_EXTENSION_DIR"
    echo "  Safari: $SAFARI_EXTENSION_DIR"

    log_section "Recent Changes"

    # Chrome popup.js modification time
    if [[ -f "$CHROME_EXTENSION_DIR/popup.js" ]]; then
        if is_macos; then
            local chrome_time=$(stat -f '%Sm' "$CHROME_EXTENSION_DIR/popup.js")
        else
            local chrome_time=$(stat -c %y "$CHROME_EXTENSION_DIR/popup.js")
        fi
        echo "  Chrome popup.js: $chrome_time"
    else
        log_warning "Chrome popup.js not found"
    fi

    # Safari popup.js modification time
    if [[ -f "$SAFARI_EXTENSION_DIR/popup.js" ]]; then
        if is_macos; then
            local safari_time=$(stat -f '%Sm' "$SAFARI_EXTENSION_DIR/popup.js")
        else
            local safari_time=$(stat -c %y "$SAFARI_EXTENSION_DIR/popup.js")
        fi
        echo "  Safari popup.js: $safari_time"
    else
        log_warning "Safari popup.js not found"
    fi

    log_section "Quick Actions"
    echo "  $0 reload chrome"
    echo "  $0 test safari"

    log_success "Extensions ready for testing"
}

# Print usage information
print_usage() {
    cat << EOF
Usage: $(basename "$0") [command] [browser]

Extension development helper for streamlined testing and reloading.

Commands:
    reload chrome    Reload Chrome extension
    reload safari    Reload Safari extension
    test chrome      Run Chrome extension test
    test safari      Run Safari extension test
    logs chrome      Show Chrome extension logs
    logs safari      Show Safari extension logs
    status           Show extension development status
    -h, --help       Show this help message

Examples:
    $(basename "$0") reload chrome
    $(basename "$0") test safari
    $(basename "$0") status
EOF
}

# Main command handler
main() {
    local command="${1:-}"
    local browser="${2:-}"

    case "$command" in
        reload)
            case "$browser" in
                chrome) reload_chrome ;;
                safari) reload_safari ;;
                *) die "Usage: $0 reload [chrome|safari]" ;;
            esac
            ;;
        test)
            case "$browser" in
                chrome) test_chrome ;;
                safari) test_safari ;;
                *) die "Usage: $0 test [chrome|safari]" ;;
            esac
            ;;
        logs)
            case "$browser" in
                chrome) show_logs_chrome ;;
                safari) show_logs_safari ;;
                *) die "Usage: $0 logs [chrome|safari]" ;;
            esac
            ;;
        status)
            show_status
            ;;
        help|-h|--help)
            print_usage
            exit 0
            ;;
        "")
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            print_usage
            exit 1
            ;;
    esac
}

main "$@"
