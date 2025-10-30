#!/usr/bin/env bash

#==============================================================================
# Android Build and Deploy Script
#==============================================================================
# NAME: android-build-and-deploy.sh
#
# PURPOSE: Orchestrates a clean build and deployment of the RecipeArchive Android app.
#          This script provides a single entry point for building and deploying
#          to different targets and configurations.
#
# USAGE:
#   ./scripts/android-build-and-deploy.sh [options]
#
#==============================================================================
set -e

START_TIME=$(date +%s)


# --- Configuration ---
TARGET="emulator"
CONFIG="debug"
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

show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --target <target>       Deployment target. Options: emulator, device (default: emulator)"
    echo "  --config <config>       Build configuration. Options: debug, release, profile (default: debug)"
    echo "  --help                  Show this help"
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            shift 2
            ;;
        --config)
            CONFIG="$2"
            shift 2
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
if [[ "$TARGET" != "emulator" && "$TARGET" != "device" ]]; then
    print_error "Invalid target: $TARGET"
    show_help
    exit 1
fi

if [[ "$CONFIG" != "debug" && "$CONFIG" != "release" && "$CONFIG" != "profile" ]]; then
    print_error "Invalid config: $CONFIG"
    show_help
    exit 1
fi

# --- Dependency checks ---
if ! command -v flutter &> /dev/null; then
    print_error "Flutter SDK not found. Please make sure it's installed and in your PATH."
    exit 1
fi

if [[ "$TARGET" == "device" ]] && ! command -v adb &> /dev/null; then
    print_error "ADB not found. Please make sure Android SDK platform-tools are installed and in your PATH."
    exit 1
fi

# --- Main execution ---
print_status "Starting Android build and deploy process..."
print_status "Target: $TARGET, Config: $CONFIG"

print_status "Step 1: Running clean script..."
if ! "$ANDROID_SCRIPT_DIR/android-clean.sh"; then
    print_error "Clean script failed. Aborting."
    exit 1
fi
print_success "Clean script completed."

print_status "Step 2: Running build script..."
if ! "$ANDROID_SCRIPT_DIR/android-build.sh" --"$CONFIG"; then
    print_error "Build script failed. Aborting."
    exit 1
fi
print_success "Build script completed."

print_status "Step 3: Deploying..."

cd "$SCRIPT_DIR/../recipe_archive"

if [[ "$TARGET" == "device" ]]; then
    print_status "Checking for connected devices..."
    # The first line is "List of devices attached", so we skip it.
    DEVICE_LIST=$(adb devices | tail -n +2 | cut -f1)
    if [ -z "$DEVICE_LIST" ]; then
        print_error "No connected devices found. Please connect a device and enable USB debugging."
        exit 1
    fi

    # If there are multiple devices, we'll just use the first one for now.
    DEVICE_ID=$(echo "$DEVICE_LIST" | head -n1)
    print_status "Found device: $DEVICE_ID"
    print_status "Deploying to device..."
    if ! flutter run -d "$DEVICE_ID" --"$CONFIG"; then
        print_error "Failed to deploy to device. Aborting."
        exit 1
    fi
else # emulator
    print_status "Deploying to emulator..."
    if ! flutter run --"$CONFIG"; then
        print_error "Failed to deploy to emulator. Make sure an emulator is running."
        exit 1
    fi
fi

print_success "All steps completed successfully."

END_TIME=$(date +%s)
ELAPSED_TIME=$((END_TIME - START_TIME))

print_status "Total execution time: ${ELAPSED_TIME} seconds."
