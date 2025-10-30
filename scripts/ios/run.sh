#!/usr/bin/env bash

#==============================================================================
# iOS App Runner Script
#==============================================================================
# NAME: run.sh
#
# PURPOSE: Launches the RecipeArchive app on the iOS simulator. It automatically
#          finds and boots a simulator instance.
#
# USAGE:
#   ./scripts/ios/run.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Xcode and Command Line Tools
#   - An installed iOS Simulator
#
# NOTES:
#   - This is a legacy script. It is recommended to use the main build and deploy script:
#     ./scripts/ios-build.sh --dev --clean --run
#   - If no simulator is running, it will attempt to start one.
#   - If multiple simulators are available, it will try to pick one.
#
#==============================================================================
set -e

echo "🍎 iOS App Runner"
echo "=================="

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

print_status "Starting iOS simulator..."

# Try to find and boot an iOS simulator
SIMULATOR_ID=$(xcrun simctl list devices iPhone | grep -E "iPhone [0-9]+" | grep "Shutdown" | head -1 | grep -o '[A-F0-9-]\{36\}' || true)

if [ -z "$SIMULATOR_ID" ]; then
    # Try to find any available simulator
    SIMULATOR_ID=$(xcrun simctl list devices | grep "Shutdown" | grep "iPhone" | head -1 | grep -o '[A-F0-9-]\{36\}' || true)
fi

if [ -n "$SIMULATOR_ID" ]; then
    print_status "Booting iOS simulator: $SIMULATOR_ID"
    xcrun simctl boot "$SIMULATOR_ID" || true
    open -a Simulator

    # Wait for simulator to be ready
    print_status "Waiting for simulator to be ready..."
    sleep 5

    # Try to run the app
    print_status "Launching RecipeArchive on iOS simulator..."

    # Check if simulator is detected by Flutter
    if flutter devices | grep -q "iOS Simulator"; then
        flutter run -d "iOS Simulator"
    else
        print_status "Flutter not detecting simulator yet. Trying direct device selection..."
        flutter run
    fi
else
    print_error "No iOS simulator found. Trying alternative approaches..."

    # Try opening Simulator app
    print_status "Opening Simulator app..."
    open -a Simulator

    echo ""
    echo "Please:"
    echo "1. Wait for Simulator to open"
    echo "2. Select Device > iOS > iPhone (any model)"
    echo "3. Once simulator is running, run this script again"
    echo ""
    echo "Or run: flutter run"

    # Try flutter run anyway
    print_status "Attempting to run Flutter app..."
    flutter run || {
        print_error "Flutter run failed. Try running in Xcode instead:"
        echo "1. Run: open ios/Runner.xcworkspace"
        echo "2. Select an iOS simulator in Xcode"
        echo "3. Click the Run button (▶️)"
    }
fi