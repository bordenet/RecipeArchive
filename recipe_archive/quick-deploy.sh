#!/bin/bash

################################################################################
#
# RecipeArchive Quick Flutter Web Deployment Script
#
# PURPOSE:
#   This script provides a fast way to deploy an existing Flutter web build
#   to S3 and invalidate the CloudFront cache. It skips the build step,
#   making it ideal for situations where the application has already been
#   built and only a deployment is needed.
#
# USAGE:
#   ./quick-deploy.sh
#
# HOW IT WORKS:
#   1.  Checks for the existence of the `build/web` directory.
#   2.  Syncs the contents of `build/web` to the specified S3 bucket.
#   3.  Creates a CloudFront invalidation to purge the cache.
#
# DEPENDENCIES:
#   - AWS CLI (configured with appropriate permissions)
#
# NOTES:
#   - This script is intended to be run from the `recipe_archive` directory.
#   - It assumes that `flutter build web` has already been run.
#
################################################################################

# Quick Flutter Web Deployment (No build, just deploy existing build/web)
# Use this when you've already run 'flutter build web' and just need to deploy + invalidate

set -e

S3_BUCKET="recipearchive-web-app-prod-990537043943"
CLOUDFRONT_DISTRIBUTION_ID="E1D19F7SLOJM5H"

echo "🚀 Quick deploying existing build to S3 and invalidating CloudFront..."

# Check if build exists
if [ ! -d "build/web" ]; then
    echo "❌ No build/web directory found. Run 'flutter build web' first or use './deploy.sh'"
    exit 1
fi

# Deploy to S3
aws s3 sync build/web/ s3://${S3_BUCKET}/ --delete

# Invalidate CloudFront
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/*" --query 'Invalidation.Id' --output text)

echo "✅ Deployed and invalidated CloudFront (${INVALIDATION_ID})"
echo "🌐 https://d1jcaphz4458q7.cloudfront.net"