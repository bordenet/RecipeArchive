import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as s3 from 'aws-cdk-lib/aws-s3';

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
      metric: new cloudwatch.Metric({
        metricName: 'Errors',
        namespace: 'AWS/Lambda',
        dimensionsMap: { FunctionName: 'background-normalizer' },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda function errors detected',
    });
    lambdaErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

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
            dimensionsMap: { Quality: 'LOW' },
            label: 'Low Quality',
          }),
          new cloudwatch.Metric({
            namespace: 'RecipeArchive/Normalizer',
            metricName: 'RecipeQuality',
            statistic: 'Sum',
            period: cdk.Duration.minutes(15),
            dimensionsMap: { Quality: 'POOR' },
            label: 'Poor (0 ingredients OR 0 instructions)',
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
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            statistic: 'Average',
            dimensionsMap: { FunctionName: 'background-normalizer' },
            period: cdk.Duration.minutes(5),
          }),
        ],
      }),
    );

    // S3 Event Metrics
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
  }
}
