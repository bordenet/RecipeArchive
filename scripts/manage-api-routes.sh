#!/bin/bash

################################################################################
#
# RecipeArchive API Gateway Route Management Script
#
# PURPOSE:
#   This script provides a centralized, automated, and repeatable way to manage
#   API Gateway routes for the RecipeArchive project. It is designed to
#   prevent manual configuration errors, maintain consistency across environments,
#   and simplify the process of updating API endpoints.
#
# USAGE:
#   ./scripts/manage-api-routes.sh <command> [options]
#
# COMMANDS:
#   show              Displays the current API Gateway routes for the target API.
#   validate          Checks all integrations for the target API Gateway,
#                     ensuring that the configured Lambda functions exist.
#   fix               [Beta] Attempts to automatically fix broken integrations for
#                     known API Gateway configurations (secure and dev).
#   add-analytics     Adds the /v1/analytics/events and /v1/analytics/summary
#                     routes and connects them to the RecipeAnalyticsAggregator Lambda.
#   remove-analytics  Removes the /v1/analytics resource and its child routes.
#   deploy            Deploys the current API Gateway configuration to the 'prod'
#                     stage.
#
# OPTIONS & ENVIRONMENT:
#   The script can be targeted at different API Gateways by setting the
#   API_GATEWAY_ID environment variable.
#
#   - API_GATEWAY_ID:         Overrides the default API Gateway ID.
#   - SECURE_API_GATEWAY_ID:  The ID for the secure (production) API Gateway.
#                             (Default: "1ym0pqnaib")
#   - DEV_API_GATEWAY_ID:     The ID for the development API Gateway.
#                             (Default: "4eprojzbrc")
#
# EXAMPLES:
#   # Show routes for the default (secure) API
#   ./scripts/manage-api-routes.sh show
#
#   # Validate integrations for the development API
#   API_GATEWAY_ID=$DEV_API_GATEWAY_ID ./scripts/manage-api-routes.sh validate
#
#   # Add analytics routes and deploy the changes
#   ./scripts/manage-api-routes.sh add-analytics
#   ./scripts/manage-api-routes.sh deploy
#
# DEPENDENCIES:
#   - AWS CLI: The script relies on 'aws' commands to interact with API Gateway
#              and Lambda. Ensure it is installed and configured.
#   - jq:      A command-line JSON processor used for parsing AWS CLI output.
#
# NOTES:
#   - This script is intended to be run from the root of the monorepo.
#   - It requires a .env file to be present in the repository root to load
#     necessary environment variables (e.g., AWS_REGION).
#
################################################################################

# API Gateway Route Management Script for RecipeArchive
# Centralizes all API Gateway changes to prevent manual inconsistencies
# Cross-platform compatible: Linux and macOS

set -e

# Check runtime environment
if [[ "$(uname)" == "Darwin" ]]; then
    PLATFORM="macOS"
elif [[ "$(uname)" == "Linux" ]]; then
    PLATFORM="Linux"
else
    echo "❌ Unsupported platform: $(uname)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables from repo root using the proper load script
if [ -f "$REPO_ROOT/.env" ]; then
    echo "🔧 Loading environment variables..."
    source "$REPO_ROOT/scripts/load-env.sh"
else
    echo "❌ .env file not found in repo root. Please create one from .env.example"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration (from existing infrastructure)
# Production API Gateway (secure stack)
SECURE_API_ID=${SECURE_API_GATEWAY_ID:-"1ym0pqnaib"}
# Development API Gateway
DEV_API_ID=${DEV_API_GATEWAY_ID:-"4eprojzbrc"}
# Default to secure API for production
API_ID=${API_GATEWAY_ID:-$SECURE_API_ID}
REGION=${AWS_REGION:-"us-west-2"}
STAGE_NAME="prod"

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Get parent resource ID by path
get_resource_id() {
    local path="$1"
    aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" \
        --query "items[?path=='$path'].id" --output text
}

