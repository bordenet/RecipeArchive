#!/usr/bin/env bash

#===============================================================================
# RecipeArchive Complete Deployment Script
#===============================================================================
# PURPOSE: Deploy both Flutter web app and all Lambda functions in one command
#
# HOW IT WORKS:
#   1. Auto-discovers Lambda functions from AWS using CLI queries
#   2. Builds and deploys all Go Lambda functions
#   3. Builds and deploys Flutter web app to S3
#   4. Creates CloudFront invalidation for instant updates
#   5. Provides comprehensive deployment status and URLs
#
# USAGE:
#   ./scripts/deploy-aws-backend.sh              # Deploy everything
#   ./scripts/deploy-aws-backend.sh --backend-only     # Deploy only Lambda functions
#   ./scripts/deploy-aws-backend.sh --frontend-only    # Deploy only Flutter web app
#   ./scripts/deploy-aws-backend.sh --dry-run    # Show what would be deployed
#
# REQUIREMENTS:
#   - AWS CLI configured
#   - Go installed
#   - Flutter installed
#   - .env file in the root of the repository with the following variables:
#       - S3_WEB_APP_BUCKET: The name of the S3 bucket for the web app.
#       - CLOUDFRONT_DISTRIBUTION_ID: The ID of the CloudFront distribution.
#       - CLOUDFRONT_URL: The URL of the CloudFront distribution.
#       - AWS_REGION: The AWS region to deploy to.
#       - API_GATEWAY_ID: The ID of the API Gateway.
#
#===============================================================================

# Require bash 4+ for associative arrays
if ((BASH_VERSINFO[0] < 4)); then
    echo "Error: This script requires bash 4.0 or higher"
    echo "Current version: $BASH_VERSION"
    echo "On macOS, install with: brew install bash"
    exit 1
fi

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
#BLUE='\033[0;34m'
BLUE='\033[1;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

declare -A LAMBDA_FUNCTIONS

# Helper functions
log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables from repo root
if [ -f "$REPO_ROOT/.env" ]; then
    echo "🔧 Loading environment variables..."
    source "$REPO_ROOT/scripts/load-env.sh"
else
    log_error ".env file not found in the project root."
    log_error "Please copy the .env.example file to .env and populate it with your AWS credentials and infrastructure details."
    log_error "For more information, see the 'Environment Variables Required' section in docs/setup/aws-setup.md."
    exit 1
fi

# Configuration from environment variables
if [ -z "$S3_WEB_APP_BUCKET" ] || [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ] || [ -z "$CLOUDFRONT_URL" ] || [ -z "$AWS_REGION" ] || [ -z "$API_GATEWAY_ID" ]; then
    log_error "Missing required environment variables in .env file."
    log_error "Please check the .env.example file for a complete list of required variables and explanations."
    exit 1
fi
S3_BUCKET=$S3_WEB_APP_BUCKET  # Backward compatibility alias

# Lambda Functions will be auto-discovered from AWS (no hardcoded values)
declare -A LAMBDA_FUNCTIONS

# Helper functions (continued)
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
    echo "======================================"
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check AWS CLI
    if ! aws sts get-caller-identity > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "AWS CLI not configured. Please run 'aws configure' first."
        exit 1
    fi
    log_success "AWS CLI configured"
    
    # Check Flutter
    if ! command -v flutter > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "Flutter not found. Please install Flutter."
        exit 1
    fi
    log_success "Flutter found"
    
    # Check Go
    if ! command -v go > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "Go not found. Please install Go for Lambda builds."
        exit 1
    fi
    log_success "Go found"
    
    # Check jq
    if ! command -v jq > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "jq not found. Please install jq for JSON parsing."
        exit 1
    fi
    log_success "jq found"
    
    echo ""
}

