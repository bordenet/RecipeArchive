#!/bin/bash

# RecipeArchive Flutter Web App Deployment Script
# Builds and deploys the Flutter web app to CloudFront via S3

set -e

DISTRIBUTION_ID="E1D19F7SLOJM5H"
S3_BUCKET="recipearchive-web-app-prod-990537043943"
APP_DIR="recipe_archive_fresh"

echo "🚀 Deploying RecipeArchive Flutter Web App to CloudFront"
echo "=========================================================="
echo ""

# Check prerequisites
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed. Please install Flutter first."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Build Flutter web app
echo "📦 Building Flutter web app for production..."
cd $APP_DIR
flutter build web
cd ..

echo "✅ Flutter web app built successfully"
echo ""

# Deploy to S3
echo "☁️  Uploading to S3..."
aws s3 sync $APP_DIR/build/web/ s3://$S3_BUCKET/ --delete

echo "✅ Files uploaded to S3 successfully"
echo ""

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)

echo "📍 Invalidation ID: $INVALIDATION_ID"
echo "⏳ Waiting for cache invalidation to complete..."

# Wait for invalidation to complete
aws cloudfront wait invalidation-completed \
    --distribution-id $DISTRIBUTION_ID \
    --id $INVALIDATION_ID

echo "✅ Cache invalidation completed"
echo ""
echo "🎉 Deployment successful!"
echo "📍 Web app URL: https://d1jcaphz4458q7.cloudfront.net"
echo ""
echo "Extension distribution features are now live:"
echo "• Navigate to the hamburger menu → Browser Extensions"
echo "• Download Chrome extension: Chrome v0.2.0"
echo "• Download Safari extension: Safari v0.3.0"