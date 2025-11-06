#!/usr/bin/env bash

################################################################################
# RecipeArchive Infrastructure Deployment
################################################################################
# PURPOSE: Deploy AWS infrastructure stack using CDK
#   - Deploys Cognito user pools and authentication
#   - Deploys S3 buckets (storage, temp, failed parsing)
#   - Deploys Lambda function infrastructure (memory, concurrency, logs)
#   - Deploys API Gateway with rate limiting and CORS
#   - Deploys CloudWatch monitoring and billing alerts
#   - Deploys SQS queues for background processing
#
# USAGE:
#   ./scripts/aws/deploy-infrastructure.sh [options]
#
# EXAMPLES:
#   ./scripts/aws/deploy-infrastructure.sh              # Deploy all stacks
#   ./scripts/aws/deploy-infrastructure.sh --dry-run    # Show what would be deployed
#   ./scripts/aws/deploy-infrastructure.sh --diff       # Show differences
#
# DEPENDENCIES:
#   - AWS CLI
#   - Node.js 18+
#   - AWS CDK CLI (npm install -g aws-cdk)
#   - jq (for JSON parsing)
#
# ENVIRONMENT VARIABLES:
#   - AWS credentials
#   - OPENAI_API_KEY (for Lambda runtime environment)
#
# NOTES:
#   - Requires AWS credentials configured
#   - First-time deployments require CDK bootstrap
#   - Deploys infrastructure configuration, NOT Lambda function code
#   - For Lambda code updates, use ./scripts/aws/lambda.sh
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly INFRA_DIR="$REPO_ROOT/aws-backend/infrastructure"

print_usage() {
    echo "🏗️  RecipeArchive Infrastructure Deployment Tool"
    echo ""
    echo "Usage:"
    echo "  ./scripts/aws/deploy-infrastructure.sh              # Deploy all stacks"
    echo "  ./scripts/aws/deploy-infrastructure.sh --diff       # Show infrastructure differences"
    echo "  ./scripts/aws/deploy-infrastructure.sh --dry-run    # Show what would be deployed"
    echo "  ./scripts/aws/deploy-infrastructure.sh --bootstrap  # Bootstrap CDK (first-time only)"
    echo "  ./scripts/aws/deploy-infrastructure.sh --help       # Show this help"
    echo ""
    echo "What this deploys:"
    echo "  ✅ Cognito user pools and authentication"
    echo "  ✅ S3 buckets with lifecycle policies (Glacier archiving)"
    echo "  ✅ Lambda infrastructure (memory, concurrency, log retention)"
    echo "  ✅ API Gateway with rate limiting and throttling"
    echo "  ✅ CloudWatch monitoring and billing alerts"
    echo "  ✅ SQS queues for background processing"
    echo ""
    echo "Cost optimization features:"
    echo "  💰 Lambda memory optimization (9 functions → 128MB)"
    echo "  💰 Lambda reserved concurrency (11 functions capped)"
    echo "  💰 CloudWatch log retention (7-30 days, not indefinite)"
    echo "  💰 API Gateway rate limiting (200 req/s, 10k/month)"
    echo "  💰 S3 Glacier lifecycle (90 days) and Deep Archive (365 days)"
    echo ""
    echo "Expected savings: \$45-85/month (35-40% cost reduction)"
}

check_prerequisites() {
    log_header "Checking Prerequisites"

    # Check AWS CLI
    if ! command -v aws > /dev/null 2>&1; then
        log_error "AWS CLI not found"
        log_error "Install with: brew install awscli"
        return 1
    fi
    log_success "AWS CLI found"

    # Check AWS credentials
    if ! aws sts get-caller-identity > /tmp/deploy-infrastructure.log 2>&1; then
        log_error "AWS credentials not configured"
        log_error "Run: aws configure"
        return 1
    fi

    local aws_account=$(aws sts get-caller-identity --query Account --output text)
    local aws_user=$(aws sts get-caller-identity --query Arn --output text | cut -d'/' -f2)
    log_success "AWS credentials configured (Account: $aws_account, User: $aws_user)"

    # Check Node.js
    if ! command -v node > /dev/null 2>&1; then
        log_error "Node.js not found"
        log_error "Install with: brew install node"
        return 1
    fi

    local node_version=$(node --version)
    log_success "Node.js found ($node_version)"

    # Check CDK CLI
    if ! command -v cdk > /dev/null 2>&1; then
        log_error "AWS CDK CLI not found"
        log_error "Install with: npm install -g aws-cdk"
        return 1
    fi

    local cdk_version=$(cdk --version 2>&1 | head -1)
    log_success "AWS CDK found ($cdk_version)"

    # Check jq
    if ! command -v jq > /dev/null 2>&1; then
        log_warning "jq not found - output formatting will be limited"
        log_warning "Install with: brew install jq"
    else
        log_success "jq found"
    fi

    # Check infrastructure directory
    if [ ! -d "$INFRA_DIR" ]; then
        log_error "Infrastructure directory not found: $INFRA_DIR"
        return 1
    fi
    log_success "Infrastructure directory found"

    # Check package.json
    if [ ! -f "$INFRA_DIR/package.json" ]; then
        log_error "package.json not found in $INFRA_DIR"
        return 1
    fi
    log_success "CDK package.json found"

    echo ""
    return 0
}

