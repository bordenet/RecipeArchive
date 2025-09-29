#!/bin/bash

################################################################################
#
# Deploy Multi-Tenant User Provisioning System
#
# This script deploys all components needed for multi-tenant functionality.
#
# USAGE:
#   ./deploy-multi-tenant.sh [dev|prod]
#
# DEPENDENCIES:
#   - AWS CLI
#   - Go
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires the .env file to be present in the root of the repository.
#
################################################################################

# Deploy Multi-Tenant User Provisioning System
# This script deploys all components needed for multi-tenant functionality

set -e

# Configuration
ENVIRONMENT=${1:-dev}

# Load environment variables from repo root
if [ -f "./.env" ]; then
    export $(cat ./.env | grep -v '^#' | grep -v '^$' | xargs)
else
    echo "❌ .env file not found in repo root. Please create one from .env.example"
    exit 1
fi

AWS_REGION=${AWS_REGION:-us-west-2}
STACK_PREFIX="recipearchive-${ENVIRONMENT}"

echo "🚀 Deploying RecipeArchive Multi-Tenant System"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists aws; then
    echo "❌ AWS CLI not found. Please install: https://aws.amazon.com/cli/"
    exit 1
fi

if ! command_exists go; then
    echo "❌ Go not found. Please install Go 1.19+"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS credentials not configured. Please run 'aws configure'"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Step 1: Deploy DynamoDB Tables
echo "📊 Step 1: Deploying DynamoDB Tables..."

if ! aws cloudformation deploy \
    --template-file aws-backend/infrastructure/dynamodb-tables.yaml \
    --stack-name "${STACK_PREFIX}-tables" \
    --parameter-overrides Environment="$ENVIRONMENT" \
    --region "$AWS_REGION" \
    --capabilities CAPABILITY_IAM > /tmp/deploy-multi-tenant.log 2>&1; then
    echo "❌ Failed to deploy DynamoDB tables. See /tmp/deploy-multi-tenant.log for details."
    exit 1
fi
echo "✅ DynamoDB tables deployed successfully"

echo ""

# Step 2: Build and Deploy Lambda Functions
echo "🔨 Step 2: Building Lambda Functions..."

./scripts/build-lambda-packages.sh invitation-manager-s3
./scripts/build-lambda-packages.sh registration-handler

echo "✅ Lambda functions built successfully"
echo ""

# Step 3: Deploy Lambda Functions
echo "🚀 Step 3: Deploying Lambda Functions..."

./scripts/deploy-lambda.sh invitation-manager-s3
./scripts/deploy-lambda.sh registration-handler

echo "✅ Lambda functions deployed successfully"
echo ""

# Step 4: Configure API Gateway Routes
echo "🌐 Step 4: Configuring API Gateway Routes..."

./scripts/manage-api-routes.sh add-analytics

echo "✅ API Gateway routes configured successfully"
echo ""

# Step 5: Cleanup build artifacts
echo "🧹 Step 5: Cleaning up build artifacts..."
rm -rf aws-backend/functions/dist

echo "✅ Cleanup completed"
echo ""

# Step 6: Output deployment summary
echo "📋 Deployment Summary"
echo "===================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""
echo "📊 DynamoDB Tables:"
echo "  - ${ENVIRONMENT}-InvitationTokens"
echo "  - ${ENVIRONMENT}-UserProfiles"
echo "  - ${ENVIRONMENT}-UsageTracking"
echo ""
echo "🔧 Lambda Functions:"
echo "  - ${STACK_PREFIX}-invitation-manager-s3"

echo "  - ${STACK_PREFIX}-registration-handler"
echo ""
echo "📝 Next Steps:"
echo "1. Configure SES (Simple Email Service) for invitation emails"
echo "2. Update API Gateway routes (if not done automatically)"
echo "3. Test invitation flow end-to-end"
echo "4. Update Flutter app with developer settings"
echo ""
echo "🎉 Multi-tenant deployment completed successfully!"

# Optional: Run basic health checks
echo ""
echo "🔍 Running basic health checks..."

# Check if tables exist
for table in "InvitationTokens" "UserProfiles" "UsageTracking"; do
    if aws dynamodb describe-table --table-name "${ENVIRONMENT}-${table}" --region "$AWS_REGION" >/dev/null 2>&1; then
        echo "✅ Table ${ENVIRONMENT}-${table} is active"
    else
        echo "❌ Table ${ENVIRONMENT}-${table} not found"
    fi
done

# Check if functions exist
for func in "${STACK_PREFIX}-invitation-manager-s3" "${STACK_PREFIX}-registration-handler"; do
    if aws lambda get-function --function-name "$func" --region "$AWS_REGION" >/dev/null 2>&1; then
        echo "✅ Function $func is deployed"
    else
        echo "❌ Function $func not found"
    fi
done

echo ""
echo "🚀 Deployment verification completed!"

echo ""
echo "🔗 Useful Commands:"
echo "   View tables: aws dynamodb list-tables --region $AWS_REGION"
echo "   View functions: aws lambda list-functions --region $AWS_REGION"
echo "   View logs: aws logs tail /aws/lambda/${STACK_PREFIX}-invitation-manager-s3 --follow"
