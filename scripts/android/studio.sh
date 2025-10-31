#!/usr/bin/env bash

################################################################################
# RecipeArchive Android Studio Launcher
################################################################################
# PURPOSE: Opens Android project in Android Studio
#   - Locates Flutter project Android directory
#   - Launches Android Studio with correct project path
#
# USAGE:
#   ./scripts/android/studio.sh
#
# EXAMPLES:
#   ./scripts/android/studio.sh
#
# DEPENDENCIES:
#   - Android Studio
#
# NOTES:
#   - Run from repository root
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"
readonly ANDROID_DIR="$FLUTTER_DIR/android"

log_header "Android Studio Launcher"

# Validate Android directory exists
require_directory "$ANDROID_DIR" "Android directory not found: $ANDROID_DIR"

# Check if Android Studio is installed
if ! is_macos; then
    die "This script currently only supports macOS. For other platforms, manually open $ANDROID_DIR in Android Studio."
fi

if [[ ! -d "/Applications/Android Studio.app" ]]; then
    die "Android Studio not found. Please install Android Studio first."
fi

log_info "Opening Android project in Android Studio..."
open -a "Android Studio" "$ANDROID_DIR"

log_success "Android Studio launched"
