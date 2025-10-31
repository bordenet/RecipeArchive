#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS Xcode Launcher
################################################################################
# PURPOSE: Open iOS project in Xcode
#   - Updates Flutter dependencies
#   - Creates .env if missing
#   - Opens Runner.xcworkspace in Xcode
#   - Provides next steps guidance
#
# USAGE:
#   ./scripts/ios/xcode.sh
#
# EXAMPLES:
#   ./scripts/ios/xcode.sh
#
# DEPENDENCIES:
#   - Xcode
#   - Flutter SDK
#
# NOTES:
#   - Called by ios/build.sh for device builds
#   - Opens workspace (not project) to include CocoaPods
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

log_header "iOS Xcode Launcher"

# Find Flutter directory
if [[ -f "$REPO_ROOT/pubspec.yaml" ]]; then
    FLUTTER_DIR="$REPO_ROOT"
    IOS_WORKSPACE="ios/Runner.xcworkspace"
else
    FLUTTER_DIR="$REPO_ROOT/recipe_archive"
    IOS_WORKSPACE="$FLUTTER_DIR/ios/Runner.xcworkspace"
fi

cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

# Validate dependencies
require_command "flutter" "brew install flutter"

if ! is_macos; then
    die "Xcode is only available on macOS"
fi

if [[ ! -d "/Applications/Xcode.app" ]]; then
    die "Xcode not found. Please install Xcode from the App Store."
fi

# Create .env if missing
log_section "Checking Environment"
if [[ ! -f ".env" ]]; then
    echo "DUMMY_CONFIG=true" > .env
    log_success "Created .env file"
else
    log_debug ".env file exists"
fi

# Update dependencies
log_section "Updating Dependencies"
if ! flutter pub get > /dev/null 2>&1; then
    die "Failed to update Flutter dependencies"
fi
log_success "Dependencies updated"

# Open Xcode
log_section "Opening Xcode"

if [[ ! -d "$IOS_WORKSPACE" ]]; then
    die "Xcode workspace not found at $IOS_WORKSPACE. Run 'pod install' in ios/ directory."
fi

log_info "Opening $IOS_WORKSPACE..."
open "$IOS_WORKSPACE"

log_success "Xcode opened with RecipeArchive iOS project"

# Provide guidance
echo ""
log_info "Next steps in Xcode:"
echo "  1. Wait for Xcode to load the project"
echo "  2. In the device dropdown (top-left), select an iOS Simulator:"
echo "     • iPhone 15"
echo "     • iPhone 15 Pro"
echo "     • iPhone 15 Pro Max"
echo "     • iPad (any model)"
echo "  3. Click the Run button (▶️) or press Cmd+R"
echo ""
log_info "Features to test:"
echo "  📱 Wakelock: Screen stays awake during recipe viewing"
echo "  🔒 Visual indicator: Lock icon in recipe detail app bar"
echo "  📋 Mobile-optimized Extensions page"
echo "  🧭 Platform-aware navigation"
echo ""
log_info "Pro tip: Once the simulator is running, you can also use:"
echo "  flutter run (from terminal)"
