# Getting Started with RecipeArchive

**Goal: Production deployment in 15 minutes**

This guide walks you through setting up RecipeArchive from scratch to a working production system.

## Prerequisites

- macOS (Intel or Apple Silicon)
- AWS Account with admin access
- OpenAI API key (for recipe normalization)
- 15 minutes of focused time

## Step 1: Clone and Configure (2 minutes)

```bash
# Clone repository
git clone https://github.com/bordenet/RecipeArchive
cd RecipeArchive

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

**Edit `.env` and set these required values:**
```bash
# AWS Credentials (from AWS Console → IAM → Security Credentials)
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=YOUR_ACCOUNT_ID

# OpenAI (from https://platform.openai.com/api-keys)
OPENAI_API_KEY=YOUR_OPENAI_KEY

# Cognito (will be populated after AWS deployment)
COGNITO_USER_POOL_ID=TBD
COGNITO_APP_CLIENT_ID=TBD
```

## Step 2: Deploy AWS Infrastructure (8 minutes)

```bash
# Automated AWS setup
./scripts/aws/deploy-infrastructure.sh

# This script will:
# 1. Verify AWS credentials and region
# 2. Deploy CDK infrastructure (Lambda, S3, Cognito, API Gateway)
# 3. Update .env with Cognito credentials
# 4. Configure browser extensions with your AWS resources
```

**Expected output:**
```
✓ AWS credentials validated
✓ CDK bootstrap complete
✓ RecipeArchive-Backend deployed
✓ Cognito User Pool created: us-west-2_XXXXX
✓ .env updated with Cognito credentials
✓ Extensions configured for your AWS account
```

## Step 3: Create First User (1 minute)

```bash
# Create admin user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id $(grep COGNITO_USER_POOL_ID .env | cut -d '=' -f2) \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $(grep COGNITO_USER_POOL_ID .env | cut -d '=' -f2) \
  --username admin@example.com \
  --password YOUR_SECURE_PASSWORD \
  --permanent
```

## Step 4: Deploy Web Application (3 minutes)

```bash
# Build and deploy Flutter web app
./scripts/web/deploy.sh

# This deploys to S3 + CloudFront
# CloudFront URL will be shown in output
```

**Expected output:**
```
✓ Flutter build complete
✓ Uploaded to S3: recipe-web-XXXXX
✓ CloudFront invalidation created
✓ Web app deployed: https://xxxxxxxxxxx.cloudfront.net
```

## Step 5: Verify Installation (1 minute)

```bash
# Run comprehensive validation
./validate-monorepo.sh --all

# Expected: All 17 validation modules pass
```

**Test in browser:**
1. Open CloudFront URL from Step 4
2. Sign in with credentials from Step 3
3. Navigate to Extensions page
4. Install browser extension (Chrome or Safari)
5. Capture your first recipe from a supported site

## Next Steps

### Browser Extensions
- [Install Chrome Extension](../../extensions/chrome/README.md)
- [Install Safari Extension](../../extensions/safari/README.md)
- [Supported Recipe Sites](../../README.md#supported-sites)

### Mobile Development (Optional)
- [iOS Setup Guide](../../scripts/ios/README.md)
- [Android Setup Guide](../../scripts/android/README.md)
- Build native apps: `./scripts/ios/build.sh --help`

### Development Workflow
- [Command Reference](../../COMMANDS.md) - Quick lookup for all commands
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Contribution workflow and development conventions
- [API Documentation](../api/api-specification.md) - Backend API reference

## Common Issues

### AWS Deployment Fails
**Error:** `Unable to resolve AWS account/region`

**Solution:**
```bash
aws configure
# Enter your AWS access key, secret key, and region (us-west-2)
```

### Extension Not Working
**Error:** Extension shows "Authentication failed"

**Solution:**
```bash
# Reconfigure extensions with your AWS resources
./scripts/setup-new-adopter-environment.sh
```

### Web App Build Fails
**Error:** `Flutter not found`

**Solution:**
```bash
# Install all development dependencies
./scripts/setup-macos.sh
```

## Architecture Overview

```
┌─────────────────┐
│ Browser         │
│ Extension       │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  │    ┌──────────────────┐
│ Flutter Web/    │  │    │ AWS Lambda       │
│ Mobile Apps     │──┼───→│ (Go Functions)   │
└─────────────────┘  │    └──────────────────┘
                     │             │
┌─────────────────┐  │             ↓
│ iOS/Android     │  │    ┌──────────────────┐
│ Native Share    │──┘    │ S3 Buckets       │
└─────────────────┘       │ - Recipes        │
                          │ - Images         │
                          │ - Temp Storage   │
                          └──────────────────┘
                                   │
                                   ↓
                          ┌──────────────────┐
                          │ OpenAI API       │
                          │ (Normalization)  │
                          └──────────────────┘
```

## Cost Estimates

**AWS Free Tier (First 12 Months):**
- Lambda: 1M requests/month free
- S3: 5GB storage free
- CloudFront: 50GB data transfer free
- Cognito: 50,000 MAU free

**Beyond Free Tier (Typical Personal Use):**
- ~$3-5/month for 100 recipes, 50 monthly captures
- OpenAI: ~$1-2/month (recipe normalization)

**Total: ~$4-7/month for active personal use**

## Security Notes

- `.env` file contains secrets - NEVER commit to git
- AWS credentials should use IAM user with least-privilege policy
- Cognito user pool is private (invitation-based by default)
- S3 buckets use server-side encryption (AES-256)
- CloudFront forces HTTPS for web app
- Browser extensions only send recipe URLs to your AWS account

## Getting Help

- **Command not found?** Check [COMMANDS.md](../../COMMANDS.md)
- **Build issues?** Run `./validate-monorepo.sh --all`
- **AWS problems?** See [AWS Setup Guide](./aws-setup.md)
- **Questions?** Open an issue on GitHub

---

**Next:** [Development Workflow →](../../CONTRIBUTING.md) | [Command Reference →](../../COMMANDS.md)
