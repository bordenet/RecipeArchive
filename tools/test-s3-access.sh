#!/bin/bash

################################################################################
#
# Test S3 Access and Upload Sample Data
#
# This script tests access to the S3 bucket and uploads a sample recipe and a
# sample parsing failure. This is useful for testing the recipe reporting tool.
#
# USAGE:
#   ./test-s3-access.sh
#
# ENVIRONMENT VARIABLES:
#   - S3_BUCKET_NAME: The name of the S3 bucket to use for testing.
#   - RECIPE_USER_EMAIL: The email address of the user to create the test data for.
#   - RECIPE_USER_PASSWORD: The password for the user.
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires the AWS CLI to be installed and configured.
#
################################################################################

set -e

# Check for required environment variables
if [ -z "$S3_BUCKET_NAME" ] || [ -z "$RECIPE_USER_EMAIL" ] || [ -z "$RECIPE_USER_PASSWORD" ]; then
    echo "❌ Missing required environment variables: S3_BUCKET_NAME, RECIPE_USER_EMAIL, RECIPE_USER_PASSWORD"
    echo "💡 Please set them in your environment or in a .env file."
    exit 1
fi

BUCKET_NAME="$S3_BUCKET_NAME"
USER_ID=$(echo "$RECIPE_USER_EMAIL" | sed 's/@/_at_/' | sed 's/\./_dot_/g')
TEST_RECIPE_ID="test-recipe-$(date +%s)"

echo "🧪 Testing S3 Access and Creating Sample Recipe"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if AWS credentials are configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS credentials not configured"
    echo "💡 Please run: aws configure"
    exit 1
fi

echo "✅ AWS credentials configured"

# Check bucket access
if ! aws s3 ls "s3://$BUCKET_NAME/" > /dev/null 2>&1; then
    echo "❌ Cannot access S3 bucket: $BUCKET_NAME"
    echo "💡 Check bucket name and permissions"
    exit 1
fi

echo "✅ S3 bucket accessible: $BUCKET_NAME"

# Create a sample recipe for testing
SAMPLE_RECIPE=$(cat <<EOF
{
  "id": "$TEST_RECIPE_ID",
  "title": "Test Chocolate Chip Cookies",
  "userId": "$USER_ID",
  "attributionUrl": "https://smittenkitchen.com/test-recipe",
  "ingredients": [
    "2 cups flour",
    "1 cup butter", 
    "1 cup chocolate chips"
  ],
  "steps": [
    "Mix ingredients",
    "Bake for 12 minutes"
  ],
  "servingSize": "24 cookies",
  "prepTime": "15 minutes",
  "cookTime": "12 minutes",
  "photos": [],
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF
)

# Upload the sample recipe
RECIPE_KEY="recipes/$USER_ID/$TEST_RECIPE_ID.json"
if echo "$SAMPLE_RECIPE" | aws s3 cp - "s3://$BUCKET_NAME/$RECIPE_KEY" --content-type "application/json"; then
    echo "✅ Sample recipe created: $RECIPE_KEY"
else
    echo "❌ Failed to upload sample recipe to S3."
    exit 1
fi

# Create a sample parsing failure for testing
SAMPLE_FAILURE=$(cat <<EOF
{
  "url": "https://example.com/failed-recipe",
  "attemptedTitle": "Failed Recipe Extraction",
  "error": "Could not find recipe structured data",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF
)

FAILURE_KEY="parsing-failures/$USER_ID/$(date +%s)-example_dot_com.json"
if echo "$SAMPLE_FAILURE" | aws s3 cp - "s3://$BUCKET_NAME/$FAILURE_KEY" --content-type "application/json"; then
    echo "✅ Sample parsing failure created: $FAILURE_KEY"
else
    echo "❌ Failed to upload sample parsing failure to S3."
    exit 1
fi

echo ""
echo "🎉 Test data created successfully!"
echo "📊 Now run the recipe reporting tool to see the results:"
echo "   cd tools/content-ops"
echo "   ./content-ops -user $RECIPE_USER_EMAIL -password $RECIPE_USER_PASSWORD"