# Task D: Monitoring & Alerting Implementation Plan

## Objective
Set up CloudWatch monitoring and alerting to detect parsing failures and quality issues in the RecipeArchive production system.

## Current State

### Existing Infrastructure
- **Diagnostics Lambda**: `/aws-backend/functions/diagnostics/main.go`
  - Receives error reports from browser extensions
  - Stores to S3: `s3://recipe-failed-{id}/diagnostics/*.json`
  - Stores failed HTML: `s3://recipe-failed-{id}/failed-parsing/*.html`

- **Extension Error Reporting**: Browser extensions already POST to diagnostics endpoint
  - Error types: `EMPTY_RECIPE`, `PARSE_ERROR`, `VALIDATION_ERROR`, etc.
  - Includes URL, userAgent, timestamp, HTML content

- **Background Normalizer**: Lambda that processes recipes via OpenAI
  - Logs to CloudWatch but no metrics
  - Shows false success for broken recipes (0 ingredients/instructions)

### Current Problems (from PROJECT_STATUS.md)
1. ❌ Extensions report errors to S3 but **no monitoring**
2. ❌ No CloudWatch alarms for parsing failures
3. ❌ No dashboard for error trends
4. ❌ False success indicators everywhere (logs show "✅ success" for garbage data)

## Implementation Plan

### Phase 1: CloudWatch Metrics (Priority: High)

**Create Custom Metrics from Diagnostics Lambda**

File: `/aws-backend/functions/diagnostics/main.go`

Add CloudWatch metrics publishing:
```go
import (
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch"
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
)

// Add to init():
var cwClient *cloudwatch.Client
cfg, _ := config.LoadDefaultConfig(context.Background())
cwClient = cloudwatch.NewFromConfig(cfg)

// After processing each error (line ~182):
publishMetric(ctx, "ParsingFailures", 1.0, diagnosticData.ErrorType, diagnosticData.URL)

func publishMetric(ctx context.Context, metricName string, value float64, errorType string, url string) {
    domain := extractDomain(url)

    _, err := cwClient.PutMetricData(ctx, &cloudwatch.PutMetricDataInput{
        Namespace: aws.String("RecipeArchive/Diagnostics"),
        MetricData: []types.MetricDatum{
            {
                MetricName: aws.String(metricName),
                Value:      aws.Float64(value),
                Unit:       types.StandardUnitCount,
                Timestamp:  aws.Time(time.Now()),
                Dimensions: []types.Dimension{
                    {Name: aws.String("ErrorType"), Value: aws.String(errorType)},
                    {Name: aws.String("Domain"), Value: aws.String(domain)},
                },
            },
        },
    })
    if err != nil {
        fmt.Printf("⚠️ Failed to publish metric: %v\n", err)
    }
}

func extractDomain(url string) string {
    url = strings.ReplaceAll(url, "https://", "")
    url = strings.ReplaceAll(url, "http://", "")
    parts := strings.Split(url, "/")
    domain := strings.ReplaceAll(parts[0], "www.", "")
    return domain
}
```

**Metrics to Track:**
- `ParsingFailures` - Count by ErrorType and Domain
- `EmptyRecipeErrors` - Specifically EMPTY_RECIPE errors
- `ValidationErrors` - Recipe validation failures
- `DiagnosticsReceived` - Total diagnostics posted

### Phase 2: Background Normalizer Metrics (Priority: High)

**Add Quality Metrics to Background Normalizer**

File: `/aws-backend/functions/background-normalizer/main.go`

Find where recipes are processed and add:
```go
// After normalization, check quality
ingredientCount := len(normalized.Ingredients)
instructionCount := len(normalized.Instructions)

// Publish quality metrics
publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
    "Quality": getQualityLevel(ingredientCount, instructionCount),
    "Source":  extractDomain(recipe.URL),
})

if ingredientCount == 0 && instructionCount == 0 {
    // This is GARBAGE - log ERROR not INFO
    log.Printf("ERROR: Recipe has 0 ingredients and 0 instructions: %s", recipe.URL)
    publishMetric(ctx, "GarbageRecipes", 1.0, map[string]string{
        "Source": extractDomain(recipe.URL),
    })
}

func getQualityLevel(ingredients, instructions int) string {
    if ingredients == 0 && instructions == 0 {
        return "GARBAGE"
    }
    if ingredients == 0 || instructions == 0 {
        return "POOR"
    }
    if ingredients < 3 || instructions < 3 {
        return "LOW"
    }
    return "GOOD"
}
```

### Phase 3: CloudWatch Alarms (Priority: High)

**Create CDK Stack for Alarms**

