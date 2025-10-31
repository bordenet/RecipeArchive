#!/usr/bin/env bash

################################################################################
# RecipeArchive Extension Quick Test
################################################################################
# PURPOSE: Quick way to test both Chrome and Safari extensions
#   - Opens extension management pages
#   - Opens test recipe pages
#   - Provides manual testing checklist
#
# USAGE:
#   ./scripts/quick-test.sh
#
# EXAMPLES:
#   ./scripts/quick-test.sh
#
# DEPENDENCIES:
#   - Google Chrome
#   - Safari (macOS only)
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

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

# Open specific browser with URL
open_browser() {
    local browser="$1"
    local url="${2:-}"

    if is_macos; then
        if [[ -n "$url" ]]; then
            open -a "$browser" "$url"
        else
            open -a "$browser"
        fi
    elif is_linux; then
        if [[ "$browser" == "Google Chrome" ]]; then
            google-chrome "$url" 2>/dev/null || chromium-browser "$url" 2>/dev/null
        else
            xdg-open "$url"
        fi
    else
        die "Unsupported operating system: $(uname -s)"
    fi
}

# Main test flow
main() {
    log_header "RecipeArchive Extension Quick Test"

    log_section "Step 1: Reload Extensions"

    log_info "Opening Chrome extensions page..."
    open_browser "Google Chrome" "chrome://extensions/"

    if is_macos; then
        log_info "Opening Safari (enable extension in preferences)"
        open_browser "Safari"
    fi

    log_info "Waiting for browsers to load..."
    sleep 3

    log_section "Step 2: Opening Test Recipe Pages"

    log_info "Chrome: Opening Smitten Kitchen test recipe"
    open_browser "Google Chrome" "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"

    if is_macos; then
        log_info "Safari: Opening Love & Lemons test recipe"
        open_browser "Safari" "https://loveandlemons.com/banana-bread-recipe/"
    fi

    log_success "Quick test setup complete"

    echo ""
    log_info "Manual Testing Steps (2 minutes):"
    echo "  1. Chrome: Reload extension → Test on Smitten Kitchen page"
    echo "  2. Safari: Toggle extension → Test on Love & Lemons page"
    echo ""
    log_info "Success Criteria:"
    echo "  ✓ Extension popup opens in <1 second"
    echo "  ✓ Authentication status shows correctly"
    echo "  ✓ Recipe capture completes in <3 seconds"
    echo "  ✓ No JavaScript console errors"
}

main "$@"
