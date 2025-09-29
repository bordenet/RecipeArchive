# AWS Cost Optimization Audit for Multi-Tenant RecipeArchive

## Current State Analysis

### Lambda Functions Configuration

#### Existing Functions

| Function              | Memory (MB) | Timeout (s) | Usage Pattern    | Optimization Priority |
| --------------------- | ----------- | ----------- | ---------------- | --------------------- |
| recipes               | 256         | 30          | High frequency   | **HIGH**              |
| content-normalizer    | 256         | 30          | Medium frequency | **MEDIUM**            |
| background-normalizer | 256         | 30          | Low frequency    | **LOW**               |
| diagnostic-processor  | 256         | 30          | Low frequency    | **LOW**               |
| backup                | 256         | 30          | Scheduled        | **LOW**               |

#### New Multi-Tenant Functions

| Function             | Memory (MB) | Timeout (s) | Usage Pattern      | Optimization Priority |
| -------------------- | ----------- | ----------- | ------------------ | --------------------- |
| invitation-manager   | 256         | 30          | Very low frequency | **CRITICAL**          |
| registration-handler | 256         | 30          | Very low frequency | **CRITICAL**          |

### Cost Optimization Recommendations

## 1. Lambda Memory Optimization

### Current Allocation: 256MB (All Functions)

**Issue**: Over-provisioning for invitation-based functions used only during onboarding

### Recommended Changes:

```typescript
// High-frequency functions (keep current)
recipesFunction: {
  memorySize: 256, // Keep - handles complex recipe operations
  timeout: 30      // Keep - may need time for OpenAI calls
}

// Medium-frequency functions (optimize)
contentNormalizer: {
  memorySize: 256, // Keep - OpenAI API calls need memory
  timeout: 60      // Increase - OpenAI can be slow
}

// Low-frequency admin functions (optimize heavily)
invitationManager: {
  memorySize: 128, // REDUCE - simple CRUD operations
  timeout: 15      // REDUCE - no heavy processing
}

registrationHandler: {
  memorySize: 128, // REDUCE - simple Cognito operations
  timeout: 15      // REDUCE - fast operations
}
```

**Estimated Monthly Savings**: $15-25 for small user base

## 2. API Gateway Rate Limiting

### Current Configuration: No explicit rate limits

**Risk**: Potential cost escalation from abuse or runaway scripts

### Recommended Throttling Limits:

```yaml
# Per-user rate limits (recommended for multi-tenant)
EndpointLimits:
  # Recipe management (high-frequency)
  'GET /recipes':
    requests_per_second: 10
    burst_limit: 20

  'POST /recipes':
    requests_per_second: 2
    burst_limit: 5

  # Admin functions (very low frequency)
  'POST /admin/invitations':
    requests_per_second: 1
    burst_limit: 2

  'GET /admin/invitations':
    requests_per_second: 2
    burst_limit: 3

  # Registration (one-time use)
  'POST /auth/register-with-invitation':
    requests_per_second: 1
    burst_limit: 2
```

**Cost Protection**: Prevents API abuse from costing hundreds of dollars

## 3. Reserved Concurrency Limits

### Current: No concurrency controls

**Risk**: Function scaling costs during traffic spikes

### Recommended Concurrency Limits:

```typescript
// Production workload functions
recipesFunction: {
  reservedConcurrency: 10; // Handle normal traffic
}

// Admin/low-frequency functions
invitationManager: {
  reservedConcurrency: 2; // Max 2 concurrent invitations
}

registrationHandler: {
  reservedConcurrency: 3; // Max 3 concurrent registrations
}

contentNormalizer: {
  reservedConcurrency: 5; // Limit OpenAI concurrent calls
}
```

**Cost Protection**: Caps maximum Lambda costs during unexpected traffic

## 4. DynamoDB On-Demand vs Provisioned

### Current: Pay-per-request (On-Demand)

**Analysis**: Appropriate for current usage patterns

### Recommendation: Keep On-Demand

**Reasons**:

- Unpredictable invitation patterns
- Small user base (< 50 users initially)
- No steady-state traffic patterns yet

**Future**: Monitor after 6 months of multi-tenant usage

## 5. S3 Storage Class Optimization

### Current: Standard storage for all objects

**Opportunity**: Move old archives to cheaper storage classes

### Recommended Lifecycle Policies:

