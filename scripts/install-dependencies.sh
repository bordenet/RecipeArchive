#!/bin/bash
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
npm install

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
        npm install --save-dev "$dep"
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
    npm install
    npm run build
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
        npm install
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
        npm install
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
        npm install
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

print_success "🎉 Dependency installation complete!"
print_info "Run 'npm run lint && npm run type-check && npm run build' to verify setup"
