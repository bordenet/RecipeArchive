#!/usr/bin/env bash

#==============================================================================
# Android Build Script
#==============================================================================
# NAME: android-build.sh
#
# PURPOSE: Builds the RecipeArchive Android app with specified configuration
#
# USAGE:
#   ./scripts/android/android-build.sh [options]
#
#==============================================================================
set -e

# --- Configuration ---
CONFIG="debug"
BUILD_TYPE="apk"
FLAVOR="dev"
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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --config <config>       Build configuration. Options: debug, release, profile (default: debug)"
    echo "  --type <type>           Build type. Options: apk, aab, appbundle (default: apk)"
    echo "  --flavor <flavor>       Build flavor. Options: dev, prod (default: dev)"
    echo "  --clean                 Clean before building"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                              # Debug APK build"
    echo "  $0 --config release --type aab  # Release app bundle"
    echo "  $0 --clean --config debug       # Clean debug build"
}

# --- Parse command line arguments ---
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --config)
            CONFIG="$2"
            shift 2
            ;;
        --type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        --flavor)
            FLAVOR="$2"
            shift 2
            ;;
        --clean)
            CLEAN=true
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

# --- Validation ---
if [[ ! "$CONFIG" =~ ^(debug|release|profile)$ ]]; then
    print_error "Invalid config: $CONFIG. Must be debug, release, or profile"
    exit 1
fi

if [[ ! "$BUILD_TYPE" =~ ^(apk|aab|appbundle)$ ]]; then
    print_error "Invalid build type: $BUILD_TYPE. Must be apk, aab, or appbundle"
    exit 1
fi

# Normalize build type
if [[ "$BUILD_TYPE" == "aab" ]] || [[ "$BUILD_TYPE" == "appbundle" ]]; then
    BUILD_TYPE="appbundle"
fi

# --- Check Flutter ---
if ! command -v flutter &> /dev/null; then
    print_error "Flutter is not installed or not in PATH"
    exit 1
fi

# --- Navigate to Flutter project ---
cd "$FLUTTER_PROJECT"

# --- Clean if requested ---
if [[ "$CLEAN" == true ]]; then
    print_status "Cleaning Flutter project..."
    flutter clean
    print_success "Clean complete"
fi

# --- Build ---
print_status "Building Android $BUILD_TYPE ($CONFIG configuration)..."

if [[ "$BUILD_TYPE" == "apk" ]]; then
    flutter build apk --$CONFIG
elif [[ "$BUILD_TYPE" == "appbundle" ]]; then
    flutter build appbundle --$CONFIG
fi

# --- Report build location ---
print_success "Build complete!"
echo ""
if [[ "$BUILD_TYPE" == "apk" ]]; then
    APK_PATH="$FLUTTER_PROJECT/build/app/outputs/flutter-apk/app-$CONFIG.apk"
    if [[ -f "$APK_PATH" ]]; then
        print_status "APK location: $APK_PATH"
        APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
        echo "  Size: $APK_SIZE"
    fi
else
    AAB_PATH="$FLUTTER_PROJECT/build/app/outputs/bundle/${CONFIG}Release/app-$CONFIG-release.aab"
    if [[ -f "$AAB_PATH" ]]; then
        print_status "App bundle location: $AAB_PATH"
        AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
        echo "  Size: $AAB_SIZE"
    fi
fi