```yaml
LifecycleRules:
  # Web archives (HTML/PDF backups)
  WebArchives:
    - Transition to IA: 30 days
    - Transition to Glacier: 90 days
    - Delete: Never (user data)

  # Temp files and processing artifacts
  TempFiles:
    - Delete: 7 days

  # Failed parsing dumps
  FailedParsing:
    - Transition to IA: 7 days
    - Delete: 30 days
```

**Estimated Savings**: 40-60% on archive storage costs

## 6. CloudWatch Logs Retention

### Current: Likely default (indefinite retention)

**Opportunity**: Set appropriate log retention periods

### Recommended Retention:

```typescript
LogRetentionPeriods: {
  // Production functions
  recipes: 30,           // 30 days - high activity
  contentNormalizer: 14, // 14 days - medium activity

  // Admin functions
  invitationManager: 7,      // 7 days - very low activity
  registrationHandler: 14,   // 14 days - need audit trail

  // Background jobs
  backgroundNormalizer: 7,   // 7 days
  diagnosticProcessor: 3,    // 3 days
}
```

**Estimated Savings**: $10-20/month in log storage costs

## 7. Multi-Tenant Specific Optimizations

### User Quotas (Cost Protection)

```typescript
QuotaLimits: {
  // Per-user limits to prevent cost abuse
  maxRecipesPerUser: 500,
  maxNormalizationsPerMonth: 50,
  maxStoragePerUserMB: 1024,

  // Admin limits
  maxActiveInvitations: 10,
  maxInvitationsPerDay: 5,
}
```

### Usage-Based Alerts

```yaml
CloudWatchAlerts:
  # Cost alerts
  - MonthlySpend > $50
  - DailySpend > $5

  # Usage alerts (per user)
  - UserRecipeCount > 400
  - UserNormalizations > 45/month
  - UserStorageMB > 900

  # System alerts
  - LambdaErrors > 10/hour
  - APIGateway4xx > 100/hour
```

## 8. Implementation Priority

### Phase 1: Immediate (This Week)

- [ ] Add API Gateway rate limiting
- [ ] Set Lambda reserved concurrency
- [ ] Configure CloudWatch log retention
- [ ] Implement user quotas in new functions

### Phase 2: Next Sprint (2 Weeks)

- [ ] Optimize Lambda memory allocation
- [ ] Set up S3 lifecycle policies
- [ ] Create cost monitoring dashboards
- [ ] Implement usage tracking

### Phase 3: Long-term (1 Month)

- [ ] Monitor DynamoDB usage patterns
- [ ] Review and adjust rate limits based on real usage
- [ ] Consider CDK-based infrastructure updates

## Expected Cost Impact

### Current Monthly Estimate (Single User)

- Lambda: $5-10
- API Gateway: $2-5
- DynamoDB: $1-3
- S3: $2-5
- **Total**: ~$10-25/month

### Multi-Tenant (10 Users) Without Optimization

- Lambda: $25-50
- API Gateway: $10-25
- DynamoDB: $5-15
- S3: $10-25
- **Total**: ~$50-115/month

### Multi-Tenant (10 Users) With Optimization

- Lambda: $15-30 (40% savings)
- API Gateway: $8-15 (25% savings)
- DynamoDB: $5-15 (no change - appropriate)
- S3: $6-15 (40% savings with lifecycle)
- **Total**: ~$34-75/month

**Total Monthly Savings**: $16-40 (30-35% cost reduction)

## Monitoring and Alerts

### Daily Monitoring

- Check AWS Cost Explorer for daily spend
- Review Lambda invocation counts
- Monitor API Gateway request volumes

### Weekly Reviews

- Analyze per-user resource consumption
- Review failed invitations/registrations
- Check storage growth patterns

### Monthly Optimization

- Adjust quotas based on user feedback
- Review and tune rate limits
- Analyze cost trends and optimize accordingly

## Risk Mitigation

### Cost Runaway Prevention

1. **Hard Limits**: Reserved concurrency caps maximum spend
2. **Quotas**: Per-user limits prevent individual abuse
3. **Alerts**: Automated notifications before costs escalate
4. **Monitoring**: Daily cost tracking and usage analysis

### User Experience Protection

1. **Graceful Degradation**: Rate limits with helpful error messages
2. **Quota Warnings**: Notify users approaching limits
3. **Admin Override**: Emergency quota increases for legitimate use

This audit provides a comprehensive framework for cost-optimized multi-tenant operation while maintaining system reliability and user experience.
