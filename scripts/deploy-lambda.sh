#!/bin/bash

# Enhanced Lambda Deployment Tool for RecipeArchive
# Usage: ./scripts/deploy-lambda.sh [function-name] [--all] [--dry-run]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="us-west-2"
FUNCTIONS_DIR="./aws-backend/functions"

# Function mapping (using simple function for compatibility)
get_aws_function_name() {
    case "$1" in
        "recipes") echo "RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w" ;;
        "background-normalizer") echo "RecipeArchive-dev-BackgroundNormalizerFunction40DC-M0YYgo9x8GDU" ;;
        "content-normalizer") echo "RecipeArchive-dev-ContentNormalizerFunction7256CD8-YAtnTbwUa2Kh" ;;
        "diagnostics") echo "RecipeArchive-dev-DiagnosticsFunctionF6482E72-7rWL0Ds1MAiV" ;;
        "health") echo "RecipeArchive-dev-HealthFunction19D7724A-5hFUloy1jWQc" ;;
        "image-upload") echo "RecipeArchive-dev-ImageUploadFunction1528BFB7-E3I8EN78CRWy" ;;
        "diagnostic-processor") echo "RecipeArchive-dev-DiagnosticProcessorFunction73AC8-XUiLSSPrPxke" ;;
        *) echo "" ;;
    esac
}

# List of available functions
AVAILABLE_FUNCTIONS="recipes background-normalizer content-normalizer diagnostics health image-upload diagnostic-processor"

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_usage() {
    echo "🚀 RecipeArchive Lambda Deployment Tool"
    echo ""
    echo "Usage:"
    echo "  ./scripts/deploy-lambda.sh <function-name>  # Deploy specific function"
    echo "  ./scripts/deploy-lambda.sh --all            # Deploy all functions"
    echo "  ./scripts/deploy-lambda.sh --list           # List available functions"
    echo "  ./scripts/deploy-lambda.sh --dry-run        # Show what would be deployed"
    echo ""
    echo "Available functions:"
    for func in $AVAILABLE_FUNCTIONS; do
        echo "  - $func"
    done
}

list_functions() {
    echo "📋 Available Lambda Functions:"
    echo ""
    printf "%-20s %-50s %-10s\n" "Local Name" "AWS Function Name" "Status"
    echo "$(printf '%.0s-' {1..85})"
    
    for local_name in $AVAILABLE_FUNCTIONS; do
        aws_name="$(get_aws_function_name "$local_name")"
        local_path="$FUNCTIONS_DIR/$local_name"
        
        if [ -d "$local_path" ] && [ -f "$local_path/main.go" ]; then
            status="🟢 Ready"
        else
            status="🔴 Missing"
        fi
        
        printf "%-20s %-50s %-10s\n" "$local_name" "$aws_name" "$status"
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
    GOOS=linux GOARCH=amd64 go build -o bootstrap main.go
    
    if [ ! -f "bootstrap" ]; then
        log_error "Build failed for $func_name"
        return 1
    fi
    
    # Create deployment package
    zip -q deployment-package.zip bootstrap
    
    if [ ! -f "deployment-package.zip" ]; then
        log_error "Failed to create deployment package for $func_name"
        return 1
    fi
    
    log_success "Built $func_name ($(stat -f%z deployment-package.zip) bytes)"
    cd - > /dev/null
    return 0
}

deploy_function() {
    local func_name="$1"
    local aws_func_name="$(get_aws_function_name "$func_name")"
    local func_dir="$FUNCTIONS_DIR/$func_name"
    
    if [ -z "$aws_func_name" ]; then
        log_error "Unknown function: $func_name"
        return 1
    fi
    
    log_info "Deploying $func_name to AWS..."
    
    # Build the function
    if ! build_function "$func_name"; then
        return 1
    fi
    
    # Deploy to AWS
    local deploy_result
    if deploy_result=$(aws lambda update-function-code \
        --function-name "$aws_func_name" \
        --zip-file "fileb://$func_dir/deployment-package.zip" \
        --region "$REGION" \
        --output json 2>&1); then
        
        local code_size=$(echo "$deploy_result" | jq -r '.CodeSize' 2>/dev/null || echo "unknown")
        local last_modified=$(echo "$deploy_result" | jq -r '.LastModified' 2>/dev/null || echo "unknown")
        
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
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it first."
        return 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
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
    if ! command -v go &> /dev/null; then
        log_error "Go not found. Please install Go first."
        return 1
    fi
    
    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found. Output formatting will be limited."
    fi
    
    # Check zip
    if ! command -v zip &> /dev/null; then
        log_error "zip not found. Please install zip utility."
        return 1
    fi
    
    return 0
}

main() {
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
                exit 1
            fi
            
            local failed_deployments=()
            local successful_deployments=()
            
            for func_name in $AVAILABLE_FUNCTIONS; do
                if deploy_function "$func_name"; then
                    successful_deployments+=("$func_name")
                else
                    failed_deployments+=("$func_name")
                fi
            done
            
            echo ""
            log_success "Deployment Summary:"
            log_success "✅ Successful: ${#successful_deployments[@]} (${successful_deployments[*]})"
            
            if [ ${#failed_deployments[@]} -gt 0 ]; then
                log_error "❌ Failed: ${#failed_deployments[@]} (${failed_deployments[*]})"
                exit 1
            fi
            
            log_success "🎉 All Lambda functions deployed successfully!"
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
            exit 1
            ;;
        *)
            if [[ -n "$(get_aws_function_name "$arg")" ]]; then
                log_info "Deploying single function: $arg"
                
                if ! check_dependencies; then
                    exit 1
                fi
                
                if deploy_function "$arg"; then
                    log_success "🎉 Function $arg deployed successfully!"
                    exit 0
                else
                    log_error "Failed to deploy $arg"
                    exit 1
                fi
            else
                log_error "Unknown function: $arg"
                print_usage
                exit 1
            fi
            ;;
    esac
}

main "$@"