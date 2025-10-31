#!/usr/bin/env bash

################################################################################
# RecipeArchive Mobile Development Setup Verification
################################################################################
# PURPOSE: Verify mobile development dependencies are properly configured
#   - Flutter SDK installation and version
#   - Android Studio and SDK configuration
#   - Xcode and iOS development tools (macOS only)
#   - CocoaPods installation
#   - Environment variables (.env, ANDROID_HOME)
#   - Flutter project health
#
# USAGE:
#   ./scripts/verify-mobile-setup.sh
#
# EXAMPLES:
#   ./scripts/verify-mobile-setup.sh
#
# DEPENDENCIES:
#   - Flutter SDK (verified by this script)
#   - Java (for Android development)
#   - Android Studio (for Android development)
#   - Xcode (for iOS development, macOS only)
#
# NOTES:
#   - Runs Flutter doctor for comprehensive health check
#   - Creates logs at /tmp for troubleshooting
#   - Provides setup summary and next steps
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

log_header "Mobile Development Setup Verification"
log_info "🔍 Verifying Mobile Development Setup"

# Check Flutter installation
log_info "Checking Flutter installation..."
if command -v flutter &> /dev/null; then
    FLUTTER_VERSION=$(flutter --version | head -1)
    log_success "Flutter found: $FLUTTER_VERSION"
else
    log_error "Flutter not found. Run './scripts/setup-macos.sh' to install."
    exit 1
fi

# Run Flutter doctor
log_info "Running Flutter doctor..."
if flutter doctor --no-version-check > /tmp/flutter-doctor.log 2>&1; then
    log_success "Flutter doctor passed"
else
    log_warning "Flutter doctor found issues:"
    cat /tmp/flutter-doctor.log
    echo ""
fi

# Check Android development setup
log_info "Checking Android development setup..."

# Check Java
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1)
    log_success "Java found: $JAVA_VERSION"
else
    log_error "Java not found. Install with: brew install openjdk@17"
fi

# Check Android Studio
if [ -d "/Applications/Android Studio.app" ]; then
    log_success "Android Studio found"
else
    log_warning "Android Studio not found. Install with: brew install --cask android-studio"
fi

