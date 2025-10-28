#!/usr/bin/env bash

#==============================================================================
# Android Build Script
#==============================================================================
# NAME: android-build.sh
#
# PURPOSE: Builds the RecipeArchive Android app.
#
# USAGE:
#   ./scripts/android-build.sh [options]
#
# OPTIONS:
#   --release     Build a release version (default: debug).
#   --apk         Build an APK (default).
#   --appbundle   Build an App Bundle.
#   --help        Shows this help message.
#
# DEPENDENCIES:
#   - Flutter SDK
#
# NOTES:
#   - This script should be run from the root of the repository.
#
#==============================================================================
set -e

echo "🤖 Android Build Script"
echo "======================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}🤖 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Parse command line arguments
BUILD_TYPE="debug"
BUILD_FORMAT="apk"

while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_TYPE="release"
            shift
            ;;
        --apk)
            BUILD_FORMAT="apk"
            shift
            ;;
        --appbundle)
            BUILD_FORMAT="appbundle"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --release     Build a release version (default: debug)."
            echo "  --apk         Build an APK (default)."
            echo "  --appbundle   Build an App Bundle."
            echo "  --help        Shows this help message."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Navigate to Flutter project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

FLUTTER_DIR="$PROJECT_ROOT/../recipe_archive"

cd "$FLUTTER_DIR"

# Build the app
print_status "Building Android app ($BUILD_TYPE, $BUILD_FORMAT)..."

if [ "$BUILD_FORMAT" == "apk" ]; then
    flutter build apk --$BUILD_TYPE
else
    flutter build appbundle --$BUILD_TYPE
fi

print_success "Android build complete!"
