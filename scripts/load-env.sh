#!/usr/bin/env bash

################################################################################
# RecipeArchive Environment Loader
################################################################################
# PURPOSE: Load environment variables from .env file
#   - Exports all non-comment lines from .env
#   - Validates .env file exists
#   - Shows key variables after loading
#
# USAGE:
#   source scripts/load-env.sh
#
# EXAMPLES:
#   source scripts/load-env.sh
#   source ./load-env.sh
#
# NOTES:
#   - This script must be sourced, not executed
#   - Fails with clear error if .env not found
################################################################################

# Source common library (only if not already loaded)
if [[ -z "${COLOR_RED}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    source "$SCRIPT_DIR/lib/common.sh"
fi

# Don't call init_script - this file is sourced, not executed
# init_script would interfere with the parent shell

# Determine project root
readonly PROJECT_ROOT="$(get_repo_root)"
readonly ENV_FILE="$PROJECT_ROOT/.env"

# Check if .env exists
if [[ ! -f "$ENV_FILE" ]]; then
    log_error ".env file not found at $ENV_FILE"
    log_info "Create .env from .env.example: cp .env.example .env"
    return 1 2>/dev/null || exit 1
fi

# Load environment variables
log_info "Loading environment variables from .env"

# Export all non-comment, non-empty lines
# shellcheck disable=SC2046
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

log_success "Environment variables loaded"

# Show key variables (without exposing sensitive values)
if [[ -n "${TEST_USER_EMAIL:-}" ]]; then
    log_debug "Test user: $TEST_USER_EMAIL"
fi
if [[ -n "${S3_RECIPE_STORAGE_BUCKET:-}" ]]; then
    log_debug "S3 bucket: $S3_RECIPE_STORAGE_BUCKET"
fi
if [[ -n "${AWS_REGION:-}" ]]; then
    log_debug "AWS region: $AWS_REGION"
fi