install_dependencies() {
    log_header "Installing CDK Dependencies"

    cd "$INFRA_DIR"

    # Check if node_modules exists and is up to date
    if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
        log_info "node_modules exists, checking if update needed..."

        # Compare package.json and package-lock.json timestamps
        if [ "package.json" -nt "package-lock.json" ]; then
            log_warning "package.json is newer than package-lock.json"
            log_info "Running npm install to update dependencies..."
            if ! npm install > /tmp/deploy-infrastructure.log 2>&1; then
                log_error "npm install failed. See /tmp/deploy-infrastructure.log"
                return 1
            fi
        else
            log_success "Dependencies are up to date"
        fi
    else
        log_info "Installing dependencies..."
        if ! npm install > /tmp/deploy-infrastructure.log 2>&1; then
            log_error "npm install failed. See /tmp/deploy-infrastructure.log"
            return 1
        fi
        log_success "Dependencies installed"
    fi

    cd - > /dev/null
    echo ""
    return 0
}

bootstrap_cdk() {
    log_header "Bootstrapping CDK"

    log_info "This is required for first-time CDK deployments"
    log_info "Creates S3 bucket and IAM roles for CDK deployments"

    cd "$INFRA_DIR"

    if ! cdk bootstrap > /tmp/deploy-infrastructure.log 2>&1; then
        log_error "CDK bootstrap failed. See /tmp/deploy-infrastructure.log"
        cd - > /dev/null
        return 1
    fi

    log_success "CDK bootstrap completed"
    cd - > /dev/null
    echo ""
    return 0
}

show_diff() {
    log_header "Showing Infrastructure Differences"

    cd "$INFRA_DIR"

    log_info "Comparing deployed stack with current code..."
    echo ""

    if ! cdk diff 2>&1 | tee /tmp/deploy-infrastructure-diff.log; then
        log_error "cdk diff failed. See /tmp/deploy-infrastructure-diff.log"
        cd - > /dev/null
        return 1
    fi

    cd - > /dev/null
    echo ""
    return 0
}

deploy_infrastructure() {
    log_header "Deploying Infrastructure"

    cd "$INFRA_DIR"

    log_info "Deploying CDK stack..."
    log_warning "This may take 5-10 minutes"
    echo ""

    # Export OPENAI_API_KEY for CDK deployment (Lambda environment variable)
    export OPENAI_API_KEY="$OPENAI_API_KEY"

    # Deploy with --all flag to deploy all stacks
    # --require-approval never: auto-approve for scripted deployments
    # --outputs-file: save outputs to JSON for later use
    if ! cdk deploy --all \
        --require-approval never \
        --outputs-file outputs.json \
        2>&1 | tee /tmp/deploy-infrastructure.log; then
        log_error "CDK deployment failed. See /tmp/deploy-infrastructure.log"
        cd - > /dev/null
        return 1
    fi

    log_success "Infrastructure deployment completed"

    # Display outputs if available
    if [ -f "outputs.json" ] && command -v jq > /dev/null 2>&1; then
        echo ""
        log_header "Deployment Outputs"
        jq -r 'to_entries[] | "\(.key):\n" + (.value | to_entries[] | "  \(.key): \(.value)")' outputs.json
    fi

    cd - > /dev/null
    echo ""
    return 0
}

verify_deployment() {
    log_header "Verifying Deployment"

    log_info "Checking Lambda function configurations..."

    # Check a few key Lambda functions to verify cost optimizations
    local test_functions=(
        "RecipeArchive-dev-DiagnosticsFunction"
        "RecipeArchive-dev-InvitationManagerFunction"
        "RecipeArchive-dev-RegistrationHandlerFunction"
    )

    local verification_passed=true

    for func_pattern in "${test_functions[@]}"; do
        # Get actual function name (may have random suffix)
        local func_name=$(aws lambda list-functions \
            --query "Functions[?contains(FunctionName, \`$func_pattern\`)].FunctionName" \
            --output text 2>/dev/null | head -1)

        if [ -z "$func_name" ]; then
            log_warning "Function not found: $func_pattern"
            continue
        fi

        # Get function configuration
        local config=$(aws lambda get-function-configuration \
            --function-name "$func_name" \
            --output json 2>/dev/null)

        if [ -z "$config" ]; then
            log_warning "Could not get configuration for: $func_name"
            continue
        fi

        local memory=$(echo "$config" | jq -r '.MemorySize')
        local concurrency=$(echo "$config" | jq -r '.ReservedConcurrentExecutions // "none"')

        log_info "$func_name:"
        log_info "  Memory: ${memory}MB"
        log_info "  Reserved Concurrency: $concurrency"

        # Verify expected memory size (should be 128MB for optimized functions)
        if [ "$memory" != "128" ]; then
            log_warning "  Expected 128MB, got ${memory}MB"
            verification_passed=false
        fi
    done

    echo ""

    if [ "$verification_passed" = true ]; then
        log_success "Deployment verification passed"
    else
        log_warning "Some verification checks failed - review configuration"
    fi

    echo ""
    return 0
}

