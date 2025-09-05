#!/bin/bash

# RecipeArchive Mobile Build Script
# Usage: ./scripts/build-mobile.sh [android|ios|both] [debug|release]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}📱 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_usage() {
    echo "📱 RecipeArchive Mobile Build Script"
    echo ""
    echo "Usage:"
    echo "  ./scripts/build-mobile.sh android debug    # Build debug Android APK"
    echo "  ./scripts/build-mobile.sh ios release      # Build release iOS app"  
    echo "  ./scripts/build-mobile.sh both debug       # Build both platforms (debug)"
    echo ""
    echo "Platforms: android, ios, both"
    echo "Build types: debug, release"
}

check_flutter() {
    if ! command -v flutter &> /dev/null; then
        log_error "Flutter not found. Please install Flutter first."
        return 1
    fi
    
    log_info "Flutter version:"
    flutter --version | head -1
    return 0
}

check_android_requirements() {
    if ! command -v java &> /dev/null; then
        log_error "Java not found. Install Java/JDK for Android builds."
        echo "Visit: https://developer.android.com/studio/install"
        return 1
    fi
    
    if [ ! -d "$ANDROID_HOME" ] && [ ! -d "$HOME/Library/Android/sdk" ]; then
        log_warning "Android SDK not found. Set ANDROID_HOME or install Android Studio."
        log_warning "Attempting to continue - may fail if SDK is missing."
    fi
    
    return 0
}

check_ios_requirements() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "iOS builds require macOS."
        return 1
    fi
    
    if ! command -v xcode-select &> /dev/null; then
        log_error "Xcode not found. Install Xcode for iOS builds."
        return 1
    fi
    
    if ! command -v pod &> /dev/null; then
        log_warning "CocoaPods not found. Installing..."
        sudo gem install cocoapods || {
            log_error "Failed to install CocoaPods"
            return 1
        }
    fi
    
    return 0
}

build_android() {
    local build_type="$1"
    
    log_info "Building Android app ($build_type mode)..."
    
    if ! check_android_requirements; then
        return 1
    fi
    
    case "$build_type" in
        "debug")
            flutter build apk --debug
            local apk_path="build/app/outputs/flutter-apk/app-debug.apk"
            ;;
        "release")
            flutter build apk --release
            local apk_path="build/app/outputs/flutter-apk/app-release.apk"
            ;;
        *)
            log_error "Invalid build type: $build_type"
            return 1
            ;;
    esac
    
    if [ -f "$apk_path" ]; then
        local size=$(stat -f%z "$apk_path" 2>/dev/null || stat -c%s "$apk_path" 2>/dev/null || echo "unknown")
        log_success "Android APK built: $apk_path ($size bytes)"
    else
        log_error "Android build failed - APK not found"
        return 1
    fi
}

build_ios() {
    local build_type="$1"
    
    log_info "Building iOS app ($build_type mode)..."
    
    if ! check_ios_requirements; then
        return 1
    fi
    
    # Run pod install to ensure dependencies are up to date
    log_info "Updating iOS dependencies..."
    cd ios && pod install && cd ..
    
    case "$build_type" in
        "debug")
            flutter build ios --debug --no-codesign
            ;;
        "release")
            flutter build ios --release --no-codesign
            ;;
        *)
            log_error "Invalid build type: $build_type"
            return 1
            ;;
    esac
    
    local ios_path="build/ios/iphoneos/Runner.app"
    if [ -d "$ios_path" ]; then
        log_success "iOS app built: $ios_path"
        log_warning "Note: App is not codesigned. Manual signing required for device deployment."
    else
        log_error "iOS build failed - app bundle not found"
        return 1
    fi
}

main() {
    local platform="${1:-}"
    local build_type="${2:-debug}"
    
    if [ "$platform" = "--help" ] || [ "$platform" = "-h" ]; then
        print_usage
        exit 0
    fi
    
    if [ -z "$platform" ]; then
        log_error "No platform specified."
        print_usage
        exit 1
    fi
    
    if ! check_flutter; then
        exit 1
    fi
    
    # Ensure we're in the right directory
    if [ ! -f "pubspec.yaml" ]; then
        log_error "Not in a Flutter project directory. Run from the recipe_archive folder."
        exit 1
    fi
    
    # Clean previous builds
    log_info "Cleaning previous builds..."
    flutter clean
    flutter pub get
    
    case "$platform" in
        "android")
            build_android "$build_type"
            ;;
        "ios")
            build_ios "$build_type"
            ;;
        "both")
            log_info "Building both Android and iOS..."
            if build_android "$build_type" && build_ios "$build_type"; then
                log_success "Both platforms built successfully!"
            else
                log_error "One or more builds failed"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown platform: $platform"
            print_usage
            exit 1
            ;;
    esac
    
    log_success "🎉 Mobile build completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "• For Android: Install APK on device or upload to Google Play Store"
    echo "• For iOS: Open Xcode, sign the app, and deploy to device/App Store"
}

main "$@"