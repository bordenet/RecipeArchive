# Deployment Troubleshooting Guide

## Flutter Web App Deployment Issues

### Issue: Missing S3 Bucket Error

**Symptoms:** `NoSuchBucket` error when accessing production URL

**Root Cause:** S3 bucket referenced by CloudFront doesn't exist

**Solution:** Updated deployment scripts now automatically:

1. Check if S3 bucket exists before deployment
2. Create bucket if missing (`aws s3 mb`)
3. Configure bucket for static website hosting
4. Set proper index and error documents

**Fixed in:** `scripts/web-deploy.sh` and `scripts/deploy-aws-infrastructure.sh`

### Issue: Flutter Build Failures

**Symptoms:**

- `IconTreeShakerException: Font subsetting failed`
- Build crashes during icon processing

**Root Cause:** Icon tree shaking conflicts with font subsetting

**Solution:** Use compatibility flags:

```bash
flutter build web --release --no-tree-shake-icons --no-wasm-dry-run
```

**Fixed in:** All deployment scripts now use these flags

### Issue: S3 Upload Timeouts

**Symptoms:**

- `RequestTimeout` errors during large file uploads
- Partial uploads with connection drops

**Root Cause:** Default AWS CLI timeout too aggressive for large assets

**Solution:** Retry with extended timeouts:

```bash
aws s3 sync build/web/ s3://bucket-name/ --delete \
  --cli-read-timeout 0 --cli-connect-timeout 60
```

**Fixed in:** `scripts/web-deploy.sh` includes retry logic

## CloudFront Configuration

### Distribution Details

- **ID:** E1D19F7SLOJM5H
- **Domain:** Your CloudFront distribution (from `.env` CLOUDFRONT_URL)
- **Origin:** recipearchive-web-app-prod-990537043943.s3-website-us-west-2.amazonaws.com

### Cache Invalidation

Scripts automatically invalidate cache after deployment:

```bash
aws cloudfront create-invalidation --distribution-id E1D19F7SLOJM5H --paths "/*"
```

## Recovery Procedures

### Complete Flutter App Recovery

1. **Create missing bucket:**

   ```bash
   aws s3 mb s3://recipearchive-web-app-prod-990537043943 --region us-west-2
   aws s3 website s3://recipearchive-web-app-prod-990537043943 \
     --index-document index.html --error-document index.html
   ```

2. **Build and deploy:**

   ```bash
   cd recipe_archive
   flutter clean && flutter pub get
   flutter build web --release --no-tree-shake-icons --no-wasm-dry-run
   aws s3 sync build/web/ s3://recipearchive-web-app-prod-990537043943 --delete
   ```

3. **Invalidate CloudFront:**
   ```bash
   aws cloudfront create-invalidation --distribution-id E1D19F7SLOJM5H --paths "/*"
   ```

### Automated Recovery

Run the updated deployment script:

```bash
./scripts/web-deploy.sh
```

This script now handles all the above issues automatically.

## Monitoring

### Health Checks

- **Production URL:** Your CloudFront URL (from `.env` CLOUDFRONT_URL)
- **Expected Response:** Flutter app loading page
- **Error Signs:** 404, NoSuchBucket, blank page

### Logs

- **CloudWatch:** Check CloudFront access logs
- **S3:** Verify bucket exists and has proper website configuration
- **Build Logs:** Check Flutter build output for warnings

### Issue: Lambda Functions with Outdated Environment Variables

**Symptoms:** API endpoints return internal server errors or unexpected responses

**Root Cause:** Lambda functions deployed with old environment variables (API Gateway URLs, Cognito User Pool IDs)

**Solution:** Update Lambda function environment variables with current values:

```bash
# Check current environment variables
aws lambda get-function-configuration --function-name "FUNCTION_NAME" --region us-west-2 --query "Environment.Variables"

# Update with correct values
aws lambda update-function-configuration \
  --function-name "FUNCTION_NAME" \
  --region us-west-2 \
  --environment 'Variables={API_GATEWAY_URL=https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod,COGNITO_USER_POOL_ID=us-west-2_rpBcEEhYK,...}'
```

