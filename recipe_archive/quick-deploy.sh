#!/bin/bash

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