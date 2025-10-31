#!/usr/bin/env bash

################################################################################
# RecipeArchive Recipe Normalization Script
################################################################################
# PURPOSE: Retroactively normalize existing recipes with enhanced search metadata
#   - Fetches all recipes for a test user
#   - Sends recipes through background normalization pipeline
#   - Enhances recipes with OpenAI-generated search metadata
#   - Processes asynchronously via SQS
#
# USAGE:
#   ./scripts/normalize-existing-recipes.sh
#
# EXAMPLES:
#   ./scripts/normalize-existing-recipes.sh
#
# DEPENDENCIES:
#   - AWS CLI
#   - jq
#   - aws-backend/functions/test-tools/test-tools
#
# ENVIRONMENT VARIABLES:
#   - NORMALIZATION_QUEUE_URL: SQS queue URL for recipe normalization
#   - AWS_REGION: AWS region (default: us-west-2)
#   - TEST_USER_ID: User ID for testing
#
# NOTES:
#   - Requires .env file with necessary environment variables
#   - Incurs OpenAI API costs (~$0.01 per recipe)
#   - Processes recipes asynchronously in background
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Load environment variables
readonly REPO_ROOT="$(get_repo_root)"
if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
fi

# Script variables
readonly AWS_REGION="${AWS_REGION:-us-west-2}"
readonly SQS_QUEUE_URL="${NORMALIZATION_QUEUE_URL:-}"
readonly USER_ID="${TEST_USER_ID:-}"
readonly TEST_TOOLS="$REPO_ROOT/aws-backend/functions/test-tools/test-tools"

log_header "Recipe Data Quality Enhancement"

log_info "Retroactively normalizing existing recipes with enhanced search metadata"

# Validate environment variables
if [[ -z "$SQS_QUEUE_URL" ]] || [[ -z "$USER_ID" ]]; then
    die "Missing required environment variables: NORMALIZATION_QUEUE_URL, TEST_USER_ID. Set them in .env file."
fi

# Check prerequisites
log_section "Checking Prerequisites"

require_command "aws" "brew install awscli"
require_command "jq" "brew install jq"
require_file "$TEST_TOOLS" "Test tools binary not found at $TEST_TOOLS"

# Verify AWS credentials
if ! aws sts get-caller-identity > /tmp/normalize-existing-recipes.log 2>&1; then
    die "AWS credentials not configured"
fi

log_success "Prerequisites check passed"

# Get list of all recipes
log_section "Fetching Recipes"

log_info "Fetching list of existing recipes..."

RECIPE_LIST_OUTPUT=$("$TEST_TOOLS" \
    -action=list-recipes \
    -user-id="$USER_ID" 2> /tmp/normalize-existing-recipes.log | grep -E "^  [a-f0-9-]{36}")

if [[ -z "$RECIPE_LIST_OUTPUT" ]]; then
    die "No recipes found for user $USER_ID"
fi

# Extract recipe IDs
RECIPE_IDS=$(echo "$RECIPE_LIST_OUTPUT" | awk '{print $1}' | grep -E '^[a-f0-9-]{36}$')
RECIPE_COUNT=$(echo "$RECIPE_IDS" | wc -l | tr -d ' ')

log_success "Found $RECIPE_COUNT recipes to normalize"

# Confirm with user
echo ""
log_warning "This will send $RECIPE_COUNT recipes through the background normalization pipeline."
log_warning "Each recipe will be enhanced with OpenAI-generated search metadata."
log_warning "This process will incur OpenAI API costs (~\$0.01 per recipe)."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Operation cancelled by user"
    exit 0
fi

# Process recipes
log_section "Sending Recipes for Background Normalization"

PROCESSED=0
SUCCESSFUL=0
FAILED=0

for RECIPE_ID in $RECIPE_IDS; do
    PROCESSED=$((PROCESSED + 1))

    log_info "Processing recipe $PROCESSED/$RECIPE_COUNT: $RECIPE_ID"

    # Create SQS message
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
        log_debug "Queued recipe $RECIPE_ID"
    else
        FAILED=$((FAILED + 1))
        log_error "Failed to queue recipe $RECIPE_ID. See /tmp/normalize-existing-recipes.log"
    fi

    # Small delay to avoid overwhelming queue
    sleep 0.1
done

# Summary
log_section "Normalization Queue Summary"

log_success "Successfully queued $SUCCESSFUL/$RECIPE_COUNT recipes for normalization"

if [[ $FAILED -gt 0 ]]; then
    log_warning "$FAILED recipes failed to queue"
fi

echo ""
log_info "Background Processing Status:"
echo "  • Recipes are now being processed asynchronously by the background normalizer"
echo "  • Each recipe will be enhanced with 9 search metadata fields via OpenAI"
echo "  • Processing typically takes 5-15 seconds per recipe"
echo "  • Check CloudWatch logs for detailed processing status"

echo ""
log_info "Estimated Cost: ~\$$(echo "scale=2; $SUCCESSFUL * 0.01" | bc) USD"
log_info "Estimated Time: ~$((SUCCESSFUL * 10 / 60)) minutes"

echo ""
log_warning "Note: Monitor progress in AWS CloudWatch logs"
log_warning "Recipes will be automatically updated with enhanced metadata when complete"
