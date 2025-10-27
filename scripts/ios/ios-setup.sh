#!/usr/bin/env bash

#==============================================================================
# iOS Development Setup Script
#==============================================================================
# NAME: ios-setup.sh
#
# PURPOSE: Sets up the complete iOS development environment for the RecipeArchive app.
#          It checks for prerequisites, configures Xcode, and installs all
#          necessary dependencies.
#
# USAGE:
#   ./scripts/ios/ios-setup.sh [OPTIONS]
#
#   OPTIONS:
#     -h, --help              Show this help message
#     -d, --device DEVICE     Target specific device for setup
#                            Options: iphone16e, ipadmac, iphone17max, auto
#     -v, --verbose          Enable verbose output
#     --skip-xcode           Skip Xcode configuration (for CI/CD)
#     --skip-pods            Skip CocoaPods installation
#
#   DEVICE TARGETS:
#     iphone16e              iPhone 16e simulator
#     ipadmac               "My Mac (designed for iPad)" - run iPad app on Mac
#     iphone17max           iPhone 17 Pro Max simulator
#     auto                  Auto-detect best available device (default)
#
# DEPENDENCIES:
#   - Flutter SDK (3.10+)
#   - Xcode (14+) and Command Line Tools
#   - CocoaPods (1.11+)
#   - macOS 12+ for optimal compatibility
#
# NOTES:
#   - This script is intended to be called from the main ios-build-and-deploy.sh script.
#   - This script should be run once before starting iOS development.
#   - It may ask for your password to install CocoaPods or configure Xcode.
#   - For iPad on Mac support, ensure you have macOS 12+ and Apple Silicon.
#   - The script automatically configures Xcode for proper iOS development.
#
#==============================================================================
set -e

# Default values
TARGET_DEVICE="auto"
VERBOSE=false
SKIP_XCODE=false
SKIP_PODS=false

# Help function
show_help() {
    echo "🍎 iOS Development Setup Script"
    echo "================================"
    echo ""
    echo "Sets up the complete iOS development environment for RecipeArchive."
    echo ""
    echo "USAGE:"
    echo "  ./scripts/ios/ios-setup.sh [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help              Show this help message"
    echo "  -d, --device DEVICE     Target specific device for setup"
    echo "                         Options: iphone16e, ipadmac, iphone17max, auto"
    echo "  -v, --verbose          Enable verbose output"
    echo "  --skip-xcode           Skip Xcode configuration (for CI/CD)"
    echo "  --skip-pods            Skip CocoaPods installation"
    echo ""
    echo "DEVICE TARGETS:"
    echo "  iphone16e              iPhone 16e simulator"
    echo "  ipadmac               \"My Mac (designed for iPad)\" - run iPad app on Mac"
    echo "  iphone17max           iPhone 17 Pro Max simulator"
    echo "  auto                  Auto-detect best available device (default)"
    echo ""
    echo "EXAMPLES:"
    echo "  ./scripts/ios/ios-setup.sh                    # Auto-detect device"
    echo "  ./scripts/ios/ios-setup.sh -d iphone16e       # Target iPhone 16e"
    echo "  ./scripts/ios/ios-setup.sh -d ipadmac -v      # iPad on Mac with verbose"
    echo "  ./scripts/ios/ios-setup.sh --skip-xcode       # Skip Xcode config for CI"
    echo ""
    echo "DEPENDENCIES:"
    echo "  - Flutter SDK (3.10+)"
    echo "  - Xcode (14+) and Command Line Tools"
    echo "  - CocoaPods (1.11+)"
    echo "  - macOS 12+ for optimal compatibility"
    echo ""
    echo "For more help: ./scripts/ios/ios-help.sh"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--device)
            TARGET_DEVICE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-xcode)
            SKIP_XCODE=true
            shift
            ;;
        --skip-pods)
            SKIP_PODS=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information."
            exit 1
            ;;
    esac
done

# Validate device target
case $TARGET_DEVICE in
    auto|iphone16e|ipadmac|iphone17max)
        ;;
    *)
        echo "❌ Invalid device target: $TARGET_DEVICE"
        echo "Valid options: auto, iphone16e, ipadmac, iphone17max"
        exit 1
        ;;
esac

echo "🍎 iOS Development Setup Script"
echo "================================"
echo "📱 Target Device: $TARGET_DEVICE"
if [ "$VERBOSE" = true ]; then
    echo "🔧 Verbose mode enabled"
fi

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
    echo -e "${BLUE}📱 $1${NC}"
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
print_status "Checking iOS development prerequisites..."

if ! command_exists flutter; then
    print_error "Flutter is not installed. Please install Flutter first."
    echo "Visit: https://docs.flutter.dev/get-started/install"
    exit 1
fi

if ! command_exists xcodebuild; then
    print_error "Xcode Command Line Tools not found."
    echo "Please install Xcode and run: xcode-select --install"
    exit 1
