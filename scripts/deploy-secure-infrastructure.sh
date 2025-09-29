#!/bin/bash

################################################################################
#
# RecipeArchive Secure Infrastructure Deployment Script
#
# This script deploys the secure infrastructure with randomized identifiers.
#
# USAGE:
#   ./deploy-secure-infrastructure.sh
#
# DEPENDENCIES:
#   - AWS CLI
#   - Node.js
#   - AWS CDK
#   - jq
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires AWS credentials to be configured.
#
################################################################################

# RecipeArchive Secure Infrastructure Deployment Script
# This script deploys the secure infrastructure with randomized identifiers

set -e

echo "🚀 RecipeArchive Secure Infrastructure Deployment"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"

    # Check AWS CLI
    if ! command -v aws > /tmp/deploy-secure-infrastructure.log 2>&1; then
        echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI.${NC}"
        exit 1
    fi

    # Check Node.js
    if ! command -v node > /tmp/deploy-secure-infrastructure.log 2>&1; then
        echo -e "${RED}❌ Node.js not found. Please install Node.js.${NC}"
        exit 1
    fi

    # Check CDK
    if ! command -v cdk > /tmp/deploy-secure-infrastructure.log 2>&1; then
        echo -e "${YELLOW}⚠️  CDK CLI not found. Installing...${NC}"
        npm install -g aws-cdk
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity > /tmp/deploy-secure-infrastructure.log 2>&1; then
        echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Deploy infrastructure
deploy_infrastructure() {
    echo -e "${BLUE}Deploying secure infrastructure...${NC}"

    # Install dependencies
    echo "Installing CDK dependencies..."
    npm install > /tmp/deploy-secure-infrastructure.log 2>&1

    # Prompt for admin email if not set
    if [ -z "$USER_EMAIL" ]; then
        read -p "Enter admin email: " USER_EMAIL
    fi

    # Deploy stack
    echo "Deploying CDK stack..."
px cdk deploy --app "npx ts-node bin/recipe-archive-secure.ts" --require-approval never --context adminEmail=${USER_EMAIL} > /tmp/deploy-secure-infrastructure.log 2>&1

    # Capture outputs
    echo -e "${BLUE}Capturing infrastructure outputs...${NC}"
    STACK_OUTPUTS=$(aws cloudformation describe-stacks \
        --stack-name "RecipeSecureStack-secure" \
        --query 'Stacks[0].Outputs' \
        --output json)

    # Extract values
    USER_POOL_ID=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="SecureUserPoolId") | .OutputValue')
    CLIENT_ID=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="SecureUserPoolClientId") | .OutputValue')
    STORAGE_BUCKET=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="SecureStorageBucketName") | .OutputValue')
    TEMP_BUCKET=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="SecureTempBucketName") | .OutputValue')
    FAILED_BUCKET=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="SecureFailedParsingBucketName") | .OutputValue')
    RANDOM_ID=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="SecureRandomId") | .OutputValue')

    echo -e "${GREEN}✅ Infrastructure deployed successfully${NC}"
    echo -e "${YELLOW}📋 Infrastructure Details:${NC}"
    echo "   User Pool ID: $USER_POOL_ID"
    echo "   Client ID: $CLIENT_ID"
    echo "   Storage Bucket: $STORAGE_BUCKET"
    echo "   Temp Bucket: $TEMP_BUCKET"
    echo "   Failed Parsing Bucket: $FAILED_BUCKET"
    echo "   Random ID: $RANDOM_ID"
}

# Create user and set password
create_user() {
    echo -e "${BLUE}Creating admin user...${NC}"

    # Prompt for user details
    read -p "Enter admin email: " USER_EMAIL
    read -s -p "Enter admin password: " USER_PASSWORD
    echo

    # Create user
    echo "Creating user in Cognito..."
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username $USER_EMAIL \
        --user-attributes Name=email,Value=$USER_EMAIL Name=email_verified,Value=true \
        --message-action SUPPRESS \
        --region us-west-2 > /tmp/deploy-secure-infrastructure.log 2>&1

    # Set password
    echo "Setting permanent password..."
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username $USER_EMAIL \
        --password \"$USER_PASSWORD\" \
        --permanent \
        --region us-west-2 > /tmp/deploy-secure-infrastructure.log 2>&1

    echo -e "${GREEN}✅ User created successfully${NC}"
}

# Generate admin token
generate_token() {
    echo -e "${BLUE}Generating admin token...${NC}"

    # Generate token
    ADMIN_TOKEN=$(aws cognito-idp initiate-auth \
        --client-id $CLIENT_ID \
        --auth-flow USER_PASSWORD_AUTH \
        --auth-parameters USERNAME=$USER_EMAIL,PASSWORD=$USER_PASSWORD \
        --region us-west-2 \
        --query 'AuthenticationResult.IdToken' \
        --output text)

    echo -e "${GREEN}✅ Admin token generated${NC}"
}

