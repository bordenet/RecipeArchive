#!/bin/bash

################################################################################
#
# RecipeArchive Flutter Web App Deployment Script
#
# This script builds and deploys the Flutter web app to CloudFront via S3.
#
# USAGE:
#   ./deploy-web-app.sh
#
# DEPENDENCIES:
#   - Flutter
#   - AWS CLI
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires the .env file to be present in the root of the repository.
#
################################################################################

# RecipeArchive Flutter Web App Deployment Script
# Builds and deploys the Flutter web app to CloudFront via S3

set -e

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables from repo root using the proper load script
if [ -f "$REPO_ROOT/.env" ]; then
    echo "🔧 Loading environment variables..."
    source "$REPO_ROOT/scripts/load-env.sh"
else
    echo "❌ .env file not found in repo root. Please create one from .env.example"
    exit 1
fi

# Configuration from environment variables with fallbacks
DISTRIBUTION_ID=${CLOUDFRONT_DISTRIBUTION_ID:-"E1D19F7SLOJM5H"}
S3_BUCKET=${S3_BUCKET:-"recipearchive-web-app-prod-990537043943"}
CLOUDFRONT_URL=${CLOUDFRONT_URL:-"https://d1jcaphz4458q7.cloudfront.net"}

# Verify AWS credentials are available
echo "🔍 Verifying AWS credentials..."
if ! aws sts get-caller-identity > /tmp/deploy-web-app.log 2>&1; then
    echo "❌ AWS credentials not configured or invalid"
    echo "💡 Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env"
    echo "💡 Or configure AWS CLI with 'aws configure'"
    exit 1
fi
echo "✅ AWS credentials verified"
APP_DIR="recipe_archive"

echo "🚀 Deploying RecipeArchive Flutter Web App to CloudFront"
echo "=========================================================="
echo ""

# Check prerequisites
if ! command -v flutter > /tmp/deploy-web-app.log 2>&1; then
    echo "❌ Flutter is not installed. Please install Flutter first."
    exit 1
fi

if ! command -v aws > /tmp/deploy-web-app.log 2>&1; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if S3 bucket exists, create if it doesn't
echo "🔍 Checking S3 bucket existence..."
if ! aws s3 ls "s3://$S3_BUCKET" > /tmp/deploy-web-app.log 2>&1; then
    echo "🏗️  Creating S3 bucket: $S3_BUCKET"
    aws s3 mb "s3://$S3_BUCKET" --region us-west-2

    echo "🌐 Configuring bucket for static website hosting..."
aws s3 website "s3://$S3_BUCKET" \
        --index-document index.html \
        --error-document index.html

    echo "✅ S3 bucket created and configured"
else
    echo "✅ S3 bucket already exists"
fi
echo ""

# Build Flutter web app
echo "📦 Building Flutter web app for production..."
cd "$REPO_ROOT/$APP_DIR"

# Use compatibility flags to avoid build issues
echo "🔧 Building with compatibility flags..."
if ! flutter build web --release --no-tree-shake-icons --no-wasm-dry-run > /tmp/deploy-web-app.log 2>&1; then
    echo "❌ Flutter build failed. See /tmp/deploy-web-app.log for details."
    echo "💡 Try: flutter clean && flutter pub get"
    echo "💡 Then: flutter build web --release --no-tree-shake-icons"
    exit 1
fi

echo "✅ Flutter web app built successfully"
echo ""

# Build and package extensions with latest configurations
echo "🔧 Building and packaging browser extensions..."
cd "$REPO_ROOT"

# Build extensions with latest parser fixes and configurations
echo "📦 Building extensions with latest parsers..."
if ! npm run build:extensions > /tmp/deploy-web-app.log 2>&1; then
    echo "❌ Extension build failed. See /tmp/deploy-web-app.log for details."
    exit 1
fi

# Package extensions with semantic versioning and upload to S3
echo "📋 Packaging extensions with semantic versioning..."
if ! ./scripts/package-extensions.sh > /tmp/deploy-web-app.log 2>&1; then
    echo "❌ Extension packaging failed. See /tmp/deploy-web-app.log for details."
    exit 1
fi

echo "✅ Extensions built, packaged and uploaded successfully"
echo ""

# Deploy to S3
echo "☁️  Uploading to S3..."
if ! aws s3 sync "$REPO_ROOT/$APP_DIR/build/web/" s3://$S3_BUCKET/ --delete > /tmp/deploy-web-app.log 2>&1; then
    echo "⚠️  S3 upload encountered issues. Retrying with timeout adjustments..."
    if ! aws s3 sync "$REPO_ROOT/$APP_DIR/build/web/" s3://$S3_BUCKET/ --delete \
        --cli-read-timeout 0 --cli-connect-timeout 60 > /tmp/deploy-web-app.log 2>&1; then
        echo "❌ S3 upload failed. See /tmp/deploy-web-app.log for details."
        exit 1
    fi
fi

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
# Get actual extension versions from manifest files
CHROME_VERSION=$(grep '"version":' "$REPO_ROOT/extensions/chrome/manifest.json" | sed 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/' || echo "unknown")
SAFARI_VERSION=$(grep '"version":' "$REPO_ROOT/extensions/safari/manifest.json" | sed 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/' || echo "unknown")

echo ""
echo "🎉 Deployment successful!"
echo "📍 Web app URL: $CLOUDFRONT_URL"
echo ""
echo "Extension distribution features are now live:"
echo "• Navigate to the hamburger menu → Browser Extensions"
echo "• Download Chrome extension: Chrome v$CHROME_VERSION"
echo "• Download Safari extension: Safari v$SAFARI_VERSION"
