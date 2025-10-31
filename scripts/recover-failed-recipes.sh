#!/usr/bin/env bash

################################################################################
# RecipeArchive Failed Recipe Recovery
################################################################################
# PURPOSE: Recover failed recipe normalizations from DLQ
#   - Reads messages from normalization DLQ
#   - Re-queues messages to main normalization queue
#   - Deletes successfully re-queued messages from DLQ
#
# USAGE:
#   ./scripts/recover-failed-recipes.sh
#
# EXAMPLES:
#   ./scripts/recover-failed-recipes.sh
#
# DEPENDENCIES:
#   - AWS CLI
#   - jq
#
# ENVIRONMENT VARIABLES:
#   - NORMALIZATION_DLQ_URL: The URL of the recipe normalization DLQ
#   - NORMALIZATION_QUEUE_URL: The URL of the recipe normalization queue
#   - AWS_REGION: The AWS region (default: us-west-2)
#
# NOTES:
#   - Requires .env file with necessary AWS queue URLs
#   - Processes messages one at a time with 1-second delay
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
readonly DLQ_URL="${NORMALIZATION_DLQ_URL:-}"
readonly MAIN_QUEUE_URL="${NORMALIZATION_QUEUE_URL:-}"
readonly REGION="${AWS_REGION:-us-west-2}"

log_header "Failed Recipe Recovery"

# Validate dependencies
require_command "aws" "brew install awscli"
require_command "jq" "brew install jq"

# Validate environment variables
if [[ -z "$DLQ_URL" ]] || [[ -z "$MAIN_QUEUE_URL" ]]; then
    die "Missing required environment variables: NORMALIZATION_DLQ_URL, NORMALIZATION_QUEUE_URL. Please set them in .env file."
fi

log_info "DLQ URL: $DLQ_URL"
log_info "Main Queue URL: $MAIN_QUEUE_URL"
log_info "Region: $REGION"

# Get message count
log_section "Checking DLQ"

MSG_COUNT=$(aws sqs get-queue-attributes \
    --region "$REGION" \
    --queue-url "$DLQ_URL" \
    --attribute-names ApproximateNumberOfMessages \
    --query 'Attributes.ApproximateNumberOfMessages' \
    --output text)

log_info "Found $MSG_COUNT messages in DLQ"

if [[ "$MSG_COUNT" -eq 0 ]]; then
    log_success "No messages to recover"
    exit 0
fi

# Process messages
log_section "Processing Messages"

for i in $(seq 1 "$MSG_COUNT"); do
    log_info "Processing message $i/$MSG_COUNT..."

    # Receive message from DLQ
    MESSAGE=$(aws sqs receive-message \
        --region "$REGION" \
        --queue-url "$DLQ_URL" \
        --max-number-of-messages 1)

    if [[ -z "$MESSAGE" ]] || [[ "$MESSAGE" == "null" ]]; then
        log_info "No more messages to process"
        break
    fi

    # Extract body and receipt handle
    BODY=$(echo "$MESSAGE" | jq -r '.Messages[0].Body')
    RECEIPT_HANDLE=$(echo "$MESSAGE" | jq -r '.Messages[0].ReceiptHandle')

    if [[ "$BODY" != "null" ]] && [[ "$RECEIPT_HANDLE" != "null" ]]; then
        log_debug "Re-queuing message: $BODY"

        # Send message back to main queue
        if ! aws sqs send-message \
            --region "$REGION" \
            --queue-url "$MAIN_QUEUE_URL" \
            --message-body "$BODY" > /tmp/recover-failed-recipes.log 2>&1; then
            die "Failed to re-queue message. See /tmp/recover-failed-recipes.log for details."
        fi

        # Delete from DLQ
        if ! aws sqs delete-message \
            --region "$REGION" \
            --queue-url "$DLQ_URL" \
            --receipt-handle "$RECEIPT_HANDLE" > /tmp/recover-failed-recipes.log 2>&1; then
            die "Failed to delete message from DLQ. See /tmp/recover-failed-recipes.log for details."
        fi

        log_debug "Message re-queued successfully"
    else
        log_error "Failed to extract message data"
    fi

    # Small delay to avoid rate limiting
    sleep 1
done

log_success "Recipe recovery completed! Processed $MSG_COUNT messages"
