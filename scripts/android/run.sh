#!/usr/bin/env bash

#==============================================================================
# Android App Runner Script
#==============================================================================
# NAME: android-run.sh
#
# PURPOSE: Launches the RecipeArchive app on the Android emulator.
#
# USAGE:
#   ./scripts/android-run.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Android Emulator
#
# NOTES:
#   - This script should be run from the root of the repository.
#   - It will automatically start the emulator if it's not already running.
#
#==============================================================================
set -e

echo "🤖 Android App Runner Script"
echo "==========================="

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

# Find Android SDK
ANDROID_SDK_ROOT=""
if [ -d "$HOME/Library/Android/sdk" ]; then
    ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
elif [ -d "/usr/local/share/android-sdk" ]; then
    ANDROID_SDK_ROOT="/usr/local/share/android-sdk"
elif [ ! -z "$ANDROID_HOME" ]; then
    ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [ -z "$ANDROID_SDK_ROOT" ]; then
    print_error "Android SDK not found."
    echo "Please run ./scripts/android-setup.sh first."
    exit 1
fi

export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Check if emulator is running
if ! adb devices | grep -q "emulator"; then
    print_status "Emulator not running. Starting it now..."
    ./scripts/android-emulator.sh start
fi

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

# Run the app
print_status "Launching RecipeArchive on Android emulator..."
flutter run
