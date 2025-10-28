#!/usr/bin/env bash

#==============================================================================
# Android Emulator Script
#==============================================================================
# NAME: android-emulator.sh
#
# PURPOSE: Manages Android Virtual Devices (AVDs) for the RecipeArchive app.
#          It can create, start, stop, and list emulators.
#
# USAGE:
#   ./scripts/android-emulator.sh [command]
#
# COMMANDS:
#   start       Starts an emulator. Creates one if it doesn't exist. (default)
#   create      Creates a new emulator.
#   list        Lists available emulators.
#   stop        Stops the running emulator.
#   --help      Shows this help message.
#
# DEPENDENCIES:
#   - Android SDK (with command-line tools)
#
# NOTES:
#   - This script should be run from the root of the repository.
#
#==============================================================================
set -e

echo "🤖 Android Emulator Script"
echo "========================="

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

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
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

EMULATOR_NAME="RecipeArchiveEmulator"

# --- SCRIPT FUNCTIONS ---

list_emulators() {
    print_status "Available Android emulators:"
    emulator -list-avds
}

create_emulator() {
    print_status "Creating a new Android emulator: $EMULATOR_NAME"
    # Install a system image
    print_status "Installing system image... (this may take a while)"
    sdkmanager "system-images;android-33;google_apis;x86_64" > /dev/null
    print_success "System image is installed."

    # Create AVD
    print_status "Creating Android Virtual Device (AVD)..."
    echo "no" | avdmanager create avd -n "$EMULATOR_NAME" -k "system-images;android-33;google_apis;x86_64" -d "pixel_6"
    print_success "Emulator '$EMULATOR_NAME' created."
}

start_emulator() {
    # Check if emulator exists
    if ! emulator -list-avds | grep -q "$EMULATOR_NAME"; then
        print_warning "Emulator '$EMULATOR_NAME' not found."
        create_emulator
    fi

    print_status "Starting emulator '$EMULATOR_NAME'..."
    # Start the emulator in the background
    emulator -avd "$EMULATOR_NAME" > /dev/null 2>&1 &
    
    # Wait for it to boot
    print_status "Waiting for emulator to boot..."
    adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done;'
    print_success "Emulator is booted and ready."
}

stop_emulator() {
    print_status "Stopping emulator..."
    adb devices | grep emulator | cut -f1 | while read line; do adb -s $line emu kill; done
    print_success "Emulator stopped."
}

# --- MAIN LOGIC ---

COMMAND="start"
if [ ! -z "$1" ]; then
    if [[ "$1" == "--help" ]]; then
        COMMAND="help"
    else
        COMMAND=$1
    fi
fi

case $COMMAND in
    start)
        start_emulator
        ;;
    create)
        create_emulator
        ;;
    list)
        list_emulators
        ;;
    stop)
        stop_emulator
        ;;
    help)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start       Starts an emulator. Creates one if it doesn't exist. (default)"
        echo "  create      Creates a new emulator."
        echo "  list        Lists available emulators."
        echo "  stop        Stops the running emulator."
        echo "  --help      Shows this help message."
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        exit 1
        ;;
esac
