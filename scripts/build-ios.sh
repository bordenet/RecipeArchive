#!/bin/bash

# build-ios.sh - iOS Production Build Script for RecipeArchive
# Generates release-ready builds for iPhone and iPad devices
# Includes both Runner (main app) and RecipeArchive (Share Extension)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_ROOT/recipe_archive/ios"
FLUTTER_DIR="$PROJECT_ROOT/recipe_archive"
BUILD_DIR="$IOS_DIR/build"
ARCHIVE_DIR="$BUILD_DIR/archives"

# Default values
BUILD_CONFIG=""
VERSION=""
CLEAN_BUILD=false
START_TIME=$(date +%s)

# Usage function
usage() {
    cat << EOF
${CYAN}╔════════════════════════════════════════════════════════════════╗
║               iOS Build Script - RecipeArchive                 ║
╚════════════════════════════════════════════════════════════════╝${NC}

${GREEN}Usage:${NC}
    $0 --release [--version VERSION] [--clean]
    $0 --debug [--version VERSION] [--clean]
    $0 -r [-v VERSION] [-c]
    $0 -d [-v VERSION] [-c]

${GREEN}Options:${NC}
    -r, --release          Build for release (required if not debug)
    -d, --debug            Build for debug (required if not release)
    -v, --version VERSION  Set app version (e.g., 1.0.1)
    -c, --clean            Clean build directories before building
    -h, --help             Show this help message

${GREEN}Examples:${NC}
    $0 --release --version 1.0.1
    $0 -r -v 1.0.1 --clean
    $0 --debug -c

${GREEN}Output:${NC}
    - Runner.app (Universal binary: iPhone + iPad)
    - RecipeArchive.appex (Share Extension, embedded)
    - Single archive supports both device types

${GREEN}Location:${NC}
    Archive created in: $BUILD_DIR/archives/

EOF
    exit 1
}

# Error handler
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    usage
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--release)
            if [ -n "$BUILD_CONFIG" ]; then
                error_exit "Cannot specify both --release and --debug"
            fi
            BUILD_CONFIG="Release"
            shift
            ;;
        -d|--debug)
            if [ -n "$BUILD_CONFIG" ]; then
                error_exit "Cannot specify both --release and --debug"
            fi
            BUILD_CONFIG="Debug"
            shift
            ;;
        -v|--version)
            VERSION="$2"
            if [ -z "$VERSION" ]; then
                error_exit "Version string required after $1"
            fi
            # Validate version format (basic semver check)
            if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                error_exit "Version must be in format X.Y.Z (e.g., 1.0.1)"
            fi
            shift 2
            ;;
        -c|--clean)
            CLEAN_BUILD=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            error_exit "Unknown option: $1\nRun '$0 --help' for usage information"
            ;;
    esac
done

# Validate required arguments
if [ -z "$BUILD_CONFIG" ]; then
    error_exit "Build configuration required: use --release or --debug"
fi

# Extract current version from pubspec.yaml
PUBSPEC="$FLUTTER_DIR/pubspec.yaml"
CURRENT_VERSION=""
if [ -f "$PUBSPEC" ]; then
    CURRENT_VERSION=$(grep "^version:" "$PUBSPEC" | awk '{print $2}')
fi

# Determine final version that will be built
FINAL_VERSION=""
if [ -n "$VERSION" ]; then
    # User specified version - extract or default build number
    if [ -n "$CURRENT_VERSION" ]; then
        BUILD_NUMBER=$(echo "$CURRENT_VERSION" | cut -d'+' -f2)
        if [ -z "$BUILD_NUMBER" ]; then
            BUILD_NUMBER="1"
        fi
    else
        BUILD_NUMBER="1"
    fi
    FINAL_VERSION="$VERSION+$BUILD_NUMBER"
else
    # Using existing version
    FINAL_VERSION="$CURRENT_VERSION"
fi

# Print banner
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗"
echo -e "║            iOS Build Script - RecipeArchive v1.0.0             ║"
echo -e "╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Build Type:    ${GREEN}$BUILD_CONFIG${NC}"
if [ -n "$FINAL_VERSION" ]; then
    echo -e "  Build Version: ${GREEN}$FINAL_VERSION${NC}"
else
    echo -e "  Build Version: ${YELLOW}Unknown (pubspec.yaml not found)${NC}"
