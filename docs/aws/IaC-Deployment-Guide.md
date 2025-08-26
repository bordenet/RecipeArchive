# Infrastructure as Code - Deployment Guide

## 🎯 100% Infrastructure as Code

This project implements **complete Infrastructure as Code** using AWS CDK. Everything is automated and reproducible.

## 💰 Conservative Cost Management

- **Budget**: $20/month maximum ($5, $10, $16 alert thresholds)
- **Pre-production data retention**: 14 days automatic deletion
- **Temp files**: 1 day automatic deletion
- **Free Tier optimized**: All services configured for minimal cost

## 🚀 One-Command Deployment

```bash
# Deploy to development (default)
./deploy.sh

# Deploy to specific environment
./deploy.sh dev
./deploy.sh staging
./deploy.sh prod
```

## 📋 Manual Setup Required (One-time)

1. **AWS CLI**: Configure credentials

   ```bash
   aws configure
   ```

2. **Email confirmation**: Check email for SNS billing alerts subscription

That's it! Everything else is Infrastructure as Code.

## 🏗️ Infrastructure Components

All defined in `aws-backend/infrastructure/lib/recipe-archive-stack.ts`:

- ✅ **Cognito User Pool**: Email-based authentication
- ✅ **DynamoDB Table**: Recipe storage with GSI indices
- ✅ **S3 Buckets**: Storage (14-day retention) + Temp (1-day retention)
- ✅ **Lambda Functions**: Go-based serverless compute
- ✅ **API Gateway**: RESTful API with CORS
- ✅ **IAM Roles**: Least-privilege security
- ✅ **SNS Topic**: Billing alerts
- ✅ **AWS Budget**: $20/month with multi-tier alerts
- ✅ **CloudWatch Alarms**: Real-time cost monitoring

## 📊 Cost Breakdown (Estimated)

### Free Tier Coverage

- **Lambda**: 1M requests, 400k GB-seconds monthly
- **DynamoDB**: 25GB storage, 200M requests monthly
- **S3**: 5GB storage, 2k GET, 20k PUT requests monthly
- **CloudWatch**: 10 custom metrics, 5GB log ingestion
- **SNS**: 1k email notifications monthly

### Projected Monthly Costs

- **Development**: $0-5/month (mostly Free Tier)
- **Production**: $5-20/month (with real traffic)

## 🔧 Development Workflow

```bash
# 1. Make changes to Lambda functions
cd aws-backend/functions
make clean && make package

# 2. Update infrastructure
cd ../infrastructure
npx cdk deploy --require-approval never

# 3. Or use the automated script
cd ../..
./deploy.sh dev
```

## 📁 File Structure

```
RecipeArchive/
├── deploy.sh                          # Automated deployment script
├── aws-backend/
│   ├── infrastructure/
│   │   ├── lib/recipe-archive-stack.ts # Complete IaC definition
│   │   ├── bin/recipe-archive.ts       # CDK app entry point
│   │   └── package.json                # CDK dependencies
│   └── functions/
│       ├── health/main.go              # Health check Lambda
│       ├── utils/common.go             # Shared utilities
│       ├── models/recipe.go            # Data models
│       └── Makefile                    # Build automation
└── docs/
    └── aws/
        ├── Infrastructure-as-Code.md   # Detailed IaC documentation
        └── S3-and-Cost-Management.md   # Cost management guide
```

## 🔐 Security & Compliance

- **Encryption**: All data encrypted at rest (S3, DynamoDB)
- **Private**: No public S3 buckets or public access
- **IAM**: Least-privilege access patterns
- **Lifecycle**: Automatic data cleanup prevents accumulation
- **Monitoring**: Real-time cost and security monitoring

## 🚨 Cost Protection Features

### Automatic Safeguards

- **14-day S3 lifecycle**: Pre-prod data auto-deleted
- **1-day temp files**: Processing files auto-cleaned
- **Pay-per-request DynamoDB**: No fixed costs
- **Minimal Lambda resources**: 128MB memory, 10s timeout

### Alert System

- **25% threshold ($5)**: Early warning email
- **50% threshold ($10)**: Action recommended email
- **80% threshold ($16)**: Critical alert email
- **100% forecast**: Projected overage warning

## 📧 Monitoring & Alerts

Billing alerts sent to: `mattbordenet@hotmail.com`

Monitor via:

- **AWS Budgets Console**: Budget tracking
- **CloudWatch**: Real-time metrics
- **Email notifications**: Immediate alerts

## 🎯 Benefits of This IaC Approach

1. **Reproducible**: Identical environments every time
2. **Version controlled**: All changes tracked in Git
3. **Cost safe**: Built-in protection against overspend
4. **Secure**: Least-privilege access patterns
5. **Automated**: One-command deployment
6. **Documented**: Self-documenting infrastructure
7. **Testable**: Infrastructure can be validated
8. **Portable**: Deploy to any AWS account/region

## 🔄 Next Steps

1. ✅ **Infrastructure complete** - All components defined as code
2. 🔄 **Recipe CRUD APIs** - Implement business logic
3. 🔄 **Frontend integration** - Connect web/mobile apps
4. 🔄 **CI/CD pipeline** - Automated testing and deployment

**Zero manual configuration required beyond AWS credentials and email confirmation!** 🎉