# Get actual Lambda function names from AWS
get_lambda_function_names() {
    log_header "Discovering Lambda Functions"
    
    # Only include directories that contain main.go (actual Lambda functions)
    local local_funcs=()
    for dir in $REPO_ROOT/aws-backend/functions/*/;
    do
        if [ -f "$dir/main.go" ]; then
            local_funcs+=($(basename "$dir"))
        fi
    done

    for local_name in "${local_funcs[@]}";
    do
        local pattern
        if [ "$local_name" == "invitation-manager-s3" ]; then
            pattern="InvitationManager"
        elif [ "$local_name" == "analytics-aggregator" ]; then
            # Direct match for analytics aggregator
            LAMBDA_FUNCTIONS[$local_name]="RecipeAnalyticsAggregator"
            log_info "Found: $local_name -> RecipeAnalyticsAggregator"
            continue
        else
            pattern=$(awk -F- '{for(i=1;i<=NF;i++) printf "%s", toupper(substr($i,1,1)) substr($i,2)}' <<< "$local_name")
            pattern="${pattern}Function"
        fi

        local aws_name
        aws_name=$(aws lambda list-functions --region "$AWS_REGION" \
            --query "Functions[?contains(FunctionName, \
$pattern\
)]].FunctionName" \
            --output text 2>> /tmp/deploy-aws-backend.log | head -1)

        if [ -n "$aws_name" ]; then
            LAMBDA_FUNCTIONS["$local_name"]="$aws_name"
            log_info "Found: $local_name -> $aws_name"
        else
            # Check if this is a known utility function
            case "$local_name" in
                "backup"|"local-server"|"s3-manager"|"test-tools"|"flutter-console-diagnostics")
                    log_info "Skipping utility function: $local_name (development/local tool)"
                    ;; 
                *)
                    log_warning "Could not find AWS function for local function: $local_name"
                    ;; 
            esac
        fi
    done
    
    echo ""
}


# Deploy Lambda function
deploy_lambda() {
    local function_dir=$1
    local function_key=$2
    local function_name=${LAMBDA_FUNCTIONS[$function_key]}
    
    if [ -z "$function_name" ]; then
        log_warning "Lambda function $function_key not found, skipping"
        return
    fi
    
    log_info "Deploying Lambda: $function_key ($function_name)"
    
    # Navigate to function directory
    cd "$REPO_ROOT/aws-backend/functions/$function_dir"
    
    # Build Go binary
    log_info "Building Go binary..."
    if ! GOOS=linux GOARCH=amd64 go build -o bootstrap *.go > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "Go build failed for $function_key. See /tmp/deploy-aws-backend.log for details."
        return 1
    fi
    log_success "Go build complete"
    
    # Create deployment package
    log_info "Creating deployment package..."
    zip -q deployment-package.zip bootstrap
    
    # Deploy to AWS Lambda
    log_info "Deploying to AWS Lambda..."
    if ! aws lambda update-function-code \
        --function-name "$function_name" \
        --zip-file fileb://deployment-package.zip \
        --region $AWS_REGION > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "Lambda $function_key deployment failed. See /tmp/deploy-aws-backend.log for details."
        return 1
    fi
    log_success "Lambda $function_key deployed successfully"
    
    # Cleanup
    rm -f bootstrap deployment-package.zip
    
    # Return to original directory
    cd - > /dev/null
}

# Deploy all Lambda functions
deploy_lambdas() {
    log_header "Deploying Lambda Functions"
    
    for function_key in "${!LAMBDA_FUNCTIONS[@]}"; do
        if [ -d "$REPO_ROOT/aws-backend/functions/$function_key" ]; then
            deploy_lambda "$function_key" "$function_key"
        else
            log_warning "Directory for function '$function_key' not found, skipping deployment."
        fi
        echo ""
    done
}

# Deploy Flutter frontend
deploy_flutter() {
    log_header "Deploying Flutter Frontend"
    
    # Navigate to Flutter directory
    cd "$REPO_ROOT/recipe_archive"
    
    # Run Flutter analysis first
    log_info "Running Flutter analysis..."
    if ! flutter analyze > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "Flutter analysis failed - fix issues before deploying. See /tmp/deploy-aws-backend.log for details."
        exit 1
    fi
    log_success "Flutter analysis passed"
    
    # Clean previous build
    log_info "Cleaning previous build..."
    if [ -d "build/web" ]; then
        rm -rf build/web
    fi
    
    # Build Flutter web app
    log_info "Building Flutter web app with compatibility flags..."
    if ! flutter build web --release --no-tree-shake-icons --no-wasm-dry-run > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "Flutter build failed! See /tmp/deploy-aws-backend.log for details."
        log_warning "Try: flutter clean && flutter pub get"
        log_warning "Then: flutter build web --release --no-tree-shake-icons"
        exit 1
    fi
    log_success "Flutter build completed"
    
    # Deploy to S3
    log_info "Deploying to S3 ($S3_BUCKET)..."
    if ! aws s3 sync build/web/ s3://${S3_BUCKET}/ --delete --cache-control "public, max-age=86400" > /tmp/deploy-aws-backend.log 2>&1; then
        log_error "S3 deployment failed! See /tmp/deploy-aws-backend.log for details."
        exit 1
    fi
    log_success "S3 deployment completed"
    
    # Create CloudFront invalidation
    log_info "Creating CloudFront invalidation..."
    INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/*" --output json)
    
    if [ $? -ne 0 ]; then
        log_error "CloudFront invalidation failed!"
        exit 1
    fi
    
    INVALIDATION_ID=$(echo $INVALIDATION_OUTPUT | jq -r '.Invalidation.Id')
    log_success "CloudFront invalidation created: $INVALIDATION_ID"
    
    # Wait for invalidation
    log_info "Waiting for invalidation to complete..."
    while true; do
        STATUS=$(aws cloudfront get-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --id ${INVALIDATION_ID} --query 'Invalidation.Status' --output text)
        
        if [ "$STATUS" = "Completed" ]; then
            log_success "CloudFront invalidation completed!"
            break
        elif [ "$STATUS" = "InProgress" ]; then
            log_info "Invalidation in progress... waiting 10 seconds"
            sleep 10
        else
            log_warning "Unexpected invalidation status: $STATUS"
            break
        fi
    done
    
    echo ""
}

# Configure CORS for API Gateway - critical for production functionality
configure_api_cors() {
    log_header "Configuring API Gateway CORS"

    # Get current API Gateway ID from environment or discover it
    local api_id=$API_GATEWAY_ID

    log_info "Configuring CORS for API Gateway: $api_id"

    # Get recipes resource ID
    local recipes_resource_id
    recipes_resource_id=$(aws apigateway get-resources --rest-api-id "$api_id" --region "$AWS_REGION" --query "items[?pathPart=='recipes'].id" --output text)

    if [ -z "$recipes_resource_id" ]; then
        log_error "Could not find recipes resource in API Gateway"
        return 1
    fi

    log_info "Found recipes resource: $recipes_resource_id"

    # Check if OPTIONS method already exists
    local options_exists
    options_exists=$(aws apigateway get-method --rest-api-id "$api_id" --resource-id "$recipes_resource_id" --http-method OPTIONS --region "$AWS_REGION" > /tmp/deploy-aws-backend.log 2>&1 && echo "exists" || echo "missing")

    if [ "$options_exists" = "missing" ]; then
        log_info "Adding OPTIONS method for CORS..."

        # Add OPTIONS method
        aws apigateway put-method \
            --rest-api-id "$api_id" \
            --resource-id "$recipes_resource_id" \
            --http-method OPTIONS \
            --authorization-type NONE \
            --region "$AWS_REGION" > /tmp/deploy-aws-backend.log 2>&1

        # Add mock integration
        aws apigateway put-integration \
            --rest-api-id "$api_id" \
            --resource-id "$recipes_resource_id" \
            --http-method OPTIONS \
            --type MOCK \
            --integration-http-method OPTIONS \
            --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
            --region "$AWS_REGION" > /tmp/deploy-aws-backend.log 2>&1

        # Add method response with CORS headers
        aws apigateway put-method-response \
            --rest-api-id "$api_id" \
            --resource-id "$recipes_resource_id" \
            --http-method OPTIONS \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
            --region "$AWS_REGION" > /tmp/deploy-aws-backend.log 2>&1

        # Add integration response with CORS header values
        aws apigateway put-integration-response \
            --rest-api-id "$api_id" \
            --resource-id "$recipes_resource_id" \
            --http-method OPTIONS \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token","method.response.header.Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","method.response.header.Access-Control-Allow-Origin":"https://d1jcaphz4458q7.cloudfront.net"}' \
            --region "$AWS_REGION" > /tmp/deploy-aws-backend.log 2>&1

        # Deploy API changes
        log_info "Deploying API Gateway changes..."
        aws apigateway create-deployment \
            --rest-api-id "$api_id" \
            --stage-name prod \
            --region "$AWS_REGION" > /tmp/deploy-aws-backend.log 2>&1

        log_success "CORS configuration completed for API Gateway"
    else
        log_success "OPTIONS method already exists - CORS already configured"
    fi

    echo ""
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    local DEPLOY_FRONTEND=true
    local DEPLOY_BACKEND=true
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --frontend-only)
                DEPLOY_BACKEND=false
                shift
                ;; 
            --backend-only)
                DEPLOY_FRONTEND=false
                shift
                ;; 
            --function)
                # Deploy specific function only
                DEPLOY_FRONTEND=false
                DEPLOY_ALL_LAMBDAS=false
                SPECIFIC_FUNCTION=$2
                shift 2
                ;; 
            --dry-run)
                # Show what would be deployed without actually deploying
                log_header "DRY RUN - What would be deployed:"
                echo ""
                check_prerequisites
                get_lambda_function_names
                echo -e "${BLUE}📋 Lambda Functions that would be deployed:${NC}"
                for function_key in "${!LAMBDA_FUNCTIONS[@]}"; do
                    echo "   • $function_key: ${LAMBDA_FUNCTIONS[$function_key]}"
                done
                echo ""
                echo -e "${BLUE}📱 Flutter app would be deployed to:${NC} ${S3_BUCKET}"
                echo -e "${BLUE}🌐 CloudFront distribution:${NC} ${CLOUDFRONT_DISTRIBUTION_ID}"
                echo -e "${BLUE}🔗 Final URL:${NC} ${CLOUDFRONT_URL}"
                exit 0
                ;; 
            -h|--help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --frontend-only    Deploy only Flutter frontend"
                echo "  --backend-only     Deploy only Lambda functions"
                echo "  --function <name>  Deploy specific Lambda function only"
                echo "  --dry-run         Show what would be deployed without deploying"
                echo "  -h, --help        Show this help message"
                exit 0
                ;; 
            *)
                log_error "Unknown option: $1"
                exit 1
                ;; 
        esac
    done
    
    log_header "RecipeArchive Complete Deployment"
    
    check_prerequisites
    
    if $DEPLOY_BACKEND;
    then
        get_lambda_function_names
        
        if [ -n "$SPECIFIC_FUNCTION" ]; then
            log_info "Deploying specific function: $SPECIFIC_FUNCTION"
            deploy_lambda "$SPECIFIC_FUNCTION" "$SPECIFIC_FUNCTION"
        else
            deploy_lambdas
        fi
    fi
    
    if $DEPLOY_FRONTEND;
    then
        deploy_flutter
    fi

    # Validate API Gateway integrations after Lambda deployment
    if $DEPLOY_BACKEND;
    then
        log_header "Validating API Gateway Integrations"
        if ./scripts/manage-api-routes.sh validate; then
            log_success "✅ All API Gateway integrations are valid"
        else
            log_warning "⚠️ API Gateway integration issues detected. Attempting automatic fix..."
            if ./scripts/manage-api-routes.sh fix; then
                log_success "✅ API Gateway integrations fixed successfully"
            else
                log_error "❌ Failed to fix API Gateway integrations. Manual intervention required."
                log_warning "💡 Run: ./scripts/manage-api-routes.sh validate"
                log_warning "💡 Then: ./scripts/manage-api-routes.sh fix"
            fi
        fi
    fi

    # Configure CORS for API Gateway (critical for production functionality)
    if $DEPLOY_BACKEND;
    then
        configure_api_cors
    fi

    # Deploy admin endpoints (invitations and analytics)
    if $DEPLOY_BACKEND;
    then
        log_header "Deploying Admin Endpoints"
        if ./scripts/deploy-admin-endpoints.sh; then
            log_success "✅ Admin endpoints deployed successfully"
        else
            log_warning "⚠️ Admin endpoints deployment failed. Check logs for details."
        fi
    fi

    # Final summary
    log_header "Deployment Summary"
    log_success "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    echo ""
    echo -e "${BLUE}📱 App URL:${NC} ${CLOUDFRONT_URL}"
    echo -e "${BLUE}🗂️  S3 Bucket:${NC} ${S3_BUCKET}"
    echo -e "${BLUE}🌐 CloudFront Distribution:${NC} ${CLOUDFRONT_DISTRIBUTION_ID}"
    
    if $DEPLOY_BACKEND;
    then
        echo -e "${BLUE}⚡ Lambda Functions Deployed:${NC}"
        for function_key in "${!LAMBDA_FUNCTIONS[@]}"; do
            echo "   • $function_key: ${LAMBDA_FUNCTIONS[$function_key]}"
        done
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo ""
    echo -e "${PURPLE}⏱️  Total deployment time: ${duration}s${NC}"
    log_warning "💡 Changes may take 1-2 minutes to propagate globally"
    log_warning "🔄 Hard refresh your browser (Cmd+Shift+R) to see changes"
    echo ""
}

# Run main function with all arguments
main "$@"