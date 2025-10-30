#!/usr/bin/env bash

#==============================================================================
# Android Studio Launcher Script
#==============================================================================
# NAME: studio.sh
#
# PURPOSE: Opens the Android project in Android Studio.
#
# USAGE:
#   ./scripts/android-studio.sh
#
# DEPENDENCIES:
#   - Android Studio
#
# NOTES:
#   - This script should be run from the root of the repository.
#
#==============================================================================
set -e

echo "🤖 Android Studio Launcher Script"
echo "=============================="

# Color codes for output
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}🤖 $1${NC}"
}

# Navigate to Flutter project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

FLUTTER_DIR="$PROJECT_ROOT/../recipe_archive"

# Open Android Studio
print_status "Opening Android project in Android Studio..."
open -a "Android Studio" "$FLUTTER_DIR/android"
