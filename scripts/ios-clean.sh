#!/usr/bin/env bash

#==============================================================================
# iOS Clean Script
#==============================================================================
# NAME: ios-clean.sh
#
# PURPOSE: Cleans iOS build artifacts, resets the development environment,
#          and provides options for a deep clean.
#
# USAGE:
#   ./scripts/ios-clean.sh [options]
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
#   - This script should be run from the root of the repository.
#   - The `--deep` option is useful for resolving persistent build issues.
#
#==============================================================================
set -e

echo "🍎 iOS Clean Script"
echo "==================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}🧹 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Parse command line arguments
DEEP_CLEAN=false
RESET_PODS=false

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
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Navigate to Flutter project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [ -f "pubspec.yaml" ]; then
    FLUTTER_DIR="$PROJECT_ROOT"
else
    FLUTTER_DIR="$PROJECT_ROOT/recipe_archive"
fi

cd "$FLUTTER_DIR"

print_status "Starting iOS clean process..."

# Flutter clean
print_status "Running Flutter clean..."
flutter clean
print_success "Flutter clean completed"

# Clean iOS build directory
if [ -d "build" ]; then
    print_status "Removing build directory..."
    rm -rf build
    print_success "Build directory removed"
fi

# Clean iOS specific files
if [ -d "ios" ]; then
    print_status "Cleaning iOS derived data..."

    # Remove iOS build artifacts
    if [ -d "ios/build" ]; then
        rm -rf ios/build
        print_success "iOS build artifacts removed"
    fi

    # Clean CocoaPods if requested
    if [ "$RESET_PODS" = true ]; then
        print_status "Resetting CocoaPods..."

        cd ios

        if [ -f "Podfile.lock" ]; then
            rm Podfile.lock
            print_success "Podfile.lock removed"
        fi

        if [ -d "Pods" ]; then
            rm -rf Pods
            print_success "Pods directory removed"
        fi

        print_status "Reinstalling CocoaPods..."
        pod install --repo-update
        print_success "CocoaPods reinstalled"

        cd ..
    fi
fi

# Deep clean if requested
if [ "$DEEP_CLEAN" = true ]; then
    print_status "Performing deep clean..."

    # Clean Xcode derived data
    if [ -d "~/Library/Developer/Xcode/DerivedData" ]; then
        print_status "Cleaning Xcode derived data..."
        rm -rf ~/Library/Developer/Xcode/DerivedData/*
        print_success "Xcode derived data cleaned"
    fi

    # Clean Flutter pub cache for this project
    print_status "Cleaning Flutter pub cache..."
    flutter pub deps --json > /dev/null 2>&1 || true
    print_success "Flutter pub cache cleaned"
fi

# Reinstall Flutter dependencies
print_status "Reinstalling Flutter dependencies..."
flutter pub get
print_success "Flutter dependencies reinstalled"

print_success "iOS clean completed!"

echo ""
echo "🚀 Next steps:"
echo "1. Run: ./scripts/ios-setup.sh                  # Ensure setup is complete"
echo "2. Run: ./scripts/ios-run.sh                    # Test the app"
echo ""
echo "💡 If you're still having issues:"
echo "1. Try: ./scripts/ios-clean.sh --deep           # Deep clean everything"
echo "2. Run: flutter doctor -v                       # Check Flutter setup"
echo "3. Restart Xcode and your terminal"