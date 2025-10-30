# Runbook: Production Incident Response

**Purpose:** 5-minute incident response for production outages

## Incident Severity Levels

- **P0 (Critical):** Complete service outage, data loss risk
- **P1 (High):** Major feature unavailable, affecting >50% users
- **P2 (Medium):** Minor feature degraded, affecting <50% users
- **P3 (Low):** Cosmetic issues, no user impact

## Initial Response (2 minutes)

```bash
# 1. Check system health
./scripts/diagnose-health.sh

# 2. Check CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM

# 3. Check recent deployments
git log -5 --oneline
```

## Common Scenarios

### Web App Down

```bash
# Check CloudFront
aws cloudfront get-distribution --id YOUR_DIST_ID | jq '.Distribution.Status'

# Check S3 bucket
aws s3 ls s3://recipe-web-XXXXX/

# Rollback: Redeploy last known good version
git checkout <previous-commit>
./scripts/web/deploy.sh
```

### Lambda Errors

```bash
# Check Lambda logs
aws logs tail /aws/lambda/recipes --follow

# Check error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=recipes \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Quick fix: Increase timeout/memory
aws lambda update-function-configuration \
  --function-name recipes \
  --timeout 60 \
  --memory-size 1024
```

### S3 Access Issues

```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket recipe-storage-XXXXX

# Check CORS configuration
aws s3api get-bucket-cors --bucket recipe-storage-XXXXX

# Fix: Reapply bucket policy
cd aws-backend/infrastructure
npx cdk deploy --exclusively RecipeArchive-Backend
```

### Cognito Auth Failures

```bash
# Check user pool status
aws cognito-idp describe-user-pool \
  --user-pool-id $COGNITO_USER_POOL_ID

# Check app client settings
aws cognito-idp describe-user-pool-client \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --client-id $COGNITO_APP_CLIENT_ID

# Common fix: Sync .env with actual pool ID
grep COGNITO .env
```

## Escalation

If issue persists after 5 minutes:

1. Enable verbose logging in Lambda
2. Review CloudWatch Logs Insights
3. Check AWS Service Health Dashboard
4. Consider temporary service degradation announcement

## Post-Incident

```bash
# 1. Document in PROJECT_STATUS.md
# 2. Create specific runbook if new scenario
# 3. Update monitoring/alerting to catch earlier
```

## Diagnostic Commands

```bash
# Get all CloudWatch log groups
aws logs describe-log-groups | jq -r '.logGroups[].logGroupName' | grep recipe

# Tail multiple log groups
aws logs tail /aws/lambda/recipes /aws/lambda/background-normalizer --follow

# Search for errors across all logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/recipes \
  --filter-pattern "ERROR" \
  --start-time $(($(date +%s) - 3600))000
```

## Related

- [System Health Dashboard](../../PROJECT_STATUS.md)
- [Lambda Cache Issues](./lambda-cache-invalidation.md)
- [Parser Issues](./parser-regression-protocol.md)