fi
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "  Clean Build:   ${GREEN}Yes${NC}"
else
    echo -e "  Clean Build:   ${YELLOW}No${NC}"
fi
echo -e "  Project Root:  $PROJECT_ROOT"
echo -e "  iOS Directory: $IOS_DIR"
echo ""

# Validate environment
echo -e "${BLUE}Validating environment...${NC}"

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    error_exit "xcodebuild not found. Please install Xcode and Xcode Command Line Tools"
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1)
echo -e "  ✓ Found: $XCODE_VERSION"

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    error_exit "Flutter not found. Please install Flutter SDK"
fi

FLUTTER_VERSION=$(flutter --version | head -n 1)
echo -e "  ✓ Found: $FLUTTER_VERSION"

# Check if project exists
if [ ! -d "$IOS_DIR" ]; then
    error_exit "iOS project directory not found: $IOS_DIR"
fi

if [ ! -f "$IOS_DIR/Runner.xcodeproj/project.pbxproj" ]; then
    error_exit "Xcode project not found: $IOS_DIR/Runner.xcodeproj"
fi

echo -e "  ✓ Xcode project found"

# Check if CocoaPods is installed (needed for dependencies)
if ! command -v pod &> /dev/null; then
    error_exit "CocoaPods not found. Please install with: sudo gem install cocoapods"
fi

echo -e "  ✓ CocoaPods found"
echo ""

# Set version if specified
if [ -n "$VERSION" ]; then
    echo -e "${BLUE}Setting app version to $VERSION...${NC}"

    # Update pubspec.yaml version
    PUBSPEC="$FLUTTER_DIR/pubspec.yaml"
    if [ -f "$PUBSPEC" ]; then
        # Extract current build number
        CURRENT_VERSION=$(grep "^version:" "$PUBSPEC" | awk '{print $2}')
        BUILD_NUMBER=$(echo "$CURRENT_VERSION" | cut -d'+' -f2)

        if [ -z "$BUILD_NUMBER" ]; then
            BUILD_NUMBER="1"
        fi

        # Update version
        sed -i.bak "s/^version:.*/version: $VERSION+$BUILD_NUMBER/" "$PUBSPEC"
        rm -f "$PUBSPEC.bak"

        echo -e "  ✓ Updated pubspec.yaml: $VERSION+$BUILD_NUMBER"
    else
        error_exit "pubspec.yaml not found at $PUBSPEC"
    fi

    # Update Info.plist for Runner
    RUNNER_PLIST="$IOS_DIR/Runner/Info.plist"
    if [ -f "$RUNNER_PLIST" ]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$RUNNER_PLIST" 2>/dev/null || true
        echo -e "  ✓ Updated Runner Info.plist"
    fi

    # Update Info.plist for RecipeArchive extension
    EXTENSION_PLIST="$IOS_DIR/RecipeArchive/Info.plist"
    if [ -f "$EXTENSION_PLIST" ]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$EXTENSION_PLIST" 2>/dev/null || true
        echo -e "  ✓ Updated RecipeArchive extension Info.plist"
    fi
    echo ""
fi

# Clean previous builds if requested
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${BLUE}Cleaning build directories...${NC}"
    cd "$FLUTTER_DIR"
    flutter clean > /dev/null 2>&1
    rm -rf "$BUILD_DIR"
    rm -rf "$IOS_DIR/Pods"
    rm -rf "$IOS_DIR/.symlinks"
    rm -f "$IOS_DIR/Podfile.lock"
    echo -e "  ✓ Cleaned Flutter build"
    echo -e "  ✓ Removed CocoaPods cache"
    echo -e "  ✓ Removed build directory"
    echo ""
else
    echo -e "${BLUE}Preparing build directories...${NC}"
    rm -rf "$BUILD_DIR"
    echo -e "  ✓ Cleaned previous archives"
    echo ""
fi

mkdir -p "$ARCHIVE_DIR"

# Get Flutter dependencies (required before CocoaPods)
echo -e "${BLUE}Getting Flutter dependencies...${NC}"
cd "$FLUTTER_DIR"
flutter pub get
echo -e "  ✓ Flutter dependencies fetched"
echo ""

# Install/update CocoaPods dependencies
echo -e "${BLUE}Installing CocoaPods dependencies...${NC}"
cd "$IOS_DIR"
pod install --repo-update
echo -e "  ✓ CocoaPods dependencies installed"
echo ""