fi

if ! command_exists pod; then
    print_error "CocoaPods not found. Installing..."
    sudo gem install cocoapods
fi

print_success "Prerequisites check complete"

# Configure Xcode properly (critical for iOS development)
print_status "Configuring Xcode development environment..."
if [ -d "/Applications/Xcode.app" ]; then
    print_status "Setting up Xcode command line tools..."
    sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
    print_status "Running Xcode first launch setup..."
    sudo xcodebuild -runFirstLaunch
    print_success "Xcode configuration complete"
else
    print_warning "Xcode not found at /Applications/Xcode.app"
    print_warning "Please install Xcode from the App Store for full iOS development support"
fi

# Navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
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

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file for development..."
    echo "DUMMY_CONFIG=true" > .env
    print_success ".env file created"
fi

# Get Flutter dependencies
print_status "Getting Flutter dependencies..."
flutter pub get

# Ensure iOS platform exists
if [ ! -d "ios" ]; then
    print_status "Creating iOS platform files..."
    flutter create --platforms=ios .
    print_success "iOS platform created"
fi

# Install CocoaPods dependencies
print_status "Installing iOS dependencies (CocoaPods)..."
cd ios
pod install --repo-update
cd ..
print_success "CocoaPods dependencies installed"

# Device-specific setup based on target
print_status "Setting up target device: $TARGET_DEVICE"

case $TARGET_DEVICE in
    iphone16e)
        print_status "Configuring for iPhone 16e..."
        DEVICE_UDID=$(xcrun simctl list devices | grep -E "iPhone 16[eE]" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
        if [ -z "$DEVICE_UDID" ]; then
            print_warning "iPhone 16e simulator not found. Using iPhone 17 as fallback."
            DEVICE_UDID=$(xcrun simctl list devices | grep -E "iPhone 17[^M]*[^a]$" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
        fi
        ;;
    ipadmac)
        print_status "Configuring for iPad on Mac (Designed for iPad)..."
        print_warning "iPad on Mac requires macOS 12+ and Apple Silicon"
        DEVICE_UDID=$(xcrun simctl list devices | grep -E "iPad.*Pro" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
        if [ -z "$DEVICE_UDID" ]; then
            DEVICE_UDID=$(xcrun simctl list devices | grep -E "iPad" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
        fi
        ;;
    iphone17max)
        print_status "Configuring for iPhone 17 Pro Max..."
        DEVICE_UDID=$(xcrun simctl list devices | grep -E "iPhone 17.*Pro Max" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
        if [ -z "$DEVICE_UDID" ]; then
            print_warning "iPhone 17 Pro Max not found. Using iPhone 17 Pro as fallback."
            DEVICE_UDID=$(xcrun simctl list devices | grep -E "iPhone 17.*Pro" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
        fi
        ;;
    auto)
        print_status "Auto-detecting best available device..."
        # Priority: iPhone 17 Pro Max > iPhone 17 > iPhone 15 Pro > iPhone 15
        DEVICE_UDID=$(xcrun simctl list devices | grep -E "iPhone (17.*Pro Max|17.*Pro|17[^M]*[^a]$|15.*Pro|15[^M]*[^a]$)" | head -1 | grep -o '([A-Z0-9\-]*)'| tr -d '()')
        ;;
esac

# Boot the selected device if found
if [ -n "$DEVICE_UDID" ]; then
    DEVICE_NAME=$(xcrun simctl list devices | grep "$DEVICE_UDID" | cut -d'(' -f1 | xargs)
    print_success "Selected device: $DEVICE_NAME ($DEVICE_UDID)"

    # Check if device is already booted
    DEVICE_STATE=$(xcrun simctl list devices | grep "$DEVICE_UDID" | grep -o "(Booted\|Shutdown)")
    if [[ "$DEVICE_STATE" == "(Shutdown)" ]]; then
        print_status "Starting simulator: $DEVICE_NAME..."
        xcrun simctl boot "$DEVICE_UDID"
        print_success "Simulator started successfully"
    else
        print_success "Simulator already running"
    fi

    # Open Simulator app
    open -a Simulator
else
    print_warning "No suitable simulator found for target: $TARGET_DEVICE"
fi

# Check for available iOS simulators
print_status "Available iOS simulators:"
SIMULATORS=$(xcrun simctl list devices iPhone | grep "Booted\|Shutdown" | head -5)
if [ -z "$SIMULATORS" ]; then
    print_warning "No iOS simulators found. You may need to install iOS simulators in Xcode."
else
    echo "$SIMULATORS"
fi

print_success "iOS setup complete!"
echo ""
echo "🚀 Next steps:"
echo "Run the main build and deploy script: ./scripts/ios-build-and-deploy.sh"
echo ""
echo "📚 For more options, see: ./scripts/ios/ios-help.sh"