File: `/aws-backend/infrastructure/lib/monitoring-stack.ts` (NEW)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

export class MonitoringStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SNS Topic for alerts
    const alertTopic = new sns.Topic(this, 'RecipeArchiveAlerts', {
      displayName: 'RecipeArchive Production Alerts',
    });

    // Add email subscription (replace with your email)
    alertTopic.addSubscription(
      new subscriptions.EmailSubscription('your-email@example.com')
    );

    // Alarm: High parsing failure rate
    const parsingFailureAlarm = new cloudwatch.Alarm(this, 'HighParsingFailures', {
      metric: new cloudwatch.Metric({
        namespace: 'RecipeArchive/Diagnostics',
        metricName: 'ParsingFailures',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Parser is failing frequently - check diagnostics S3 bucket',
    });
    parsingFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    // Alarm: Garbage recipes being produced
    const garbageRecipeAlarm = new cloudwatch.Alarm(this, 'GarbageRecipes', {
      metric: new cloudwatch.Metric({
        namespace: 'RecipeArchive/Normalizer',
        metricName: 'GarbageRecipes',
        statistic: 'Sum',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Normalizer producing recipes with 0 ingredients AND 0 instructions',
    });
    garbageRecipeAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    // Alarm: Lambda errors
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrors', {
      metric: cloudwatch.Metric.fromMetricName(
        'AWS/Lambda',
        'Errors',
        'Sum',
        {
          dimensions: { FunctionName: 'background-normalizer' },
          period: cdk.Duration.minutes(5),
        }
      ),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda function errors detected',
    });
    lambdaErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
  }
}
```

Add to `/aws-backend/infrastructure/bin/infrastructure.ts`:
```typescript
import { MonitoringStack } from '../lib/monitoring-stack';

const monitoringStack = new MonitoringStack(app, 'RecipeArchive-Monitoring', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
```

### Phase 4: CloudWatch Dashboard (Priority: Medium)

**Create Operational Dashboard**

Add to MonitoringStack:
```typescript
// CloudWatch Dashboard
const dashboard = new cloudwatch.Dashboard(this, 'RecipeArchiveDashboard', {
  dashboardName: 'RecipeArchive-Production',
});

dashboard.addWidgets(
  // Parsing Failures by Error Type
  new cloudwatch.GraphWidget({
    title: 'Parsing Failures by Error Type',
    left: [
      new cloudwatch.Metric({
        namespace: 'RecipeArchive/Diagnostics',
        metricName: 'ParsingFailures',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: { ErrorType: 'EMPTY_RECIPE' },
        label: 'Empty Recipe',
      }),
      new cloudwatch.Metric({
        namespace: 'RecipeArchive/Diagnostics',
        metricName: 'ParsingFailures',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: { ErrorType: 'PARSE_ERROR' },
        label: 'Parse Error',
      }),
    ],
  }),

  // Recipe Quality Distribution
  new cloudwatch.GraphWidget({
    title: 'Recipe Quality',
    left: [
      new cloudwatch.Metric({
        namespace: 'RecipeArchive/Normalizer',
        metricName: 'RecipeQuality',
        statistic: 'Sum',
        period: cdk.Duration.minutes(15),
        dimensionsMap: { Quality: 'GOOD' },
        label: 'Good Quality',
      }),
      new cloudwatch.Metric({
        namespace: 'RecipeArchive/Normalizer',
        metricName: 'RecipeQuality',
        statistic: 'Sum',
        period: cdk.Duration.minutes(15),
        dimensionsMap: { Quality: 'GARBAGE' },
        label: 'Garbage (0/0)',
      }),
    ],
  }),

  // Lambda Performance
  new cloudwatch.GraphWidget({
    title: 'Lambda Duration',
    left: [
      cloudwatch.Metric.fromMetricName('AWS/Lambda', 'Duration', 'Average', {
        dimensions: { FunctionName: 'background-normalizer' },
        period: cdk.Duration.minutes(5),
      }),
    ],
  }),
);
```

### Phase 5: S3 Event Metrics (Priority: Low)

**Track Diagnostic S3 Write Rate**

Create S3 bucket metrics for failed-parsing bucket to see upload trends.

CDK:
```typescript
const failedParsingBucket = s3.Bucket.fromBucketName(
  this,
  'FailedParsingBucket',
  'recipe-failed-0ea7007d57f67ecb-990537043943'
);

// Add metric filter for diagnostics/ prefix
const diagnosticsMetric = new cloudwatch.Metric({
  namespace: 'AWS/S3',
  metricName: 'NumberOfObjects',
  dimensionsMap: {
    BucketName: failedParsingBucket.bucketName,
    StorageType: 'AllStorageTypes',
  },
  statistic: 'Average',
  period: cdk.Duration.hours(1),
});

new cloudwatch.Alarm(this, 'HighDiagnosticVolume', {
  metric: diagnosticsMetric,
  threshold: 100,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  alarmDescription: 'Large number of diagnostic files - possible parser regression',
});
```

## Deployment Steps

### 1. Update Diagnostics Lambda
```bash
cd aws-backend/functions/diagnostics
# Add CloudWatch SDK dependency
go get github.com/aws/aws-sdk-go-v2/service/cloudwatch
# Edit main.go to add metrics publishing
# Test locally
go test ./...
# Deploy
cd ../../..
./scripts/deploy-lambda.sh diagnostics
```

### 2. Update Background Normalizer
```bash
cd aws-backend/functions/background-normalizer
# Add metrics and ERROR logging
# Test locally
go test ./...
# Deploy
./scripts/deploy-lambda.sh background-normalizer
```

### 3. Deploy Monitoring Stack
```bash
cd aws-backend/infrastructure
npm install
npx cdk deploy RecipeArchive-Monitoring
```

### 4. Verify Alarms
```bash
# Check CloudWatch console
# Confirm SNS subscription email
# Trigger test alarm (manually invoke Lambda with test payload)
```

## Testing Plan

### 1. Test Metrics Publishing
```bash
# Trigger diagnostics endpoint with test error
curl -X POST https://YOUR_API/diagnostics \
  -H "Content-Type: application/json" \
  -d '{
    "errors": [{
      "url": "https://test.com/recipe",
      "errorType": "EMPTY_RECIPE",
      "error": "Test error",
      "timestamp": "2025-10-27T00:00:00Z"
    }]
  }'

