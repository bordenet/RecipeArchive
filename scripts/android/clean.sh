#!/usr/bin/env bash

################################################################################
# RecipeArchive Android Clean Script
################################################################################
# PURPOSE: Clean Android build artifacts
#   - Runs flutter clean
#   - Optionally runs Gradle clean (--deep)
#   - Removes build caches
#
# USAGE:
#   ./scripts/android/clean.sh [options]
#
# EXAMPLES:
#   ./scripts/android/clean.sh              # Standard clean
#   ./scripts/android/clean.sh --deep       # Deep clean with Gradle cache
#
# OPTIONS:
#   --deep    Cleans Gradle cache in addition to Flutter clean
#   --help    Shows this help message
#
# DEPENDENCIES:
#   - Flutter SDK
#
# NOTES:
#   - Deep clean takes longer but is more thorough
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"
DEEP_CLEAN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --deep)
            DEEP_CLEAN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --deep    Cleans Gradle cache in addition to Flutter clean"
            echo "  --help    Shows this help message"
            exit 0
            ;;
        *)
            die "Unknown option: $1"
            ;;
    esac
done

log_header "Android Clean"

# Validate Flutter
require_command "flutter" "brew install flutter"

# Change to Flutter directory
cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

# Flutter clean
log_section "Running Flutter Clean"
if ! flutter clean; then
    die "Flutter clean failed"
fi
log_success "Flutter clean complete"

# Deep clean
if [[ "$DEEP_CLEAN" == true ]]; then
    log_section "Running Deep Clean"
    log_info "Cleaning Gradle cache..."

    cd android || die "Failed to change to android directory"

    if [[ ! -f "gradlew" ]]; then
        die "gradlew not found in android directory"
    fi

    if ! ./gradlew clean; then
        die "Gradle clean failed"
    fi

    cd .. || die "Failed to return to Flutter directory"
    log_success "Gradle clean complete"
fi

log_success "Android clean complete!"
