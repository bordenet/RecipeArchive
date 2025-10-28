#!/usr/bin/env bash

#==============================================================================
# Android Build and Deploy Script
#==============================================================================
# NAME: android-build-and-deploy.sh
#
# PURPOSE: Orchestrates a clean build and deployment of the RecipeArchive Android app.
#          This script provides a single entry point for building and deploying
#          to different devices and configurations.
#
# USAGE:
#   ./scripts/android-build-and-deploy.sh [options]
#
#==============================================================================
set -e

# --- Configuration ---
DEVICE_ID=""
CONFIG="debug"
BUILD_TYPE="apk"
CLEAN=false
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ANDROID_SCRIPT_DIR="$SCRIPT_DIR/android"

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
    echo "  --device <device_id>    Device ID to deploy to (optional)"
    echo "  --config <config>       Build configuration. Options: debug, release, profile (default: debug)"
    echo "  --type <type>           Build type. Options: apk, aab (default: apk)"
    echo "  --clean                 Clean before building"
    echo "  --build-only            Only build, don't deploy"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Debug APK build and deploy"
    echo "  $0 --clean --config release          # Clean release build"
    echo "  $0 --device emulator-5554            # Deploy to specific device"
    echo "  $0 --type aab --build-only           # Build app bundle only"
}

# --- Parse command line arguments ---
BUILD_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --device)
            DEVICE_ID="$2"
            shift 2
            ;;
        --config)
            CONFIG="$2"
            shift 2
            ;;
        --type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --build-only)
            BUILD_ONLY=true
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

# --- Display configuration ---
echo ""
print_status "RecipeArchive Android Build & Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Configuration: $CONFIG"
echo "Build type: $BUILD_TYPE"
echo "Clean: $CLEAN"
echo "Build only: $BUILD_ONLY"
if [[ -n "$DEVICE_ID" ]]; then
    echo "Device: $DEVICE_ID"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# --- Step 1: Clean (if requested) ---
if [[ "$CLEAN" == true ]]; then
    print_status "Step 1: Cleaning..."
    "$ANDROID_SCRIPT_DIR/android-clean.sh"
    print_success "Clean complete"
    echo ""
fi

# --- Step 2: Build ---
print_status "Step 2: Building Android app..."
BUILD_ARGS=("--config" "$CONFIG" "--type" "$BUILD_TYPE")

"$ANDROID_SCRIPT_DIR/android-build.sh" "${BUILD_ARGS[@]}"
print_success "Build complete"
echo ""

# --- Step 3: Deploy (if not build-only) ---
if [[ "$BUILD_ONLY" == false ]]; then
    print_status "Step 3: Deploying to device..."

    # For APK, we can install directly
    if [[ "$BUILD_TYPE" == "apk" ]]; then
        RUN_ARGS=("--config" "$CONFIG")
        if [[ -n "$DEVICE_ID" ]]; then
            RUN_ARGS+=("--device" "$DEVICE_ID")
        fi

        "$ANDROID_SCRIPT_DIR/android-run.sh" "${RUN_ARGS[@]}"
        print_success "Deployment complete"
    else
        print_warning "App bundles (.aab) cannot be directly deployed"
        print_warning "Upload to Google Play Console or use bundletool to generate APK"
    fi
else
    print_status "Skipping deployment (--build-only specified)"
fi

echo ""
print_success "🎉 Android build and deploy complete!"
echo ""
