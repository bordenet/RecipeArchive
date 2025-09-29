#!/usr/bin/env bash

#==============================================================================
# iOS Simulator Launcher Script
#==============================================================================
# NAME: ios-simulator.sh
#
# PURPOSE: Starts the iOS simulator and runs the RecipeArchive app. It includes
#          multiple methods to find and launch the simulator.
#
# USAGE:
#   ./scripts/ios-simulator.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Xcode and Command Line Tools
#   - An installed iOS Simulator
#
# NOTES:
#   - This script should be run from the root of the repository.
#   - It will attempt to open the Simulator app directly and then let Flutter
#     take over.
#
#==============================================================================
set -e

echo "🍎 iOS Simulator Launcher"
echo "=========================="

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

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "DUMMY_CONFIG=true" > .env
    print_success "Created .env file"
fi

print_status "Ensuring Flutter dependencies are up to date..."
flutter pub get > /dev/null 2>&1

# Method 1: Try using open command with Simulator app
print_status "Method 1: Opening iOS Simulator app directly..."
open -a Simulator

# Wait for Simulator to start
print_status "Waiting for Simulator to initialize..."
sleep 8

# Method 2: Check if Flutter can detect the simulator
print_status "Checking for available devices..."
DEVICES=$(flutter devices --machine 2>/dev/null || echo "[]")

if echo "$DEVICES" | grep -q "ios-simulator"; then
    print_success "iOS Simulator detected by Flutter"
    print_status "Launching RecipeArchive on iOS Simulator..."

    # Run the app
    flutter run -d ios-simulator --no-sound-null-safety
else
    print_warning "Flutter not detecting iOS Simulator yet..."

    # Method 3: Try to run anyway and let Flutter handle device selection
    print_status "Attempting to launch app..."

    # Get available devices in readable format
    echo ""
    echo "Available devices:"
    flutter devices

    echo ""
    print_status "Trying to launch on any available simulator..."

    # Try to run with device selection
    if flutter devices | grep -q "iPhone"; then
        # Extract the first iPhone simulator device ID
        DEVICE_ID=$(flutter devices | grep "iPhone" | head -1 | grep -o '• [^•]*•' | sed 's/• //g' | sed 's/ •//g')
        if [ ! -z "$DEVICE_ID" ]; then
            print_success "Found simulator: $DEVICE_ID"
            flutter run -d "$DEVICE_ID"
        else
            flutter run
        fi
    else
        print_status "Launching with automatic device selection..."
        flutter run
    fi
fi

if [ $? -eq 0 ]; then
    print_success "iOS app launched successfully!"
    echo ""
    echo "🎉 RecipeArchive is now running on iOS Simulator"
    echo "📱 New features available:"
    echo "   • Screen stays awake during recipe viewing (wakelock)"
    echo "   • Mobile-optimized Extensions page"
    echo "   • Platform-aware navigation"
    echo ""
    echo "💡 To test the wakelock feature:"
    echo "   1. Navigate to any recipe"
    echo "   2. Look for the lock icon in the top bar"
    echo "   3. Screen will stay awake while viewing recipes"
else
    print_error "Failed to launch iOS app"
    echo ""
    echo "Alternative methods:"
    echo "1. Open Xcode manually:"
    echo "   open ios/Runner.xcworkspace"
    echo "   Then select a simulator and click Run (▶️)"
    echo ""
    echo "2. Use Xcode's simulator menu:"
    echo "   • Open Xcode"
    echo "   • Window > Devices and Simulators"
    echo "   • Create/start a simulator"
    echo "   • Then run this script again"
fi