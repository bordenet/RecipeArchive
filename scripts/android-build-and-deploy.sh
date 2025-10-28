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
if [[ "$TARGET" == "emulator" ]]; then
    print_status "Launching emulator..."
    "$ANDROID_SCRIPT_DIR/android-emulator.sh" &
    EMULATOR_PID=$!
    print_status "Emulator launched in background with PID: $EMULATOR_PID"

    # Wait for 2 minutes (120 seconds)
    SECONDS=0
    while ps -p $EMULATOR_PID > /dev/null && [ $SECONDS -lt 120 ]; do
        sleep 1
    done

    if ps -p $EMULATOR_PID > /dev/null; then
        print_status "Timeout reached. Emulator is still running in the background."
    else
        print_success "Emulator process finished."
    fi
    print_success "App launch process initiated on emulator."
else
    print_status "To deploy to a device, please connect your device and run 'flutter run'."
fi

print_success "All steps completed successfully."

END_TIME=$(date +%s)
ELAPSED_TIME=$((END_TIME - START_TIME))

print_status "Total execution time: ${ELAPSED_TIME} seconds."
