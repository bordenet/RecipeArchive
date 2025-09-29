#!/bin/bash

################################################################################
#
# RecipeArchive Dependency Installation Script
#
# This script ensures all dependencies are properly installed across the monorepo.
#
# USAGE:
#   ./install-dependencies.sh
#
# DEPENDENCIES:
#   - Node.js
#   - npm
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

# RecipeArchive Dependency Installation Script
# Ensures all dependencies are properly installed across the monorepo

set -e

# Color codes for better output
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

print_info "🔧 Installing RecipeArchive Monorepo Dependencies"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    print_error "Must be run from the project root directory"
    exit 1
fi

# Install root dependencies
print_info "Installing root monorepo dependencies..."
if ! npm install > /tmp/install-dependencies.log 2>&1; then
    print_error "Failed to install root dependencies. See /tmp/install-dependencies.log for details."
    exit 1
fi

# Verify key dependencies are installed
print_info "Verifying core dependencies..."

REQUIRED_DEPS=(
    "@typescript-eslint/eslint-plugin"
    "@typescript-eslint/parser"
    "eslint"
    "eslint-config-prettier"
    "eslint-plugin-prettier"
    "husky"
    "lint-staged"
    "prettier"
    "typescript"
)

for dep in "${REQUIRED_DEPS[@]}"; do
    if npm list "$dep" >/dev/null 2>&1; then
        print_success "$dep installed"
    else
        print_warning "$dep missing - attempting to install..."
        if ! npm install --save-dev "$dep" > /tmp/install-dependencies.log 2>&1; then
            print_error "Failed to install $dep. See /tmp/install-dependencies.log for details."
            exit 1
        fi
    fi
done

# Set up pre-commit hooks
print_info "Setting up Git pre-commit hooks..."
npx husky init || true
echo "npx lint-staged" > .husky/pre-commit
chmod +x .husky/pre-commit

# Build shared types package
if [ -d "packages/shared-types" ]; then
    print_info "Building shared types package..."
    cd packages/shared-types
    if ! npm install > /tmp/install-dependencies.log 2>&1; then
        print_error "Failed to install shared-types dependencies. See /tmp/install-dependencies.log for details."
        exit 1
    fi
    if ! npm run build > /tmp/install-dependencies.log 2>&1; then
        print_error "Failed to build shared-types. See /tmp/install-dependencies.log for details."
        exit 1
    fi
    cd - > /dev/null
    print_success "Shared types package built"
else
    print_warning "Shared types package not found"
fi

# Install Chrome extension dependencies
if [ -d "extensions/chrome" ]; then
    print_info "Installing Chrome extension dependencies..."
    cd extensions/chrome
    if [ -f "package.json" ]; then
        if ! npm install > /tmp/install-dependencies.log 2>&1; then
            print_error "Failed to install Chrome extension dependencies. See /tmp/install-dependencies.log for details."
            exit 1
        fi
        print_success "Chrome extension dependencies installed"
    else
        print_warning "Chrome extension package.json not found"
    fi
    cd - > /dev/null
fi

# Install Safari extension dependencies
if [ -d "extensions/safari" ]; then
    print_info "Installing Safari extension dependencies..."
    cd extensions/safari
    if [ -f "package.json" ]; then
        if ! npm install > /tmp/install-dependencies.log 2>&1; then
            print_error "Failed to install Safari extension dependencies. See /tmp/install-dependencies.log for details."
            exit 1
        fi
        print_success "Safari extension dependencies installed"
    else
        print_warning "Safari extension package.json not found"
    fi
    cd - > /dev/null
fi

# Install AWS CDK infrastructure dependencies
if [ -d "aws-backend/infrastructure" ]; then
    print_info "Installing AWS CDK infrastructure dependencies..."
    cd aws-backend/infrastructure
    if [ -f "package.json" ]; then
        if ! npm install > /tmp/install-dependencies.log 2>&1; then
            print_error "Failed to install AWS CDK infrastructure dependencies. See /tmp/install-dependencies.log for details."
            exit 1
        fi
        print_success "AWS CDK dependencies installed"
    else
        print_warning "AWS CDK package.json not found"
    fi
    cd - > /dev/null
fi

# Verify the setup
print_info "Verifying installation..."

# Test TypeScript compilation
if npm run type-check >/dev/null 2>&1; then
    print_success "TypeScript compilation working"
else
    print_warning "TypeScript compilation failed"
fi

# Test linting
if npm run lint >/dev/null 2>&1; then
    print_success "ESLint configuration working"
else
    print_warning "ESLint issues found - run 'npm run lint:fix' to resolve"
fi

# Test formatting
if npm run format:check >/dev/null 2>&1; then
    print_success "Prettier configuration working"
else
    print_warning "Prettier formatting issues found - run 'npm run format' to fix"
fi

# Install Flutter dependencies if Flutter app exists
if [ -d "recipe_archive" ]; then
    print_info "Installing Flutter app dependencies..."
    cd recipe_archive
    if command -v flutter &> /dev/null; then
        if ! flutter pub get > /tmp/install-dependencies.log 2>&1; then
            print_error "Failed to install Flutter dependencies. See /tmp/install-dependencies.log for details."
            exit 1
        fi
        print_success "Flutter dependencies installed"
        
        # Run Flutter doctor to check setup
        print_info "Checking Flutter setup..."
        if flutter doctor --no-version-check > /tmp/flutter-doctor.log 2>&1; then
            print_success "Flutter setup verified"
        else
            print_warning "Flutter doctor found issues - see /tmp/flutter-doctor.log"
        fi
    else
        print_warning "Flutter not found - mobile development dependencies skipped"
        print_info "Run './scripts/setup-macos.sh' to install Flutter and mobile development tools"
    fi
    cd - > /dev/null
else
    print_warning "Flutter app directory not found"
fi

# Verify mobile development setup if available
if command -v flutter &> /dev/null; then
    print_info "Verifying mobile development setup..."
    
    # Check Android setup
    if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
        print_success "Android SDK found at $ANDROID_HOME"
    else
        print_warning "Android SDK not configured - set ANDROID_HOME environment variable"
    fi
    
    # Check iOS setup (macOS only)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v pod &> /dev/null; then
            print_success "CocoaPods found for iOS development"
        else
            print_warning "CocoaPods not found - run './scripts/setup-macos.sh' to install"
        fi
        
        if [ -d "/Applications/Xcode.app" ]; then
            print_success "Xcode found for iOS development"
        else
            print_warning "Xcode not found - install from App Store for iOS development"
        fi
    fi
fi

print_success "🎉 Dependency installation complete!"
print_info "Run 'npm run lint && npm run type-check && npm run build' to verify setup"
print_info "For mobile development: './validate-monorepo.sh --mobile' to check mobile setup"