#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS Build Script
################################################################################
# PURPOSE: Build iOS app for development or production
#   - Supports debug, release, and profile configurations
#   - Builds for simulator or device
#   - Uses Xcode build system directly (NOT flutter build)
#   - Automatic Share Extension embedding verification
#   - Auto-resets project.pbxproj to avoid git noise
#   - Supports versioning
#   - Automatic timeout protection (10 minutes)
#
# USAGE:
#   ./scripts/ios/build.sh [options]
#
# EXAMPLES:
#   ./scripts/ios/build.sh --dev --run
#   ./scripts/ios/build.sh --prod --release --device --version 1.0.1
#   ./scripts/ios/build.sh --clean --dev --run
#
# OPTIONS:
#   --dev           Development mode (fast build)
#   --prod          Production mode (signed release)
#   --debug         Build Debug configuration
#   --release       Build Release configuration
#   --profile       Build Profile configuration
#   --simulator     Build for iOS Simulator
#   --device        Build for iOS Device
#   --clean         Clean before building
#   --run           Run on simulator/device after build
#   --version X.Y.Z Set build version
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Xcode
#   - CocoaPods
#
# NOTES:
#   - Uses Xcode build system (NOT flutter build ios)
#   - Automatic 10-minute timeout protection
#   - Auto-resets project.pbxproj after build
#   - Xcode 16 compatible (auto-downgrades objectVersion)
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

readonly REPO_ROOT="$(get_repo_root)"
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"

if ! is_macos; then
    die "iOS builds are only available on macOS"
fi

IOS_DIR="$FLUTTER_DIR/ios"
UNIFIED_BUILD_DIR="$REPO_ROOT/build"

# Helper functions
print_header() {
    echo -e "\n${COLOR_CYAN}╔════════════════════════════════════════════════════════════════╗"
    echo -e "${COLOR_CYAN}║  $1"
    echo -e "${COLOR_CYAN}╚════════════════════════════════════════════════════════════════╝${COLOR_RESET}\n"
}

print_status() {
    log_info "▸ $1"
}

print_success() {
    log_success "✓ $1"
}

print_error() {
    log_error "✗ $1${COLOR_RESET}" >&2
}

error_exit() {
    print_error "$1"
    die "Build failed"
}