**Fixed in:** Systematic Lambda environment variable updates (September 19, 2025) - All 6 Lambda functions updated with correct Cognito User Pool ID and API Gateway URLs

### Issue: CORS Preflight Failures (OPTIONS Method Missing)

**Symptoms:**

- Browser console shows CORS policy errors
- "No 'Access-Control-Allow-Origin' header is present on the requested resource"
- Recipe loading fails with CORS errors

**Root Cause:** API Gateway missing OPTIONS method for CORS preflight requests

**Solution:** Deploy with CORS configuration (automatic):

```bash
# CORS configuration is now automated in deployment scripts
./scripts/deploy-aws-infrastructure.sh --backend-only
```

**Manual Fix (if needed):**

```bash
# Get API Gateway and resource IDs
API_ID=$(aws apigateway get-rest-apis --query "items[?contains(name, 'recipe-api')].id" --output text)
RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='recipes'].id" --output text)

# Add OPTIONS method for CORS
aws apigateway put-method --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method OPTIONS --authorization-type NONE
aws apigateway put-integration --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method OPTIONS --type MOCK --request-templates '{"application/json": "{\"statusCode\": 200}"}'
aws apigateway put-method-response --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}'
aws apigateway put-integration-response --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'${CLOUDFRONT_URL}'"'"'"}'
aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod
```

**Fixed in:** Enhanced deployment scripts with automatic CORS configuration (September 18, 2025)

### Issue: Systematic Lambda Environment Variable Mismatch (September 19, 2025)

**Symptoms:**

- Multiple app features not working: invitations, analytics, OpenAI normalization
- Authentication failures across different services
- Functions returning authentication errors

**Root Cause:** Multiple Lambda functions deployed with outdated environment variables:

- Incorrect Cognito User Pool ID: `us-west-2_xr2a7PPdi` instead of `us-west-2_rpBcEEhYK`
- Incorrect API Gateway URL in analytics function

**Functions Updated:**

- RecipeArchive-dev-InvitationManagerFunctionC8A45B8-yiEZQLmLoXj5
- RecipeArchive-dev-ImageUploadFunction1528BFB7-SkQEMmTH8zTf
- RecipeArchive-dev-ContentNormalizerFunction7256CD8-H9PZ1QlG31vV
- RecipeArchive-dev-HealthFunction19D7724A-ZDwHNtPzi1E9
- RecipeAnalyticsAggregator

**Solution:** Updated all functions with correct environment variables

```bash
aws lambda update-function-configuration \
  --function-name "FUNCTION_NAME" \
  --region us-west-2 \
  --environment 'Variables={COGNITO_USER_POOL_ID=us-west-2_rpBcEEhYK,...}'
```

**Impact:** Restored functionality for invitations management, analytics, and OpenAI content normalization

**Fixed in:** Systematic Lambda troubleshooting (September 19, 2025)

## Updated Files (September 18-19, 2025)

- `scripts/web-deploy.sh` - Bucket creation + build fixes
- `scripts/deploy-aws-infrastructure.sh` - Flutter build compatibility flags + automated CORS configuration
- `validate-monorepo.sh` - CORS configuration validation
- `docs/deployment/troubleshooting.md` - This guide + Lambda environment variable + CORS fixes
- `.env` - Added API_GATEWAY_ID for deployment automation
- `extensions/build-parser-bundle.js` - Fixed parser path references
- `parsers/base-parser.ts` - Added multi-step instruction parsing logic

**September 19, 2025 Lambda Updates:**

- All 6 Lambda functions updated with correct Cognito User Pool ID
- Analytics function updated with correct API Gateway URL
- Full authentication and service integration restored

These fixes ensure future deployments will handle missing buckets, build issues, environment variable mismatches, CORS configuration, and multi-step instruction parsing automatically.
