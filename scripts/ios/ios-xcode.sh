#!/usr/bin/env bash

#==============================================================================
# iOS Xcode Launcher Script
#==============================================================================
# NAME: ios-xcode.sh
#
# PURPOSE: Opens the iOS project in Xcode, which is the recommended way to run,
#          debug, and profile the app.
#
# USAGE:
#   ./scripts/ios/ios-xcode.sh
#
# DEPENDENCIES:
#   - Xcode
#
# NOTES:
#   - This script is intended to be called from the main ios-build-and-deploy.sh script.
#   - After running, you can select a simulator and run the app from within Xcode.
#
#==============================================================================

echo "🍎 iOS Xcode Launcher"
echo "===================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}📱 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

if [ -f "pubspec.yaml" ]; then
    FLUTTER_DIR="$PROJECT_ROOT"
    IOS_WORKSPACE="ios/Runner.xcworkspace"
else
    FLUTTER_DIR="$PROJECT_ROOT/recipe_archive"
    IOS_WORKSPACE="recipe_archive/ios/Runner.xcworkspace"
fi

cd "$FLUTTER_DIR"

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "DUMMY_CONFIG=true" > .env
    print_success "Created .env file"
fi

# Ensure dependencies are current
print_status "Updating Flutter dependencies..."
flutter pub get > /dev/null 2>&1
print_success "Dependencies updated"

# Open Xcode
print_status "Opening iOS project in Xcode..."
if [ -d "ios/Runner.xcworkspace" ]; then
    open ios/Runner.xcworkspace
    XCODE_PATH="ios/Runner.xcworkspace"
else
    cd ..
    open recipe_archive/ios/Runner.xcworkspace
    XCODE_PATH="recipe_archive/ios/Runner.xcworkspace"
fi

print_success "Xcode opened with RecipeArchive iOS project"

echo ""
echo "🚀 Next steps in Xcode:"
echo "1. Wait for Xcode to load the project"
echo "2. In the device dropdown (top-left), select an iOS Simulator:"
echo "   • iPhone 15"
echo "   • iPhone 15 Pro"
echo "   • iPhone 15 Pro Max"
echo "   • iPad (any model)"
echo "3. Click the Run button (▶️) or press Cmd+R"
echo ""
echo "🎉 New features to test:"
echo "   📱 Wakelock: Screen stays awake during recipe viewing"
echo "   🔒 Visual indicator: Lock icon in recipe detail app bar"
echo "   📋 Mobile-optimized Extensions page"
echo "   🧭 Platform-aware navigation"
echo ""
echo "💡 Pro tip: Once the simulator is running, you can also use:"
echo "   flutter run (from terminal)"
echo "" 