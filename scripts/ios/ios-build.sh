#!/usr/bin/env bash

#==============================================================================
# iOS Build Script
#==============================================================================
# NAME: ios-build.sh
#
# PURPOSE: Builds the RecipeArchive iOS app for different targets (simulator or device)
#          and configurations (debug or release).
#
# USAGE:
#   ./scripts/ios/ios-build.sh [options]
#
# OPTIONS:
#   --release     Build release version (default: debug)
#   --debug       Build debug version
#   --device      Build for physical device
#   --simulator   Build for simulator (default)
#   --xcode       Open Xcode after build
#   --help        Show this help
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Xcode and Command Line Tools
#
# NOTES:
#   - This script is intended to be called from the main ios-build-and-deploy.sh script.
#   - For device builds, ensure you have a valid Apple Developer account and
#     code signing is properly configured in Xcode.
#
#==============================================================================
set -e

echo "🍎 iOS Build Script"
echo "==================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}📱 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Parse command line arguments
BUILD_TYPE="debug"
TARGET="simulator"
OPEN_XCODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_TYPE="release"
            shift
            ;;
        --debug)
            BUILD_TYPE="debug"
            shift
            ;;
        --device)
            TARGET="device"
            shift
            ;;
        --simulator)
            TARGET="simulator"
            shift
            ;;
        --xcode)
            OPEN_XCODE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --release     Build release version (default: debug)"
            echo "  --debug       Build debug version"
            echo "  --device      Build for physical device"
            echo "  --simulator   Build for simulator (default)"
            echo "  --xcode       Open Xcode after build"
            echo "  --help        Show this help"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Navigate to Flutter project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

if [ -f "pubspec.yaml" ]; then
    FLUTTER_DIR="$PROJECT_ROOT"
else
    FLUTTER_DIR="$PROJECT_ROOT/recipe_archive"
fi

cd "$FLUTTER_DIR"

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "DUMMY_CONFIG=true" > .env
fi

print_status "Building iOS app..."
print_status "Target: $TARGET"
print_status "Build type: $BUILD_TYPE"

# Clean previous builds
print_status "Cleaning previous builds..."
flutter clean
flutter pub get

# Build based on target and type
if [ "$TARGET" = "simulator" ]; then
    if [ "$BUILD_TYPE" = "release" ]; then
        print_status "Building iOS release for simulator..."
        flutter build ios --release --simulator
    else
        print_status "Building iOS debug for simulator..."
        flutter build ios --debug --simulator
    fi
else
    # Building for device
    if [ "$BUILD_TYPE" = "release" ]; then
        print_status "Building iOS release for device..."
        print_warning "Device builds require code signing. Make sure you have:"
        print_warning "1. Apple Developer Account"
        print_warning "2. Provisioning profiles configured"
        print_warning "3. Code signing certificates installed"
        flutter build ios --release
    else
        print_status "Building iOS debug for device..."
        flutter build ios --debug
    fi
fi

if [ $? -eq 0 ]; then
    print_success "iOS build completed successfully!"

    # Show build output location
    if [ "$TARGET" = "simulator" ]; then
        BUILD_PATH="build/ios/iphonesimulator/Runner.app"
    else
        BUILD_PATH="build/ios/iphoneos/Runner.app"
    fi

    if [ -d "$BUILD_PATH" ]; then
        print_success "Build output: $BUILD_PATH"
    fi

    # Open Xcode if requested
    if [ "$OPEN_XCODE" = true ]; then
        print_status "Opening Xcode..."
        open ios/Runner.xcworkspace
    fi

    echo ""
    echo "🚀 Next steps:"
    echo "Run the main build and deploy script: ./scripts/ios-build-and-deploy.sh"
else
    print_error "iOS build failed!"
    echo ""
    echo "Common solutions:"
    echo "1. Run: ./scripts/ios/ios-setup.sh                   # Ensure setup is complete"
    echo "2. Check that Xcode is properly installed"
    echo "3. For device builds, check code signing settings"
    echo "4. Try opening ios/Runner.xcworkspace in Xcode"
    exit 1
fi