#!/bin/bash

################################################################################
#
# Mobile Development Setup Verification Script
#
# This script verifies that all mobile development dependencies are properly
# configured for Android and iOS development.
#
# USAGE:
#   ./scripts/verify-mobile-setup.sh
#
# REQUIREMENTS:
#   - macOS (for iOS development)
#   - Flutter SDK
#   - Android Studio (for Android development)
#   - Xcode (for iOS development)
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "🔍 Verifying Mobile Development Setup"

# Check Flutter installation
print_info "Checking Flutter installation..."
if command -v flutter &> /dev/null; then
    FLUTTER_VERSION=$(flutter --version | head -1)
    print_success "Flutter found: $FLUTTER_VERSION"
else
    print_error "Flutter not found. Run './scripts/setup-macos.sh' to install."
    exit 1
fi

# Run Flutter doctor
print_info "Running Flutter doctor..."
if flutter doctor --no-version-check > /tmp/flutter-doctor.log 2>&1; then
    print_success "Flutter doctor passed"
else
    print_warning "Flutter doctor found issues:"
    cat /tmp/flutter-doctor.log
    echo ""
fi

# Check Android development setup
print_info "Checking Android development setup..."

# Check Java
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1)
    print_success "Java found: $JAVA_VERSION"
else
    print_error "Java not found. Install with: brew install openjdk@17"
fi

# Check Android Studio
if [ -d "/Applications/Android Studio.app" ]; then
    print_success "Android Studio found"
else
    print_warning "Android Studio not found. Install with: brew install --cask android-studio"
fi

# Check Android SDK
if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
    print_success "Android SDK found at: $ANDROID_HOME"
    
    # Check SDK tools
    if [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
        print_success "Android platform tools found"
    else
        print_warning "Android platform tools not found. Install via Android Studio SDK Manager."
    fi
else
    print_warning "ANDROID_HOME not set or directory not found"
    print_info "Expected location: $HOME/Library/Android/sdk"
    print_info "Set with: export ANDROID_HOME=$HOME/Library/Android/sdk"
fi

# Check iOS development setup (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    print_info "Checking iOS development setup..."
    
    # Check Xcode
    if [ -d "/Applications/Xcode.app" ]; then
        print_success "Xcode found"
        
        # Check Xcode command line tools
        if xcode-select -p &> /dev/null; then
            print_success "Xcode command line tools configured"
        else
            print_warning "Xcode command line tools not configured. Run: xcode-select --install"
        fi
    else
        print_warning "Xcode not found. Install from App Store for iOS development."
    fi
    
    # Check CocoaPods
    if command -v pod &> /dev/null; then
        POD_VERSION=$(pod --version)
        print_success "CocoaPods found: $POD_VERSION"
    else
        print_warning "CocoaPods not found. Install with modern Ruby:"
        print_info "  brew install ruby"
        print_info "  /opt/homebrew/opt/ruby/bin/gem install cocoapods"
    fi
    
    # Check Ruby version
    if command -v ruby &> /dev/null; then
        RUBY_VERSION=$(ruby --version)
        print_success "Ruby found: $RUBY_VERSION"
        
        # Check if using modern Ruby
        if /opt/homebrew/opt/ruby/bin/ruby --version &> /dev/null; then
            print_success "Modern Ruby (Homebrew) available"
        else
            print_warning "Using system Ruby. Install modern Ruby with: brew install ruby"
        fi
    else
        print_error "Ruby not found"
    fi
else
    print_info "iOS development only available on macOS"
fi

# Check environment variables
print_info "Checking environment variables..."

# Check .env file
if [ -f ".env" ]; then
    print_success ".env file found"
    
    # Check mobile-specific variables
    if grep -q "ANDROID_HOME" .env; then
        ANDROID_HOME_ENV=$(grep "ANDROID_HOME" .env | cut -d'=' -f2)
        print_success "ANDROID_HOME configured in .env: $ANDROID_HOME_ENV"
    else
        print_warning "ANDROID_HOME not configured in .env"
    fi
    
    if grep -q "FLUTTER_ROOT" .env; then
        FLUTTER_ROOT_ENV=$(grep "FLUTTER_ROOT" .env | cut -d'=' -f2)
        print_success "FLUTTER_ROOT configured in .env: $FLUTTER_ROOT_ENV"
    else
        print_warning "FLUTTER_ROOT not configured in .env"
    fi
else
    print_warning ".env file not found. Copy from .env.example and configure."
fi

# Test Flutter project
print_info "Testing Flutter project setup..."
if [ -d "recipe_archive" ]; then
    cd recipe_archive
    
    # Test pub get
    if flutter pub get > /tmp/flutter-pub-get.log 2>&1; then
        print_success "Flutter dependencies resolved"
    else
        print_error "Flutter pub get failed. See /tmp/flutter-pub-get.log"
    fi
    
    # Test analysis
    if flutter analyze --no-congratulate > /tmp/flutter-analyze.log 2>&1; then
        print_success "Flutter analysis passed"
    else
        print_warning "Flutter analysis found issues. See /tmp/flutter-analyze.log"
    fi
    
    cd - > /dev/null
else
    print_error "Flutter project directory 'recipe_archive' not found"
fi

# Run mobile validation if available
print_info "Running mobile validation..."
if [ -f "../validate-monorepo.sh" ]; then
    if ../validate-monorepo.sh --mobile > /tmp/mobile-validation.log 2>&1; then
        print_success "Mobile validation passed"
    else
        print_warning "Mobile validation found issues. See /tmp/mobile-validation.log"
    fi
elif [ -f "./validate-monorepo.sh" ]; then
    if ./validate-monorepo.sh --mobile > /tmp/mobile-validation.log 2>&1; then
        print_success "Mobile validation passed"
    else
        print_warning "Mobile validation found issues. See /tmp/mobile-validation.log"
    fi
else
    print_warning "Mobile validation script not found"
fi

print_info ""
print_info "📋 Setup Summary:"
print_info "=================="

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
print_info "🚀 Next Steps:"
print_info "1. Fix any issues listed above"
print_info "2. Run: ./validate-monorepo.sh --mobile"
print_info "3. Test mobile builds: cd recipe_archive && ./scripts/build-mobile.sh both debug"
print_info "4. For complete setup: ./scripts/setup-macos.sh"

print_success "🎉 Mobile development setup verification complete!"