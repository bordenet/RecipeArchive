#!/usr/bin/env bash

#==============================================================================
# Android Run Script
#==============================================================================
# NAME: android-run.sh
#
# PURPOSE: Deploys and runs the RecipeArchive Android app on a device or emulator
#
# USAGE:
#   ./scripts/android/android-run.sh [options]
#
#==============================================================================
set -e

# --- Configuration ---
DEVICE_ID=""
CONFIG="debug"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$SCRIPT_DIR/../.."
FLUTTER_PROJECT="$REPO_ROOT/recipe_archive"

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
    echo "  --device <device_id>    Device ID to deploy to (optional, uses default if not specified)"
    echo "  --config <config>       Build configuration. Options: debug, release, profile (default: debug)"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run on default device"
    echo "  $0 --device emulator-5554   # Run on specific emulator"
    echo "  $0 --config release         # Run release build"
}

# --- Parse command line arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        --device)
            DEVICE_ID="$2"
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

# --- Check Flutter ---
if ! command -v flutter &> /dev/null; then
    print_error "Flutter is not installed or not in PATH"
    exit 1
fi

# --- Navigate to Flutter project ---
cd "$FLUTTER_PROJECT"

# --- List devices if none specified ---
if [[ -z "$DEVICE_ID" ]]; then
    print_status "Listing available Android devices..."
    flutter devices | grep android || true
    echo ""
fi

# --- Run app ---
print_status "Running Android app ($CONFIG configuration)..."

if [[ -z "$DEVICE_ID" ]]; then
    flutter run --$CONFIG
else
    flutter run --$CONFIG -d "$DEVICE_ID"
fi
