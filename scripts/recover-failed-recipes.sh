#!/bin/bash

# Script to recover failed recipe normalizations from DLQ

DLQ_URL="https://sqs.us-west-2.amazonaws.com/990537043943/recipe-normalization-dlq-dev"
MAIN_QUEUE_URL="https://sqs.us-west-2.amazonaws.com/990537043943/recipe-normalization-dev"
REGION="us-west-2"

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
        aws sqs send-message --region $REGION --queue-url $MAIN_QUEUE_URL --message-body "$BODY"
        
        # Delete from DLQ
        aws sqs delete-message --region $REGION --queue-url $DLQ_URL --receipt-handle "$RECEIPT_HANDLE"
        
        echo "✅ Message re-queued successfully"
    else
        echo "❌ Failed to extract message data"
    fi
    
    # Small delay to avoid rate limiting
    sleep 1
done

echo "🎉 Recipe recovery completed!"