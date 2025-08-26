# S3 Storage & Cost Management Implementation

## 📦 S3 Bucket Architecture

### Primary Storage Bucket

- **Name**: `recipearchive-storage-dev-[ACCOUNT-ID]`
- **Purpose**: Recipe photos, documents, and permanent storage
- **Retention Policy**:
  - **Pre-Production**: **14 days strict deletion** for testing data
  - **Production**: 7 years retention for compliance
- **Security**: Fully private with S3-managed encryption
- **Versioning**: Disabled in dev, enabled in production

### Temporary Processing Bucket

- **Name**: `recipearchive-temp-dev-[ACCOUNT-ID]`
- **Purpose**: File uploads, processing, temporary storage
- **Retention Policy**: **1 day deletion** in dev, 7 days in production
- **Security**: Fully private with S3-managed encryption
- **Features**: Auto-cleanup of incomplete multipart uploads

## 💰 Cost Monitoring & Billing Alerts

### Billing Alert System

- **Email**: `mattbordenet@hotmail.com`
- **SNS Topic**: `arn:aws:sns:us-west-2:[ACCOUNT-ID]:recipearchive-billing-alerts-dev`
- **Status**: ⚠️ **Subscription pending confirmation** - check your email!

### Budget Watchdog ($20/month maximum)

- **25% Alert**: $5.00/month (Early warning - investigate usage)
- **50% Alert**: $10.00/month (Action required - optimize resources)
- **80% Alert**: $16.00/month (Critical - immediate intervention needed)
- **100% Forecast**: $20.00/month (Projected overage - emergency mode)

### CloudWatch Monitoring

- **Metric**: AWS Billing EstimatedCharges
- **Threshold**: $20/month
- **Check Frequency**: Every 12 hours
- **Action**: SNS alert to your email

## 🎯 DynamoDB Usage Strategy

DynamoDB will store:

### Recipe Data

```json
{
  "recipeId": "recipe-uuid",
  "userId": "user-uuid",
  "title": "Pasta Carbonara",
  "description": "Classic Italian pasta dish",
  "ingredients": ["eggs", "bacon", "pasta", "cheese"],
  "instructions": ["Step 1...", "Step 2..."],
  "tags": ["italian", "quick", "dinner"],
  "nutritionalInfo": {
    "calories": 450,
    "protein": "20g",
    "carbs": "45g"
  },
  "photos": ["s3://bucket/photo1.jpg"],
  "createdAt": "2025-08-24T12:00:00Z",
  "updatedAt": "2025-08-24T12:00:00Z"
}
```

### Search Indices

- **recipes-by-created**: userId + createdAt (chronological browsing)
- **recipes-by-title**: userId + title (alphabetical search)
- **Global Search**: Tags and ingredients for discovery

### User Management

- **User profiles**: Preferences, dietary restrictions
- **Recipe collections**: Favorites, meal plans, shopping lists
- **Sharing permissions**: Public/private recipe visibility

## 🔒 Cost-Optimization Features

### S3 Storage Classes

- **Standard**: Active recipe photos and documents
- **Lifecycle Management**: Automatic cleanup prevents runaway storage costs
- **No versioning in dev**: Saves on duplicate file storage

### DynamoDB Optimization

- **Pay-per-request billing**: No fixed costs, scales with usage
- **Efficient indexing**: Targeted queries reduce read costs
- **Free Tier friendly**: 25GB storage, 200M requests/month

### Lambda Function Efficiency

- **128MB memory**: Minimum billable memory for cost savings
- **10s timeout**: Prevents runaway execution costs
- **Environment variables**: Reduce cold start configuration overhead

## 📧 Email Confirmation Required

**⚠️ ACTION NEEDED**: Check your email (`mattbordenet@hotmail.com`) for an SNS subscription confirmation from AWS. Click the confirmation link to activate billing alerts.

## 🚨 Emergency Cost Controls

If spending exceeds thresholds:

1. **Automatic alerts** sent to your email
2. **S3 lifecycle rules** prevent data accumulation beyond 14 days in dev
3. **Budget tracking** provides early warning at 50% spend
4. **CloudWatch alarms** provide real-time monitoring

## 📊 Monitoring Dashboard

Monitor costs via:

- **AWS Budgets Console**: Monthly spending tracking
- **CloudWatch Billing**: Real-time cost metrics
- **Email alerts**: Immediate notification of threshold breaches
- **S3 storage metrics**: Track storage usage by bucket

## 🛡️ Data Protection

### Pre-Production Safety

- **14-day auto-deletion**: All test data automatically purged
- **No versioning**: Prevents accidental data retention
- **Private buckets**: No public access possible

### Production Safeguards

- **7-year retention**: Compliance with data regulations
- **Versioning enabled**: Protection against accidental deletion
- **Encryption at rest**: S3-managed encryption for all objects

---

**Next Steps**:

1. ✅ Confirm SNS email subscription
2. 🔄 Monitor first billing cycle
3. 🚀 Implement recipe CRUD operations
4. 📱 Connect to frontend applications
