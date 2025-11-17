#!/usr/bin/env bash

################################################################################
# RecipeArchive Android Build Script
################################################################################
# PURPOSE: Build Android app for development or production
#   - Supports debug, release, and profile build types
#   - Builds APK or App Bundle (AAB)
#   - Configures signing for release builds
#   - Manages emulator deployment
#   - Organizes output with symlinks
#   - Automatic timeout protection (10 minutes)
#
# USAGE:
#   ./scripts/android/build.sh [options]
#
# EXAMPLES:
#   ./scripts/android/build.sh --dev --run
#   ./scripts/android/build.sh --prod --release --appbundle
#   ./scripts/android/build.sh --clean --dev --run
#
# OPTIONS:
#   --dev           Development mode (fast build)
#   --prod          Production mode (signed release)
#   --debug         Build debug variant
#   --release       Build release variant
#   --profile       Build profile variant
#   --appbundle     Build App Bundle (AAB) instead of APK
#   --clean         Clean before building
#   --run           Run on emulator/device after build
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Android SDK
#   - Gradle
#
# NOTES:
#   - Uses Gradle build system directly (NOT flutter build)
#   - Automatic 10-minute timeout protection
#   - Auto-resets build artifacts organization
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

readonly REPO_ROOT="$(get_repo_root)"
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"
readonly ANDROID_DIR="$FLUTTER_DIR/android"
readonly UNIFIED_BUILD_DIR="$REPO_ROOT/build"
readonly BUILD_DIR="$FLUTTER_DIR/build"

# Usage
usage() {
    cat << EOF
${COLOR_CYAN}Android Build Script${COLOR_RESET}

${COLOR_GREEN}Usage:${COLOR_RESET}
    # Development (fast iteration)
    $0 --dev [--emulator|--device] [--debug|--release] [--run]

    # Production (distribution)
    $0 --prod --device --release --version X.Y.Z [--apk|--appbundle]

${COLOR_GREEN}Required:${COLOR_RESET}
    --dev              Development mode (build for emulator)
    --prod             Production mode (create signed release)

${COLOR_GREEN}Optional:${COLOR_RESET}
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

${COLOR_GREEN}Examples:${COLOR_RESET}
    # Quick dev build and run
    $0 --dev --run

    # Production release APK with version
    $0 --prod --device --release --version 1.2.0

    # Clean release build for emulator testing
    $0 --dev --emulator --release --clean

${COLOR_GREEN}Note:${COLOR_RESET}
    - Dev mode: Fast builds using gradle
    - Prod mode: Creates signed APK/AAB for distribution
    - Always uses Gradle build system directly
    - Follows iOS unified script pattern

EOF
    exit 0
}

