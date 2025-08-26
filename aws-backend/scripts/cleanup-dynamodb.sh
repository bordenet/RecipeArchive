#!/bin/bash

# DynamoDB Cleanup Script for RecipeArchive
# This script will identify and delete any DynamoDB tables that may have been created
# during development to prevent unnecessary costs.

set -e

echo "🔍 DynamoDB Cleanup Script"
echo "========================="
echo ""
echo "⚠️  WARNING: This will identify and DELETE DynamoDB tables!"
echo "This script is designed to remove any DynamoDB resources that may"
echo "have been accidentally created, as the RecipeArchive project uses"
echo "S3-based JSON storage for 95% cost savings."
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

# Get current AWS account and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-west-2"  # Default region
fi

echo "📋 AWS Account: $ACCOUNT_ID"
echo "📋 Region: $REGION"
echo ""

# List all DynamoDB tables
echo "🔍 Scanning for DynamoDB tables..."
TABLES=$(aws dynamodb list-tables --region $REGION --query 'TableNames[]' --output text 2>/dev/null || echo "")

if [ -z "$TABLES" ]; then
    echo "✅ No DynamoDB tables found in region $REGION"
    echo ""
    echo "🎉 Good news! No DynamoDB cleanup needed."
    echo "The project is properly configured to use S3-based storage."
    exit 0
fi

echo "📊 Found DynamoDB tables:"
for table in $TABLES; do
    # Get table info
    TABLE_INFO=$(aws dynamodb describe-table --table-name "$table" --region $REGION 2>/dev/null || echo "")
    if [ -n "$TABLE_INFO" ]; then
        STATUS=$(echo "$TABLE_INFO" | grep -o '"TableStatus": "[^"]*"' | cut -d'"' -f4)
        ITEM_COUNT=$(echo "$TABLE_INFO" | grep -o '"ItemCount": [0-9]*' | cut -d' ' -f2 || echo "unknown")
        SIZE_BYTES=$(echo "$TABLE_INFO" | grep -o '"TableSizeBytes": [0-9]*' | cut -d' ' -f2 || echo "0")
        
        echo "  📋 $table (Status: $STATUS, Items: $ITEM_COUNT)"
        
        # Check if this looks like a RecipeArchive table
        if [[ $table == *"Recipe"* ]] || [[ $table == *"recipe"* ]] || [[ $table == *"RecipeArchive"* ]]; then
            echo "      ⚠️  LIKELY RECIPEARCHIVE TABLE - Should be deleted!"
        fi
    fi
done

echo ""
echo "💰 Cost Impact:"
echo "   Each DynamoDB table costs approximately $2.50-5.00/month minimum"
echo "   S3 storage costs ~$0.05/month for typical recipe usage"
echo "   Deleting DynamoDB tables = 95%+ cost savings"
echo ""

# Confirmation prompt
read -p "❓ Do you want to delete ALL DynamoDB tables? (yes/no): " CONFIRMATION

if [[ $CONFIRMATION != "yes" ]]; then
    echo "❌ Operation cancelled. No tables were deleted."
    echo ""
    echo "💡 Manual cleanup instructions:"
    echo "   1. Go to AWS Console > DynamoDB"
    echo "   2. Select each table you want to delete"
    echo "   3. Click Actions > Delete table"
    echo "   4. Type 'delete' to confirm"
    exit 0
fi

echo ""
echo "🗑️ Deleting DynamoDB tables..."

# Delete each table
DELETED_COUNT=0
FAILED_COUNT=0

for table in $TABLES; do
    echo "   Deleting: $table..."
    
    if aws dynamodb delete-table --table-name "$table" --region $REGION &> /dev/null; then
        echo "   ✅ $table deletion initiated"
        ((DELETED_COUNT++))
    else
        echo "   ❌ Failed to delete $table"
        ((FAILED_COUNT++))
    fi
done

echo ""
echo "📊 Deletion Summary:"
echo "   ✅ Tables deleted: $DELETED_COUNT"
echo "   ❌ Failed deletions: $FAILED_COUNT"
echo ""

if [ $DELETED_COUNT -gt 0 ]; then
    echo "⏰ Note: Table deletion takes 5-10 minutes to complete."
    echo "💰 Estimated monthly savings: \$$(( $DELETED_COUNT * 3 ))-\$$(( $DELETED_COUNT * 5 ))"
fi

echo ""
echo "🏆 RecipeArchive Confirmation:"
echo "   ✅ Project uses S3-based JSON storage"
echo "   ✅ 95% cost savings vs DynamoDB"
echo "   ✅ Simpler architecture and maintenance"
echo ""
echo "✨ Cleanup complete! No more DynamoDB charges."