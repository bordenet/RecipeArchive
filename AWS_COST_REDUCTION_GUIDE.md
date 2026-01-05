# AWS Cost Reduction Guide - RecipeArchive

**Date**: 2026-01-05
**Purpose**: Safely pause AWS infrastructure to eliminate daily costs while preserving ability to resume later

---

## Executive Summary

This guide helps you **safely pause** all AWS infrastructure for RecipeArchive to reduce or eliminate ongoing daily costs. All actions are **non-destructive** and **reversible** - you can fully restore the environment in a few months when you're ready to resume.

### Current AWS Services Deployed
- **13 Lambda functions** (compute charges per invocation)
- **3 S3 buckets** (storage + data transfer charges)
- **1 API Gateway** (per-request charges)
- **1 Cognito User Pool** (per-user monthly charges)
- **1 SQS Queue** (per-message charges)
- **CloudWatch** (log storage + metrics)
- **SNS** (notifications)
- **Daily scheduled GitHub Action** (free, but tests live endpoints)

### Estimated Current Monthly Costs
Based on your budget alarms:
- **Minimal stack**: $5/month budget
- **Main stack**: $20/month budget
- **Secure stack**: $50/month budget

**Total estimated**: $5-50/month depending on which stack is deployed

---

## Cost Reduction Strategy

### Option 1: Disable Daily GitHub Action (Immediate, Zero Cost)
**Impact**: Eliminates daily scheduled runs
**Savings**: Minimal (GitHub Actions are free for public repos)
**Reversibility**: Instant (re-enable workflow)

### Option 2: Tear Down Lambda + API Gateway (Aggressive Cost Reduction)
**Impact**: Stops all compute and API charges, keeps data
**Savings**: 60-80% reduction (~$3-40/month)
**Reversibility**: Minutes (redeploy CDK stack)

### Option 3: Full Infrastructure Teardown (Maximum Savings)
**Impact**: Deletes everything except code repository
**Savings**: 100% (~$5-50/month)
**Reversibility**: 15-30 minutes (full CDK redeploy)
**⚠️ CAUTION**: Deletes user data, S3 objects, Cognito users

### Option 4: Hibernate Mode (Recommended Balance)
**Impact**: Keeps infrastructure, removes data from S3, disables Lambda triggers
**Savings**: 40-60% reduction
**Reversibility**: Quick (re-enable triggers, restore S3 from backups if needed)

---

## RECOMMENDED APPROACH: Option 4 - Hibernate Mode

This approach balances cost savings with easy restoration:

### Step 1: Disable Daily GitHub Action
**Time**: 1 minute
**Reversibility**: Instant

