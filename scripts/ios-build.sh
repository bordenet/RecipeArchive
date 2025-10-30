#!/usr/bin/env bash

################################################################################
# iOS Build Script for RecipeArchive
################################################################################
# PURPOSE: Single source of truth for all iOS builds
#   - Development builds (fast, simulator-focused)
#   - Production builds (archives for distribution)
#
# USAGE:
#   Development (simulator):
#     ./scripts/ios-build.sh --dev --simulator --debug
#     ./scripts/ios-build.sh --dev --simulator --release
#
#   Production (archive):
#     ./scripts/ios-build.sh --prod --device --release --version 1.0.1
#
#   Quick simulator build+run:
#     ./scripts/ios-build.sh --dev --run
#
# PHILOSOPHY:
#   - Always use Flutter's build pipeline first (flutter build ios)
#   - Always use "Runner" scheme with standard Xcode configurations
#   - Consistent workflow regardless of target
#   - Clear separation between dev (fast iteration) and prod (distribution)
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults
MODE=""              # dev or prod
TARGET="simulator"   # simulator or device
CONFIG="debug"       # debug, release, profile
VERSION=""           # Optional version string
RUN_AFTER=false      # Auto-launch after build
CLEAN=false          # Clean before build

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FLUTTER_DIR="$PROJECT_ROOT/recipe_archive"
IOS_DIR="$FLUTTER_DIR/ios"
BUILD_DIR="$IOS_DIR/build"

# Helper functions
print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  $1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_status() {
    echo -e "${BLUE}▸ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

error_exit() {
    print_error "$1"
    exit 1
}

# Usage
usage() {
    cat << EOF
${CYAN}iOS Build Script${NC}

${GREEN}Usage:${NC}
    # Development (fast iteration)
    $0 --dev [--simulator|--device] [--debug|--release] [--run]

    # Production (distribution)
    $0 --prod --device --release --version X.Y.Z

${GREEN}Required:${NC}
    --dev              Development mode (build for simulator)
    --prod             Production mode (create archive)

${GREEN}Optional:${NC}
    --simulator        Build for simulator (default in dev mode)
    --device           Build for physical device
    --debug            Debug configuration (default)
    --release          Release configuration
    --profile          Profile configuration
    --version X.Y.Z    Set version (prod mode only)
    --run              Auto-launch after build (dev mode only)
    --clean            Clean build (flutter clean + pod install)

${GREEN}Examples:${NC}
    # Quick dev build and run
    $0 --dev --run

    # Production release archive with version
    $0 --prod --device --release --version 1.2.0

    # Clean release build for simulator testing
    $0 --dev --simulator --release --clean

${GREEN}Note:${NC}
    - Dev mode: Fast builds using xcodebuild build
    - Prod mode: Creates .xcarchive for distribution
    - Always uses Flutter build pipeline first
    - Always uses "Runner" scheme

EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            [ -n "$MODE" ] && error_exit "Cannot specify both --dev and --prod"
            MODE="dev"
            shift
            ;;
        --prod)
            [ -n "$MODE" ] && error_exit "Cannot specify both --dev and --prod"
            MODE="prod"
            shift
            ;;
        --simulator)
            TARGET="simulator"
            shift
            ;;
        --device)
            TARGET="device"
            shift
            ;;
        --debug)
            CONFIG="debug"
            shift
            ;;
        --release)
            CONFIG="release"
            shift
            ;;
        --profile)
            CONFIG="profile"
            shift
            ;;
        --version)
            VERSION="$2"
            [ -z "$VERSION" ] && error_exit "Version required after --version"
            [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && error_exit "Version must be X.Y.Z format"
            shift 2
            ;;
        --run)
            RUN_AFTER=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --help|-h)
            usage
            ;;
        *)
            error_exit "Unknown option: $1 (use --help)"
            ;;
    esac
done

# Validate
[ -z "$MODE" ] && error_exit "Must specify --dev or --prod"
[ "$MODE" = "prod" ] && [ "$TARGET" = "simulator" ] && error_exit "Production builds require --device"
[ "$MODE" = "dev" ] && [ -n "$VERSION" ] && error_exit "Version only applies to production builds"
[ "$RUN_AFTER" = true ] && [ "$MODE" = "prod" ] && error_exit "--run only applies to dev builds"

# Convert config to Xcode format
XCODE_CONFIG="$(echo "${CONFIG}" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"

# Determine the scheme based on the configuration
if [ "$XCODE_CONFIG" = "Debug" ]; then
    SCHEME="Runner-Debug"
else
    SCHEME="Runner"
fi

# Banner
print_header "iOS Build - RecipeArchive"
echo -e "${BLUE}Mode:${NC}          ${GREEN}$MODE${NC}"
echo -e "${BLUE}Target:${NC}        ${GREEN}$TARGET${NC}"
echo -e "${BLUE}Configuration:${NC} ${GREEN}$XCODE_CONFIG${NC}"
[ -n "$VERSION" ] && echo -e "${BLUE}Version:${NC}       ${GREEN}$VERSION${NC}"

