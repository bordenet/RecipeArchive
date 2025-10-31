#!/usr/bin/env bash

################################################################################
# RecipeArchive Android Emulator Management
################################################################################
# PURPOSE: Manage Android Virtual Devices (AVDs) for the RecipeArchive app
#   - Create new emulator with default configuration
#   - Start existing or create new emulator
#   - Stop running emulator
#   - List available emulators
#
# USAGE:
#   ./scripts/android/emulator.sh [command]
#
# EXAMPLES:
#   ./scripts/android/emulator.sh start
#   ./scripts/android/emulator.sh create
#   ./scripts/android/emulator.sh list
#   ./scripts/android/emulator.sh stop
#
# COMMANDS:
#   start       Start emulator (creates if doesn't exist) [default]
#   create      Create new emulator
#   list        List available emulators
#   stop        Stop running emulator
#   --help      Show this help message
#
# DEPENDENCIES:
#   - Android SDK with command-line tools
#
# ENVIRONMENT VARIABLES:
#   - ANDROID_HOME (optional, auto-detected if not set)
#
# NOTES:
#   - Default emulator name: RecipeArchiveEmulator
#   - Uses Pixel 6 API 34 system image
#   - Automatically sets up PATH and ANDROID_HOME
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly EMULATOR_NAME="RecipeArchiveEmulator"

log_header "Android Emulator Management"

# Find Android SDK
ANDROID_SDK_ROOT=""
if [[ -d "$HOME/Library/Android/sdk" ]]; then
    ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
elif [[ -d "/usr/local/share/android-sdk" ]]; then
    ANDROID_SDK_ROOT="/usr/local/share/android-sdk"
elif [[ -n "$ANDROID_HOME" ]]; then
    ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [[ -z "$ANDROID_SDK_ROOT" ]]; then
    die "Android SDK not found. Please run ./scripts/android/setup.sh first."
fi

export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

log_debug "Android SDK: $ANDROID_SDK_ROOT"

# --- SCRIPT FUNCTIONS ---

list_emulators() {
    log_info "Available Android emulators:"
    emulator -list-avds
}

create_emulator() {
    log_info "Creating a new Android emulator: $EMULATOR_NAME"
    # Install a system image
    log_info "Installing system image... (this may take a while)"
    sdkmanager "system-images;android-33;google_apis;x86_64" > /dev/null
    log_success "System image is installed."

    # Create AVD
    log_info "Creating Android Virtual Device (AVD)..."
    echo "no" | avdmanager create avd -n "$EMULATOR_NAME" -k "system-images;android-33;google_apis;x86_64" -d "pixel_6"
    log_success "Emulator '$EMULATOR_NAME' created."
}

start_emulator() {
    # Check if emulator exists
    if ! emulator -list-avds | grep -q "$EMULATOR_NAME"; then
        log_warning "Emulator '$EMULATOR_NAME' not found."
        create_emulator
    fi

    log_info "Starting emulator '$EMULATOR_NAME'..."
    # Start the emulator in the background with 10-minute timeout
    timeout 600 emulator -avd "$EMULATOR_NAME" > /dev/null 2>&1 &
    EMULATOR_PID=$!

    log_success "Emulator is starting in the background (PID: $EMULATOR_PID)."
    log_info "Emulator will auto-terminate after 10 minutes if still running."

    # Wait for emulator to be ready (max 2 minutes)
    log_info "Waiting for emulator to be ready..."
    WAIT_COUNT=0
    while [ $WAIT_COUNT -lt 24 ]; do
        if adb devices | grep -q "emulator.*device$"; then
            log_success "Emulator is ready!"
            return 0
        fi
        sleep 5
        WAIT_COUNT=$((WAIT_COUNT + 1))
    done

    log_warning "Emulator startup timeout (2 minutes). Check manually with: adb devices"
}

stop_emulator() {
    log_info "Stopping emulator..."
    adb devices | grep emulator | cut -f1 | while read line; do adb -s $line emu kill; done
    log_success "Emulator stopped."
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
        log_error "Unknown command: $COMMAND"
        die "Command failed"
        ;;
esac