1. Navigate to [.github/workflows/parser-health-check.yml](.github/workflows/parser-health-check.yml#L4-L6)
2. Comment out the cron schedule:

```yaml
on:
  # schedule:
  #   # Run daily at 9 AM UTC (1 AM PST, 4 AM EST)
  #   - cron: "0 9 * * *"
  workflow_dispatch: # Allow manual trigger (keep this)
  push:
    branches: [main]
    paths:
      - "parsers/**"
      - "tests/e2e/**"
```

3. Commit and push:
```bash
git add .github/workflows/parser-health-check.yml
git commit -m "chore: disable daily parser health check during hibernation"
git push
```

**Cost savings**: $0 (GitHub Actions are free, but reduces unnecessary runs)

---

### Step 2: Export Critical Data (Backup Before Hibernation)
**Time**: 5-10 minutes
**Purpose**: Ensure you can restore user data when resuming

#### 2a. Export Cognito Users (if any exist)
```bash
# List users in Cognito User Pool
aws cognito-idp list-users \
  --user-pool-id <YOUR_COGNITO_USER_POOL_ID> \
  --output json > cognito-users-backup-$(date +%Y%m%d).json

# Store backup safely
mkdir -p backups/
mv cognito-users-backup-*.json backups/
```

#### 2b. Inventory S3 Buckets
```bash
# Check what's in your S3 buckets
aws s3 ls s3://recipearchive-storage-${AWS_ACCOUNT_ID}/ --recursive --human-readable --summarize > backups/s3-storage-inventory-$(date +%Y%m%d).txt
aws s3 ls s3://recipearchive-temp-${AWS_ACCOUNT_ID}/ --recursive --human-readable --summarize > backups/s3-temp-inventory-$(date +%Y%m%d).txt
aws s3 ls s3://recipearchive-failed-parsing-${AWS_ACCOUNT_ID}/ --recursive --human-readable --summarize > backups/s3-failed-inventory-$(date +%Y%m%d).txt
```

#### 2c. Download Important S3 Data (Optional)
If you have important recipe images/documents, download them:
```bash
# Only if you have data you want to preserve locally
aws s3 sync s3://recipearchive-storage-${AWS_ACCOUNT_ID}/ backups/s3-storage/ --dryrun
# Remove --dryrun if you want to proceed
```

---

### Step 3: Clean Out S3 Buckets (Major Cost Reduction)
**Time**: 5 minutes
**Reversibility**: Only if you backed up in Step 2
**Cost savings**: $1-20/month (depending on data volume)

```bash
# Empty temp bucket (safe - designed to be ephemeral)
aws s3 rm s3://recipearchive-temp-${AWS_ACCOUNT_ID}/ --recursive

# Empty failed parsing bucket (safe - just diagnostics)
aws s3 rm s3://recipearchive-failed-parsing-${AWS_ACCOUNT_ID}/ --recursive

# OPTIONAL: Empty storage bucket (only if you backed up or don't need the data)
# aws s3 rm s3://recipearchive-storage-${AWS_ACCOUNT_ID}/ --recursive
```

**What this does**:
- Eliminates S3 storage costs for temporary/diagnostic data
- Keeps the buckets themselves (no infrastructure changes needed)
- Can be restored from backups when you resume

---

### Step 4: Disable CloudWatch Log Retention (Minor Savings)
**Time**: 2 minutes
**Cost savings**: $0.50-2/month

```bash
# List all Lambda function log groups
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/RecipeArchive" \
  --query 'logGroups[].logGroupName' \
  --output text

# Delete old logs (keeps the log groups for future use)
for log_group in $(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/RecipeArchive" --query 'logGroups[].logGroupName' --output text); do
  echo "Deleting logs in: $log_group"
  aws logs delete-log-stream --log-group-name "$log_group" --log-stream-name '*' || true
done
```

---

### Step 5: Monitor AWS Budget (Verification)
**Time**: 1 minute

1. Check your AWS Budget dashboard:
   - Navigate to: https://console.aws.amazon.com/billing/home#/budgets
2. Verify budgets are still active (should show near $0 usage after hibernation)
3. Keep budget alarms enabled to catch any unexpected charges

---

## ALTERNATIVE: Full Teardown (Maximum Savings)

If you want to **completely eliminate all AWS costs** and are comfortable redeploying from scratch:

### ⚠️ WARNING: This is DESTRUCTIVE
- Deletes ALL infrastructure
- Deletes ALL user data (Cognito users, S3 objects, etc.)
- Requires full redeployment to resume (15-30 minutes)

### Full Teardown Steps

#### 1. Backup Everything First (CRITICAL)
```bash
# Export Cognito users
aws cognito-idp list-users \
  --user-pool-id <YOUR_COGNITO_USER_POOL_ID> \
  --output json > backups/cognito-users-backup-$(date +%Y%m%d).json

# Download ALL S3 data
aws s3 sync s3://recipearchive-storage-${AWS_ACCOUNT_ID}/ backups/s3-storage/
aws s3 sync s3://recipearchive-temp-${AWS_ACCOUNT_ID}/ backups/s3-temp/
aws s3 sync s3://recipearchive-failed-parsing-${AWS_ACCOUNT_ID}/ backups/s3-failed/

# Save CDK outputs (for restoration reference)
cd aws-backend/infrastructure/
cp outputs.json ../../backups/cdk-outputs-$(date +%Y%m%d).json
```

#### 2. Destroy CDK Stack
```bash
cd aws-backend/infrastructure/

# Preview what will be deleted
npm run cdk diff

# Destroy all stacks
npm run cdk destroy -- --all

# Confirm when prompted (type 'y')
```

**Time to complete**: 5-15 minutes (AWS resource deletion)

#### 3. Verify Deletion
```bash
# Check Lambda functions (should return empty)
aws lambda list-functions --query 'Functions[?contains(FunctionName, `RecipeArchive`)].FunctionName'

# Check S3 buckets (should return empty)
aws s3 ls | grep recipearchive

# Check API Gateway (should return empty)
aws apigateway get-rest-apis --query 'items[?contains(name, `RecipeArchive`)].name'

# Check Cognito User Pools (should return empty)
aws cognito-idp list-user-pools --max-results 60 --query 'UserPools[?contains(Name, `recipeArchive`)].Name'
```

---

## How to Resume Later

### From Hibernate Mode (Recommended)
**Time**: 5-10 minutes

1. **Re-enable GitHub Action**
   - Uncomment the cron schedule in [.github/workflows/parser-health-check.yml](.github/workflows/parser-health-check.yml)
   - Commit and push

2. **Restore S3 Data** (if you backed up)
   ```bash
   aws s3 sync backups/s3-storage/ s3://recipearchive-storage-${AWS_ACCOUNT_ID}/
   ```

3. **Verify Lambda Functions**
   ```bash
   # Test health endpoint
   curl https://<API_GATEWAY_ID>.execute-api.us-west-2.amazonaws.com/prod/health
   ```

4. **Restore Cognito Users** (if needed)
   - Manual process: Re-invite users or import from backup JSON

---

### From Full Teardown
**Time**: 15-30 minutes

1. **Redeploy Infrastructure**
   ```bash
   cd aws-backend/infrastructure/
   npm run cdk deploy -- --all
   ```

2. **Deploy Lambda Functions**
   ```bash
   ./scripts/aws/lambda.sh --all
   ```

3. **Restore Data**
   ```bash
   # Restore S3 data
   aws s3 sync backups/s3-storage/ s3://recipearchive-storage-${AWS_ACCOUNT_ID}/

   # Restore Cognito users (manual process)
   # See: docs/disaster-recovery-infrastructure.md
   ```

4. **Update .env with New Outputs**
   ```bash
   # Copy new outputs from CDK deployment
   cat aws-backend/infrastructure/outputs.json
   # Update .env file with new IDs
   ```

5. **Re-enable GitHub Action**
   - Uncomment cron schedule
   - Commit and push

---

## Cost Monitoring Checklist

After implementing hibernation or teardown:

- [ ] Verify AWS Budget dashboard shows reduced usage
- [ ] Check CloudWatch logs are not accumulating
- [ ] Confirm no Lambda invocations in past 24 hours
- [ ] Verify S3 buckets are empty or contain minimal data
- [ ] Monitor AWS bill for next 2-3 days to confirm savings
- [ ] Keep budget alarms enabled (alerts if unexpected charges occur)

---

## Troubleshooting

### "cdk destroy" fails with dependency errors
**Solution**: Manually delete resources in AWS Console:
1. Delete S3 bucket contents first (required before bucket deletion)
2. Delete Lambda functions
3. Delete API Gateway
4. Delete Cognito User Pool
5. Retry `cdk destroy`

### S3 bucket won't delete
**Cause**: Bucket versioning enabled, objects still present
**Solution**:
```bash
# Empty versioned bucket completely
aws s3api delete-objects \
  --bucket recipearchive-storage-${AWS_ACCOUNT_ID} \
  --delete "$(aws s3api list-object-versions \
    --bucket recipearchive-storage-${AWS_ACCOUNT_ID} \
    --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
    --output=json)"
```

### Budget alarms still triggering after teardown
**Cause**: Pending charges or resources not fully deleted
**Solution**:
1. Wait 24-48 hours (AWS billing has lag)
2. Check Cost Explorer for detailed breakdown
3. Verify all resources deleted: Lambda, S3, API Gateway, Cognito

---

## Summary

### Recommended Action Plan (Hibernate Mode)
1. ✅ Disable daily GitHub Action (1 min)
2. ✅ Export Cognito users and S3 inventory (5 min)
3. ✅ Empty S3 temp and failed-parsing buckets (2 min)
4. ✅ Delete CloudWatch logs (2 min)
5. ✅ Monitor AWS Budget for verification (1 min)

**Total time**: 10-15 minutes
**Cost savings**: 40-60% reduction
**Reversibility**: 5-10 minutes to resume

### When to Use Full Teardown
- You want **zero AWS costs** during hibernation
- You're comfortable redeploying infrastructure from scratch
- You have a complete backup of all user data
- You're confident you won't need to access data for several months

---

## Questions?

See these docs for more details:
- [aws-backend/infrastructure/README.md](aws-backend/infrastructure/README.md) - CDK deployment
- [docs/disaster-recovery-infrastructure.md](docs/disaster-recovery-infrastructure.md) - Recovery procedures
- [archive/DEPLOYMENT_SUMMARY.md](archive/DEPLOYMENT_SUMMARY.md) - Deployment history

**Created by**: Claude Sonnet 4.5
**Date**: 2026-01-05