# Check CloudWatch console for metric: RecipeArchive/Diagnostics -> ParsingFailures
```

### 2. Test Alarms
```bash
# Send 11 errors rapidly to trigger HighParsingFailures alarm
for i in {1..11}; do
  curl -X POST https://YOUR_API/diagnostics -d '{"errors":[{"url":"https://test.com","errorType":"TEST","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}]}'
done

# Check CloudWatch Alarms - should go to ALARM state
# Check email for SNS notification
```

### 3. Validate Dashboard
```bash
# Open CloudWatch console
# Navigate to Dashboards -> RecipeArchive-Production
# Verify widgets show data
# Check time ranges and refresh
```

## Success Criteria

✅ **Metrics Publishing:**
- [ ] Diagnostics Lambda publishes ParsingFailures metric
- [ ] Background Normalizer publishes RecipeQuality metric
- [ ] Background Normalizer logs ERROR for garbage recipes (not INFO)

✅ **Alarms Working:**
- [ ] HighParsingFailures alarm triggers on >10 errors in 10 min
- [ ] GarbageRecipes alarm triggers on >5 garbage recipes in 15 min
- [ ] Email notifications received via SNS

✅ **Dashboard Operational:**
- [ ] Dashboard shows parsing failure trends
- [ ] Dashboard shows recipe quality distribution
- [ ] Dashboard shows Lambda performance metrics

✅ **Documentation:**
- [ ] README documents alarm thresholds
- [ ] Runbook for responding to alarms
- [ ] CloudWatch Insights queries for common diagnostics

## Files to Create/Modify

### New Files:
- `/aws-backend/infrastructure/lib/monitoring-stack.ts`
- `/docs/operations/MONITORING_RUNBOOK.md`

### Modified Files:
- `/aws-backend/functions/diagnostics/main.go` - Add CloudWatch metrics
- `/aws-backend/functions/background-normalizer/main.go` - Add quality metrics + ERROR logging
- `/aws-backend/infrastructure/bin/infrastructure.ts` - Import MonitoringStack
- `/aws-backend/infrastructure/package.json` - Add CloudWatch CDK dependencies

## Estimated Effort
- **Development**: 4-6 hours
- **Testing**: 2 hours
- **Documentation**: 1 hour
- **Total**: 7-9 hours

## Dependencies
- AWS CDK CLI installed
- CloudWatch permissions in AWS account
- SNS email subscription confirmed
- Access to production CloudWatch logs

## Follow-up Work (Post-Implementation)
1. Create CloudWatch Insights queries for common diagnostics patterns
2. Set up weekly digest of parsing failures by domain
3. Build automated report: "Top 10 failing domains this week"
4. Add cost alarms for OpenAI API usage spikes
5. Monitor Lambda cold start times and optimize if needed

---

**Status**: Ready for implementation
**Priority**: High (Task D in sequence A→D→B→C)
**Blockers**: None
