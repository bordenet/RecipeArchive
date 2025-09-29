# Infrastructure Disaster Recovery Guide

## 🚨 Critical Infrastructure Recovery

This document provides step-by-step instructions to recreate the secure RecipeArchive infrastructure after a disaster or security incident. The recovery follows a staged approach to minimize costs and avoid deployment issues.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js and npm installed
- CDK CLI installed (`npm install -g aws-cdk`)
- Access to the environment variables file

## Emergency Recovery Steps (Staged Approach)

### Step 1: Deploy Minimal Secure Infrastructure (Cost-Safe)

Deploy only S3 buckets and Cognito first to avoid circular dependencies and minimize cost:

```bash
# 1. Ensure AWS credentials are configured
aws sts get-caller-identity

# 2. Install CDK dependencies
cd aws-backend/infrastructure
npm install

# 3. Deploy the minimal secure infrastructure stack (S3 + Cognito only)
npx cdk deploy --app "npx ts-node bin/recipe-archive-minimal.ts" --require-approval never --context adminEmail=your-admin@email.com

# 4. Capture the outputs (save these to .env file):
# - SecureUserPoolId
# - SecureUserPoolClientId
# - SecureStorageBucketName
# - SecureTempBucketName
# - SecureFailedParsingBucketName
# - SecureRandomId
```

**Expected Monthly Cost**: ~$0.50-2.00 (S3 storage only, Cognito is free tier)

### Step 2: Deploy API Gateway and Lambda Functions (Incremental)

After the minimal infrastructure is verified, add API Gateway:

```bash
# 1. Deploy basic API Gateway with health endpoint only
npx cdk deploy --app "npx ts-node bin/recipe-archive-api-stack.ts" --require-approval never --context adminEmail=your-admin@email.com

# 2. Add recipes endpoint after health verification
npx cdk deploy --app "npx ts-node bin/recipe-archive-recipes-stack.ts" --require-approval never --context adminEmail=your-admin@email.com

# 3. Capture new API Gateway URL for .env file
```

**Additional Monthly Cost**: ~$3-10 (API Gateway + Lambda executions)

### Step 3: Add Monitoring and Cost Controls

```bash
# Deploy cost monitoring and CloudWatch alarms
npx cdk deploy --app "npx ts-node bin/recipe-archive-monitoring-stack.ts" --require-approval never --context adminEmail=your-admin@email.com
```

### Step 2: Create User in New Cognito Pool

```bash
# Replace USER_POOL_ID with the output from Step 1
export USER_POOL_ID="us-west-2_XXXXXXXXX"
export USER_EMAIL="your-admin-email@domain.com"
export USER_PASSWORD="YourSecurePassword123!"

# Create user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $USER_EMAIL \
  --user-attributes Name=email,Value=$USER_EMAIL Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region us-west-2

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $USER_EMAIL \
  --password "$USER_PASSWORD" \
  --permanent \
  --region us-west-2
```

### Step 3: Generate Admin Token

```bash
# Replace CLIENT_ID with the output from Step 1
export CLIENT_ID="XXXXXXXXXXXXXXXXXX"

# Generate admin token
aws cognito-idp initiate-auth \
  --client-id $CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=$USER_EMAIL,PASSWORD=$USER_PASSWORD \
  --region us-west-2 \
  --query 'AuthenticationResult.IdToken' \
  --output text
```

### Step 4: Update Environment Configuration

Update `.env` file with all new infrastructure identifiers:

```env
# Core Infrastructure (SECURE - New infrastructure with randomized identifiers)
AWS_REGION=us-west-2
AWS_DEFAULT_REGION=us-west-2
COGNITO_USER_POOL_ID=us-west-2_XXXXXXXXX
COGNITO_APP_CLIENT_ID=XXXXXXXXXXXXXXXXXX

# S3 Configuration (SECURE - New buckets with randomized names)
S3_BUCKET_NAME=recipe-storage-XXXXXXXXXXXXXXXX-990537043943
S3_TEMP_BUCKET_NAME=recipe-temp-XXXXXXXXXXXXXXXX-990537043943

# Admin Token (SECURE - From new Cognito pool)
RECIPE_ADMIN_TOKEN=eyJxxxxxxxxxxxxxxxxxxxxxxx...

# Test User Credentials
TEST_USER_EMAIL=your-admin-email@domain.com
TEST_USER_PASSWORD=YourSecurePassword123!
RECIPE_USER_EMAIL=your-admin-email@domain.com
RECIPE_USER_PASSWORD=YourSecurePassword123!
```

## Infrastructure Components Created

### Secure Infrastructure (Stack: RecipeSecureStack-secure)

1. **Cognito User Pool** - Randomized name: `recipe-users-{RANDOM_ID}`
2. **Cognito Client** - Randomized name: `recipe-client-{RANDOM_ID}`
3. **S3 Storage Bucket** - Pattern: `recipe-storage-{RANDOM_ID}-{ACCOUNT}`
4. **S3 Temp Bucket** - Pattern: `recipe-temp-{RANDOM_ID}-{ACCOUNT}`
5. **S3 Failed Parsing Bucket** - Pattern: `recipe-failed-{RANDOM_ID}-{ACCOUNT}`

### Security Features

- **Random Resource Names**: All resources use cryptographically secure random IDs
- **Proper Retention Policies**: Matching original stack configurations
- **Encryption**: S3 buckets encrypted with AWS managed keys
- **Access Control**: Block all public access on S3 buckets
- **Lifecycle Rules**: Automatic cleanup of old and temporary data

## Verification Steps

After deployment, verify the infrastructure:

```bash
# Test Cognito authentication
aws cognito-idp initiate-auth \
  --client-id $CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=$USER_EMAIL,PASSWORD=$USER_PASSWORD \
  --region us-west-2

# Test S3 bucket access
aws s3 ls s3://recipe-storage-XXXXXXXXXXXXXXXX-990537043943/

# Run application tests
npm run test
./validate-monorepo.sh --med
```

## Rollback Procedures

If issues are encountered during recovery:

1. **Delete failed stack**: `npx cdk destroy --app "npx ts-node bin/recipe-archive-secure.ts"`
2. **Review errors** and fix infrastructure code
3. **Redeploy** with corrected configuration
4. **Update environment variables** with new identifiers

## Security Considerations

- **Never commit** the actual resource IDs to version control
- **Rotate passwords** immediately after disaster recovery
- **Audit access logs** to ensure no unauthorized access during incident
- **Update firewall rules** if IP addresses changed
- **Regenerate all JWT tokens** after infrastructure recovery

## Contact Information

- **AWS Account**: 990537043943
- **Primary Region**: us-west-2
- **Emergency Contact**: [Add emergency contact information]

---

**Last Updated**: September 2025
**CDK Version**: Compatible with AWS CDK v2.x
**Stack File**: `aws-backend/infrastructure/lib/recipe-archive-secure-stack.ts`
