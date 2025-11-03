#!/usr/bin/env bash

################################################################################
# RecipeArchive Multi-Tenant System Deployment
################################################################################
# PURPOSE: Deploy all components for multi-tenant functionality
#   - DynamoDB tables (InvitationTokens, UserProfiles, UsageTracking)
#   - Lambda functions (invitation-manager-s3, registration-handler)
#   - API Gateway routes
#   - Health checks and verification
#
# USAGE:
#   ./scripts/aws/multi-tenant.sh [dev|prod]
#
# EXAMPLES:
#   ./scripts/aws/multi-tenant.sh dev
#   ./scripts/aws/multi-tenant.sh prod
#
# DEPENDENCIES:
#   - AWS CLI
#   - Go 1.19+
#
# ENVIRONMENT VARIABLES:
#   - AWS_REGION (optional, defaults to us-west-2)
#
# NOTES:
#   - Requires .env file in repository root
#   - Creates CloudFormation stacks with prefix: recipearchive-{environment}
#   - Runs health checks after deployment
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly ENVIRONMENT="${1:-dev}"
readonly AWS_REGION="${AWS_REGION:-us-west-2}"
readonly STACK_PREFIX="recipearchive-${ENVIRONMENT}"

log_header "Multi-Tenant System Deployment"

log_info "Environment: $ENVIRONMENT"
log_info "Region: $AWS_REGION"
log_info "Stack Prefix: $STACK_PREFIX"
echo ""

# Load environment variables
if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
    log_debug "Environment variables loaded"
else
    die ".env file not found. Please create one from .env.example"
fi

# Validate prerequisites
log_section "Checking Prerequisites"

require_command "aws" "https://aws.amazon.com/cli/"
require_command "go" "brew install go"

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    die "AWS credentials not configured. Please run 'aws configure'"
fi

log_success "Prerequisites validated"
echo ""

# DynamoDB removed - now using S3-based invitation system for cost optimization
# Multi-tenant invitations stored as JSON files in S3 bucket

# Step 1: Build Lambda Functions
log_section "Step 1: Building Lambda Functions"

cd "$REPO_ROOT" || die "Failed to change to repository root"

if ! "$SCRIPT_DIR/build-packages.sh" invitation-manager-s3 > /tmp/deploy-multi-tenant.log 2>&1; then
    die "Failed to build invitation-manager-s3. See /tmp/deploy-multi-tenant.log"
fi

if ! "$SCRIPT_DIR/build-packages.sh" registration-handler > /tmp/deploy-multi-tenant.log 2>&1; then
    die "Failed to build registration-handler. See /tmp/deploy-multi-tenant.log"
fi

log_success "Lambda functions built"

# Step 2: Deploy Lambda Functions
log_section "Step 2: Deploying Lambda Functions"

if ! "$SCRIPT_DIR/lambda.sh" invitation-manager-s3 > /tmp/deploy-multi-tenant.log 2>&1; then
    die "Failed to deploy invitation-manager-s3. See /tmp/deploy-multi-tenant.log"
fi

if ! "$SCRIPT_DIR/lambda.sh" registration-handler > /tmp/deploy-multi-tenant.log 2>&1; then
    die "Failed to deploy registration-handler. See /tmp/deploy-multi-tenant.log"
fi

log_success "Lambda functions deployed"

# Step 3: Configure API Gateway Routes
log_section "Step 3: Configuring API Gateway Routes"

if ! "$SCRIPT_DIR/manage-api-routes.sh" add-analytics > /tmp/deploy-multi-tenant.log 2>&1; then
    die "Failed to configure API Gateway routes. See /tmp/deploy-multi-tenant.log"
fi

log_success "API Gateway routes configured"

# Step 5: Cleanup build artifacts
log_section "Step 5: Cleaning Up"

rm -rf "$REPO_ROOT/aws-backend/functions/dist"
log_success "Build artifacts cleaned"

# Step 6: Deployment Summary
log_section "Deployment Summary"

log_info "Environment: $ENVIRONMENT"
log_info "Region: $AWS_REGION"
echo ""
log_info "DynamoDB Tables:"
echo "  - ${ENVIRONMENT}-InvitationTokens"
echo "  - ${ENVIRONMENT}-UserProfiles"
echo "  - ${ENVIRONMENT}-UsageTracking"
echo ""
log_info "Lambda Functions:"
echo "  - ${STACK_PREFIX}-invitation-manager-s3"
echo "  - ${STACK_PREFIX}-registration-handler"
echo ""
log_info "Next Steps:"
echo "1. Configure SES (Simple Email Service) for invitation emails"
echo "2. Update API Gateway routes (if not done automatically)"
echo "3. Test invitation flow end-to-end"
echo "4. Update Flutter app with developer settings"

# Step 7: Health Checks
log_section "Running Health Checks"

# Check DynamoDB tables
for table in "InvitationTokens" "UserProfiles" "UsageTracking"; do
    if aws dynamodb describe-table --table-name "${ENVIRONMENT}-${table}" --region "$AWS_REGION" >/dev/null 2>&1; then
        log_success "Table ${ENVIRONMENT}-${table} is active"
    else
        log_error "Table ${ENVIRONMENT}-${table} not found"
    fi
done

# Check Lambda functions
for func in "${STACK_PREFIX}-invitation-manager-s3" "${STACK_PREFIX}-registration-handler"; do
    if aws lambda get-function --function-name "$func" --region "$AWS_REGION" >/dev/null 2>&1; then
        log_success "Function $func is deployed"
    else
        log_error "Function $func not found"
    fi
done

log_success "Multi-tenant deployment completed!"
echo ""
log_info "Useful commands:"
echo "  View tables: aws dynamodb list-tables --region $AWS_REGION"
echo "  View functions: aws lambda list-functions --region $AWS_REGION"
echo "  View logs: aws logs tail /aws/lambda/${STACK_PREFIX}-invitation-manager-s3 --follow"
