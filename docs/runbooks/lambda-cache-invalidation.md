# Runbook: Lambda Cache Invalidation

**Issue:** Lambda in-memory cache causes stale data to persist across container reuse
**Impact:** 77% cache miss rate, increased costs and latency
**P0 Priority:** Medium

## Symptoms

- Recipe updates not reflecting immediately
- Inconsistent recipe data between requests
- Cache hit rate below 30%
- High Lambda execution costs

## Root Cause

Lambda functions persist in-memory cache across container reuse without TTL or invalidation strategy. Content hashing is based on counts only (insufficient).

## Quick Fix: Disable Cache

```bash
# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name recipes \
  --environment "Variables={CACHE_ENABLED=false}"

# Verify
aws lambda get-function-configuration \
  --function-name recipes \
  --query 'Environment.Variables.CACHE_ENABLED'
```

## Long-term Solutions

### Option 1: DynamoDB Cache with TTL

```bash
# Deploy DynamoDB cache table (add to CDK)
# Update Lambda to use DynamoDB instead of in-memory
```

**Pros:** Shared cache across Lambda instances, proper TTL
**Cons:** Additional AWS costs (~$5-10/month), increased latency

### Option 2: Improved Content Hashing

Update cache key from count-based to content-hash-based:

```go
// Before: hash based on ingredient/instruction counts
cacheKey := fmt.Sprintf("%d-%d", len(ingredients), len(instructions))

// After: hash based on actual content
hash := sha256.Sum256([]byte(recipeJSON))
cacheKey := hex.EncodeToString(hash[:])
```

**Pros:** No additional costs, better cache accuracy
**Cons:** Requires code changes and testing

## Verification

```bash
# Check cache metrics
aws cloudwatch get-metric-statistics \
  --namespace RecipeArchive \
  --metric-name CacheHitRate \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

Target: >70% cache hit rate

## Related

- Lambda Cache Inefficiency (archived)
