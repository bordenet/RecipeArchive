#!/bin/bash

################################################################################
#
# RecipeArchive API Gateway Validation Script
#
# PURPOSE:
#   This script serves as a standalone validator for API Gateway integrations.
#   It is designed to be used in CI/CD pipelines or by developers to ensure
#   that all API Gateway routes are correctly pointing to existing Lambda
#   functions. It acts as a wrapper around the 'validate' and 'fix' commands
#   of the 'manage-api-routes.sh' script.
#
# USAGE:
#   ./scripts/validate-api-gateway.sh [options]
#
# OPTIONS:
#   --fix     Attempts to automatically fix any broken integrations it finds.
#   --dev     Targets the development API Gateway instead of the default
#             secure (production) API.
#   --help    Displays the help message.
#
# HOW IT WORKS:
#   1.  Sets the target API Gateway (secure or dev) based on the provided flags.
#   2.  Calls './scripts/manage-api-routes.sh validate' to check integrations.
#   3.  If validation fails and the '--fix' flag is provided, it then calls
#       './scripts/manage-api-routes.sh fix'.
#   4.  Returns a non-zero exit code if validation fails, making it suitable
#       for use in automated checks.
#
# EXAMPLES:
#   # Validate the secure (production) API
#   ./scripts/validate-api-gateway.sh
#
#   # Validate and automatically fix the development API
#   ./scripts/validate-api-gateway.sh --dev --fix
#
# DEPENDENCIES:
#   - AWS CLI: Required for interacting with AWS services.
#   - jq: Used for parsing JSON output from the AWS CLI.
#   - manage-api-routes.sh: This script is a wrapper around it.
#
# NOTES:
#   - This script should be run from the root of the monorepo.
#   - It requires a .env file in the repository root for environment variables.
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if this is being run from the root directory
if [ ! -f "$REPO_ROOT/.env" ]; then
    log_error ".env file not found. Please run from repository root."
    exit 1
fi

# Parse arguments
SHOULD_FIX=false
USE_DEV_API=false

for arg in "$@"; do
    case $arg in
        --fix)
            SHOULD_FIX=true
            ;;
        --dev)
            USE_DEV_API=true
            ;;
        --help|-h)
            echo "API Gateway Integration Validation Script"
            echo ""
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --fix     Automatically fix broken integrations"
            echo "  --dev     Validate development API Gateway instead of production"
            echo "  --help    Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown argument: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set API Gateway ID based on environment
if $USE_DEV_API; then
    export API_GATEWAY_ID="4eprojzbrc"
    log_info "Targeting development API Gateway"
else
    export API_GATEWAY_ID="1ym0pqnaib"
    log_info "Targeting production API Gateway"
fi

# Validate integrations
log_info "Starting API Gateway validation..."
if ./scripts/manage-api-routes.sh validate; then
    log_success "✅ All API Gateway integrations are valid!"
    exit 0
else
    validation_failed=true
    log_error "❌ API Gateway validation failed!"

    if $SHOULD_FIX; then
        log_warning "Attempting to fix broken integrations..."
        if ./scripts/manage-api-routes.sh fix; then
            log_success "✅ API Gateway integrations fixed successfully!"

            # Validate again to confirm fixes worked
            log_info "Re-validating after fixes..."
            if ./scripts/manage-api-routes.sh validate; then
                log_success "✅ All integrations are now valid!"
                exit 0
            else
                log_error "❌ Some integrations still broken after fix attempt"
                exit 1
            fi
        else
            log_error "❌ Failed to fix API Gateway integrations"
            exit 1
        fi
    else
        log_warning "💡 Run with --fix to automatically repair broken integrations"
        log_warning "💡 Or run: ./scripts/manage-api-routes.sh fix"
        exit 1
    fi
fi