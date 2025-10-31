#!/usr/bin/env bash

################################################################################
# RecipeArchive Android App Runner
################################################################################
# PURPOSE: Launch RecipeArchive app on Android emulator
#   - Finds Android SDK installation
#   - Starts emulator if not running
#   - Runs Flutter app on emulator
#
# USAGE:
#   ./scripts/android/run.sh
#
# EXAMPLES:
#   ./scripts/android/run.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Android SDK
#   - Android Emulator
#
# NOTES:
#   - Automatically starts emulator if not running
#   - Uses ./scripts/android/emulator.sh for emulator management
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"

log_header "Android App Runner"

# Find Android SDK
log_section "Locating Android SDK"

ANDROID_SDK_ROOT=""
if [[ -d "$HOME/Library/Android/sdk" ]]; then
    ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
elif [[ -d "/usr/local/share/android-sdk" ]]; then
    ANDROID_SDK_ROOT="/usr/local/share/android-sdk"
elif [[ -n "${ANDROID_HOME:-}" ]]; then
    ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [[ -z "$ANDROID_SDK_ROOT" ]]; then
    die "Android SDK not found. Please run ./scripts/android/setup.sh first."
fi

export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

log_success "Android SDK found: $ANDROID_SDK_ROOT"

# Check if emulator is running
log_section "Checking Emulator Status"

if ! adb devices | grep -q "emulator"; then
    log_warning "Emulator not running"
    log_info "Starting emulator..."
    "$SCRIPT_DIR/emulator.sh" start
fi

log_success "Emulator is running"

# Run the app
log_section "Launching App"
cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

log_info "Starting RecipeArchive on Android emulator..."
require_command "flutter" "brew install flutter"

if ! flutter run; then
    die "Flutter run failed"
fi

log_success "App launched successfully"
