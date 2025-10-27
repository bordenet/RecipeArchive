# CloudWatch Monitoring Implementation Reference

## Overview

CloudWatch monitoring for RecipeArchive production system to detect parsing failures and recipe quality issues.

## Architecture

### Custom Metrics

**Namespace: RecipeArchive/Diagnostics**
- `ParsingFailures` - Count by ErrorType and Domain
- `EmptyRecipeErrors` - EMPTY_RECIPE error count
- `ValidationErrors` - Recipe validation failures
- `DiagnosticsReceived` - Total diagnostic reports

**Namespace: RecipeArchive/Normalizer**
- `RecipeQuality` - Recipe quality distribution (GARBAGE/POOR/LOW/GOOD)
- `GarbageRecipes` - Count of recipes with 0 ingredients AND 0 instructions

### Alarms

- **HighParsingFailures**: Triggers on >10 errors in 10 minutes
- **GarbageRecipes**: Triggers on >5 garbage recipes in 15 minutes
- **LambdaErrors**: Triggers on >3 Lambda errors in 5 minutes

### Dashboard

**RecipeArchive-Production** dashboard includes:
- Parsing failures by error type (time series)
- Recipe quality distribution (time series)
- Lambda performance metrics (duration, errors)

## Implementation Details

### Phase 1: Diagnostics Lambda Metrics

File: `/aws-backend/functions/diagnostics/main.go`

Add CloudWatch SDK:
```bash
go get github.com/aws/aws-sdk-go-v2/service/cloudwatch
```

Add metrics publishing after processing each error:
```go
import (
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch"
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
)

var cwClient *cloudwatch.Client

func init() {
    cfg, _ := config.LoadDefaultConfig(context.Background())
    cwClient = cloudwatch.NewFromConfig(cfg)
}

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
        fmt.Printf("Failed to publish metric: %v\n", err)
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

### Phase 2: Background Normalizer Metrics

File: `/aws-backend/functions/background-normalizer/main.go`

Add quality validation after normalization:
```go
ingredientCount := len(normalized.Ingredients)
instructionCount := len(normalized.Instructions)

publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
    "Quality": getQualityLevel(ingredientCount, instructionCount),
    "Source":  extractDomain(recipe.URL),
})