# Check Android SDK
if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
    log_success "Android SDK found at: $ANDROID_HOME"
    
    # Check SDK tools
    if [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
        log_success "Android platform tools found"
    else
        log_warning "Android platform tools not found. Install via Android Studio SDK Manager."
    fi
else
    log_warning "ANDROID_HOME not set or directory not found"
    log_info "Expected location: $HOME/Library/Android/sdk"
    log_info "Set with: export ANDROID_HOME=$HOME/Library/Android/sdk"
fi

# Check iOS development setup (macOS only)
if is_macos; then
    log_info "Checking iOS development setup..."
    
    # Check Xcode
    if [ -d "/Applications/Xcode.app" ]; then
        log_success "Xcode found"
        
        # Check Xcode command line tools
        if xcode-select -p &> /dev/null; then
            log_success "Xcode command line tools configured"
        else
            log_warning "Xcode command line tools not configured. Run: xcode-select --install"
        fi
    else
        log_warning "Xcode not found. Install from App Store for iOS development."
    fi
    
    # Check CocoaPods
    if command -v pod &> /dev/null; then
        POD_VERSION=$(pod --version)
        log_success "CocoaPods found: $POD_VERSION"
    else
        log_warning "CocoaPods not found. Install with modern Ruby:"
        log_info "  brew install ruby"
        log_info "  /opt/homebrew/opt/ruby/bin/gem install cocoapods"
    fi
    
    # Check Ruby version
    if command -v ruby &> /dev/null; then
        RUBY_VERSION=$(ruby --version)
        log_success "Ruby found: $RUBY_VERSION"
        
        # Check if using modern Ruby
        if /opt/homebrew/opt/ruby/bin/ruby --version &> /dev/null; then
            log_success "Modern Ruby (Homebrew) available"
        else
            log_warning "Using system Ruby. Install modern Ruby with: brew install ruby"
        fi
    else
        log_error "Ruby not found"
    fi
else
    log_info "iOS development only available on macOS"
fi

# Check environment variables
log_info "Checking environment variables..."

# Check .env file
if [ -f ".env" ]; then
    log_success ".env file found"
    
    # Check mobile-specific variables
    if grep -q "ANDROID_HOME" .env; then
        ANDROID_HOME_ENV=$(grep "ANDROID_HOME" .env | cut -d'=' -f2)
        log_success "ANDROID_HOME configured in .env: $ANDROID_HOME_ENV"
    else
        log_warning "ANDROID_HOME not configured in .env"
    fi
    
    if grep -q "FLUTTER_ROOT" .env; then
        FLUTTER_ROOT_ENV=$(grep "FLUTTER_ROOT" .env | cut -d'=' -f2)
        log_success "FLUTTER_ROOT configured in .env: $FLUTTER_ROOT_ENV"
    else
        log_warning "FLUTTER_ROOT not configured in .env"
    fi
else
    log_warning ".env file not found. Copy from .env.example and configure."
fi

# Test Flutter project
log_info "Testing Flutter project setup..."
if [ -d "recipe_archive" ]; then
    cd recipe_archive
    
    # Test pub get
    if flutter pub get > /tmp/flutter-pub-get.log 2>&1; then
        log_success "Flutter dependencies resolved"
    else
        log_error "Flutter pub get failed. See /tmp/flutter-pub-get.log"
    fi
    
    # Test analysis
    if flutter analyze --no-congratulate > /tmp/flutter-analyze.log 2>&1; then
        log_success "Flutter analysis passed"
    else
        log_warning "Flutter analysis found issues. See /tmp/flutter-analyze.log"
    fi
    
    cd - > /dev/null
else
    log_error "Flutter project directory 'recipe_archive' not found"
fi

# Run mobile validation if available
log_info "Running mobile validation..."
if [ -f "../validate-monorepo.sh" ]; then
    if ../validate-monorepo.sh --mobile > /tmp/mobile-validation.log 2>&1; then
        log_success "Mobile validation passed"
    else
        log_warning "Mobile validation found issues. See /tmp/mobile-validation.log"
    fi
elif [ -f "./validate-monorepo.sh" ]; then
    if ./validate-monorepo.sh --mobile > /tmp/mobile-validation.log 2>&1; then
        log_success "Mobile validation passed"
    else
        log_warning "Mobile validation found issues. See /tmp/mobile-validation.log"
    fi
else
    log_warning "Mobile validation script not found"
fi

log_info ""
log_info "📋 Setup Summary:"
log_info "=================="

# Summary of what's working
echo "✅ Working components:"
command -v flutter &> /dev/null && echo "  • Flutter SDK"
command -v java &> /dev/null && echo "  • Java Development Kit"
[ -d "/Applications/Android Studio.app" ] && echo "  • Android Studio"
[ -d "/Applications/Xcode.app" ] && echo "  • Xcode"
command -v pod &> /dev/null && echo "  • CocoaPods"

echo ""
echo "⚠️  Items needing attention:"
! command -v flutter &> /dev/null && echo "  • Install Flutter SDK"
! command -v java &> /dev/null && echo "  • Install Java (brew install openjdk@17)"
[ ! -d "/Applications/Android Studio.app" ] && echo "  • Install Android Studio"
[ ! -d "/Applications/Xcode.app" ] && echo "  • Install Xcode from App Store"
! command -v pod &> /dev/null && echo "  • Install CocoaPods"
[ -z "$ANDROID_HOME" ] && echo "  • Set ANDROID_HOME environment variable"

echo ""
log_info "🚀 Next Steps:"
log_info "1. Fix any issues listed above"
log_info "2. Run: ./validate-monorepo.sh --mobile"
log_info "3. Test mobile builds: cd recipe_archive && ./scripts/build-mobile.sh both debug"
log_info "4. For complete setup: ./scripts/setup-macos.sh"

log_success "🎉 Mobile development setup verification complete!"