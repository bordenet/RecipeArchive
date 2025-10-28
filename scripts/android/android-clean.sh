#!/usr/bin/env bash

#==============================================================================
# Android Clean Script
#==============================================================================
# NAME: android-clean.sh
#
# PURPOSE: Cleans Android build artifacts and caches
#
# USAGE:
#   ./scripts/android/android-clean.sh [options]
#
#==============================================================================
set -e

# --- Configuration ---
DEEP_CLEAN=false
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$SCRIPT_DIR/../.."
FLUTTER_PROJECT="$REPO_ROOT/recipe_archive"

# --- Color codes for output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Helper functions ---
print_status() {
    echo -e "${BLUE}🚀 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --deep     Perform deep clean (includes Gradle caches)"
    echo "  --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0           # Standard clean"
    echo "  $0 --deep    # Deep clean including Gradle caches"
}

# --- Parse command line arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        --deep)
            DEEP_CLEAN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# --- Check Flutter ---
if ! command -v flutter &> /dev/null; then
    print_error "Flutter is not installed or not in PATH"
    exit 1
fi

# --- Navigate to Flutter project ---
cd "$FLUTTER_PROJECT"

# --- Standard clean ---
print_status "Cleaning Flutter project..."
flutter clean
print_success "Flutter clean complete"

# --- Deep clean ---
if [[ "$DEEP_CLEAN" == true ]]; then
    print_status "Performing deep clean..."

    # Clean Gradle caches
    if [[ -d "android/.gradle" ]]; then
        print_status "Cleaning Gradle build cache..."
        rm -rf android/.gradle
        print_success "Gradle cache cleaned"
    fi

    # Clean Gradle build directory
    if [[ -d "android/build" ]]; then
        print_status "Cleaning Gradle build directory..."
        rm -rf android/build
        print_success "Gradle build directory cleaned"
    fi

    # Clean app build directory
    if [[ -d "android/app/build" ]]; then
        print_status "Cleaning app build directory..."
        rm -rf android/app/build
        print_success "App build directory cleaned"
    fi

    print_success "Deep clean complete"
fi

print_success "All cleaning operations complete!"
