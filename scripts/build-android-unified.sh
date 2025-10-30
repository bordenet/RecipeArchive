#!/usr/bin/env bash

################################################################################
# Unified Android Build Script for RecipeArchive
################################################################################
# PURPOSE: Single source of truth for all Android builds
#   - Development builds (fast, emulator-focused)
#   - Production builds (signed APKs/AABs for distribution)
#
# USAGE:
#   Development (emulator):
#     ./scripts/build-android-unified.sh --dev --emulator --debug
#     ./scripts/build-android-unified.sh --dev --emulator --release
#
#   Production (signed APK/AAB):
#     ./scripts/build-android-unified.sh --prod --device --release --version 1.0.1
#
#   Quick emulator build+run:
#     ./scripts/build-android-unified.sh --dev --run
#
# PHILOSOPHY:
#   - Always use Gradle build system directly (NOT flutter build)
#   - Always use standard Gradle configurations (debug, release)
#   - Consistent workflow regardless of target
#   - Clear separation between dev (fast iteration) and prod (distribution)
#   - Mirror iOS unified script patterns for consistency
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
TARGET="emulator"    # emulator or device
CONFIG="debug"       # debug, release, profile
FORMAT="apk"         # apk or appbundle
VERSION=""           # Optional version string
RUN_AFTER=false      # Auto-launch after build
CLEAN=false          # Clean before build

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FLUTTER_DIR="$PROJECT_ROOT/recipe_archive"
ANDROID_DIR="$FLUTTER_DIR/android"
BUILD_DIR="$ANDROID_DIR/app/build"

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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error_exit() {
    print_error "$1"
    exit 1
}

# Usage
usage() {
    cat << EOF
${CYAN}Unified Android Build Script${NC}

${GREEN}Usage:${NC}
    # Development (fast iteration)
    $0 --dev [--emulator|--device] [--debug|--release] [--run]

    # Production (distribution)
    $0 --prod --device --release --version X.Y.Z [--apk|--appbundle]

${GREEN}Required:${NC}
    --dev              Development mode (build for emulator)
    --prod             Production mode (create signed release)

${GREEN}Optional:${NC}
    --emulator         Build for emulator (default in dev mode)
    --device           Build for physical device
    --debug            Debug configuration (default)
    --release          Release configuration
    --profile          Profile configuration
    --apk              Build APK (default)
    --appbundle        Build App Bundle (AAB)
    --version X.Y.Z    Set version (prod mode only)
    --run              Auto-launch after build (dev mode only)
    --clean            Clean build (flutter clean + gradle clean)

${GREEN}Examples:${NC}
    # Quick dev build and run
    $0 --dev --run

    # Production release APK with version
    $0 --prod --device --release --version 1.2.0

    # Clean release build for emulator testing
    $0 --dev --emulator --release --clean

${GREEN}Note:${NC}
    - Dev mode: Fast builds using gradle
    - Prod mode: Creates signed APK/AAB for distribution
    - Always uses Gradle build system directly
    - Follows iOS unified script pattern

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
        --emulator)
            TARGET="emulator"
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
        --apk)
            FORMAT="apk"
            shift
            ;;
        --appbundle)
            FORMAT="appbundle"
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
[ "$MODE" = "prod" ] && [ "$TARGET" = "emulator" ] && error_exit "Production builds require --device"
[ "$MODE" = "dev" ] && [ -n "$VERSION" ] && error_exit "Version only applies to production builds"
[ "$RUN_AFTER" = true ] && [ "$MODE" = "prod" ] && error_exit "--run only applies to dev builds"
[ "$MODE" = "prod" ] && [ "$CONFIG" != "release" ] && error_exit "Production builds must use --release"

# Convert config to Gradle format
GRADLE_TASK="assemble$(echo "${CONFIG}" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"
if [ "$FORMAT" = "appbundle" ]; then
    GRADLE_TASK="bundle$(echo "${CONFIG}" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"
fi

# Banner
print_header "Android Build - RecipeArchive"
echo -e "${BLUE}Mode:${NC}          ${GREEN}$MODE${NC}"
echo -e "${BLUE}Target:${NC}        ${GREEN}$TARGET${NC}"
echo -e "${BLUE}Configuration:${NC} ${GREEN}$CONFIG${NC}"
echo -e "${BLUE}Format:${NC}        ${GREEN}$FORMAT${NC}"
[ -n "$VERSION" ] && echo -e "${BLUE}Version:${NC}       ${GREEN}$VERSION${NC}"

# Validate environment
print_status "Validating environment..."
command -v flutter &>/dev/null || error_exit "Flutter not found."
command -v java &>/dev/null || error_exit "Java not found. Install OpenJDK."

# Check for Android SDK
ANDROID_SDK_ROOT=""
if [ -d "$HOME/Library/Android/sdk" ]; then
    ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
elif [ -n "$ANDROID_HOME" ]; then
    ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

[ -z "$ANDROID_SDK_ROOT" ] && error_exit "Android SDK not found. Set ANDROID_HOME or run ./scripts/setup-macos.sh"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

print_success "Environment validated"

# Navigate to Flutter directory
cd "$FLUTTER_DIR" || error_exit "Cannot access $FLUTTER_DIR"

# Set version if specified
if [ -n "$VERSION" ]; then
    print_status "Setting version to $VERSION..."

    # Get current build number
    CURRENT_VERSION=$(grep "^version:" pubspec.yaml | awk '{print $2}')
    BUILD_NUMBER=$(echo "$CURRENT_VERSION" | cut -d'+' -f2)
    [ -z "$BUILD_NUMBER" ] && BUILD_NUMBER="1"

    # Increment build number for new version
    BUILD_NUMBER=$((BUILD_NUMBER + 1))

    # Update pubspec.yaml
    sed -i.bak "s/^version:.*/version: $VERSION+$BUILD_NUMBER/" pubspec.yaml
    rm -f pubspec.yaml.bak

    print_success "Version set to $VERSION+$BUILD_NUMBER"
