#!/bin/bash

# RecipeArchive AWS Infrastructure Deployment Script
# This script guides you through the complete AWS setup process

set -e  # Exit on any error

echo "🍽️  RecipeArchive AWS Infrastructure Setup"
echo "==========================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "⚠️  AWS CDK is not installed. Installing it now..."
    npm install -g aws-cdk
fi

echo "✅ Prerequisites check completed"
echo ""

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run:"
    echo "   aws configure"
    echo "   Enter your Access Key ID, Secret Access Key, and region (us-west-2)"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

echo "✅ AWS credentials configured"
echo "   Account ID: $AWS_ACCOUNT_ID"
echo "   Region: $AWS_REGION"
echo ""

# Create environment file
echo "📝 Creating environment configuration..."
cd aws-backend

if [ ! -f .env ]; then
    cp .env.template .env
    sed -i.bak "s/your-aws-account-id-here/$AWS_ACCOUNT_ID/g" .env
    rm .env.bak
    echo "✅ Created .env file with your AWS account ID"
    echo "⚠️  Please review aws-backend/.env and update any other values as needed"
else
    echo "✅ Environment file already exists"
fi

# Install CDK dependencies
echo ""
echo "📦 Installing CDK dependencies..."
cd infrastructure
npm install

echo "✅ Dependencies installed"
echo ""

# Bootstrap CDK (if not already done)
echo "🚀 Bootstrapping CDK..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION &> /dev/null; then
    echo "⚠️  CDK not bootstrapped. Bootstrapping now..."
    cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
    echo "✅ CDK bootstrapped successfully"
else
    echo "✅ CDK already bootstrapped"
fi

echo ""
echo "🔍 CDK diff (showing what will be created)..."
cdk diff

echo ""
echo "🚀 Ready to deploy infrastructure!"
echo ""
echo "Next steps:"
echo "1. Review the CDK diff above"
echo "2. Run: cd aws-backend/infrastructure && cdk deploy"
echo "3. Confirm deployment when prompted"
echo "4. Note the outputs for User Pool ID, API Gateway URL, etc."
echo ""
echo "After deployment, create your admin user:"
echo "aws cognito-idp admin-create-user \\"
echo "  --user-pool-id <USER_POOL_ID_FROM_OUTPUT> \\"
echo "  --username \$ADMIN_EMAIL \\"
echo "  --user-attributes Name=email,Value=\$ADMIN_EMAIL Name=email_verified,Value=true \\"
echo "  --temporary-password \$TEMP_PASSWORD \\"
echo "  --message-action SUPPRESS"
echo ""
echo "🎉 Setup script completed!"

# Optional: Ask if user wants to deploy now
read -p "Would you like to deploy the infrastructure now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying infrastructure..."
    cdk deploy --require-approval never
    echo ""
    echo "🎉 Infrastructure deployed successfully!"
    echo "📋 Please save the outputs above - you'll need them for configuration"
else
    echo "👍 No problem! Deploy when ready with: cd aws-backend/infrastructure && cdk deploy"
fi
