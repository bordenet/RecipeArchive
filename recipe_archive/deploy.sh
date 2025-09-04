#!/bin/bash

# RecipeArchive Flutter Web Deployment Script
# Builds, deploys to S3, and invalidates CloudFront cache automatically

set -e  # Exit on any error

# Configuration
S3_BUCKET="recipearchive-web-app-prod-990537043943"
CLOUDFRONT_DISTRIBUTION_ID="E1D19F7SLOJM5H"
CLOUDFRONT_URL="https://d1jcaphz4458q7.cloudfront.net"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 RecipeArchive Flutter Web Deployment${NC}"
echo "======================================"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Step 1: Clean previous build
echo -e "${YELLOW}🧹 Cleaning previous build...${NC}"
if [ -d "build/web" ]; then
    rm -rf build/web
fi

# Step 2: Build Flutter web app
echo -e "${YELLOW}🔨 Building Flutter web app...${NC}"
flutter build web --release

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Flutter build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Flutter build completed successfully${NC}"

# Step 3: Deploy to S3
echo -e "${YELLOW}☁️  Deploying to S3 (${S3_BUCKET})...${NC}"
aws s3 sync build/web/ s3://${S3_BUCKET}/ --delete --cache-control "public, max-age=86400"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ S3 deployment failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ S3 deployment completed successfully${NC}"

# Step 4: Create CloudFront invalidation
echo -e "${YELLOW}🔄 Creating CloudFront invalidation...${NC}"
INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/*" --output json)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ CloudFront invalidation failed!${NC}"
    exit 1
fi

INVALIDATION_ID=$(echo $INVALIDATION_OUTPUT | jq -r '.Invalidation.Id')
echo -e "${GREEN}✅ CloudFront invalidation created: ${INVALIDATION_ID}${NC}"

# Step 5: Wait for invalidation to complete (optional)
echo -e "${YELLOW}⏳ Checking invalidation status...${NC}"
while true; do
    STATUS=$(aws cloudfront get-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --id ${INVALIDATION_ID} --query 'Invalidation.Status' --output text)
    
    if [ "$STATUS" = "Completed" ]; then
        echo -e "${GREEN}✅ CloudFront invalidation completed!${NC}"
        break
    elif [ "$STATUS" = "InProgress" ]; then
        echo -e "${BLUE}⏳ Invalidation in progress... waiting 10 seconds${NC}"
        sleep 10
    else
        echo -e "${RED}❌ Unexpected invalidation status: ${STATUS}${NC}"
        break
    fi
done

# Step 6: Deployment summary
echo ""
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo "======================================"
echo -e "${BLUE}📱 App URL:${NC} ${CLOUDFRONT_URL}"
echo -e "${BLUE}🗂️  S3 Bucket:${NC} ${S3_BUCKET}"
echo -e "${BLUE}🌐 CloudFront Distribution:${NC} ${CLOUDFRONT_DISTRIBUTION_ID}"
echo -e "${BLUE}🔄 Invalidation ID:${NC} ${INVALIDATION_ID}"
echo ""
echo -e "${YELLOW}💡 Note: Changes may take 1-2 minutes to propagate globally${NC}"
echo -e "${YELLOW}🔄 Hard refresh your browser (Cmd+Shift+R / Ctrl+Shift+F5) to see changes${NC}"
echo ""