fi

# Clean if requested
if [ "$CLEAN" = true ]; then
    print_status "Cleaning build..."
    flutter clean
    cd android
    ./gradlew clean || error_exit "Gradle clean failed"
    cd ..
    print_success "Clean complete"
fi

# Step 1: Get Flutter dependencies
print_status "Getting Flutter dependencies..."
flutter pub get
print_success "Dependencies fetched"

# Step 2: Gradle build
print_header "Gradle Build"
print_status "Building with Gradle..."

cd android

# Set up timeout (10 minutes = 600 seconds)
TIMEOUT_DURATION=600

if [ "$MODE" = "dev" ]; then
    # Development mode: Quick build
    print_status "Running: ./gradlew $GRADLE_TASK"

    if timeout "$TIMEOUT_DURATION" ./gradlew "$GRADLE_TASK" --stacktrace 2>&1 | grep -E "BUILD|SUCCESSFUL|FAILED|> Task" || true; then
        BUILD_EXIT_CODE=${PIPESTATUS[0]}
    else
        BUILD_EXIT_CODE=1
    fi
else
    # Production mode: Signed release build
    print_status "Running: ./gradlew $GRADLE_TASK"
    print_warning "Note: Requires signing configuration in android/key.properties"

    if timeout "$TIMEOUT_DURATION" ./gradlew "$GRADLE_TASK" --stacktrace 2>&1 | grep -E "BUILD|SUCCESSFUL|FAILED|> Task" || true; then
        BUILD_EXIT_CODE=${PIPESTATUS[0]}
    else
        BUILD_EXIT_CODE=1
    fi
fi

cd ..

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    print_success "Build complete"

    # Find the output file
    CONFIG_LOWER=$(echo "$CONFIG" | tr '[:upper:]' '[:lower:]')

    if [ "$FORMAT" = "apk" ]; then
        OUTPUT_FILE="$BUILD_DIR/outputs/apk/$CONFIG_LOWER/app-$CONFIG_LOWER.apk"
        OUTPUT_NAME="app-$CONFIG_LOWER.apk"
    else
        OUTPUT_FILE="$BUILD_DIR/outputs/bundle/${CONFIG_LOWER}Release/app-${CONFIG_LOWER}-release.aab"
        OUTPUT_NAME="app-${CONFIG_LOWER}-release.aab"
    fi

    if [ -f "$OUTPUT_FILE" ]; then
        print_success "Output location: $OUTPUT_FILE"

        # Create symlink in builds directory organized by build type
        BUILDS_DIR="android/builds/$CONFIG_LOWER"
        mkdir -p "$BUILDS_DIR"
        SYMLINK_NAME="$BUILDS_DIR/$OUTPUT_NAME"

        # Remove old symlink if it exists
        rm -f "$SYMLINK_NAME"

        # Create new symlink
        ln -s "../../$OUTPUT_FILE" "$SYMLINK_NAME"
        print_success "Symlink created: $SYMLINK_NAME"

        # Show size
        SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
        echo -e "\n${BLUE}Build Size:${NC} $SIZE"

        # Auto-run if requested
        if [ "$RUN_AFTER" = true ] && [ "$TARGET" = "emulator" ]; then
            print_status "Launching on emulator..."

            # Check if emulator is running
            EMULATOR_RUNNING=$(adb devices | grep -c "emulator" || echo "0")

            if [ "$EMULATOR_RUNNING" = "0" ]; then
                print_warning "No emulator running. Starting emulator..."
                # This will be handled by the emulator script
                timeout 600 "$SCRIPT_DIR/android/android-emulator.sh" start &
                EMULATOR_PID=$!
                sleep 30  # Give emulator time to start

                # Wait for emulator to be ready (max 5 minutes)
                WAIT_COUNT=0
                while [ $WAIT_COUNT -lt 60 ]; do
                    if adb devices | grep -q "emulator"; then
                        print_success "Emulator ready"
                        break
                    fi
                    sleep 5
                    WAIT_COUNT=$((WAIT_COUNT + 1))
                done
            fi

            # Install and launch
            if adb devices | grep -q "emulator"; then
                print_status "Installing APK..."
                adb install -r "$OUTPUT_FILE"

                # Get package name from AndroidManifest.xml
                PACKAGE_NAME=$(grep "package=" android/app/src/main/AndroidManifest.xml | sed 's/.*package="\([^"]*\)".*/\1/')

                if [ -n "$PACKAGE_NAME" ]; then
                    print_status "Launching app..."
                    adb shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1
                    print_success "App launched on emulator"
                fi
            else
                print_error "Emulator not available"
            fi
        fi
    else
        error_exit "Build succeeded but output not found at $OUTPUT_FILE"
    fi
else
    error_exit "Build failed (exit code: $BUILD_EXIT_CODE)"
fi

print_header "Build Complete"

# Next steps for production builds
if [ "$MODE" = "prod" ]; then
    echo -e "\n${YELLOW}Next Steps for Production:${NC}"
    if [ "$FORMAT" = "apk" ]; then
        echo "  1. Test the APK: adb install $OUTPUT_FILE"
        echo "  2. Upload to Play Store Internal Testing"
        echo "  3. Run validation tests"
        echo "  4. Promote to Production"
    else
        echo "  1. Upload AAB to Play Console"
        echo "  2. Create release in Play Console"
        echo "  3. Submit for review"
    fi
    echo ""
fi
