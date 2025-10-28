#!/usr/bin/env bash

#==============================================================================
# Android Clean Script
#==============================================================================
# NAME: android-clean.sh
#
# PURPOSE: Cleans Android build artifacts.
#
# USAGE:
#   ./scripts/android-clean.sh [options]
#
# OPTIONS:
#   --deep    Cleans the Gradle cache in addition to the default clean.
#   --help    Shows this help message.
#
# DEPENDENCIES:
#   - Flutter SDK
#
# NOTES:
#   - This script should be run from the root of the repository.
#
#==============================================================================
set -e

echo "🤖 Android Clean Script"
echo "======================"

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

# Parse command line arguments
DEEP_CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --deep)
            DEEP_CLEAN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --deep    Cleans the Gradle cache in addition to the default clean."
            echo "  --help    Shows this help message."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Navigate to Flutter project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

FLUTTER_DIR="$PROJECT_ROOT/../recipe_archive"

cd "$FLUTTER_DIR"

# Flutter clean
print_status "Running flutter clean..."
flutter clean
print_success "Flutter clean complete."

# Deep clean
if [ "$DEEP_CLEAN" = true ]; then
    print_status "Performing deep clean..."
    cd android
    ./gradlew clean
    cd ..
    print_success "Gradle clean complete."
fi

print_success "Android clean complete!"
