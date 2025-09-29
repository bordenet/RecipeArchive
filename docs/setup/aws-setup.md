# AWS Development Environment Setup Guide

## Overview

This guide walks you through setting up the AWS development environment for RecipeArchive, optimized for the **AWS Free Tier** to keep costs at $0.

## Prerequisites

- macOS machine with the main setup completed (`./scripts/setup-macos.sh`)
- AWS account (can be new, Free Tier eligible)
- Terminal access
- Node.js 18+ installed
- AWS CDK 2.87.0+ installed
- Flutter SDK installed (for mobile app development)
- Android Studio and/or Xcode (for mobile app deployment)

## Step 1: AWS Account Setup

### 1.1 Create AWS Account (if needed)

- Go to [aws.amazon.com](https://aws.amazon.com) and create a free account
- Verify your email and phone number
- Add a payment method (required but won't be charged on Free Tier)

### 1.2 Enable AWS Free Tier Monitoring

1. Sign in to AWS Console
2. Go to **Billing & Cost Management** → **Billing preferences**
3. Check **"Receive Billing Alerts"**
4. Save preferences

## Step 2: IAM User Setup

### 2.1 Create IAM User for Development

1. Go to **IAM** → **Users** → **Create user**
2. Username: `recipeArchive-dev` (or your preference)
3. Select **"Provide user access to the AWS Management Console"** (optional)
4. Set a secure password

### 2.2 Attach Required Policies

**For Development (Recommended):**
Attach these policies to your user:

- `IAMFullAccess`
- `CloudFormationFullAccess`
- `S3FullAccess`
- `DynamoDBFullAccess`
- `AWSLambda_FullAccess`
- `AmazonAPIGatewayAdministrator`
- `AmazonCognitoPowerUser`
- `CloudWatchFullAccess`
- `AmazonSNSFullAccess`

**Alternative (Quick Setup):**

- `AdministratorAccess` (simpler but broader permissions)

### 2.3 Create Access Keys

1. Click on your username → **Security credentials** tab
2. Scroll to **Access keys** → **Create access key**
3. Choose **"Command Line Interface (CLI)"**
4. Download and save both Access Key ID and Secret Access Key
5. **NEVER commit these to git!**

## Step 3: Configure AWS CLI

### 3.1 Install AWS CLI (if not done by setup script)

```bash
brew install awscli
```

### 3.2 Configure Credentials

```bash
aws configure
```

Enter:

- **AWS Access Key ID**: [your access key]
- **AWS Secret Access Key**: [your secret key]
- **Default region name**: `us-west-2`
- **Default output format**: `json`

### 3.3 Test Configuration

```bash
aws sts get-caller-identity
```

Should return your account information.

## Step 4: Set Up Free Tier Monitoring

### 4.1 Run Billing Controls Script

```bash
cd /path/to/RecipeArchive
./scripts/setup-aws-billing-controls.sh
```

### 4.2 Confirm Email Subscription

- Check your email for SNS subscription confirmation
- Click the confirmation link

## Step 5: Bootstrap AWS CDK

### 5.1 Navigate to Infrastructure Directory

```bash
cd aws-backend/infrastructure
```

### 5.2 Bootstrap CDK Environment

```bash
npx cdk bootstrap
```

This creates the necessary S3 bucket and IAM roles for CDK deployments.

### 5.3 Deploy Infrastructure

```bash
# Deploy all AWS resources
cdk deploy --all
```

**Important Notes:**
- CDK will show you all resources to be created and ask for confirmation
- Review the changes carefully before typing 'y' to proceed
- Deployment takes 5-10 minutes to create all resources
- Copy the output values (User Pool ID, API Gateway URL, etc.) for your `.env` file

## Step 6: Configure Environment Variables

The project requires a `.env` file in the root directory to store AWS credentials and infrastructure details. A `.env.example` file is provided in the root directory with all the required variables.

1.  **Create the .env file:**

    ```bash
    cp .env.example .env
    ```

2.  **Populate the .env file:**

    Open the `.env` file and fill in the values for each variable. The comments in the `.env.example` file explain what each variable is and how to obtain its value.

    For more information on setting up the required AWS resources, see the `aws-backend/infrastructure/README.md` file and the AWS CDK deployment guide.

## Step 7: Configure Browser Extensions

**CRITICAL**: The browser extensions contain hardcoded references to the original developer's AWS infrastructure. You MUST run this script to configure them for your infrastructure:

```bash
# Return to project root
cd /path/to/RecipeArchive

# Configure extensions to use YOUR AWS resources
./scripts/setup-new-adopter-environment.sh
```

This script will:
- ✅ Replace all hardcoded AWS resource references with your values from `.env`
- ✅ Update both Chrome and Safari extensions
- ✅ Create backup files of all modified files
- ✅ Configure the Flutter app to use your AWS resources

## Step 8: Build and Test

```bash
# Build extensions with your configuration
npm run build:extensions

# Package extensions for installation
./scripts/package-extensions.sh

# Test everything works
./validate-monorepo.sh --all
```

## Step 9: Deploy Web Application

```bash
# Deploy your Flutter web app to CloudFront
./scripts/deploy-web-app.sh
```

## Complete Setup Verification

After following all steps, you should have:
- ✅ Your own AWS infrastructure deployed
- ✅ Browser extensions configured for your AWS resources
- ✅ Flutter web app deployed to your CloudFront distribution
- ✅ All validation tests passing

**⚠️ Security**: Your setup now uses entirely YOUR AWS infrastructure - no data or requests go to the original developer's resources.
