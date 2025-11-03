#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS Simulator Launcher
################################################################################
# PURPOSE: Start iOS simulator and run RecipeArchive app
#   - Auto-detects simulator or targets specific UDID
#   - Opens Simulator app
#   - Runs Flutter app on simulator
#
# USAGE:
#   ./scripts/ios/simulator.sh [UDID]
#
# EXAMPLES:
#   ./scripts/ios/simulator.sh                           # Auto-detect
#   ./scripts/ios/simulator.sh ABCD1234-5678-90EF-GHIJ   # Specific UDID
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Xcode Command Line Tools
#
# NOTES:
#   - Called by ios/build.sh --dev --run
#   - Waits 8 seconds for simulator to boot
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly UDID="${1:-}"

log_header "iOS Simulator Launcher"

# Find Flutter directory
if [[ -f "$REPO_ROOT/pubspec.yaml" ]]; then
    FLUTTER_DIR="$REPO_ROOT"
else
    FLUTTER_DIR="$REPO_ROOT/recipe_archive"
fi

cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

# Validate Flutter
require_command "flutter" "brew install flutter"
require_command "xcrun" "xcode-select --install"

if [[ -z "$UDID" ]]; then
    # Use standard iPhone 17 Pro Max simulator
    log_section "Launching iPhone 17 Pro Max Simulator"
    UDID=$(get_standard_ios_simulator)

    if [[ -z "$UDID" ]]; then
        die "iPhone 17 Pro Max simulator not found. Please create it in Xcode."
    fi

    log_info "Using iPhone 17 Pro Max: $UDID"
fi

# Boot and launch
xcrun simctl boot "$UDID" 2>/dev/null || log_debug "Simulator already booted"
open -a Simulator

log_info "Waiting for simulator to initialize (8 seconds)..."
sleep 8

log_info "Running Flutter app on iPhone 17 Pro Max..."
if ! flutter run -d "$UDID"; then
    die "Failed to launch app on simulator"
fi

log_success "iOS app launched successfully!"
