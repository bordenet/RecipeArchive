#!/usr/bin/env bash

################################################################################
# RecipeArchive Lambda Function Deployment
################################################################################
# PURPOSE: Deploy individual Lambda functions to AWS
#   - Builds Go Lambda functions for Linux
#   - Creates deployment packages
#   - Updates Lambda function code
#   - Configures function settings
#   - Updates environment variables
#   - Verifies deployment
#
# USAGE:
#   ./scripts/aws/lambda.sh <function-name>
#   ./scripts/aws/lambda.sh --all
#   ./scripts/aws/lambda.sh --list
#
# EXAMPLES:
#   ./scripts/aws/lambda.sh recipes
#   ./scripts/aws/lambda.sh analytics
#   ./scripts/aws/lambda.sh --all
#
# DEPENDENCIES:
#   - AWS CLI
#   - Go 1.19+
#
# ENVIRONMENT VARIABLES:
#   - AWS credentials
#
# NOTES:
#   - Requires AWS credentials configured
#   - Builds for Linux AMD64 (AWS Lambda runtime)
#   - Creates deployment packages with proper structure
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

# Load environment variables from repo root
if [ -f "$REPO_ROOT/.env" ]; then
    export $(cat "$REPO_ROOT/.env" | grep -v '^#' | grep -v '^$' | xargs)
else
    echo "❌ .env file not found in repo root. Please create one from .env.example"
    die "Deployment failed"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration from environment with fallbacks
REGION=${AWS_REGION:-"us-west-2"}

# Slow connection configuration
AWS_CLI_READ_TIMEOUT=${AWS_CLI_READ_TIMEOUT:-300}
AWS_CLI_CONNECT_TIMEOUT=${AWS_CLI_CONNECT_TIMEOUT:-60}
MAX_RETRIES=${MAX_RETRIES:-5}
RETRY_DELAY=${RETRY_DELAY:-10}

export AWS_CLI_READ_TIMEOUT
export AWS_CLI_CONNECT_TIMEOUT
export AWS_MAX_ATTEMPTS=${MAX_RETRIES}
FUNCTIONS_DIR="$REPO_ROOT/aws-backend/functions"

# Retry wrapper for AWS CLI commands with slow connection handling
aws_retry() {
    local cmd="$*"
    local attempt=1

    while [ $attempt -le $MAX_RETRIES ]; do
        echo "🔄 Attempt $attempt/$MAX_RETRIES: $cmd" >&2

        if timeout $((AWS_CLI_READ_TIMEOUT + AWS_CLI_CONNECT_TIMEOUT)) $cmd; then
            echo "✅ Success on attempt $attempt" >&2
            return 0
        else
            local exit_code=$?
            echo "❌ Attempt $attempt failed (exit code: $exit_code)" >&2

            if [ $attempt -lt $MAX_RETRIES ]; then
                echo "⏳ Waiting ${RETRY_DELAY}s before retry..." >&2
                sleep $RETRY_DELAY
            fi
        fi

        ((attempt++))
    done

    echo "💥 All $MAX_RETRIES attempts failed" >&2
    return 1
}

# Get AWS function name by discovering from AWS
get_lambda_function_name() {
    local function_name_prefix=$1
    local region=$2
    # List all function names and then filter using grep for robustness
    aws lambda list-functions --region "$region" --query "Functions[].FunctionName" --output text | grep "^$function_name_prefix"
}

get_aws_function_name() {
    local local_name="$1"

    # Direct mappings for API Gateway functions (CDK-managed)
    case "$local_name" in
        "analytics-aggregator")
            echo "RecipeAnalyticsAggregator"
            return
            ;;
        "invitation-manager-s3")
            # API Gateway function name (CDK-managed)
            echo "RecipeArchive-dev-InvitationManagerFunctionC8A45B8-yiEZQLmLoXj5"
            return
            ;;
        "recipes")
            # API Gateway function name (CDK-managed)
            local aws_name
            aws_name=$(aws lambda list-functions --region "$REGION" \
                --query "Functions[?contains(FunctionName, \`RecipeArchive-dev-RecipesFunction\`)].FunctionName" \
                --output text 2> /tmp/deploy-lambda.log | head -1)
            echo "$aws_name"
            return
            ;;
        "diagnostics")
            # Diagnostics function name (CDK-managed)
            echo "RecipeArchive-dev-DiagnosticsFunctionF6482E72-GpGVR5DdZICc"
            return
            ;;
        "image-upload")
            # Image upload function name (CDK-managed)
            echo "RecipeArchive-dev-ImageUploadFunction1528BFB7-SkQEMmTH8zTf"
            return
            ;;
        "backup"|"local-server"|"s3-manager"|"test-tools")
            # These are utility functions that don't have AWS deployments
            echo ""
            return
            ;;
    esac

    # Generate pattern for standard functions
    local pattern="RecipeArchive-dev-$(echo "$local_name" | awk -F- '{for(i=1;i<=NF;i++) printf "%s", toupper(substr($i,1,1)) substr($i,2);}')Function"

    # Query AWS for function name
    local aws_name
    aws_name=$(aws lambda list-functions --region "$REGION" \
        --query "Functions[?contains(FunctionName, \`$pattern\`)].FunctionName" \
        --output text 2> /tmp/deploy-lambda.log | head -1)

    if [ -n "$aws_name" ]; then
        echo "$aws_name"
    else
        echo ""
    fi
}