# Create resource if it doesn't exist
ensure_resource() {
    local parent_id="$1"
    local path_part="$2"
    local full_path="$3"

    local existing_id=$(get_resource_id "$full_path")
    if [ -n "$existing_id" ]; then
        echo "$existing_id"
        return
    fi

    log_info "Creating resource: $full_path"
    local result=$(aws apigateway create-resource \
        --rest-api-id "$API_ID" \
        --parent-id "$parent_id" \
        --path-part "$path_part" \
        --region "$REGION")

    echo "$result" | jq -r '.id'
}

# Create method if it doesn't exist
ensure_method() {
    local resource_id="$1"
    local http_method="$2"
    local auth_type="${3:-AWS_IAM}"

    # Check if method exists
    if aws apigateway get-method --rest-api-id "$API_ID" --resource-id "$resource_id" \
            --http-method "$http_method" --region "$REGION" > /tmp/manage-api-routes.log 2>&1; then
        log_warning "Method $http_method already exists for resource $resource_id"
        return
    fi

    log_info "Creating method: $http_method"
    aws apigateway put-method \
        --rest-api-id "$API_ID" \
        --resource-id "$resource_id" \
        --http-method "$http_method" \
        --authorization-type "$auth_type" \
        --region "$REGION" > /tmp/manage-api-routes.log 2>&1
}

# Create Lambda integration
ensure_lambda_integration() {
    local resource_id="$1"
    local http_method="$2"
    local lambda_function_arn="$3"

    # Check if integration exists
    if aws apigateway get-integration --rest-api-id "$API_ID" --resource-id "$resource_id" \
            --http-method "$http_method" --region "$REGION" > /tmp/manage-api-routes.log 2>&1; then
        log_warning "Integration already exists for $http_method"
        return
    fi

    log_info "Creating Lambda integration for $http_method"
    local integration_uri="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${lambda_function_arn}/invocations"

    aws apigateway put-integration \
        --rest-api-id "$API_ID" \
        --resource-id "$resource_id" \
        --http-method "$http_method" \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "$integration_uri" \
        --region "$REGION" > /tmp/manage-api-routes.log 2>&1
}

# Grant API Gateway permission to invoke Lambda
ensure_lambda_permission() {
    local function_name="$1"
    local statement_id="$2"
    local http_method="$3"
    local resource_path="$4"

    # Check if permission exists
    if aws lambda get-policy --function-name "$function_name" --region "$REGION" 2> /tmp/manage-api-routes.log | \
            jq -r '.Policy' | jq -r --arg sid "$statement_id" '.Statement[] | select(.Sid == $sid)' | \
            grep -q "$statement_id" 2> /tmp/manage-api-routes.log; then
        log_warning "Permission $statement_id already exists"
        return
    fi

    log_info "Adding Lambda permission: $statement_id"
    local source_arn="arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/*/${http_method}${resource_path}"

    aws lambda add-permission \
        --function-name "$function_name" \
        --statement-id "$statement_id" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "$source_arn" \
        --region "$REGION" > /tmp/manage-api-routes.log 2>&1
}

# Deploy API Gateway changes
deploy_api() {
    log_info "Deploying API Gateway changes to stage: $STAGE_NAME"
    aws apigateway create-deployment \
        --rest-api-id "$API_ID" \
        --stage-name "$STAGE_NAME" \
        --region "$REGION" > /tmp/manage-api-routes.log 2>&1
    log_success "API Gateway deployed successfully"
}

# Show current routes
show_routes() {
    echo
    log_info "Current API Gateway Routes for $API_ID:"
    aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" \
        --query 'items[].[path,id]' --output table
}

