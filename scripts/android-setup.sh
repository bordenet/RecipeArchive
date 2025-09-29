#!/usr/bin/env bash

#==============================================================================
# Android Development Setup Script
#==============================================================================
# NAME: android-setup.sh
#
# PURPOSE: Sets up the complete Android development environment for the RecipeArchive app.
#          It checks for prerequisites, configures the Android SDK, and helps
#          install necessary tools.
#
# USAGE:
#   ./scripts/android-setup.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Android Studio (recommended) or Android SDK Command-line tools
#   - Java Development Kit (JDK)
#
# NOTES:
#   - This script should be run from the root of the repository.
#   - This script should be run once before starting Android development.
#   - It may ask for your password for certain operations.
#
#==============================================================================
set -e

echo "🤖 Android Development Setup Script"
echo "=================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

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

# Check prerequisites
print_status "Checking Android development prerequisites..."

if ! command_exists flutter; then
    print_error "Flutter is not installed. Please install Flutter first."
    echo "Visit: https://docs.flutter.dev/get-started/install"
    exit 1
fi
print_success "Flutter is installed."

if ! command_exists java; then
    print_error "Java (JDK) is not installed. Android development requires a JDK."
    echo "We recommend installing Android Studio, which includes a JDK."
    echo "Alternatively, install a JDK using Homebrew: brew install openjdk"
    exit 1
fi
print_success "Java (JDK) is installed."

# Find Android SDK
print_status "Locating Android SDK..."
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
    echo "Please install Android Studio or set the ANDROID_HOME environment variable."
    exit 1
fi

export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

print_success "Android SDK found at: $ANDROID_SDK_ROOT"

# Check for command-line tools
if ! command_exists sdkmanager; then
    print_error "Android command-line tools are not installed or not in your PATH."
    echo "Please install them via Android Studio (SDK Manager > SDK Tools > Android SDK Command-line Tools)."
    exit 1
fi
print_success "Android command-line tools are available."

# Accept licenses
print_status "Accepting Android SDK licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || print_warning "Could not auto-accept licenses. Manual intervention may be required."
print_success "Android licenses checked."

# Install necessary packages
print_status "Installing required SDK packages (platform-tools, emulator, build-tools)..."
sdkmanager "platform-tools" "emulator" "build-tools;34.0.0" > /dev/null
print_success "SDK packages are up to date."

# Navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

print_status "Project root: $PROJECT_ROOT"

# Navigate to Flutter project directory
if [ -f "pubspec.yaml" ]; then
    FLUTTER_DIR="$PROJECT_ROOT"
else
    FLUTTER_DIR="$PROJECT_ROOT/recipe_archive"
fi

if [ ! -f "$FLUTTER_DIR/pubspec.yaml" ]; then
    print_error "Cannot find Flutter project. Expected pubspec.yaml in $FLUTTER_DIR"
    exit 1
fi

cd "$FLUTTER_DIR"
print_status "Flutter project directory: $FLUTTER_DIR"

# Get Flutter dependencies
print_status "Getting Flutter dependencies..."
flutter pub get

# Run flutter doctor
print_status "Running flutter doctor to verify setup..."
flutter doctor

print_success "Android setup complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Run: ./scripts/android-emulator.sh  # To start the emulator"
echo "2. Run: ./scripts/android-run.sh       # To run the app"
echo "3. Run: ./scripts/android-build.sh      # To build the app"
echo ""
echo "📚 For more options, see: ./scripts/android-help.sh"