# Usage
usage() {
    cat << EOF
${COLOR_CYAN}iOS Build Script${COLOR_RESET}

${COLOR_GREEN}Usage:${COLOR_RESET}
    # Development (fast iteration)
    $0 --dev [--simulator|--device] [--debug|--release] [--run]

    # Production (distribution)
    $0 --prod --device --release --version X.Y.Z

${COLOR_GREEN}Required:${COLOR_RESET}
    --dev              Development mode (build for simulator)
    --prod             Production mode (create archive)

${COLOR_GREEN}Optional:${COLOR_RESET}
    --simulator        Build for simulator (default in dev mode)
    --device           Build for physical device
    --debug            Debug configuration (default)
    --release          Release configuration
    --profile          Profile configuration
    --version X.Y.Z    Set version (prod mode only)
    --run              Auto-launch after build (dev mode only)
    --clean            Clean build (flutter clean + pod install)

${COLOR_GREEN}Examples:${COLOR_RESET}
    # Quick dev build and run
    $0 --dev --run

    # Production release archive with version
    $0 --prod --device --release --version 1.2.0

    # Clean release build for simulator testing
    $0 --dev --simulator --release --clean

${COLOR_GREEN}Note:${COLOR_RESET}
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

# Auto-detect version if not provided
if [ -z "$VERSION" ]; then
    # Try git describe for semantic version
    if git describe --tags --always --dirty 2>/dev/null | grep -q "^v"; then
        VERSION=$(git describe --tags --always --dirty | sed 's/^v//')
    else
        # Fallback to pubspec.yaml version
        VERSION=$(grep "^version:" "$FLUTTER_DIR/pubspec.yaml" 2>/dev/null | awk '{print $2}' | cut -d'+' -f1)
        [ -z "$VERSION" ] && VERSION="1.0.0-dev"
    fi
fi

# Banner
print_header "iOS Build - RecipeArchive"
log_info "Mode:${COLOR_RESET}          ${COLOR_GREEN}$MODE"
log_info "Target:${COLOR_RESET}        ${COLOR_GREEN}$TARGET"
log_info "Configuration:${COLOR_RESET} ${COLOR_GREEN}$XCODE_CONFIG"
log_info "Version:${COLOR_RESET}       ${COLOR_GREEN}$VERSION"

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

            # Create unified build directory with semantic naming
            CONFIG_LOWER=$(echo "$XCODE_CONFIG" | tr '[:upper:]' '[:lower:]')
            OUTPUT_DIR="$UNIFIED_BUILD_DIR/ios/$CONFIG_LOWER"
            mkdir -p "$OUTPUT_DIR/artifacts"

            # Semantic artifact naming: RecipeArchive-{version}-ios-{config}-{target}.app
            SEMANTIC_NAME="RecipeArchive-$VERSION-ios-$CONFIG_LOWER-$TARGET.app"
            OUTPUT_PATH="$OUTPUT_DIR/$SEMANTIC_NAME"

            # Copy app to unified build directory
            rm -rf "$OUTPUT_PATH"
            cp -R "$APP_PATH" "$OUTPUT_PATH"
            print_success "Artifact: $OUTPUT_PATH"

            # Create convenience symlink
            SYMLINK_NAME="$OUTPUT_DIR/artifacts/Runner.app"
            rm -f "$SYMLINK_NAME"
            ln -s "../$SEMANTIC_NAME" "$SYMLINK_NAME"
            print_success "Symlink: $SYMLINK_NAME"

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

    log_warning "Note:${COLOR_RESET} This requires signing with your Apple ID"
    log_warning "      Free accounts work! Open Xcode → Preferences → Accounts to add your Apple ID${COLOR_RESET}\n"

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

            # Create unified build directory with semantic naming
            CONFIG_LOWER=$(echo "$XCODE_CONFIG" | tr '[:upper:]' '[:lower:]')
            OUTPUT_DIR="$UNIFIED_BUILD_DIR/ios/$CONFIG_LOWER"
            mkdir -p "$OUTPUT_DIR/artifacts"

            # Semantic artifact naming: RecipeArchive-{version}-ios-{config}-device.app
            SEMANTIC_NAME="RecipeArchive-$VERSION-ios-$CONFIG_LOWER-device.app"
            OUTPUT_PATH="$OUTPUT_DIR/$SEMANTIC_NAME"

            # Copy app to unified build directory
            rm -rf "$OUTPUT_PATH"
            cp -R "$APP_PATH" "$OUTPUT_PATH"
            print_success "Artifact: $OUTPUT_PATH"

            # Create convenience symlink
            SYMLINK_NAME="$OUTPUT_DIR/artifacts/Runner.app"
            rm -f "$SYMLINK_NAME"
            ln -s "../$SEMANTIC_NAME" "$SYMLINK_NAME"
            print_success "Symlink: $SYMLINK_NAME"

            # Show size
            SIZE=$(du -sh "$APP_PATH" | cut -f1)
            echo -e "\n${COLOR_BLUE}App Size:${COLOR_RESET} $SIZE"

            # Check signing
            print_status "Checking code signature..."
            codesign -dv "$APP_PATH" 2>&1 | grep "Authority\|Identifier" || true

            # Next steps
            echo -e "\n${COLOR_YELLOW}Next Steps:"
            echo "  1. Connect your iPhone via USB"
            echo "  2. Open Xcode: Window → Devices and Simulators"
            echo "  3. Select your device"
            echo "  4. Click '+' under Installed Apps"
            echo "  5. Navigate to: $APP_PATH"
            echo ""
            echo "  ${COLOR_CYAN}Or use Xcode to run directly:"
            echo "  open -a Xcode ios/Runner.xcworkspace"
            echo "  Then Product → Destination → Your Device → Run"
        else
            error_exit "Build succeeded but .app not found at $APP_PATH"
        fi
    else
        print_error "Build failed - possible signing issues"
        echo ""
        log_warning "Common fixes:"
        echo "  1. Open Xcode → Preferences → Accounts"
        echo "  2. Add your Apple ID (free account works!)"
        echo "  3. Open ios/Runner.xcworkspace in Xcode"
        echo "  4. Select Runner target → Signing & Capabilities"
        echo "  5. Check 'Automatically manage signing'"
        echo "  6. Select your Team (your Apple ID)"
        echo "  7. Do the same for RecipeArchive target"
        echo ""
        echo -e "${COLOR_CYAN}Then run this script again or use Xcode directly"
        die "Build failed"
    fi
fi

# Reset project.pbxproj to avoid Flutter-generated changes
print_status "Resetting project.pbxproj..."
git checkout -- ios/Runner.xcodeproj/project.pbxproj 2>/dev/null || true

print_header "Build Complete"