# Initialize variables
MODE=""
CONFIG="debug"
TARGET="emulator"
FORMAT="apk"
VERSION=""
RUN_AFTER=false
CLEAN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            [ -n "$MODE" ] && die "Cannot specify both --dev and --prod"
            MODE="dev"
            shift
            ;;
        --prod)
            [ -n "$MODE" ] && die "Cannot specify both --dev and --prod"
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
            [ -z "$VERSION" ] && die "Version required after --version"
            [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && die "Version must be X.Y.Z format"
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
            die "Unknown option: $1 (use --help)"
            ;;
    esac
done

# Validate - default to dev mode if not specified
if [ -z "$MODE" ]; then
    log_warning "No mode specified, defaulting to --dev mode"
    MODE="dev"
fi
[ "$MODE" = "prod" ] && [ "$TARGET" = "emulator" ] && die "Production builds require --device"
[ "$MODE" = "dev" ] && [ -n "$VERSION" ] && die "Version only applies to production builds"
[ "$RUN_AFTER" = true ] && [ "$MODE" = "prod" ] && die "--run only applies to dev builds"
[ "$MODE" = "prod" ] && [ "$CONFIG" != "release" ] && die "Production builds must use --release"

# Convert config to Gradle format
GRADLE_TASK="assemble$(echo "${CONFIG}" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"
if [ "$FORMAT" = "appbundle" ]; then
    GRADLE_TASK="bundle$(echo "${CONFIG}" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"
fi

# Auto-detect version if not provided
if [ -z "$VERSION" ]; then
    # For dev mode, just use pubspec.yaml version (don't modify it)
    # For prod mode, version is required and must be provided via --version flag
    if [ "$MODE" = "dev" ]; then
        VERSION=$(grep "^version:" "$FLUTTER_DIR/pubspec.yaml" 2>/dev/null | awk '{print $2}')
        [ -z "$VERSION" ] && VERSION="1.0.0+1"
    fi
fi

# Banner
log_header "Android Build - RecipeArchive"
log_info "Mode:${COLOR_RESET}          ${COLOR_GREEN}$MODE"
log_info "Target:${COLOR_RESET}        ${COLOR_GREEN}$TARGET"
log_info "Configuration:${COLOR_RESET} ${COLOR_GREEN}$CONFIG"
log_info "Format:${COLOR_RESET}        ${COLOR_GREEN}$FORMAT"
log_info "Version:${COLOR_RESET}       ${COLOR_GREEN}$VERSION"

# Validate environment
log_section "Validating Environment"
command -v flutter &>/dev/null || die "Flutter not found."

# Check for Java - try Homebrew installation first
JAVA_HOME_DETECTED=""
if [ -d "/opt/homebrew/opt/openjdk" ]; then
    JAVA_HOME_DETECTED="/opt/homebrew/opt/openjdk"
elif [ -d "/usr/local/opt/openjdk" ]; then
    JAVA_HOME_DETECTED="/usr/local/opt/openjdk"
elif [ -n "$JAVA_HOME" ]; then
    JAVA_HOME_DETECTED="$JAVA_HOME"
fi

if [ -n "$JAVA_HOME_DETECTED" ]; then
    export JAVA_HOME="$JAVA_HOME_DETECTED"
    export PATH="$JAVA_HOME/bin:$PATH"
fi

# Verify Java is accessible
if ! command -v java &>/dev/null; then
    die "Java not found. Install OpenJDK via: brew install openjdk"
fi

# Check for Android SDK
ANDROID_SDK_ROOT=""
if [ -d "$HOME/Library/Android/sdk" ]; then
    ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
elif [ -n "$ANDROID_HOME" ]; then
    ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

[ -z "$ANDROID_SDK_ROOT" ] && die "Android SDK not found. Set ANDROID_HOME or run ./scripts/setup-macos.sh"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

log_success "Environment validated"

# Navigate to Flutter directory
cd "$FLUTTER_DIR" || die "Cannot access $FLUTTER_DIR"

# Ensure .env file is copied from root (Flutter doesn't follow symlinks in assets)
if [ -f "$REPO_ROOT/.env" ]; then
    log_info "Syncing .env file from repository root..."
    cp "$REPO_ROOT/.env" .env
    log_success ".env file synced"
fi

# Set version if specified (prod mode only)
if [ -n "$VERSION" ] && [ "$MODE" = "prod" ]; then
    log_info "Setting version to $VERSION..."

    # Get current build number
    CURRENT_VERSION=$(grep "^version:" pubspec.yaml | awk '{print $2}')
    BUILD_NUMBER=$(echo "$CURRENT_VERSION" | cut -d'+' -f2)
    [ -z "$BUILD_NUMBER" ] && BUILD_NUMBER="1"

    # Increment build number for new version
    BUILD_NUMBER=$((BUILD_NUMBER + 1))

    # Update pubspec.yaml
    sed -i.bak "s/^version:.*/version: $VERSION+$BUILD_NUMBER/" pubspec.yaml
    rm -f pubspec.yaml.bak

    log_success "Version set to $VERSION+$BUILD_NUMBER"
fi

# Clean if requested
if [ "$CLEAN" = true ]; then
    log_info "Cleaning build..."
    flutter clean
    cd android
    ./gradlew clean || die "Gradle clean failed"
    cd ..
    log_success "Clean complete"
fi

# Step 1: Get Flutter dependencies
log_info "Getting Flutter dependencies..."
flutter pub get
log_success "Dependencies fetched"

# Step 1.5: Ensure Gradle wrapper exists
if [ ! -f "$ANDROID_DIR/gradlew" ]; then
    log_warning "Gradle wrapper not found - generating..."
    # Flutter will generate the wrapper when building with --config-only
    if ! flutter build apk --config-only > /dev/null 2>&1; then
        log_warning "Flutter config-only failed, trying direct gradle wrapper generation..."
        cd "$ANDROID_DIR"
        if command -v gradle > /dev/null 2>&1; then
            gradle wrapper --gradle-version 8.3
        else
            die "Gradle wrapper missing and cannot be generated. Install gradle or run 'flutter build apk --config-only' manually."
        fi
        cd ..
    fi
    if [ -f "$ANDROID_DIR/gradlew" ]; then
        chmod +x "$ANDROID_DIR/gradlew"
        log_success "Gradle wrapper generated"
    else
        die "Failed to generate Gradle wrapper"
    fi
fi

# Step 2: Gradle build
log_section "Gradle Build"
log_info "Building with Gradle..."

cd android

# Set up timeout (10 minutes = 600 seconds)
TIMEOUT_DURATION=600

if [ "$MODE" = "dev" ]; then
    # Development mode: Quick build
    log_info "Running: ./gradlew $GRADLE_TASK --no-daemon"

    # Run build and capture output to temp file while preserving exit code
    # Use --no-daemon to prevent Gradle daemon from hanging waiting for input
    TEMP_OUTPUT=$(mktemp)
    if timeout "$TIMEOUT_DURATION" ./gradlew "$GRADLE_TASK" --no-daemon --stacktrace > "$TEMP_OUTPUT" 2>&1; then
        BUILD_EXIT_CODE=0
    else
        BUILD_EXIT_CODE=$?
    fi

    # Display relevant build output
    grep -E "BUILD|SUCCESSFUL|FAILED|> Task" "$TEMP_OUTPUT" || cat "$TEMP_OUTPUT"
    rm -f "$TEMP_OUTPUT"
else
    # Production mode: Signed release build
    log_info "Running: ./gradlew $GRADLE_TASK --no-daemon"
    log_warning "Note: Requires signing configuration in android/key.properties"

    # Run build and capture output to temp file while preserving exit code
    # Use --no-daemon to prevent Gradle daemon from hanging waiting for input
    TEMP_OUTPUT=$(mktemp)
    if timeout "$TIMEOUT_DURATION" ./gradlew "$GRADLE_TASK" --no-daemon --stacktrace > "$TEMP_OUTPUT" 2>&1; then
        BUILD_EXIT_CODE=0
    else
        BUILD_EXIT_CODE=$?
    fi

    # Display relevant build output
    grep -E "BUILD|SUCCESSFUL|FAILED|> Task" "$TEMP_OUTPUT" || cat "$TEMP_OUTPUT"
    rm -f "$TEMP_OUTPUT"
fi

cd ..

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    log_success "Build complete"

    # Find the output file
    CONFIG_LOWER=$(echo "$CONFIG" | tr '[:upper:]' '[:lower:]')

    if [ "$FORMAT" = "apk" ]; then
        # Try all possible APK locations (Gradle can put them in different places)
        # Standard Gradle locations
        POSSIBLE_LOCATIONS=(
            "$ANDROID_DIR/app/build/outputs/apk/$CONFIG_LOWER/app-$CONFIG_LOWER.apk"
            "$FLUTTER_DIR/build/app/outputs/flutter-apk/app-$CONFIG_LOWER.apk"
            "$FLUTTER_DIR/build/app/outputs/apk/$CONFIG_LOWER/app-$CONFIG_LOWER.apk"
            "$BUILD_DIR/outputs/apk/$CONFIG_LOWER/app-$CONFIG_LOWER.apk"
            "$BUILD_DIR/app/outputs/apk/$CONFIG_LOWER/app-$CONFIG_LOWER.apk"
        )

        OUTPUT_FILE=""
        for location in "${POSSIBLE_LOCATIONS[@]}"; do
            if [ -f "$location" ]; then
                OUTPUT_FILE="$location"
                break
            fi
        done
        OUTPUT_NAME="app-$CONFIG_LOWER.apk"
    else
        # Try all possible AAB locations
        POSSIBLE_LOCATIONS=(
            "$ANDROID_DIR/app/build/outputs/bundle/${CONFIG_LOWER}Release/app-${CONFIG_LOWER}-release.aab"
            "$FLUTTER_DIR/build/app/outputs/bundle/${CONFIG_LOWER}Release/app-${CONFIG_LOWER}-release.aab"
            "$BUILD_DIR/outputs/bundle/${CONFIG_LOWER}Release/app-${CONFIG_LOWER}-release.aab"
            "$BUILD_DIR/app/outputs/bundle/${CONFIG_LOWER}Release/app-${CONFIG_LOWER}-release.aab"
        )

        OUTPUT_FILE=""
        for location in "${POSSIBLE_LOCATIONS[@]}"; do
            if [ -f "$location" ]; then
                OUTPUT_FILE="$location"
                break
            fi
        done
        OUTPUT_NAME="app-${CONFIG_LOWER}-release.aab"
    fi

    if [ -n "$OUTPUT_FILE" ] && [ -f "$OUTPUT_FILE" ]; then
        log_success "Output location: $OUTPUT_FILE"

        # Create unified build directory with semantic naming
        OUTPUT_DIR="$UNIFIED_BUILD_DIR/android/$CONFIG_LOWER"
        mkdir -p "$OUTPUT_DIR/artifacts"

        # Semantic artifact naming: RecipeArchive-{version}-android-{config}.{ext}
        if [ "$FORMAT" = "apk" ]; then
            SEMANTIC_NAME="RecipeArchive-$VERSION-android-$CONFIG_LOWER.apk"
        else
            SEMANTIC_NAME="RecipeArchive-$VERSION-android-$CONFIG_LOWER.aab"
        fi
        OUTPUT_PATH="$OUTPUT_DIR/$SEMANTIC_NAME"

        # Copy artifact to unified build directory
        cp "$OUTPUT_FILE" "$OUTPUT_PATH"
        log_success "Artifact: $OUTPUT_PATH"

        # Create convenience symlink
        SYMLINK_NAME="$OUTPUT_DIR/artifacts/$OUTPUT_NAME"
        rm -f "$SYMLINK_NAME"
        ln -s "../$SEMANTIC_NAME" "$SYMLINK_NAME"
        log_success "Symlink: $SYMLINK_NAME"

        # Show size
        SIZE=$(du -h "$OUTPUT_PATH" | cut -f1)
        echo -e "\n${COLOR_BLUE}Build Size:${COLOR_RESET} $SIZE"

        # Auto-run if requested
        if [ "$RUN_AFTER" = true ] && [ "$TARGET" = "emulator" ]; then
            log_info "Launching on emulator..."

            # Check if emulator is running
            EMULATOR_RUNNING=$(adb devices | grep -c "emulator" || echo "0")

            if [ "$EMULATOR_RUNNING" = "0" ]; then
                log_warning "No emulator running. Starting emulator..."
                # This will be handled by the emulator script
                timeout 600 "$SCRIPT_DIR/android/android-emulator.sh" start &
                EMULATOR_PID=$!
                sleep 30  # Give emulator time to start

                # Wait for emulator to be ready (max 5 minutes)
                WAIT_COUNT=0
                while [ $WAIT_COUNT -lt 60 ]; do
                    if adb devices | grep -q "emulator"; then
                        log_success "Emulator ready"
                        break
                    fi
                    sleep 5
                    WAIT_COUNT=$((WAIT_COUNT + 1))
                done
            fi

            # Install and launch
            if adb devices | grep -q "emulator"; then
                log_info "Installing APK..."
                adb install -r "$OUTPUT_FILE"

                # Get package name from AndroidManifest.xml
                PACKAGE_NAME=$(grep "package=" android/app/src/main/AndroidManifest.xml | sed 's/.*package="\([^"]*\)".*/\1/')

                if [ -n "$PACKAGE_NAME" ]; then
                    log_info "Launching app..."
                    adb shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1
                    log_success "App launched on emulator"
                fi
            else
                log_error "Emulator not available"
            fi
        fi
    else
        log_error "Build succeeded but output file not found"
        echo ""
        echo "Checked the following locations:"
        for location in "${POSSIBLE_LOCATIONS[@]}"; do
            echo "  ✗ $location"
        done
        echo ""
        echo "Searching for APK/AAB files in build directory:"
        if [ "$FORMAT" = "apk" ]; then
            find "$ANDROID_DIR" "$FLUTTER_DIR/build" -name "*.apk" 2>/dev/null | while read -r file; do
                echo "  Found: $file"
            done || echo "  No APK files found"
        else
            find "$ANDROID_DIR" "$FLUTTER_DIR/build" -name "*.aab" 2>/dev/null | while read -r file; do
                echo "  Found: $file"
            done || echo "  No AAB files found"
        fi
        echo ""
        die "Build failed: output artifact not found in expected locations"
    fi
else
    die "Build failed (exit code: $BUILD_EXIT_CODE)"
fi

log_header "Build Complete"

# Next steps for production builds
if [ "$MODE" = "prod" ]; then
    echo -e "\n${COLOR_YELLOW}Next Steps for Production:"
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
