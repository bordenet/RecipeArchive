#!/usr/bin/env bash

#==============================================================================
# iOS Build and Deploy Script
#==============================================================================
# NAME: ios-build-and-deploy.sh
#
# PURPOSE: Orchestrates a clean build and deployment of the RecipeArchive iOS app.
#          This script provides a single entry point for building and deploying
#          to different targets and configurations.
#
# USAGE:
#   ./scripts/ios-build-and-deploy.sh [options]
#
#==============================================================================
set -e

# --- Configuration ---
TARGET="simulator"
CONFIG="debug"
DEVICE_TARGET="auto"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
IOS_SCRIPT_DIR="$SCRIPT_DIR/ios"

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
    echo "  --target <target>       Deployment target. Options: simulator, device (default: simulator)"
    echo "  --config <config>       Build configuration. Options: debug, release (default: debug)"
    echo "  --device-target <name>  The name of the simulator to target."
    echo "  --help                  Show this help"
    echo ""
    echo "Simulator Targets:"
    echo "  ipad-pro-m2"
    echo "  ipad-mac                # My Mac (Designed for iPad)"
    echo "  iphone"
    echo "  ipad-a16                # iPad (A16)"
    echo "  ipad-air-11-m3          # iPad Air 11-inch (M3)"
    echo "  ipad-air-13-m3          # iPad Air 13-inch (M3)"
    echo "  ipad-pro-11-m4          # iPad Pro 11-inch (M4)"
    echo "  ipad-pro-13-m4          # iPad Pro 13-inch (M4)"
    echo "  ipad-mini-a17           # iPad mini (A17 Pro)"
    echo "  iphone-16e"
    echo "  iphone-17"
    echo "  iphone-17-pro"
    echo "  iphone-17-pro-max"
    echo "  iphone-air"
    echo "  auto                    # Auto-detect best available device (default)"
}

get_device_udid() {
    local device_name=$1
    local udid

    case $device_name in
        ipad-pro-m2)
            udid=$(xcrun simctl list devices | grep -E "iPad Pro.*M2" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad Pro" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        ipad-mac)
            udid=$(xcrun simctl list devices | grep -E "iPad.*Pro" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        iphone)
            udid=$(xcrun simctl list devices | grep -E "iPhone" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            ;;
        ipad-a16)
            udid=$(xcrun simctl list devices | grep -E "iPad \(A16\)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        ipad-air-11-m3)
            udid=$(xcrun simctl list devices | grep -E "iPad Air 11-inch \(M3\)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad Air" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        ipad-air-13-m3)
            udid=$(xcrun simctl list devices | grep -E "iPad Air 13-inch \(M3\)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad Air" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        ipad-pro-11-m4)
            udid=$(xcrun simctl list devices | grep -E "iPad Pro 11-inch \(M4\)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad Pro" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        ipad-pro-13-m4)
            udid=$(xcrun simctl list devices | grep -E "iPad Pro 13-inch \(M4\)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad Pro" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        ipad-mini-a17)
            udid=$(xcrun simctl list devices | grep -E "iPad mini \(A17 Pro\)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPad mini" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        iphone-16e)
            udid=$(xcrun simctl list devices | grep -E "iPhone 16e" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPhone" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        iphone-17)
            udid=$(xcrun simctl list devices | grep -E "iPhone 17" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPhone" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        iphone-17-pro)
            udid=$(xcrun simctl list devices | grep -E "iPhone 17 Pro" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPhone 17" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPhone" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        iphone-17-pro-max)
            udid=$(xcrun simctl list devices | grep -E "iPhone 17 Pro Max" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPhone 17" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPhone" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        iphone-air)
            udid=$(xcrun simctl list devices | grep -E "iPhone Air" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            if [ -z "$udid" ]; then
                udid=$(xcrun simctl list devices | grep -E "iPhone" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            fi
            ;;
        auto)
            udid=$(xcrun simctl list devices | grep -E "iPhone (17.*Pro Max|17.*Pro|17[^M]*[^a]$|15.*Pro|15[^M]*[^a]$)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
            ;;
        *)
            udid=""
            ;;
    esac
    echo "$udid"
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
        --device-target)
            DEVICE_TARGET="$2"
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
if [[ "$TARGET" != "simulator" && "$TARGET" != "device" ]]; then
    print_error "Invalid target: $TARGET"
    show_help
    exit 1
fi

if [[ "$CONFIG" != "debug" && "$CONFIG" != "release" ]]; then
    print_error "Invalid config: $CONFIG"
    show_help
    exit 1
fi

# --- Main execution ---
print_status "Starting iOS build and deploy process..."
print_status "Target: $TARGET, Config: $CONFIG"

if [[ "$TARGET" == "simulator" ]]; then
    print_status "Device Target: $DEVICE_TARGET"
fi

print_status "Step 1: Running clean script..."
if ! "$IOS_SCRIPT_DIR/ios-clean.sh" --deep; then
    print_error "Clean script failed. Aborting."
    exit 1
fi
print_success "Clean script completed."

print_status "Step 2: Running build script..."
if [[ "$TARGET" == "simulator" ]]; then
    if ! "$IOS_SCRIPT_DIR/ios-build.sh" --simulator --"$CONFIG"; then
        print_error "Build script failed. Aborting."
        exit 1
    fi
else
    if ! "$IOS_SCRIPT_DIR/ios-build.sh" --device --"$CONFIG"; then
        print_error "Build script failed. Aborting."
        exit 1
    fi
fi
print_success "Build script completed."

print_status "Step 3: Deploying..."
if [[ "$TARGET" == "simulator" ]]; then
    UDID=$(get_device_udid "$DEVICE_TARGET")
    if [ -z "$UDID" ]; then
        print_error "Could not find a simulator for target '$DEVICE_TARGET'."
        exit 1
    fi
    print_status "Found simulator with UDID: $UDID"
    print_status "Launching simulator..."
    if ! "$IOS_SCRIPT_DIR/ios-simulator.sh" "$UDID"; then
        print_error "Failed to launch simulator."
        exit 1
    fi
    print_success "App launched on simulator."
else
    print_status "To deploy to a device, please open Xcode and select your device."
    "$IOS_SCRIPT_DIR/ios-xcode.sh"
fi

print_success "All steps completed successfully."