# Validate API Gateway integrations
validate_integrations() {
    log_info "Validating API Gateway integrations for $API_ID..."
    local failed_validations=0

    # Get all resources with methods
    local resources=$(aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" \
        --query 'items[?resourceMethods].[id,path,keys(resourceMethods)]' --output json)

    echo "$resources" | jq -r '.[] | @base64' | while IFS= read -r resource; do
        local resource_data=$(echo "$resource" | base64 --decode)
        local resource_id=$(echo "$resource_data" | jq -r '.[0]')
        local path=$(echo "$resource_data" | jq -r '.[1]')
        local methods=$(echo "$resource_data" | jq -r '.[2][]')

        echo "Checking $path ($resource_id):"

        for method in $methods; do
            if [[ "$method" == "OPTIONS" ]]; then
                continue # Skip OPTIONS methods
            fi

            # Get integration
            local integration=$(aws apigateway get-method --rest-api-id "$API_ID" \
                --resource-id "$resource_id" --http-method "$method" --region "$REGION" \
                --query 'methodIntegration.uri' --output text 2>/dev/null)

            if [[ "$integration" == "None" ]] || [[ -z "$integration" ]]; then
                echo "  ❌ $method - No integration found"
                failed_validations=$((failed_validations + 1))
                continue
            fi

            # Extract function name from integration URI
            local function_name=$(echo "$integration" | grep -o 'function:[^/]*' | cut -d: -f2)

            if [[ -z "$function_name" ]]; then
                echo "  ❌ $method - Invalid integration URI"
                failed_validations=$((failed_validations + 1))
                continue
            fi

            # Check if Lambda function exists
            if aws lambda get-function-configuration --function-name "$function_name" \
                    --region "$REGION" >/dev/null 2>&1; then
                echo "  ✅ $method -> $function_name"
            else
                echo "  ❌ $method -> $function_name (function not found)"
                failed_validations=$((failed_validations + 1))
            fi
        done
        echo
    done

    if [ $failed_validations -gt 0 ]; then
        log_error "$failed_validations integration validation failures found"
        return 1
    else
        log_success "All integrations are valid"
        return 0
    fi
}

# Fix broken integrations automatically
fix_integrations() {
    log_info "Fixing broken integrations for API Gateway $API_ID..."

    case "$API_ID" in
        "1ym0pqnaib")
            log_info "Applying fixes for secure API Gateway"
            fix_secure_api_integrations
            ;;
        "4eprojzbrc")
            log_info "Applying fixes for development API Gateway"
            fix_dev_api_integrations
            ;;
        *)
            log_error "Unknown API Gateway ID: $API_ID"
            return 1
            ;;
    esac

    deploy_api
    log_success "Integration fixes applied and deployed"
}

# Fix secure API integrations
fix_secure_api_integrations() {
    local recipes_function="RecipeArchive-dev-RecipesFunction16AA7634-CoVv1WbwNocL"
    local health_function="RecipeArchive-dev-HealthFunction19D7724A-ZDwHNtPzi1E9"
    local diagnostics_function="RecipeArchive-dev-DiagnosticsFunctionF6482E72-GpGVR5DdZICc"
    local image_upload_function="RecipeArchive-dev-ImageUploadFunction1528BFB7-SkQEMmTH8zTf"

    # Fix recipes endpoints
    local recipes_uri="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:$(aws sts get-caller-identity --query Account --output text):function:${recipes_function}/invocations"

    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "lxfp13" --http-method "GET" --type "AWS_PROXY" --integration-http-method "POST" --uri "$recipes_uri" --region "$REGION" >/dev/null
    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "lxfp13" --http-method "POST" --type "AWS_PROXY" --integration-http-method "POST" --uri "$recipes_uri" --region "$REGION" >/dev/null
    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "crtjy9" --http-method "GET" --type "AWS_PROXY" --integration-http-method "POST" --uri "$recipes_uri" --region "$REGION" >/dev/null
    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "crtjy9" --http-method "PUT" --type "AWS_PROXY" --integration-http-method "POST" --uri "$recipes_uri" --region "$REGION" >/dev/null
    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "crtjy9" --http-method "DELETE" --type "AWS_PROXY" --integration-http-method "POST" --uri "$recipes_uri" --region "$REGION" >/dev/null
    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "x18i1c" --http-method "POST" --type "AWS_PROXY" --integration-http-method "POST" --uri "$recipes_uri" --region "$REGION" >/dev/null

    # Fix health endpoint
    local health_uri="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:$(aws sts get-caller-identity --query Account --output text):function:${health_function}/invocations"
    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "5dkax5" --http-method "GET" --type "AWS_PROXY" --integration-http-method "POST" --uri "$health_uri" --region "$REGION" >/dev/null

    # Add Lambda permissions if they don't exist
    add_lambda_permissions_secure_api

    # Fix CORS OPTIONS methods for specific endpoints
    fix_cors_options_methods
}

