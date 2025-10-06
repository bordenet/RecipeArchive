# AWS CDK Infrastructure Deployment

This directory contains the AWS CDK (Cloud Development Kit) infrastructure code for RecipeArchive.

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with your credentials (`aws configure`)
3. **AWS CDK** installed globally: `npm install -g aws-cdk`
4. **Node.js 18+** and **npm** installed

## Quick Start

### 1. Install Dependencies

```bash
cd aws-backend/infrastructure
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
# This creates the necessary S3 bucket and IAM roles for CDK deployments
cdk bootstrap
```

### 3. Deploy Infrastructure

```bash
# Deploy all stacks
cdk deploy --all
```

**Important**: During deployment, CDK will show you the resources it will create and ask for confirmation. Review carefully and type 'y' to proceed.

### 4. Get Infrastructure Details

After deployment, CDK will output important information like:

- **Cognito User Pool ID**
- **Cognito App Client ID**
- **API Gateway URL**
- **CloudFront Distribution URL**
- **S3 Bucket Names**

Copy these values to your `.env` file in the project root.

## Environment Configuration

After deployment, update your `.env` file with the outputs:

```bash
# Example of what to update in .env based on CDK outputs:
COGNITO_USER_POOL_ID=your-deployed-user-pool-id
COGNITO_APP_CLIENT_ID=your-deployed-app-client-id
API_BASE_URL=https://your-api-gateway-id.execute-api.us-west-2.amazonaws.com/prod
WEB_APP_URL=https://your-cloudfront-distribution.cloudfront.net
S3_RECIPE_STORAGE_BUCKET=your-s3-bucket-name
```

## Cost Management

This infrastructure is designed for the AWS Free Tier with minimal costs:

- **S3**: Storage and requests (Free Tier: 5 GB storage)
- **Lambda**: Pay per invocation (Free Tier: 1M requests/month)
- **CloudFront**: Data transfer (Free Tier: 50 GB/month)
- **Cognito**: User authentication (Free Tier: 50,000 MAUs)
- **API Gateway**: REST API calls (Free Tier: 1M calls/month)

**Expected Monthly Cost**: Pennies per month for typical development usage within Free Tier limits.

## Useful Commands

- `cdk ls` - List all stacks
- `cdk diff` - Show differences between deployed and current code
- `cdk deploy` - Deploy stacks
- `cdk destroy` - Delete all resources (⚠️ **CAUTION**: This deletes everything!)
- `cdk synth` - Generate CloudFormation templates

## Stack Structure

The infrastructure uses a single CDK stack (`RecipeArchiveStack-dev`) that creates:

1. **Cognito Resources**: User pools and authentication
2. **S3 Resources**: Recipe storage, temporary files, failed parsing diagnostics, and web app hosting
3. **Lambda Functions**: 11 backend functions using singleton pattern for consistent deployment
4. **API Gateway**: REST API endpoints with CORS and authentication
5. **CloudFront**: CDN distribution for web app
6. **SQS**: Recipe normalization queue for background processing
7. **CloudWatch**: Billing alerts and monitoring
8. **IAM**: Shared roles and policies for Lambda functions

## Security Notes

- All resources are configured with appropriate security groups and IAM roles
- API Gateway has CORS enabled for browser extension compatibility
- S3 buckets have public read access disabled by default
- Cognito requires email verification for user registration

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Error**: Make sure AWS CLI is configured with valid credentials
2. **Permission Denied**: Ensure your AWS user has CDK deployment permissions
3. **Resource Already Exists**: Some AWS resource names must be globally unique

### Getting Help

If you encounter issues:

1. Check AWS CloudFormation console for detailed error messages
2. Review CDK output for specific failure reasons
3. Ensure your `.env` file has all required variables set

## Clean Up

To remove all AWS resources:

```bash
cdk destroy --all
```

⚠️ **WARNING**: This permanently deletes all data including recipes, user accounts, and uploaded images!