get_available_functions() {
    for dir in $FUNCTIONS_DIR/*/; do
        if [ -f "$dir/main.go" ]; then
            basename "$dir"
        fi
    done
}

log_info() {
    log_info "ℹ️  $1"
}

log_success() {
    log_success "✅ $1"
}

log_warning() {
    log_warning "⚠️  $1"
}

log_error() {
    log_error "❌ $1"
}

print_usage() {
    echo "🚀 RecipeArchive Lambda Deployment Tool"
    echo ""
    echo "Usage:"
    echo "  ./scripts/aws/lambda.sh <function-name>  # Deploy specific function"
    echo "  ./scripts/aws/lambda.sh --all            # Deploy all functions"
    echo "  ./scripts/aws/lambda.sh --list           # List available functions"
    echo "  ./scripts/aws/lambda.sh --dry-run        # Show what would be deployed"
    echo ""
    echo "Available functions:"
    for func in $(get_available_functions);
    do
        echo "  - $func"
    done
}

list_functions() {
    echo "📋 Available Lambda Functions:"
    echo ""
    printf "% -20s % -50s % -10s\n" "Local Name" "AWS Function Name" "Status"
    echo "$(printf '%.0s-' {1..85})"
    
    for local_name in $(get_available_functions);
    do
        aws_name="$(get_aws_function_name "$local_name")"
        local_path="$FUNCTIONS_DIR/$local_name"
        
        if [ -d "$local_path" ] && [ -f "$local_path/main.go" ]; then
            status="🟢 Ready"
        else
            status="🔴 Missing"
        fi
        
        printf "% -20s % -50s % -10s\n" "$local_name" "$aws_name" "$status"
    done
}

build_function() {
    local func_name="$1"
    local func_dir="$FUNCTIONS_DIR/$func_name"
    
    if [ ! -d "$func_dir" ]; then
        log_error "Function directory not found: $func_dir"
        return 1
    fi
    
    if [ ! -f "$func_dir/main.go" ]; then
        log_error "main.go not found in: $func_dir"
        return 1
    fi
    
    log_info "Building $func_name..."
    
    # Clean previous builds
    rm -f "$func_dir/bootstrap" "$func_dir/main" "$func_dir/deployment-package.zip"
    
    # Build for AWS Lambda (Linux)
    cd "$func_dir"
    if ! GOOS=linux GOARCH=amd64 go build -o bootstrap *.go > /tmp/deploy-lambda.log 2>&1; then
        log_error "Build failed for $func_name. See /tmp/deploy-lambda.log for details."
        return 1
    fi
    
    # Create deployment package
    zip -q deployment-package.zip bootstrap
    
    if [ ! -f "deployment-package.zip" ]; then
        log_error "Failed to create deployment package for $func_name"
        return 1
    fi
    
    # Cross-platform file size detection
    zip_size=$(ls -la deployment-package.zip | awk '{print $5}')
    log_success "Built $func_name ($zip_size bytes)"
    cd - > /dev/null
    return 0
}

deploy_function() {
    local func_name="$1"
    local aws_func_name="$(get_aws_function_name "$func_name")"
    local func_dir="$FUNCTIONS_DIR/$func_name"

    if [ -z "$aws_func_name" ]; then
        # Check if this is a utility function that shouldn't be deployed
        case "$func_name" in
            "backup"|"local-server"|"s3-manager"|"test-tools")
                log_warning "Skipping utility function: $func_name (not deployable to AWS)"
                return 2  # Special return code for skipped functions
                ;;
            *)
                log_error "Unknown function: $func_name"
                return 1
                ;;
        esac
    fi
    
    log_info "Deploying $func_name to AWS..."
    
    # Build the function
    if ! build_function "$func_name"; then
        return 1
    fi
    
    # Deploy to AWS with retry logic for slow connections
    local deploy_result
    if deploy_result=$(aws_retry aws lambda update-function-code \
        --function-name "$aws_func_name" \
        --zip-file "fileb://$func_dir/deployment-package.zip" \
        --region "$REGION" \
        --output json 2>&1); then
        
        local code_size=$(echo "$deploy_result" | jq -r '.CodeSize' 2> /tmp/deploy-lambda.log || echo "unknown")
        local last_modified=$(echo "$deploy_result" | jq -r '.LastModified' 2> /tmp/deploy-lambda.log || echo "unknown")
        
        log_success "Deployed $func_name (${code_size} bytes, modified: ${last_modified})"
        
        # Cleanup
        rm -f "$func_dir/bootstrap" "$func_dir/deployment-package.zip"
        return 0
    else
        log_error "Failed to deploy $func_name:"
        echo "$deploy_result" | head -3
        return 1
    fi
}

check_aws_cli() {
    if ! command -v aws > /tmp/deploy-lambda.log 2>&1; then
        log_error "AWS CLI not found. Please install it first."
        return 1
    fi
    
    if ! aws_retry aws sts get-caller-identity > /tmp/deploy-lambda.log 2>&1; then
        log_error "AWS credentials not configured. Run 'aws configure' first."
        return 1
    fi
    
    return 0
}

check_dependencies() {
    # Check AWS CLI
    if ! check_aws_cli; then
        return 1
    fi
    
    # Check Go
    if ! command -v go > /tmp/deploy-lambda.log 2>&1; then
        log_error "Go not found. Please install Go first."
        return 1
    fi
    
    # Check jq for JSON parsing
    if ! command -v jq > /tmp/deploy-lambda.log 2>&1; then
        log_warning "jq not found. Output formatting will be limited."
    fi
    
    # Check zip
    if ! command -v zip > /tmp/deploy-lambda.log 2>&1; then
        log_error "zip not found. Please install zip utility."
        return 1
    fi
    
    return 0
}

main() {
    local start_time=$(date +%s)
    local arg="${1:-}"
    
    case "$arg" in
        --help|-h)
            print_usage
            exit 0
            ;; 
        --list)
            list_functions
            exit 0
            ;; 
        --all)
            log_info "Deploying all Lambda functions..."
            
            if ! check_dependencies; then
                die "Deployment failed"
            fi
            
            local failed_deployments=()
            local successful_deployments=()
            local skipped_deployments=()

            for func_name in $(get_available_functions);
            do
                # Check if AWS function exists before attempting deployment
                aws_function_name="$(get_aws_function_name "$func_name")"
                if [ -z "$aws_function_name" ]; then
                    log_warning "Skipping $func_name - no corresponding AWS function found"
                    skipped_deployments+=("$func_name (no AWS function)")
                    continue
                fi

                deploy_function "$func_name"
                deploy_result=$?
                case "$deploy_result" in
                    0)
                        successful_deployments+=("$func_name")
                        ;;
                    2)
                        skipped_deployments+=("$func_name")
                        ;;
                    *)
                        failed_deployments+=("$func_name")
                        ;;
                esac
            done
            
            echo ""
            log_success "Deployment Summary:"
            log_success "✅ Successful: ${#successful_deployments[@]} (${successful_deployments[*]})"

            if [ ${#skipped_deployments[@]} -gt 0 ]; then
                log_warning "⏭️ Skipped: ${#skipped_deployments[@]} (${skipped_deployments[*]})"
            fi

            if [ ${#failed_deployments[@]} -gt 0 ]; then
                log_error "❌ Failed: ${#failed_deployments[@]} (${failed_deployments[*]})"
                die "Deployment failed"
            fi

            # Validate API Gateway integrations after deployment
            echo ""
            log_info "Validating API Gateway integrations..."
            if ./scripts/manage-api-routes.sh validate > /tmp/api-gateway-validation.log 2>&1; then
                log_success "✅ All API Gateway integrations are valid"
            else
                log_warning "⚠️ API Gateway integration issues detected"
                log_info "Validation output:"
                cat /tmp/api-gateway-validation.log
                log_warning "💡 Run: ./scripts/manage-api-routes.sh fix"
            fi

            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log_success "🎉 All deployable Lambda functions deployed successfully! (${duration}s)"
            exit 0
            ;; 
        --dry-run)
            log_info "Dry run - showing what would be deployed:"
            list_functions
            exit 0
            ;; 
        "")
            log_error "No function specified."
            print_usage
            die "Deployment failed"
            ;; 
        *)
            if [[ -n "$(get_aws_function_name "$arg")" ]]; then
                log_info "Deploying single function: $arg"
                
                if ! check_dependencies; then
                    die "Deployment failed"
                fi
                
                if deploy_function "$arg"; then
                    local end_time=$(date +%s)
                    local duration=$((end_time - start_time))
                    log_success "🎉 Function $arg deployed successfully! (${duration}s)"
                    exit 0
                else
                    log_error "Failed to deploy $arg"
                    die "Deployment failed"
                fi
            else
                log_error "Unknown function: $arg"
                print_usage
                die "Deployment failed"
            fi
            ;; 
    esac
}

main "$@"