# Validate environment
print_status "Validating environment..."
command -v xcodebuild &>/dev/null || error_exit "xcodebuild not found. Install Xcode."
command -v flutter &>/dev/null || error_exit "Flutter not found."
command -v pod &>/dev/null || error_exit "CocoaPods not found. Run: sudo gem install cocoapods"
print_success "Environment validated"

# Navigate to Flutter directory
cd "$FLUTTER_DIR" || error_exit "Cannot access $FLUTTER_DIR"

# Ensure .env file is copied from root (Flutter doesn't follow symlinks in assets)
if [ -f "$PROJECT_ROOT/.env" ]; then
    print_status "Syncing .env file from repository root..."
    cp "$PROJECT_ROOT/.env" .env
    print_success ".env file synced"
fi

# Set version if specified
if [ -n "$VERSION" ]; then
    print_status "Setting version to $VERSION..."

    # Get current build number
    CURRENT_VERSION=$(grep "^version:" pubspec.yaml | awk '{print $2}')
    BUILD_NUMBER=$(echo "$CURRENT_VERSION" | cut -d'+' -f2)
    [ -z "$BUILD_NUMBER" ] && BUILD_NUMBER="1"

    # Update pubspec.yaml
    sed -i.bak "s/^version:.*/version: $VERSION+$BUILD_NUMBER/" pubspec.yaml
    rm -f pubspec.yaml.bak

    # Update Info.plist files
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" ios/Runner/Info.plist 2>/dev/null || true
    [ -f ios/RecipeArchive/Info.plist ] && /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" ios/RecipeArchive/Info.plist 2>/dev/null || true

    print_success "Version set to $VERSION+$BUILD_NUMBER"
fi

# Clean if requested
if [ "$CLEAN" = true ]; then
    print_status "Cleaning build..."
    flutter clean
    rm -rf ios/Pods ios/.symlinks ios/Podfile.lock
    print_success "Clean complete"
fi

# Step 1: Get Flutter dependencies
print_status "Getting Flutter dependencies..."
flutter pub get
print_success "Dependencies fetched"

# Step 2: Install CocoaPods dependencies
print_status "Installing CocoaPods dependencies..."
cd ios
pod install --repo-update
cd ..
print_success "CocoaPods dependencies installed"

# Step 3: Xcode build (Xcode will compile Flutter framework via build phases)
print_header "Xcode Build"
print_status "Note: Xcode will compile Flutter framework automatically via build scripts"

if [ "$MODE" = "dev" ]; then
    # Development mode: Quick build
    print_status "Building with xcodebuild..."

    SDK="iphonesimulator"
    [ "$TARGET" = "device" ] && SDK="iphoneos"

    cd ios
    xcodebuild \
        -workspace Runner.xcworkspace \
        -scheme "$SCHEME" \
        -configuration "$XCODE_CONFIG" \
        -sdk "$SDK" \
        build \
        | grep -E "Building|Compiling|Linking|✓|Build succeeded" || true

    BUILD_EXIT_CODE=${PIPESTATUS[0]}
    cd ..

    if [ $BUILD_EXIT_CODE -eq 0 ]; then
        print_success "Build complete"

        # Find the .app (Xcode places it in DerivedData)
        # Get DerivedData path from xcodebuild
        DERIVED_DATA_PATH=$(xcodebuild -workspace ios/Runner.xcworkspace -scheme "$SCHEME" -showBuildSettings 2>/dev/null | grep " BUILD_DIR =" | awk '{print $3}')

        if [ "$TARGET" = "simulator" ]; then
            APP_PATH="$DERIVED_DATA_PATH/$XCODE_CONFIG-iphonesimulator/Runner.app"
        else
            APP_PATH="$DERIVED_DATA_PATH/$XCODE_CONFIG-iphoneos/Runner.app"
        fi

        if [ -d "$APP_PATH" ]; then
            print_success "App location: $APP_PATH"

            # Create symlink in builds directory organized by build type
            BUILD_TYPE_LOWER=$(echo "$XCODE_CONFIG" | tr '[:upper:]' '[:lower:]')
            BUILDS_DIR="ios/builds/$BUILD_TYPE_LOWER"
            mkdir -p "$BUILDS_DIR"

            if [ "$TARGET" = "simulator" ]; then
                SYMLINK_NAME="$BUILDS_DIR/Runner.app"
            else
                SYMLINK_NAME="$BUILDS_DIR/Runner.app"
            fi

            # Remove old symlink if it exists
            rm -f "$SYMLINK_NAME"

            # Create new symlink
            ln -s "$APP_PATH" "$SYMLINK_NAME"
            print_success "Symlink created: $SYMLINK_NAME"

            # Auto-run if requested
            if [ "$RUN_AFTER" = true ] && [ "$TARGET" = "simulator" ]; then
                print_status "Launching simulator..."
                # Find any available iPhone simulator
                SIMULATOR_ID=$(xcrun simctl list devices available | grep -m 1 "iPhone" | grep -o '([A-F0-9\-]*)' | tr -d '()')

                if [ -n "$SIMULATOR_ID" ]; then
                    xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
                    sleep 2
                    xcrun simctl install "$SIMULATOR_ID" "$APP_PATH"
                    BUNDLE_ID=$(plutil -extract CFBundleIdentifier raw "$APP_PATH/Info.plist")
                    xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID"
                    print_success "App launched on simulator"
                else
                    print_error "No simulator found"
                fi
            fi
        else
            error_exit "Build succeeded but .app not found"
        fi
    else
        error_exit "Build failed"
    fi

