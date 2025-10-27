#!/usr/bin/env bash

#==============================================================================
# iOS Simulator Launcher Script
#==============================================================================
# NAME: ios-simulator.sh
#
# PURPOSE: Starts the iOS simulator and runs the RecipeArchive app. It can either
#          auto-detect a simulator or target a specific one by its UDID.
#
# USAGE:
#   ./scripts/ios/ios-simulator.sh [UDID]
#
# ARGUMENTS:
#   UDID (optional)   The UDID of the simulator to target.
#
# NOTES:
#   - This script is intended to be called from the main ios-build-and-deploy.sh script.
#
#==============================================================================
set -e

# --- Configuration ---
UDID=$1

# --- Color codes for output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Helper functions ---
print_status() {
    echo -e "${BLUE}📱 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# --- Main execution ---
echo "🍎 iOS Simulator Launcher"
echo "=========================="

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

if [ -z "$UDID" ]; then
    print_status "No UDID provided, auto-detecting simulator..."
    # Method 1: Try using open command with Simulator app
    print_status "Method 1: Opening iOS Simulator app directly..."
    open -a Simulator

    # Wait for Simulator to start
    print_status "Waiting for Simulator to initialize..."
    sleep 8

    # Method 2: Check if Flutter can detect the simulator
    print_status "Checking for available devices..."
    flutter run -d ios-simulator --no-sound-null-safety
else
    print_status "Targeting simulator with UDID: $UDID"
    xcrun simctl boot "$UDID" || true
    open -a Simulator
    print_status "Waiting for simulator to initialize..."
    sleep 8
    flutter run -d "$UDID"
fi

if [ $? -eq 0 ]; then
    print_success "iOS app launched successfully!"
else
    print_error "Failed to launch iOS app"
fi