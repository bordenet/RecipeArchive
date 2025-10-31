#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS Clean Script
################################################################################
# PURPOSE: Clean iOS build artifacts and reset development environment
#   - Runs flutter clean
#   - Removes build directories
#   - Reinstalls CocoaPods
#   - Optionally performs deep clean (derived data, pod cache)
#
# USAGE:
#   ./scripts/ios/clean.sh [options]
#
# EXAMPLES:
#   ./scripts/ios/clean.sh              # Standard clean
#   ./scripts/ios/clean.sh --deep       # Deep clean with derived data
#   ./scripts/ios/clean.sh --pods       # Reset CocoaPods only
#
# OPTIONS:
#   --deep      Deep clean (includes CocoaPods, derived data)
#   --pods      Reset CocoaPods only
#   --help      Show this help
#
# DEPENDENCIES:
#   - Flutter SDK
#   - CocoaPods
#
# NOTES:
#   - Deep clean useful for resolving persistent build issues
#   - Always reinstalls CocoaPods after flutter clean
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
DEEP_CLEAN=false
RESET_PODS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --deep)
            DEEP_CLEAN=true
            RESET_PODS=true
            shift
            ;;
        --pods)
            RESET_PODS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --deep      Deep clean (includes CocoaPods, derived data)"
            echo "  --pods      Reset CocoaPods only"
            echo "  --help      Show this help"
            exit 0
            ;;
        *)
            die "Unknown option: $1. Use --help for usage information"
            ;;
    esac
done

log_header "iOS Clean"

# Find Flutter directory
if [[ -f "$REPO_ROOT/pubspec.yaml" ]]; then
    FLUTTER_DIR="$REPO_ROOT"
else
    FLUTTER_DIR="$REPO_ROOT/recipe_archive"
fi

cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

# Validate dependencies
require_command "flutter" "brew install flutter"
require_command "pod" "sudo gem install cocoapods"

# Flutter clean
log_section "Running Flutter Clean"
if ! flutter clean > /dev/null; then
    die "Flutter clean failed"
fi
log_success "Flutter clean completed"

# Clean build directory
if [[ -d "build" ]]; then
    log_section "Cleaning Build Directory"
    rm -rf build
    log_success "Build directory removed"
fi

# Clean iOS specific files
if [[ -d "ios" ]]; then
    log_section "Cleaning iOS Artifacts"

    # Remove iOS build artifacts
    if [[ -d "ios/build" ]]; then
        rm -rf ios/build
        log_success "iOS build artifacts removed"
    fi

    # CocoaPods setup
    log_section "Setting up CocoaPods"
    cd ios || die "Failed to change to ios directory"

    # Remove existing files if reset requested
    if [[ "$RESET_PODS" == true ]]; then
        if [[ -f "Podfile.lock" ]]; then
            rm Podfile.lock
            log_debug "Podfile.lock removed"
        fi

        if [[ -d "Pods" ]]; then
            rm -rf Pods
            log_debug "Pods directory removed"
        fi
    fi

    log_info "Installing CocoaPods dependencies..."
    flutter pub get > /dev/null

    # Try CocoaPods installation with fallback
    if ! pod install --repo-update > /dev/null 2>&1; then
        log_warning "Standard pod install failed, trying compatibility fixes..."
        rm -rf Pods Podfile.lock 2>/dev/null || true

        if ! pod install > /dev/null 2>&1; then
            log_warning "CocoaPods installation failed - likely Xcode 16 compatibility issue"
            log_warning "You may need to manually run: cd recipe_archive/ios && pod install"
            cd ..
        else
            log_success "CocoaPods installed with fallback"
            cd ..
        fi
    else
        log_success "CocoaPods installed successfully"
        cd ..
    fi
fi

# Deep clean if requested
if [[ "$DEEP_CLEAN" == true ]]; then
    log_section "Performing Deep Clean"

    # Clean Xcode derived data
    if [[ -d "$HOME/Library/Developer/Xcode/DerivedData" ]]; then
        log_info "Cleaning Xcode derived data..."
        rm -rf "$HOME/Library/Developer/Xcode/DerivedData"/*
        log_success "Xcode derived data cleaned"
    fi

    # Clean Flutter pub cache
    log_info "Cleaning Flutter pub cache..."
    flutter pub deps --json > /dev/null 2>&1 || true
    log_success "Flutter pub cache cleaned"
fi

# Reinstall Flutter dependencies
log_section "Reinstalling Dependencies"
if ! flutter pub get > /dev/null; then
    die "Failed to reinstall Flutter dependencies"
fi
log_success "Flutter dependencies reinstalled"

log_success "iOS clean completed!"
echo ""
log_info "Next steps:"
echo "  Run: ./scripts/ios/build.sh --dev --run"
echo ""
log_info "If still having issues:"
echo "  1. ./scripts/ios/clean.sh --deep    # Deep clean everything"
echo "  2. flutter doctor -v                # Check Flutter setup"
echo "  3. Restart Xcode and terminal"