else
    # Production mode: Build for device with signing
    print_status "Building for device (requires Apple Developer account)..."

    echo -e "${YELLOW}Note:${NC} This requires signing with your Apple ID"
    echo -e "${YELLOW}      Free accounts work! Open Xcode → Preferences → Accounts to add your Apple ID${NC}\n"

    SDK="iphoneos"

    cd ios

    # First, try to build with automatic signing (best for free accounts)
    print_status "Attempting build with automatic signing..."

    xcodebuild \
        -workspace Runner.xcworkspace \
        -scheme "$SCHEME" \
        -configuration "$XCODE_CONFIG" \
        -sdk "$SDK" \
        -allowProvisioningUpdates \
        build \
        | grep -E "Building|Compiling|Linking|✓|Build succeeded" || true

    BUILD_EXIT_CODE=${PIPESTATUS[0]}
    cd ..

    if [ $BUILD_EXIT_CODE -eq 0 ]; then
        print_success "Build complete"

        # Find the .app (Xcode places it in DerivedData)
        # Get DerivedData path from xcodebuild
        DERIVED_DATA_PATH=$(xcodebuild -workspace ios/Runner.xcworkspace -scheme "$SCHEME" -showBuildSettings 2>/dev/null | grep " BUILD_DIR =" | awk '{print $3}')
        APP_PATH="$DERIVED_DATA_PATH/$XCODE_CONFIG-iphoneos/Runner.app"

        if [ -d "$APP_PATH" ]; then
            print_success "App location: $APP_PATH"

            # Verify extensions are embedded
            SHARE_EXT_PATH="$APP_PATH/PlugIns/RecipeArchive.appex"
            WEB_EXT_PATH="$APP_PATH/PlugIns/RecipeExtension.appex"

            if [ -d "$SHARE_EXT_PATH" ]; then
                print_success "Share Extension verified: RecipeArchive.appex"
            else
                print_error "WARNING: Share Extension not found"
            fi

            if [ -d "$WEB_EXT_PATH" ]; then
                print_success "Safari Web Extension verified: RecipeExtension.appex"
            else
                print_error "WARNING: Safari Web Extension not found"
            fi

            # Create symlink in builds directory organized by build type
            BUILD_TYPE_LOWER=$(echo "$XCODE_CONFIG" | tr '[:upper:]' '[:lower:]')
            BUILDS_DIR="ios/builds/$BUILD_TYPE_LOWER"
            mkdir -p "$BUILDS_DIR"
            SYMLINK_NAME="$BUILDS_DIR/Runner.app"

            # Remove old symlink if it exists
            rm -f "$SYMLINK_NAME"

            # Create new symlink
            ln -s "$APP_PATH" "$SYMLINK_NAME"
            print_success "Symlink created: $SYMLINK_NAME"

            # Show size
            SIZE=$(du -sh "$APP_PATH" | cut -f1)
            echo -e "\n${BLUE}App Size:${NC} $SIZE"

            # Check signing
            print_status "Checking code signature..."
            codesign -dv "$APP_PATH" 2>&1 | grep "Authority\|Identifier" || true

            # Next steps
            echo -e "\n${YELLOW}Next Steps:${NC}"
            echo "  1. Connect your iPhone via USB"
            echo "  2. Open Xcode: Window → Devices and Simulators"
            echo "  3. Select your device"
            echo "  4. Click '+' under Installed Apps"
            echo "  5. Navigate to: $APP_PATH"
            echo ""
            echo "  ${CYAN}Or use Xcode to run directly:${NC}"
            echo "  open -a Xcode ios/Runner.xcworkspace"
            echo "  Then Product → Destination → Your Device → Run"
        else
            error_exit "Build succeeded but .app not found at $APP_PATH"
        fi
    else
        print_error "Build failed - possible signing issues"
        echo ""
        echo -e "${YELLOW}Common fixes:${NC}"
        echo "  1. Open Xcode → Preferences → Accounts"
        echo "  2. Add your Apple ID (free account works!)"
        echo "  3. Open ios/Runner.xcworkspace in Xcode"
        echo "  4. Select Runner target → Signing & Capabilities"
        echo "  5. Check 'Automatically manage signing'"
        echo "  6. Select your Team (your Apple ID)"
        echo "  7. Do the same for RecipeArchive target"
        echo ""
        echo -e "${CYAN}Then run this script again or use Xcode directly${NC}"
        exit 1
    fi
fi

# Reset project.pbxproj to avoid Flutter-generated changes
print_status "Resetting project.pbxproj..."
git checkout -- ios/Runner.xcodeproj/project.pbxproj 2>/dev/null || true

print_header "Build Complete"
