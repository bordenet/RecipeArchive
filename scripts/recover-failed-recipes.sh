#!/bin/bash

################################################################################
#
# Recover Failed Recipe Normalizations Script
#
# This script recovers failed recipe normalizations from the DLQ.
#
# USAGE:
#   ./recover-failed-recipes.sh
#
# DEPENDENCIES:
#   - AWS CLI
#   - jq
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires the .env file to be present in the root of the repository with
#     the following variables:
#       - NORMALIZATION_DLQ_URL: The URL of the recipe normalization DLQ.
#       - NORMALIZATION_QUEUE_URL: The URL of the recipe normalization queue.
#       - AWS_REGION: The AWS region.
#
################################################################################

# Script to recover failed recipe normalizations from DLQ

set -e

# Load environment variables from repo root
if [ -f "./.env" ]; then
    export $(cat ./.env | grep -v '^#' | grep -v '^$' | xargs)
fi

DLQ_URL=${NORMALIZATION_DLQ_URL}
MAIN_QUEUE_URL=${NORMALIZATION_QUEUE_URL}
REGION=${AWS_REGION:-us-west-2}

if [ -z "$DLQ_URL" ] || [ -z "$MAIN_QUEUE_URL" ]; then
    echo "❌ Missing required environment variables: NORMALIZATION_DLQ_URL, NORMALIZATION_QUEUE_URL"
    echo "💡 Please set them in your environment or in a .env file."
    exit 1
fi

echo "🔧 Recovering failed recipe normalizations from DLQ..."

# Get the number of messages in DLQ
MSG_COUNT=$(aws sqs get-queue-attributes --region $REGION --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text)

echo "📋 Found $MSG_COUNT messages in DLQ"

if [ "$MSG_COUNT" -eq 0 ]; then
    echo "✅ No messages to recover"
    exit 0
fi

# Process each message
for i in $(seq 1 $MSG_COUNT); do
    echo "Processing message $i/$MSG_COUNT..."
    
    # Receive a message from DLQ
    MESSAGE=$(aws sqs receive-message --region $REGION --queue-url $DLQ_URL --max-number-of-messages 1)
    
    if [ -z "$MESSAGE" ] || [ "$MESSAGE" == "null" ]; then
        echo "No more messages to process"
        break
    fi
    
    # Extract body and receipt handle
    BODY=$(echo $MESSAGE | jq -r '.Messages[0].Body')
    RECEIPT_HANDLE=$(echo $MESSAGE | jq -r '.Messages[0].ReceiptHandle')
    
    if [ "$BODY" != "null" ] && [ "$RECEIPT_HANDLE" != "null" ]; then
        echo "📤 Re-queuing message: $BODY"
        
        # Send message back to main queue for retry
        if ! aws sqs send-message --region $REGION --queue-url $MAIN_QUEUE_URL --message-body "$BODY" > /tmp/recover-failed-recipes.log 2>&1; then
            echo "❌ Failed to re-queue message. See /tmp/recover-failed-recipes.log for details."
            exit 1
        fi
        
        # Delete from DLQ
        if ! aws sqs delete-message --region $REGION --queue-url $DLQ_URL --receipt-handle "$RECEIPT_HANDLE" > /tmp/recover-failed-recipes.log 2>&1; then
            echo "❌ Failed to delete message from DLQ. See /tmp/recover-failed-recipes.log for details."
            exit 1
        fi
        
        echo "✅ Message re-queued successfully"
    else
        echo "❌ Failed to extract message data"
    fi
    
    # Small delay to avoid rate limiting
    sleep 1
done

echo "🎉 Recipe recovery completed!"