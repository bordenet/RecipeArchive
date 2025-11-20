#!/usr/bin/env bash

################################################################################
# RecipeArchive API Gateway Validation
################################################################################
# PURPOSE: Validate and optionally fix API Gateway integrations
#   - Checks all API Gateway routes point to existing Lambda functions
#   - Supports both production and development APIs
#   - Can automatically fix broken integrations
#   - Suitable for CI/CD pipelines
#
# USAGE:
#   ./scripts/validate-api-gateway.sh [options]
#
# EXAMPLES:
#   ./scripts/validate-api-gateway.sh                  # Validate production
#   ./scripts/validate-api-gateway.sh --dev --fix      # Validate and fix dev API
#
# OPTIONS:
#   --fix     Automatically fix broken integrations
#   --dev     Target development API Gateway
#   --help    Show this help message
#
# DEPENDENCIES:
#   - AWS CLI
#   - jq
#   - scripts/manage-api-routes.sh
#
# NOTES:
#   - Requires .env file with AWS credentials
#   - Wrapper around manage-api-routes.sh validate/fix
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
SHOULD_FIX=false
USE_DEV_API=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --fix)
            SHOULD_FIX=true
            shift
            ;;
        --dev)
            USE_DEV_API=true
            shift
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
            die "Unknown argument: $arg. Use --help for usage information"
            ;;
    esac
done

log_header "API Gateway Validation"

# Validate .env exists
require_file "$REPO_ROOT/.env" ".env file not found at $REPO_ROOT/.env"

# Set API Gateway ID
if [[ "$USE_DEV_API" == true ]]; then
    if [[ -z "${DEV_API_GATEWAY_ID:-}" ]]; then
        die "DEV_API_GATEWAY_ID must be set in your environment or .env to validate the development API"
    fi
    export API_GATEWAY_ID="$DEV_API_GATEWAY_ID"
    log_info "Targeting development API Gateway ($API_GATEWAY_ID)"
else
    if [[ -z "${SECURE_API_GATEWAY_ID:-}" ]]; then
        die "SECURE_API_GATEWAY_ID must be set in your environment or .env to validate the production API"
    fi
    export API_GATEWAY_ID="$SECURE_API_GATEWAY_ID"
    log_info "Targeting production API Gateway ($API_GATEWAY_ID)"
fi

# Validate integrations
log_section "Validating Integrations"

if "$SCRIPT_DIR/manage-api-routes.sh" validate; then
    log_success "All API Gateway integrations are valid!"
    exit 0
else
    log_error "API Gateway validation failed!"

    if [[ "$SHOULD_FIX" == true ]]; then
        log_section "Fixing Broken Integrations"
        log_warning "Attempting to fix broken integrations..."

        if "$SCRIPT_DIR/manage-api-routes.sh" fix; then
            log_success "API Gateway integrations fixed successfully!"

            # Re-validate after fixes
            log_section "Re-validating After Fixes"
            if "$SCRIPT_DIR/manage-api-routes.sh" validate; then
                log_success "All integrations are now valid!"
                exit 0
            else
                die "Some integrations still broken after fix attempt"
            fi
        else
            die "Failed to fix API Gateway integrations"
        fi
    else
        log_warning "Run with --fix to automatically repair broken integrations"
        log_warning "Or run: ./scripts/manage-api-routes.sh fix"
        exit 1
    fi
fi
