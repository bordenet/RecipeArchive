#!/usr/bin/env bash

################################################################################
#
# Normalize Existing Recipes Script
#
# This script retroactively normalizes existing recipes with enhanced search
# metadata by sending them through the background normalization pipeline.
#
# USAGE:
#   ./normalize-existing-recipes.sh
#
# DEPENDENCIES:
#   - AWS CLI
#   - jq
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires the .env file to be present in the root of the repository with
#     the following variables:
#       - NORMALIZATION_QUEUE_URL: The URL of the recipe normalization queue.
#       - AWS_REGION: The AWS region.
#       - TEST_USER_ID: The user ID to use for testing.
#
################################################################################

# Script to retroactively normalize existing recipes with enhanced search metadata
# This sends all existing recipes through the background normalization pipeline

set -e

# Load environment variables from repo root
if [ -f "./.env" ]; then
    export $(cat ./.env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Helper functions
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

log_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
    echo "======================================"
}

# Configuration
AWS_REGION=${AWS_REGION:-us-west-2}
SQS_QUEUE_URL=${NORMALIZATION_QUEUE_URL}
USER_ID=${TEST_USER_ID}

if [ -z "$SQS_QUEUE_URL" ] || [ -z "$USER_ID" ]; then
    log_error "Missing required environment variables: SQS_QUEUE_URL, USER_ID"
    log_error "Please set them in your environment or in a .env file."
    exit 1
fi

log_header "Recipe Data Quality Enhancement"
log_info "Retroactively normalizing existing recipes with enhanced search metadata"
echo ""

# Check prerequisites
log_info "Checking prerequisites..."
if ! command -v aws > /tmp/normalize-existing-recipes.log 2>&1; then
    log_error "AWS CLI is required but not installed"
    exit 1
fi

if ! command -v jq > /tmp/normalize-existing-recipes.log 2>&1; then
    log_error "jq is required but not installed"
    exit 1
fi

# Verify AWS credentials
if ! aws sts get-caller-identity > /tmp/normalize-existing-recipes.log 2>&1; then
    log_error "AWS credentials not configured"
    exit 1
fi

log_success "Prerequisites check passed"
echo ""

# Get list of all recipes
log_info "Fetching list of existing recipes..."
RECIPE_LIST_OUTPUT=$(./aws-backend/functions/test-tools/test-tools \
    -action=list-recipes \
    -user-id="$USER_ID" 2> /tmp/normalize-existing-recipes.log | grep -E "^  [a-f0-9-]{36}")

if [ -z "$RECIPE_LIST_OUTPUT" ]; then
    log_error "No recipes found for user $USER_ID"
    exit 1
fi

# Extract recipe IDs
RECIPE_IDS=$(echo "$RECIPE_LIST_OUTPUT" | awk '{print $1}' | grep -E '^[a-f0-9-]{36}$')
RECIPE_COUNT=$(echo "$RECIPE_IDS" | wc -l | tr -d ' ')

log_success "Found $RECIPE_COUNT recipes to normalize"
echo ""

# Confirm with user
log_warning "This will send $RECIPE_COUNT recipes through the background normalization pipeline."
log_warning "Each recipe will be enhanced with OpenAI-generated search metadata."
log_warning "This process will incur OpenAI API costs (~$0.01 per recipe)."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Operation cancelled by user"
    exit 0
fi

echo ""
log_header "Sending Recipes for Background Normalization"

# Counter for tracking progress
PROCESSED=0
SUCCESSFUL=0
FAILED=0

# Process each recipe
for RECIPE_ID in $RECIPE_IDS; do
    PROCESSED=$((PROCESSED + 1))
    
    log_info "Processing recipe $PROCESSED/$RECIPE_COUNT: $RECIPE_ID"
    
    # Create SQS message for background normalization
    SQS_MESSAGE=$(jq -n \
        --arg recipeId "$RECIPE_ID" \
        --arg userId "$USER_ID" \
        --arg action "normalize" \
        '{
            recipeId: $recipeId,
            userId: $userId,
            action: $action
        }')
    
    # Send message to SQS
    if aws sqs send-message \
        --region "$AWS_REGION" \
        --queue-url "$SQS_QUEUE_URL" \
        --message-body "$SQS_MESSAGE" \
        --delay-seconds 1 \
        > /tmp/normalize-existing-recipes.log 2>&1; then
        
        SUCCESSFUL=$((SUCCESSFUL + 1))
        log_success "Queued recipe $RECIPE_ID for normalization"
    else
        FAILED=$((FAILED + 1))
        log_error "Failed to queue recipe $RECIPE_ID. See /tmp/normalize-existing-recipes.log for details."
    fi
    
    # Small delay to avoid overwhelming the queue
    sleep 0.1
done

echo ""
log_header "Normalization Queue Summary"
log_success "🎉 Successfully queued $SUCCESSFUL/$RECIPE_COUNT recipes for normalization"

if [ $FAILED -gt 0 ]; then
    log_warning "$FAILED recipes failed to queue"
fi

echo ""
log_info "📊 Background Processing Status:"
log_info "   • Recipes are now being processed asynchronously by the background normalizer"
log_info "   • Each recipe will be enhanced with 9 search metadata fields via OpenAI"
log_info "   • Processing typically takes 5-15 seconds per recipe"
log_info "   • Check CloudWatch logs for detailed processing status"

echo ""
log_info "💰 Estimated Cost: ~\$$(echo "scale=2; $SUCCESSFUL * 0.01" | bc) USD"
log_info "⏱️  Estimated Time: ~$((SUCCESSFUL * 10 / 60)) minutes"

echo ""
log_warning "💡 Note: You can monitor progress in AWS CloudWatch logs"
log_warning "🔄 Recipes will be automatically updated with enhanced metadata when complete"
