#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS App Runner (Legacy)
################################################################################
# PURPOSE: Launch RecipeArchive app on iOS simulator
#   - Finds and boots available iOS simulator
#   - Runs Flutter app on simulator
#   - Falls back to manual instructions if needed
#
# USAGE:
#   ./scripts/ios/run.sh
#
# EXAMPLES:
#   ./scripts/ios/run.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Xcode Command Line Tools
#   - iOS Simulator
#
# NOTES:
#   - LEGACY: Use ./scripts/ios/build.sh --dev --run instead
#   - Auto-creates .env if missing
#   - Attempts to find shutdown simulator and boot it
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

log_header "iOS App Runner (Legacy)"

log_warning "This is a legacy script. Recommended: ./scripts/ios/build.sh --dev --run"

# Find Flutter directory
if [[ -f "$REPO_ROOT/pubspec.yaml" ]]; then
    FLUTTER_DIR="$REPO_ROOT"
else
    FLUTTER_DIR="$REPO_ROOT/recipe_archive"
fi

cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

# Validate dependencies
require_command "flutter" "brew install flutter"
require_command "xcrun" "xcode-select --install"

# Create .env if missing
if [[ ! -f ".env" ]]; then
    echo "DUMMY_CONFIG=true" > .env
    log_debug "Created .env file"
fi

# Try to find a shutdown simulator
log_section "Finding iOS Simulator"

SIMULATOR_ID=$(xcrun simctl list devices iPhone | grep -E "iPhone [0-9]+" | grep "Shutdown" | head -1 | grep -o '[A-F0-9-]\{36\}' || true)

if [[ -z "$SIMULATOR_ID" ]]; then
    # Try any iPhone simulator
    SIMULATOR_ID=$(xcrun simctl list devices | grep "Shutdown" | grep "iPhone" | head -1 | grep -o '[A-F0-9-]\{36\}' || true)
fi

if [[ -n "$SIMULATOR_ID" ]]; then
    log_info "Booting iOS simulator: $SIMULATOR_ID"
    xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || log_debug "Simulator already booted or boot failed"
    open -a Simulator

    log_info "Waiting for simulator to be ready (5 seconds)..."
    sleep 5

    log_section "Launching App"
    if flutter devices | grep -q "iOS Simulator"; then
        if ! flutter run -d "iOS Simulator"; then
            die "Flutter run failed"
        fi
    else
        log_warning "Flutter not detecting simulator yet. Trying direct run..."
        if ! flutter run; then
            die "Flutter run failed"
        fi
    fi
else
    log_warning "No shutdown iOS simulator found"
    log_info "Opening Simulator app..."
    open -a Simulator

    echo ""
    log_info "Manual steps:"
    echo "  1. Wait for Simulator to open"
    echo "  2. Select Device > iOS > iPhone (any model)"
    echo "  3. Run: flutter run"
    echo ""
    log_info "Or run in Xcode:"
    echo "  1. open ios/Runner.xcworkspace"
    echo "  2. Select an iOS simulator"
    echo "  3. Click Run (▶️)"

    log_warning "Attempting flutter run anyway..."
    flutter run || log_error "Flutter run failed. Follow manual steps above."
fi

log_success "iOS app runner completed"