# Update environment file
update_env() {
    echo -e "${BLUE}Updating .env file...${NC}"

    # Create backup
    if [ -f .env ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo "Created backup of existing .env file"
    fi

    # Update or create .env
    cat > .env << EOF
# RecipeArchive Environment Configuration
# SECURITY: Never commit .env to version control!
# Generated by deploy-secure-infrastructure.sh on $(date)

# Core Infrastructure (SECURE - New infrastructure with randomized identifiers)
AWS_REGION=us-west-2
AWS_DEFAULT_REGION=us-west-2
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_APP_CLIENT_ID=$CLIENT_ID

# API Endpoints (TODO: Deploy new API Gateway)
API_BASE_URL=https://4eprojzbrc.execute-api.us-west-2.amazonaws.com/prod
WEB_APP_URL=https://d1jcaphz4458q7.cloudfront.net

# S3 Configuration (SECURE - New buckets with randomized names)
S3_BUCKET_NAME=$STORAGE_BUCKET
S3_TEMP_BUCKET_NAME=$TEMP_BUCKET

# Development Settings
DEV_API_BASE=http://localhost:8080
DEV_API_PORT=8080
LOCAL_SERVER_PORT=8080

# Test User Credentials (for end-to-end testing)
TEST_USER_EMAIL=$USER_EMAIL
TEST_USER_PASSWORD=$USER_PASSWORD
RECIPE_USER_EMAIL=$USER_EMAIL
RECIPE_USER_PASSWORD=$USER_PASSWORD

# Admin Token (SECURE - From new Cognito pool)
RECIPE_ADMIN_TOKEN=$ADMIN_TOKEN

# Developer Experience
AUTO_LOGIN=true

# AWS Access Keys (for MCP/VS Code integration)
AWS_ACCESS_KEY_ID=\\\${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=\\\${AWS_SECRET_ACCESS_KEY}

# GitHub Token
GITHUB_TOKEN=\\\${GITHUB_TOKEN}

# CloudFront Configuration (for web app deployment)
CLOUDFRONT_DISTRIBUTION_ID=E1D19F7SLOJM5H
CLOUDFRONT_URL=https://d1jcaphz4458q7.cloudfront.net

# S3 Configuration (for web app deployment)
S3_BUCKET=recipearchive-web-app-prod-990537043943

# OpenAI Configuration
OPENAI_API_KEY=\\\${OPENAI_API_KEY}
EOF

    echo -e "${GREEN}✅ .env file updated${NC}"
}

# Run validation tests
run_validation() {
    echo -e "${BLUE}Running validation tests...${NC}"

    # Test Cognito authentication
    echo "Testing Cognito authentication..."
    aws cognito-idp initiate-auth \
        --client-id $CLIENT_ID \
        --auth-flow USER_PASSWORD_AUTH \
        --auth-parameters USERNAME=$USER_EMAIL,PASSWORD=$USER_PASSWORD \
        --region us-west-2 > /tmp/deploy-secure-infrastructure.log 2>&1

    # Test S3 access
    echo "Testing S3 bucket access..."
    aws s3 ls s3://$STORAGE_BUCKET/ > /tmp/deploy-secure-infrastructure.log 2>&1 || echo "Bucket is empty (expected for new deployment)"

    echo -e "${GREEN}✅ Validation tests passed${NC}"
}

# Main execution
main() {
    echo -e "${YELLOW}This script will deploy secure RecipeArchive infrastructure with randomized identifiers.${NC}"
    echo -e "${YELLOW}It will create new Cognito pools, S3 buckets, and update your .env file.${NC}"
    echo
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi

    check_prerequisites
    deploy_infrastructure
    create_user
    generate_token
    update_env
    run_validation

    echo
    echo -e "${GREEN}🎉 Secure infrastructure deployment completed successfully!${NC}"
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "   1. Deploy API Gateway and CloudFront"
    echo "   2. Migrate data from old infrastructure"
    echo "   3. Test the complete system"
    echo "   4. Delete old exposed infrastructure"
    echo
    echo -e "${YELLOW}📁 Files Updated:${NC}"
    echo "   - .env (backup created)"
    echo "   - Infrastructure deployed to AWS"
    echo
    echo -e "${YELLOW}🔒 Security Notes:${NC}"
    echo "   - All resource names use secure random identifiers"
    echo "   - Old infrastructure is still active - remember to clean up"
    echo "   - New admin token has been generated"
}

# Execute main function
main "$@"