# Build Flutter assets
echo -e "${BLUE}Building Flutter assets...${NC}"
cd "$FLUTTER_DIR"
flutter build ios --$BUILD_CONFIG --no-codesign
echo -e "  ✓ Flutter assets built"
echo ""

# Create archives for both Runner and RecipeArchive
echo -e "${BLUE}Building Xcode archives...${NC}"

# Array to store output paths
declare -a OUTPUT_PATHS

# Build universal Runner app (supports both iPhone and iPad)
echo -e "${CYAN}Building Runner.app (Universal: iPhone + iPad)...${NC}"
RUNNER_ARCHIVE="$ARCHIVE_DIR/Runner.xcarchive"
xcodebuild archive \
    -workspace "$IOS_DIR/Runner.xcworkspace" \
    -scheme Runner \
    -configuration "$BUILD_CONFIG" \
    -destination 'generic/platform=iOS' \
    -archivePath "$RUNNER_ARCHIVE" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    SUPPORTS_MACCATALYST=NO \
    | grep -v "^$" | grep -E "(Building|Compiling|Linking|Generating|Creating|Processing|✓)" || true

if [ -d "$RUNNER_ARCHIVE" ]; then
    echo -e "  ${GREEN}✓ Runner.app built successfully (Universal Binary)${NC}"
    RUNNER_APP_PATH="$RUNNER_ARCHIVE/Products/Applications/Runner.app"
    if [ -d "$RUNNER_APP_PATH" ]; then
        OUTPUT_PATHS+=("$RUNNER_APP_PATH")

        # Get supported devices from Info.plist
        SUPPORTED_DEVICES=$(/usr/libexec/PlistBuddy -c "Print :UIDeviceFamily" "$RUNNER_APP_PATH/Info.plist" 2>/dev/null | grep -E "^    [0-9]" | tr -d ' ')
        if echo "$SUPPORTED_DEVICES" | grep -q "1"; then
            echo -e "  ${CYAN}  ├─ iPhone support: enabled${NC}"
        fi
        if echo "$SUPPORTED_DEVICES" | grep -q "2"; then
            echo -e "  ${CYAN}  └─ iPad support: enabled${NC}"
        fi
    fi
    # Check for embedded RecipeArchive extension
    EXTENSION_PATH="$RUNNER_APP_PATH/PlugIns/RecipeArchive.appex"
    if [ -d "$EXTENSION_PATH" ]; then
        OUTPUT_PATHS+=("$EXTENSION_PATH")
        echo -e "  ${CYAN}  └─ RecipeArchive.appex embedded${NC}"
    fi
else
    error_exit "Failed to build Runner.app"
fi
echo ""

# Calculate build time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Print summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗"
echo -e "║                    BUILD COMPLETED                             ║"
echo -e "╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Build Summary:${NC}"
echo -e "  Configuration:  ${GREEN}$BUILD_CONFIG${NC}"
if [ -n "$FINAL_VERSION" ]; then
    echo -e "  Build Version:  ${GREEN}$FINAL_VERSION${NC}"
fi
echo -e "  Build Time:     ${CYAN}${MINUTES}m ${SECONDS}s${NC}"
echo -e "  Archives:       ${CYAN}${#OUTPUT_PATHS[@]} artifacts${NC}"
echo ""
echo -e "${BLUE}Output Artifacts:${NC}"

# Print output paths
for path in "${OUTPUT_PATHS[@]}"; do
    if [ -e "$path" ]; then
        SIZE=$(du -h "$path" | cut -f1)
        FILENAME=$(basename "$path")
        echo -e "  ${GREEN}✓${NC} $FILENAME"
        echo -e "    ${CYAN}$path${NC}"
        echo -e "    Size: $SIZE"
        echo ""
    fi
done

# Print archive locations
echo -e "${BLUE}Archive Location:${NC}"
echo -e "  ${CYAN}$RUNNER_ARCHIVE${NC}"
echo ""

# Deployment notes
echo -e "${YELLOW}Deployment Notes:${NC}"
echo -e "  • Universal binary supports both iPhone and iPad"
echo -e "  • To install on device: Use Xcode's Devices and Simulators window"
echo -e "  • Or drag .app to device in Xcode's Devices window"
echo -e "  • For App Store: Export IPA using Xcode Organizer"
echo -e "  • Archive location: $ARCHIVE_DIR"
echo ""

# Success exit
exit 0
