#!/usr/bin/env bash

################################################################################
# RecipeArchive Washington Post Cookie Capture
################################################################################
# PURPOSE: Capture authentication cookies for Washington Post recipe parsing
#   - Launch browser for Washington Post login
#   - Guide through authentication process
#   - Save subscription cookies for automated parsing
#
# USAGE:
#   ./scripts/capture-wapost-cookies.sh
#
# EXAMPLES:
#   ./scripts/capture-wapost-cookies.sh
#
# DEPENDENCIES:
#   - Go
#   - Google Chrome
#
# NOTES:
#   - Requires active Washington Post subscription
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Paths
readonly REPO_ROOT="$(get_repo_root)"
readonly TOOL_DIR="$REPO_ROOT/tools/cmd/wapost-cookies"

# Main function
main() {
    log_header "Washington Post Cookie Capture"

    log_info "This script will:"
    echo "  1. Launch a browser window for Washington Post login"
    echo "  2. Guide you through the authentication process"
    echo "  3. Save your subscription cookies for automated recipe parsing"
    echo ""

    log_info "Requirements:"
    echo "  - Active Washington Post subscription"
    echo "  - Chrome browser installed"
    echo ""

    # Validate dependencies
    require_command "go" "brew install go"
    require_directory "$TOOL_DIR" "Tool directory not found: $TOOL_DIR"

    log_section "Starting Cookie Capture Tool"

    # Navigate to tool directory and run
    cd "$TOOL_DIR" || die "Failed to change to tool directory"

    if ! go run main.go; then
        die "Cookie capture tool failed"
    fi

    log_success "Cookie capture complete"
}

main "$@"