main() {
    local start_time=$(date +%s)
    local mode="deploy"

    # Parse command line arguments (check help first, before loading .env)
    case "${1:-}" in
        --help|-h)
            print_usage
            exit 0
            ;;
        --dry-run)
            mode="dry-run"
            ;;
        --diff)
            mode="diff"
            ;;
        --bootstrap)
            mode="bootstrap"
            ;;
        "")
            mode="deploy"
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            die "Deployment failed"
            ;;
    esac

    # Load environment variables (after help check)
    if [ -f "$REPO_ROOT/.env" ]; then
        log_info "Loading environment variables from .env"
        source "$REPO_ROOT/scripts/load-env.sh"
    else
        log_error ".env file not found in repo root"
        log_error "Please create .env from .env.example and populate AWS credentials"
        die "Deployment failed"
    fi

    # Check if OPENAI_API_KEY is set (required for Lambda runtime)
    if [ -z "$OPENAI_API_KEY" ]; then
        log_warning "OPENAI_API_KEY not set in .env"
        log_warning "Lambda functions will deploy but OpenAI features will not work"
        log_warning "Set OPENAI_API_KEY in .env before deploying if you need recipe normalization"
    fi

    log_header "RecipeArchive Infrastructure Deployment"

    # Check prerequisites for all modes
    if ! check_prerequisites; then
        die "Prerequisites check failed"
    fi

    # Install dependencies for all modes except dry-run
    if [ "$mode" != "dry-run" ]; then
        if ! install_dependencies; then
            die "Dependency installation failed"
        fi
    fi

    # Execute based on mode
    case "$mode" in
        dry-run)
            log_header "Dry Run - What Would Be Deployed"
            echo ""
            log_info "CDK Infrastructure Stack:"
            log_info "  Location: $INFRA_DIR"
            log_info "  Region: ${AWS_REGION:-us-west-2}"
            log_info "  Account: $(aws sts get-caller-identity --query Account --output text)"
            echo ""
            log_info "Resources that would be deployed/updated:"
            log_info "  ✅ Cognito User Pool and Client"
            log_info "  ✅ S3 Buckets (storage, temp, failed-parsing)"
            log_info "  ✅ Lambda Functions (11 total)"
            log_info "  ✅ API Gateway REST API"
            log_info "  ✅ SQS Queue (recipe normalization)"
            log_info "  ✅ CloudWatch Log Groups"
            log_info "  ✅ IAM Roles and Policies"
            log_info "  ✅ Budget Alerts and Monitoring"
            echo ""
            log_info "Cost optimizations included:"
            log_info "  💰 Lambda memory: 9 functions → 128MB"
            log_info "  💰 Lambda concurrency: 11 functions with limits"
            log_info "  💰 CloudWatch logs: 7-30 day retention"
            log_info "  💰 API Gateway: 200 req/s rate limiting"
            log_info "  💰 S3 lifecycle: Glacier (90d) + Deep Archive (365d)"
            echo ""
            log_success "Dry run completed (no changes made)"
            ;;

        bootstrap)
            if ! bootstrap_cdk; then
                die "CDK bootstrap failed"
            fi
            ;;

        diff)
            if ! show_diff; then
                die "CDK diff failed"
            fi
            ;;

        deploy)
            if ! deploy_infrastructure; then
                die "Infrastructure deployment failed"
            fi

            if ! verify_deployment; then
                log_warning "Verification had warnings but deployment succeeded"
            fi

            local end_time=$(date +%s)
            local duration=$((end_time - start_time))

            log_header "Deployment Summary"
            log_success "🎉 INFRASTRUCTURE DEPLOYMENT COMPLETED!"
            echo ""
            log_info "⏱️  Total deployment time: ${duration}s"
            log_info "📋 Next steps:"
            log_info "  1. Copy outputs from outputs.json to .env file"
            log_info "  2. Deploy Lambda function code: ./scripts/aws/lambda.sh --all"
            log_info "  3. Deploy web app: ./scripts/web/deploy.sh"
            log_info "  4. Verify deployment: ./validate-monorepo.sh --all"
            echo ""
            log_info "💰 Cost optimizations deployed:"
            log_success "  ✅ Expected savings: \$45-85/month (35-40% reduction)"
            echo ""
            ;;
    esac
}

main "$@"
