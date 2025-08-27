#!/bin/bash
# Test S3 access and upload a sample recipe for testing the recipe reporting tool

set -e

BUCKET_NAME="recipearchive-storage-dev-990537043943"
USER_ID="mattbordenet_at_hotmail_dot_com"
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
echo "$SAMPLE_RECIPE" | aws s3 cp - "s3://$BUCKET_NAME/$RECIPE_KEY" --content-type "application/json"

echo "✅ Sample recipe created: $RECIPE_KEY"

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
echo "$SAMPLE_FAILURE" | aws s3 cp - "s3://$BUCKET_NAME/$FAILURE_KEY" --content-type "application/json"

echo "✅ Sample parsing failure created: $FAILURE_KEY"

echo ""
echo "🎉 Test data created successfully!"
echo "📊 Now run the recipe reporting tool to see the results:"
echo "   cd tools/recipe-report"
echo "   ./recipe-report -user mattbordenet@hotmail.com -password Recipe123"