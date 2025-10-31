#!/usr/bin/env bash

################################################################################
# RecipeArchive Dependency Installation
################################################################################
# PURPOSE: Install and verify all dependencies across the monorepo
#   - Root monorepo npm dependencies
#   - Extension dependencies (Chrome, Safari)
#   - AWS CDK infrastructure dependencies
#   - Flutter app dependencies
#   - Shared types package
#   - Pre-commit hooks setup
#   - Mobile development toolchain verification
#
# USAGE:
#   ./scripts/install-dependencies.sh
#
# EXAMPLES:
#   ./scripts/install-dependencies.sh
#
# DEPENDENCIES:
#   - Node.js
#   - npm
#   - Flutter (optional, for mobile development)
#
# NOTES:
#   - Must be run from the project root directory
#   - Automatically sets up Husky pre-commit hooks
#   - Verifies TypeScript, ESLint, and Prettier configuration
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

log_header "Monorepo Dependency Installation"

# Check if we're in the project root
cd "$REPO_ROOT" || die "Failed to change to repository root"
require_file "$REPO_ROOT/package.json" "Must be run from project root directory"

# Install root dependencies
log_section "Installing Root Dependencies"

if ! npm install > /tmp/install-dependencies.log 2>&1; then
    die "Failed to install root dependencies. See /tmp/install-dependencies.log for details."
fi
log_success "Root dependencies installed"

# Verify key dependencies
log_section "Verifying Core Dependencies"

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
        log_debug "$dep installed"
    else
        log_warning "$dep missing - attempting to install..."
        if ! npm install --save-dev "$dep" > /tmp/install-dependencies.log 2>&1; then
            die "Failed to install $dep. See /tmp/install-dependencies.log for details."
        fi
    fi
done
log_success "Core dependencies verified"

# Set up pre-commit hooks
log_section "Setting Up Pre-Commit Hooks"

npx husky init 2>/dev/null || true
echo "npx lint-staged" > .husky/pre-commit
chmod +x .husky/pre-commit
log_success "Pre-commit hooks configured"

# Build shared types package
log_section "Building Shared Packages"

if [[ -d "$REPO_ROOT/packages/shared-types" ]]; then
    cd "$REPO_ROOT/packages/shared-types" || die "Failed to change to shared-types directory"

    if ! npm install > /tmp/install-dependencies.log 2>&1; then
        die "Failed to install shared-types dependencies. See /tmp/install-dependencies.log for details."
    fi

    if ! npm run build > /tmp/install-dependencies.log 2>&1; then
        die "Failed to build shared-types. See /tmp/install-dependencies.log for details."
    fi

    cd "$REPO_ROOT" || die "Failed to return to repository root"
    log_success "Shared types package built"
else
    log_warning "Shared types package not found"
fi

# Install extension dependencies
log_section "Installing Extension Dependencies"

if [[ -d "$REPO_ROOT/extensions/chrome" ]]; then
    cd "$REPO_ROOT/extensions/chrome" || die "Failed to change to Chrome extension directory"
    if [[ -f "package.json" ]]; then
        if ! npm install > /tmp/install-dependencies.log 2>&1; then
            die "Failed to install Chrome extension dependencies. See /tmp/install-dependencies.log for details."
        fi
        log_success "Chrome extension dependencies installed"
    else
        log_warning "Chrome extension package.json not found"
    fi
else
    log_warning "Chrome extension directory not found"
fi

if [[ -d "$REPO_ROOT/extensions/safari" ]]; then
    cd "$REPO_ROOT/extensions/safari" || die "Failed to change to Safari extension directory"
    if [[ -f "package.json" ]]; then
        if ! npm install > /tmp/install-dependencies.log 2>&1; then
            die "Failed to install Safari extension dependencies. See /tmp/install-dependencies.log for details."
        fi
        log_success "Safari extension dependencies installed"
    else
        log_warning "Safari extension package.json not found"
    fi
else
    log_warning "Safari extension directory not found"
fi

# Install AWS CDK infrastructure dependencies
log_section "Installing AWS CDK Dependencies"

if [[ -d "$REPO_ROOT/aws-backend/infrastructure" ]]; then
    cd "$REPO_ROOT/aws-backend/infrastructure" || die "Failed to change to AWS CDK directory"
    if [[ -f "package.json" ]]; then
        if ! npm install > /tmp/install-dependencies.log 2>&1; then
            die "Failed to install AWS CDK dependencies. See /tmp/install-dependencies.log for details."
        fi
        log_success "AWS CDK dependencies installed"
    else
        log_warning "AWS CDK package.json not found"
    fi
else
    log_warning "AWS CDK directory not found"
fi

# Return to repo root
cd "$REPO_ROOT" || die "Failed to return to repository root"

# Verify the setup
log_section "Verifying Installation"

if npm run type-check >/dev/null 2>&1; then
    log_success "TypeScript compilation working"
else
    log_warning "TypeScript compilation failed"
fi

if npm run lint >/dev/null 2>&1; then
    log_success "ESLint configuration working"
else
    log_warning "ESLint issues found - run 'npm run lint:fix' to resolve"
fi

if npm run format:check >/dev/null 2>&1; then
    log_success "Prettier configuration working"
else
    log_warning "Prettier formatting issues found - run 'npm run format' to fix"
fi

# Install Flutter dependencies
log_section "Installing Flutter Dependencies"

if [[ -d "$REPO_ROOT/recipe_archive" ]]; then
    if command -v flutter &> /dev/null; then
        cd "$REPO_ROOT/recipe_archive" || die "Failed to change to Flutter directory"

        if ! flutter pub get > /tmp/install-dependencies.log 2>&1; then
            die "Failed to install Flutter dependencies. See /tmp/install-dependencies.log for details."
        fi
        log_success "Flutter dependencies installed"

        if flutter doctor --no-version-check > /tmp/flutter-doctor.log 2>&1; then
            log_success "Flutter setup verified"
        else
            log_warning "Flutter doctor found issues - see /tmp/flutter-doctor.log"
        fi

        cd "$REPO_ROOT" || die "Failed to return to repository root"
    else
        log_warning "Flutter not found - mobile development dependencies skipped"
        log_info "Run './scripts/setup-macos.sh' to install Flutter"
    fi
else
    log_warning "Flutter app directory not found"
fi

# Verify mobile development setup
log_section "Verifying Mobile Development Setup"

if command -v flutter &> /dev/null; then
    if [[ -n "$ANDROID_HOME" ]] && [[ -d "$ANDROID_HOME" ]]; then
        log_success "Android SDK found at $ANDROID_HOME"
    else
        log_warning "Android SDK not configured - set ANDROID_HOME environment variable"
    fi

    if is_macos; then
        if command -v pod &> /dev/null; then
            log_success "CocoaPods found for iOS development"
        else
            log_warning "CocoaPods not found - run './scripts/setup-macos.sh' to install"
        fi

        if [[ -d "/Applications/Xcode.app" ]]; then
            log_success "Xcode found for iOS development"
        else
            log_warning "Xcode not found - install from App Store"
        fi
    fi
fi

log_success "Dependency installation complete!"
echo ""
log_info "Next steps:"
echo "  Run 'npm run lint && npm run type-check && npm run build' to verify setup"
echo "  For mobile development: './validate-monorepo.sh --mobile'"