if ingredientCount == 0 && instructionCount == 0 {
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

### Phase 3: CDK Monitoring Stack

File: `/aws-backend/infrastructure/lib/monitoring-stack.ts` (new file)

```typescript
import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export class MonitoringStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const alertTopic = new sns.Topic(this, "RecipeArchiveAlerts", {
      displayName: "RecipeArchive Production Alerts",
    });

    alertTopic.addSubscription(
      new subscriptions.EmailSubscription("your-email@example.com")
    );

    const parsingFailureAlarm = new cloudwatch.Alarm(this, "HighParsingFailures", {
      metric: new cloudwatch.Metric({
        namespace: "RecipeArchive/Diagnostics",
        metricName: "ParsingFailures",
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Parser failing frequently - check diagnostics S3 bucket",
    });
    parsingFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    const garbageRecipeAlarm = new cloudwatch.Alarm(this, "GarbageRecipes", {
      metric: new cloudwatch.Metric({
        namespace: "RecipeArchive/Normalizer",
        metricName: "GarbageRecipes",
        statistic: "Sum",
        period: cdk.Duration.minutes(15),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Normalizer producing recipes with 0 ingredients AND 0 instructions",
    });
    garbageRecipeAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    const dashboard = new cloudwatch.Dashboard(this, "RecipeArchiveDashboard", {
      dashboardName: "RecipeArchive-Production",
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Parsing Failures by Error Type",
        left: [
          new cloudwatch.Metric({
            namespace: "RecipeArchive/Diagnostics",
            metricName: "ParsingFailures",
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            dimensionsMap: { ErrorType: "EMPTY_RECIPE" },
            label: "Empty Recipe",
          }),
          new cloudwatch.Metric({
            namespace: "RecipeArchive/Diagnostics",
            metricName: "ParsingFailures",
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            dimensionsMap: { ErrorType: "PARSE_ERROR" },
            label: "Parse Error",
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: "Recipe Quality",
        left: [
          new cloudwatch.Metric({
            namespace: "RecipeArchive/Normalizer",
            metricName: "RecipeQuality",
            statistic: "Sum",
            period: cdk.Duration.minutes(15),
            dimensionsMap: { Quality: "GOOD" },
            label: "Good Quality",
          }),
          new cloudwatch.Metric({
            namespace: "RecipeArchive/Normalizer",
            metricName: "RecipeQuality",
            statistic: "Sum",
            period: cdk.Duration.minutes(15),
            dimensionsMap: { Quality: "GARBAGE" },
            label: "Garbage (0/0)",
          }),
        ],
      })
    );
  }
}
```

Update `/aws-backend/infrastructure/bin/infrastructure.ts`:
```typescript
import { MonitoringStack } from "../lib/monitoring-stack";

const monitoringStack = new MonitoringStack(app, "RecipeArchive-Monitoring", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
```

## Deployment Procedure

### 1. Update Diagnostics Lambda
```bash
cd aws-backend/functions/diagnostics
go get github.com/aws/aws-sdk-go-v2/service/cloudwatch
# Edit main.go to add metrics
go test ./...
cd ../../..
./scripts/deploy-lambda.sh diagnostics
```

### 2. Update Background Normalizer
```bash
cd aws-backend/functions/background-normalizer
# Edit main.go to add metrics and ERROR logging
go test ./...
cd ../../..
./scripts/deploy-lambda.sh background-normalizer
```

### 3. Deploy Monitoring Stack
```bash
cd aws-backend/infrastructure
npm install
npx cdk deploy RecipeArchive-Monitoring
# Confirm SNS email subscription
```

### 4. Verify Deployment
```bash
# Check CloudWatch console for new metrics namespace
# Verify alarms are created and in OK state
# Verify dashboard is accessible
```

## Testing Procedures

### Test Metric Publishing
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

# Check CloudWatch console:
# RecipeArchive/Diagnostics → ParsingFailures
```

### Test Alarm Triggers
```bash
# Send 11 errors rapidly to trigger HighParsingFailures
for i in {1..11}; do
  curl -X POST https://YOUR_API/diagnostics \
    -H "Content-Type: application/json" \
    -d "{\"errors\":[{\"url\":\"https://test.com\",\"errorType\":\"TEST\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]}"
done

# Check CloudWatch Alarms for ALARM state
# Check email for SNS notification
```

## Files Modified/Created

### New Files
- `/aws-backend/infrastructure/lib/monitoring-stack.ts`
- `/docs/operations/MONITORING_IMPLEMENTATION.md`

### Modified Files
- `/aws-backend/functions/diagnostics/main.go` - Add CloudWatch metrics
- `/aws-backend/functions/diagnostics/go.mod` - Add cloudwatch dependency
- `/aws-backend/functions/background-normalizer/main.go` - Add quality metrics + ERROR logging
- `/aws-backend/infrastructure/bin/infrastructure.ts` - Import MonitoringStack
- `/aws-backend/infrastructure/package.json` - Add CloudWatch CDK dependencies

## Success Criteria

- Diagnostics Lambda publishes ParsingFailures metric with dimensions
- Background Normalizer publishes RecipeQuality metric
- Background Normalizer logs ERROR (not INFO) for garbage recipes
- HighParsingFailures alarm triggers on >10 errors in 10 minutes
- GarbageRecipes alarm triggers on >5 garbage recipes in 15 minutes
- Email notifications received via SNS when alarms trigger
- Dashboard shows parsing failure trends and recipe quality distribution

## Estimated Effort

- Development: 4-6 hours
- Testing: 2 hours
- Documentation: 1 hour
- Total: 7-9 hours

## Dependencies

- AWS CDK CLI installed
- CloudWatch permissions in AWS account
- SNS email subscription confirmed
- Access to production CloudWatch logs

## Future Enhancements

- CloudWatch Insights queries for common diagnostic patterns
- Weekly digest of parsing failures by domain
- Automated report: "Top 10 failing domains this week"
- Cost alarms for OpenAI API usage spikes
- Lambda cold start monitoring and optimization