# Fix dev API integrations
fix_dev_api_integrations() {
    log_warning "Development API Gateway fixes not implemented yet"
}

# Add Lambda permissions for secure API
add_lambda_permissions_secure_api() {
    local recipes_function="RecipeArchive-dev-RecipesFunction16AA7634-CoVv1WbwNocL"
    local health_function="RecipeArchive-dev-HealthFunction19D7724A-ZDwHNtPzi1E9"

    # Add permissions (ignore errors if they already exist)
    aws lambda add-permission --function-name "$recipes_function" --statement-id "secure-api-recipes-get-2" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/GET/recipes" --region "$REGION" 2>/dev/null || true
    aws lambda add-permission --function-name "$recipes_function" --statement-id "secure-api-recipes-post-2" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/POST/recipes" --region "$REGION" 2>/dev/null || true
    aws lambda add-permission --function-name "$recipes_function" --statement-id "secure-api-recipes-id-get-2" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/GET/recipes/*" --region "$REGION" 2>/dev/null || true
    aws lambda add-permission --function-name "$recipes_function" --statement-id "secure-api-recipes-id-put-2" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/PUT/recipes/*" --region "$REGION" 2>/dev/null || true
    aws lambda add-permission --function-name "$recipes_function" --statement-id "secure-api-recipes-id-delete-2" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/DELETE/recipes/*" --region "$REGION" 2>/dev/null || true
    aws lambda add-permission --function-name "$recipes_function" --statement-id "secure-api-recipes-search-2" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/POST/recipes/search" --region "$REGION" 2>/dev/null || true
    aws lambda add-permission --function-name "$health_function" --statement-id "secure-api-health-get-2" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/GET/health" --region "$REGION" 2>/dev/null || true
}

# Fix CORS OPTIONS methods for /report-error and /images/upload endpoints
fix_cors_options_methods() {
    local diagnostics_function="RecipeArchive-dev-DiagnosticsFunctionF6482E72-GpGVR5DdZICc"
    local image_upload_function="RecipeArchive-dev-ImageUploadFunction1528BFB7-SkQEMmTH8zTf"

    log_info "Fixing CORS OPTIONS methods for /report-error and /images/upload endpoints"

    # Fix /report-error OPTIONS integration to point to diagnostics function
    local report_error_resource=$(get_resource_id "/report-error")
    if [ -n "$report_error_resource" ]; then
        log_info "Updating /report-error OPTIONS integration to point to diagnostics function"
        aws apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$report_error_resource" \
            --http-method OPTIONS \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:$(aws sts get-caller-identity --query Account --output text):function:${diagnostics_function}/invocations" \
            --region "$REGION" > /tmp/manage-api-routes.log 2>&1
    fi

    # Create /images/upload OPTIONS method if missing
    local images_upload_resource=$(get_resource_id "/images/upload")
    if [ -n "$images_upload_resource" ]; then
        # Check if OPTIONS method exists
        if ! aws apigateway get-method --rest-api-id "$API_ID" --resource-id "$images_upload_resource" --http-method OPTIONS --region "$REGION" > /tmp/manage-api-routes.log 2>&1; then
            log_info "Creating OPTIONS method for /images/upload endpoint"
            aws apigateway put-method \
                --rest-api-id "$API_ID" \
                --resource-id "$images_upload_resource" \
                --http-method OPTIONS \
                --authorization-type NONE \
                --region "$REGION" > /tmp/manage-api-routes.log 2>&1
        fi

        log_info "Setting up /images/upload OPTIONS integration to point to image upload function"
        aws apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$images_upload_resource" \
            --http-method OPTIONS \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:$(aws sts get-caller-identity --query Account --output text):function:${image_upload_function}/invocations" \
            --region "$REGION" > /tmp/manage-api-routes.log 2>&1
    fi

    # Add Lambda permissions for OPTIONS methods
    aws lambda add-permission \
        --function-name "$diagnostics_function" \
        --statement-id "secure-api-report-error-options" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/OPTIONS/report-error" \
        --region "$REGION" 2>/dev/null || true

    aws lambda add-permission \
        --function-name "$image_upload_function" \
        --statement-id "secure-api-images-upload-options" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/prod/OPTIONS/images/upload" \
        --region "$REGION" 2>/dev/null || true

    log_success "CORS OPTIONS methods configured for /report-error and /images/upload"
}

# Add analytics routes
add_analytics_routes() {
    log_info "Adding analytics routes to API Gateway"

    # Get Lambda function ARN
    local function_arn=$(aws lambda get-function --function-name "RecipeAnalyticsAggregator" \
        --region "$REGION" --query 'Configuration.FunctionArn' --output text)

    if [ -z "$function_arn" ]; then
        log_error "RecipeAnalyticsAggregator function not found"
        return 1
    fi

    # Get /v1 resource ID
    local v1_id=$(get_resource_id "/v1")
    if [ -z "$v1_id" ]; then
        log_error "/v1 resource not found"
        return 1
    fi

    # Create /v1/analytics
    local analytics_id=$(ensure_resource "$v1_id" "analytics" "/v1/analytics")

    # Create /v1/analytics/events
    local events_id=$(ensure_resource "$analytics_id" "events" "/v1/analytics/events")
    ensure_method "$events_id" "POST"
    ensure_lambda_integration "$events_id" "POST" "$function_arn"
    ensure_lambda_permission "RecipeAnalyticsAggregator" "apigateway-analytics-events" "POST" "/v1/analytics/events"

    # Create /v1/analytics/summary
    local summary_id=$(ensure_resource "$analytics_id" "summary" "/v1/analytics/summary")
    ensure_method "$summary_id" "GET"
    ensure_lambda_integration "$summary_id" "GET" "$function_arn"
    ensure_lambda_permission "RecipeAnalyticsAggregator" "apigateway-analytics-summary" "GET" "/v1/analytics/summary"

    deploy_api
    log_success "Analytics routes added successfully"
}

# Remove analytics routes
remove_analytics_routes() {
    log_info "Removing analytics routes from API Gateway"

    local analytics_id=$(get_resource_id "/v1/analytics")
    if [ -n "$analytics_id" ]; then
        aws apigateway delete-resource --rest-api-id "$API_ID" --resource-id "$analytics_id" --region "$REGION"
        deploy_api
        log_success "Analytics routes removed successfully"
    else
        log_warning "Analytics routes not found"
    fi
}

# Usage
usage() {
    cat << EOF
🚀 RecipeArchive API Gateway Route Manager

Usage: $0 <command> [options]

Commands:
  show              Show current API Gateway routes
  validate          Validate all API Gateway integrations
  fix               Fix broken API Gateway integrations
  add-analytics     Add analytics routes (/v1/analytics/events, /v1/analytics/summary)
  remove-analytics  Remove analytics routes
  deploy            Deploy API Gateway changes

Environment Variables:
  API_GATEWAY_ID           Override default API Gateway ID
  SECURE_API_GATEWAY_ID    Secure API Gateway ID (default: 1ym0pqnaib)
  DEV_API_GATEWAY_ID       Development API Gateway ID (default: 4eprojzbrc)

Examples:
  $0 show
  $0 validate
  $0 fix
  $0 add-analytics
  $0 deploy
  API_GATEWAY_ID=4eprojzbrc $0 validate    # Validate dev API

EOF
}

# Main execution
case "${1:-}" in
    "show")
        show_routes
        ;;
    "validate")
        validate_integrations
        ;;
    "fix")
        fix_integrations
        ;;
    "add-analytics")
        add_analytics_routes
        ;;
    "remove-analytics")
        remove_analytics_routes
        ;;
    "deploy")
        deploy_api
        ;;
    *)
        usage
        exit 1
        ;;
esac
