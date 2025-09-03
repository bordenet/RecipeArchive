# AWS Development Environment Setup Guide

## Overview

This guide walks you through setting up the AWS development environment for RecipeArchive, optimized for the **AWS Free Tier** to keep costs at $0.

## Prerequisites

- macOS machine with the main setup completed (`./scripts/setup-macos.sh`)
- AWS account (can be new, Free Tier eligible)
- Terminal access
- Node.js 18+ installed
- AWS CDK 2.87.0+ installed

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

## Environment Variables Required

The `.env` file in `aws-backend/` directory contains:

```bash
# AWS Configuration
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=your-account-id-here

# Cognito Configuration
COGNITO_USER_POOL_NAME=recipeArchive-users
COGNITO_APP_CLIENT_NAME=recipeArchive-client
ADMIN_EMAIL=mattbordenet@hotmail.com

# DynamoDB Configuration
DYNAMODB_TABLE_NAME=recipeArchive-recipes
DYNAMODB_BILLING_MODE=ON_DEMAND

# S3 Configuration
S3_BUCKET_NAME=recipearchive-storage-${AWS_ACCOUNT_ID}
S3_REGION=us-west-2

# API Gateway Configuration
API_GATEWAY_NAME=recipeArchive-api
API_STAGE=prod

# Environment
ENVIRONMENT=prod
PROJECT_NAME=recipeArchive
```

## Step 1: AWS Account Setup

### 1.1 Create AWS Account (if needed)

- Sign up at https://aws.amazon.com
- Verify your email and phone number
- Add payment method (free tier available)

### 1.2 Create IAM User for Development

1. Navigate to IAM Console
2. Create new user: `recipeArchive-dev`
3. Attach policies:
   - `PowerUserAccess` (for development)
   - Custom policy for Cognito and specific services
4. Generate Access Keys
5. Save credentials to environment variables:

```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-west-2
```

### 1.3 Configure AWS CLI

```bash
aws configure
# Enter your access key, secret key, region (us-west-2), output format (json)

# Test configuration
aws sts get-caller-identity
```

## Step 2: Infrastructure as Code Setup

We'll use AWS CDK (Cloud Development Kit) for infrastructure management.

### 2.1 Install AWS CDK

```bash
npm install -g aws-cdk
```

### 2.2 Initialize CDK Project

```bash
mkdir aws-infrastructure
cd aws-infrastructure
cdk init app --language typescript
```

### 2.3 Install Required CDK Libraries

```bash
npm install @aws-cdk/aws-cognito @aws-cdk/aws-dynamodb @aws-cdk/aws-s3 @aws-cdk/aws-lambda @aws-cdk/aws-apigateway @aws-cdk/aws-iam
```

## Step 3: Cognito User Pool Setup

### 3.1 User Pool Configuration

The CDK stack will create:

- User Pool for authentication
- User Pool Client for applications
- Identity Pool for AWS resource access

### 3.2 Initial Admin User Creation

After deployment, create your admin user:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username mattbordenet@hotmail.com \
  --user-attributes Name=email,Value=mattbordenet@hotmail.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

## Step 4: DynamoDB Table Setup

### 4.1 Table Schema

- Table Name: `recipeArchive-recipes`
- Partition Key: `userId` (String)
- Sort Key: `id` (String)
- Billing Mode: On-Demand
- Global Secondary Indexes:
  - `recipes-by-created`: userId (PK) + createdAt (SK)
  - `recipes-by-title`: userId (PK) + title (SK)

## Step 5: S3 Bucket Setup

### 5.1 Bucket Configuration

- Bucket Name: `recipearchive-storage-{account-id}`
- Region: us-west-2
- Versioning: Enabled
- Public Access: Blocked (use signed URLs)
- Lifecycle Rules: Archive old files after 1 year

### 5.2 Folder Structure

```
recipearchive-storage-{account-id}/
├── users/
│   └── {userId}/
│       ├── photos/
│       │   └── {recipeId}/
│       │       └── main.jpg
│       └── archives/
│           └── {recipeId}/
│               ├── page.html
│               └── page.pdf
```

## Step 6: Lambda Functions Setup

### 6.1 Function Structure

```
aws-backend/
├── functions/
│   ├── recipes/
│   │   ├── create/
│   │   ├── read/
│   │   ├── update/
│   │   ├── delete/
│   │   └── search/
│   ├── diagnostics/
│   │   ├── manual/
│   │   └── auto/
│   └── shared/
│       ├── auth/
│       ├── database/
│       └── s3/
```

### 6.2 Environment Variables for Lambda

Each Lambda function will receive:

- `DYNAMODB_TABLE_NAME`
- `S3_BUCKET_NAME`
- `COGNITO_USER_POOL_ID`
- `ENVIRONMENT`

## Step 7: API Gateway Setup

### 7.1 API Structure

```
/v1/
├── recipes/
│   ├── GET    /           (list recipes)
│   ├── POST   /           (create recipe)
│   ├── GET    /{id}       (get recipe)
│   ├── PUT    /{id}       (update recipe)
│   ├── DELETE /{id}       (delete recipe)
│   └── GET    /search     (search recipes)
├── diagnostics/
│   ├── POST   /           (manual diagnostics)
│   └── POST   /auto       (auto diagnostics)
└── health/
    └── GET    /           (health check)
```

### 7.2 CORS Configuration

- Allow Origins: Browser extension domains, localhost
- Allow Methods: GET, POST, PUT, DELETE, OPTIONS
- Allow Headers: Authorization, Content-Type
- Allow Credentials: true

## Step 8: Security Configuration

### 8.1 IAM Roles

- Lambda Execution Role with minimal permissions
- Cognito Identity Pool roles for authenticated users
- S3 bucket policies for user-scoped access

### 8.2 Rate Limiting

- API Gateway throttling: 200 requests/second
- User-level throttling: 200 requests/hour per user
- Burst limits: 100 requests

## Deployment Steps

### 1. Bootstrap CDK

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/us-west-2
```

### 2. Deploy Infrastructure

```bash
cdk deploy --require-approval never
```

### 3. Create Initial Admin User

```bash
# Use the output from CDK deployment
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID_FROM_OUTPUT> \
  --username mattbordenet@hotmail.com \
  --user-attributes Name=email,Value=mattbordenet@hotmail.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

### 4. Test API Endpoints

```bash
# Get Cognito JWT token first, then test:
curl -X GET https://your-api-id.execute-api.us-west-2.amazonaws.com/prod/v1/health \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Cost Monitoring Setup

### 8.1 Budget Alerts

- Monthly budget: $10 (adjust as needed)
- Alert at 80% and 100% of budget
- Email notifications to mattbordenet@hotmail.com

### 8.2 Cost Optimization

- DynamoDB: On-demand billing for variable usage
- Lambda: ARM64 Graviton2 for better price/performance
- S3: Intelligent Tiering for automatic cost optimization
- CloudWatch: 5-minute metrics (free tier)

## Security Best Practices

1. **No Hardcoded Credentials**: All secrets in environment variables or AWS Secrets Manager
2. **Least Privilege**: IAM roles with minimal required permissions
3. **Encryption**: At rest (DynamoDB, S3) and in transit (HTTPS)
4. **Monitoring**: CloudTrail for API calls, CloudWatch for metrics
5. **Rate Limiting**: Prevent abuse and cost overruns

## Next Steps After Setup

1. Deploy the infrastructure
2. Create initial admin user
3. Test authentication flow
4. Deploy Lambda functions
5. Test CRUD operations
6. Set up monitoring and alerts

---

**Important**: Never commit the `.env` file to git. Add it to `.gitignore` immediately.
