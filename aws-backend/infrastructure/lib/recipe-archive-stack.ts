import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export interface RecipeArchiveStackProps extends cdk.StackProps {
  environment: string;
  adminEmail: string;
}

export class RecipeArchiveStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly storageBucket: s3.Bucket;
  public readonly tempBucket: s3.Bucket;
  public readonly failedParsingBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly billingAlertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: RecipeArchiveStackProps) {
    super(scope, id, props);

    // Cognito User Pool for Authentication
    this.userPool = new cognito.UserPool(this, 'RecipeArchiveUserPool', {
      userPoolName: `recipeArchive-users-${props.environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        props.environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // Cognito User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(
      this,
      'RecipeArchiveUserPoolClient',
      {
        userPool: this.userPool,
        userPoolClientName: `recipeArchive-client-${props.environment}`,
        generateSecret: false, // Public client for browser/mobile apps
        authFlows: {
          userPassword: true,
          userSrp: true,
          custom: false,
          adminUserPassword: false,
        },
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
          },
          scopes: [
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.PROFILE,
          ],
        },
        accessTokenValidity: cdk.Duration.hours(1),
        idTokenValidity: cdk.Duration.hours(1),
        refreshTokenValidity: cdk.Duration.days(30),
        enableTokenRevocation: true,
      }
    );


    // S3 Buckets with Environment-Specific Retention Policies

    // Primary Storage Bucket for Recipe Photos and Documents
    this.storageBucket = new s3.Bucket(this, 'RecipeArchiveStorage', {
      bucketName: `recipearchive-storage-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: props.environment === 'prod',
      lifecycleRules: [
        {
          id: 'delete-incomplete-uploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        // Environment-specific retention policies
        ...(props.environment === 'prod'
          ? [
              {
                id: 'archive-old-files',
                expiration: cdk.Duration.days(2555), // 7 years for production
              },
              {
                id: 'archive-old-versions',
                noncurrentVersionExpiration: cdk.Duration.days(365),
              },
            ]
          : [
              {
                // STRICT 14-DAY RETENTION FOR PRE-PROD TESTING
                id: 'delete-test-data',
                expiration: cdk.Duration.days(14),
                enabled: true,
              },
            ]),
      ],
      removalPolicy:
        props.environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // Temporary/Processing Bucket with Ultra-Short Retention
    this.tempBucket = new s3.Bucket(this, 'RecipeArchiveTemp', {
      bucketName: `recipearchive-temp-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false, // Never version temporary files
      lifecycleRules: [
        {
          id: 'delete-temp-files',
          expiration: cdk.Duration.days(props.environment === 'prod' ? 7 : 1),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1), // Fixed: use days instead of hours
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Always destroy temp bucket
    });

    // Failed Parsing HTML Storage Bucket with Size and Time Limits
    this.failedParsingBucket = new s3.Bucket(this, 'RecipeArchiveFailedParsing', {
      bucketName: `recipearchive-failed-parsing-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false, // No versioning needed for failed parsing data
      lifecycleRules: [
        {
          id: 'delete-failed-parsing-data',
          expiration: cdk.Duration.days(30), // Auto-purge after 30 days
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      // Bucket notification to monitor size (will be handled by CloudWatch metrics)
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Always safe to destroy failed parsing data
    });

    // IAM Role for Lambda Functions (TODO: Implement Lambda functions)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const lambdaRole = new iam.Role(this, 'RecipeArchiveLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
      inlinePolicies: {
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetObjectUrl',
                's3:PutObjectAcl', // For public image uploads
              ],
              resources: [
                `${this.storageBucket.bucketArn}/*`,
                `${this.tempBucket.bucketArn}/*`,
                `${this.failedParsingBucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:ListBucket'],
              resources: [
                this.storageBucket.bucketArn,
                this.tempBucket.bucketArn,
                this.failedParsingBucket.bucketArn,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
              ],
              resources: ['*'], // Will be restricted to specific queue in production
            }),
          ],
        }),
      },
    });

    // API Gateway with DDoS Protection
    this.api = new apigateway.RestApi(this, 'RecipeArchiveAPI', {
      restApiName: `recipeArchive-api-${props.environment}`,
      description: 'RecipeArchive Backend API',
      defaultCorsPreflightOptions: {
        allowOrigins: ['https://localhost:3000', 'https://recipearchive.com', 'https://d1jcaphz4458q7.cloudfront.net'], // Restrict origins
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowCredentials: true, // Important for authenticated requests
      },
      deployOptions: {
        stageName: 'prod',
      },
    });

    // DDoS Protection: Usage Plan with Rate Limiting
    const usagePlan = new apigateway.UsagePlan(this, 'RecipeArchiveUsagePlan', {
      name: `recipearchive-usage-plan-${props.environment}`,
      description: 'Usage plan for DDoS protection',
      throttle: {
        rateLimit: 200,    // requests per second per API key
        burstLimit: 400,   // concurrent requests
      },
      quota: {
        limit: 10000,      // requests per month per API key
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Cognito Authorizer for API Gateway - DDoS Protection & Authentication
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [this.userPool],
        authorizerName: 'recipeArchive-cognito-authorizer',
        resultsCacheTtl: cdk.Duration.minutes(5), // Cache auth results to reduce load
      }
    );

    // Request Validator for DDoS Protection - Reject malformed requests early
    const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.api,
      requestValidatorName: 'recipe-request-validator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // SQS Queue for async recipe normalization (must be defined before Lambda functions that reference it)
    const recipeNormalizationQueue = new sqs.Queue(this, 'RecipeNormalizationQueue', {
      queueName: `recipe-normalization-${props.environment}`,
      visibilityTimeout: cdk.Duration.seconds(60), // Allow 60 seconds for processing
      retentionPeriod: cdk.Duration.days(14), // Keep messages for 2 weeks
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'RecipeNormalizationDLQ', {
          queueName: `recipe-normalization-dlq-${props.environment}`,
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3, // Try 3 times before moving to DLQ
      },
    });

    // Lambda Functions
    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/health-package'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128, // Minimal memory for Free Tier optimization
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        S3_STORAGE_BUCKET: this.storageBucket.bucketName,
        S3_TEMP_BUCKET: this.tempBucket.bucketName,
        S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
      },
      role: lambdaRole,
    });

    const recipesFunction = new lambda.Function(this, 'RecipesFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/recipes-package'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256, // More memory for CRUD operations
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        S3_STORAGE_BUCKET: this.storageBucket.bucketName,
        S3_TEMP_BUCKET: this.tempBucket.bucketName,
        S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        API_GATEWAY_URL: `https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod`,
        NORMALIZATION_QUEUE_URL: recipeNormalizationQueue.queueUrl,
      },
      role: lambdaRole,
    });

    const imageUploadFunction = new lambda.Function(this, 'ImageUploadFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/image-upload-package'),
      timeout: cdk.Duration.seconds(30), // More time for image processing
      memorySize: 512, // More memory for image processing
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        S3_STORAGE_BUCKET: this.storageBucket.bucketName,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
      },
      role: lambdaRole,
    });

    const diagnosticsFunction = new lambda.Function(this, 'DiagnosticsFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/diagnostics-package'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
      },
      role: lambdaRole,
    });

    // Content Normalizer Function (OpenAI integration)
    const contentNormalizerFunction = new lambda.Function(this, 'ContentNormalizerFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/content-normalizer-package'),
      timeout: cdk.Duration.seconds(30), // Longer timeout for OpenAI API calls
      memorySize: 512, // More memory for JSON processing
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '', // Read from environment
      },
      role: lambdaRole,
    });

    // Background Recipe Normalizer Function (processes SQS queue)
    const backgroundNormalizerFunction = new lambda.Function(this, 'BackgroundNormalizerFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/background-normalizer-package'),
      timeout: cdk.Duration.seconds(45), // Longer timeout for OpenAI processing
      memorySize: 512,
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        S3_STORAGE_BUCKET: this.storageBucket.bucketName,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      },
      role: lambdaRole,
    });

    // Connect SQS queue to background normalizer Lambda
    backgroundNormalizerFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(recipeNormalizationQueue, {
        batchSize: 1, // Process one recipe at a time
        maxBatchingWindow: cdk.Duration.seconds(5),
      })
    );

    // Diagnostic Processor Function (Failed parse workflow)
    const diagnosticProcessorFunction = new lambda.Function(this, 'DiagnosticProcessorFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/diagnostic-processor-package'),
      timeout: cdk.Duration.seconds(60), // Longer timeout for S3 analysis
      memorySize: 1024, // More memory for processing diagnostic data
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
      },
      role: lambdaRole,
    });

    // API Gateway Integration
    const healthIntegration = new apigateway.LambdaIntegration(healthFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // API Resources
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', healthIntegration);

    const v1 = this.api.root.addResource('v1');

    // Diagnostics endpoint (authenticated)
    const diagnosticsResource = v1.addResource('diagnostics');
    const diagnosticsIntegration = new apigateway.LambdaIntegration(diagnosticsFunction);
    diagnosticsResource.addMethod('POST', diagnosticsIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });

    // Content Normalizer endpoint (internal system calls - no auth required)
    const normalizerResource = v1.addResource('normalize');
    const normalizerIntegration = new apigateway.LambdaIntegration(contentNormalizerFunction);
    normalizerResource.addMethod('POST', normalizerIntegration, {
      // No authorizer - allow internal system calls from recipes function
      requestValidator: requestValidator,
    });

    // Diagnostic Processor endpoint (authenticated)
    const diagnosticProcessorResource = v1.addResource('diagnostic-summary');
    const diagnosticProcessorIntegration = new apigateway.LambdaIntegration(diagnosticProcessorFunction);
    diagnosticProcessorResource.addMethod('GET', diagnosticProcessorIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });

    // Future recipe endpoints
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const recipesResource = v1.addResource('recipes');

    // Recipe CRUD operations with Authentication
    const recipesIntegration = new apigateway.LambdaIntegration(recipesFunction);
    
    // List recipes: GET /v1/recipes (requires authentication)
    recipesResource.addMethod('GET', recipesIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });
    
    // Create recipe: POST /v1/recipes (requires authentication)
    recipesResource.addMethod('POST', recipesIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });
    
    // Single recipe operations: GET/PUT/DELETE /v1/recipes/{id} (requires authentication)
    const recipeResource = recipesResource.addResource('{id}');
    recipeResource.addMethod('GET', recipesIntegration, {
      authorizer: cognitoAuthorizer,
    });
    recipeResource.addMethod('PUT', recipesIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });
    recipeResource.addMethod('DELETE', recipesIntegration, {
      authorizer: cognitoAuthorizer,
    });

    // Image upload endpoint: POST /v1/images/upload (requires authentication)
    const imagesResource = v1.addResource('images');
    const uploadResource = imagesResource.addResource('upload');
    const imageUploadIntegration = new apigateway.LambdaIntegration(imageUploadFunction);
    uploadResource.addMethod('POST', imageUploadIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });

    // Add Gateway Responses to include CORS headers on API Gateway error responses
    this.api.addGatewayResponse('unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'https://d1jcaphz4458q7.cloudfront.net'`,
        'Access-Control-Allow-Credentials': `'true'`,
        'Access-Control-Allow-Headers': `'Content-Type,Authorization'`,
      },
    });

    this.api.addGatewayResponse('access-denied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'https://d1jcaphz4458q7.cloudfront.net'`,
        'Access-Control-Allow-Credentials': `'true'`,
        'Access-Control-Allow-Headers': `'Content-Type,Authorization'`,
      },
    });

    this.api.addGatewayResponse('default-4xx', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'https://d1jcaphz4458q7.cloudfront.net'`,
        'Access-Control-Allow-Credentials': `'true'`,
        'Access-Control-Allow-Headers': `'Content-Type,Authorization'`,
      },
    });

    this.api.addGatewayResponse('default-5xx', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'https://d1jcaphz4458q7.cloudfront.net'`,
        'Access-Control-Allow-Credentials': `'true'`,
        'Access-Control-Allow-Headers': `'Content-Type,Authorization'`,
      },
    });

    // 🚨 COST MONITORING & BILLING ALERTS 🚨

    // SNS Topic for billing alerts
    this.billingAlertTopic = new sns.Topic(this, 'BillingAlerts', {
      topicName: `recipearchive-billing-alerts-${props.environment}`,
      displayName: 'RecipeArchive Billing Alerts',
    });

    // Email subscription for billing alerts
    this.billingAlertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(props.adminEmail)
    );

    // AWS Budget for conservative monthly cost monitoring ($20/month maximum)
    new budgets.CfnBudget(this, 'MonthlyCostBudget', {
      budget: {
        budgetName: `RecipeArchive-MonthlyCostWatchdog-${props.environment}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: 20, // $20/month maximum budget
          unit: 'USD',
        },
        costFilters: {
          // Only monitor this account's costs
        },
        timePeriod: {
          start: '1756080093', // August 24, 2025 in epoch seconds
          end: '2082762102', // December 31, 2035 in epoch seconds
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 25, // Alert at 25% of budget ($5.00)
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.billingAlertTopic.topicArn,
            },
          ],
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 50, // Warning at 50% of budget ($10.00)
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.billingAlertTopic.topicArn,
            },
          ],
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80, // Critical at 80% of budget ($16.00)
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.billingAlertTopic.topicArn,
            },
          ],
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100, // Forecast alert if projected to exceed $20
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.billingAlertTopic.topicArn,
            },
          ],
        },
      ],
    });

    // CloudWatch Alarm for unusual spending patterns
    const unusualSpendingAlarm = new cloudwatch.Alarm(
      this,
      'UnusualSpendingAlarm',
      {
        alarmName: `RecipeArchive-UnusualSpending-${props.environment}`,
        alarmDescription: 'Alert when estimated monthly charges exceed $20',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Billing',
          metricName: 'EstimatedCharges',
          dimensionsMap: {
            Currency: 'USD',
          },
          statistic: 'Maximum',
          period: cdk.Duration.hours(12), // Check twice daily
        }),
        threshold: 20, // $20/month threshold
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // Connect the alarm to SNS topic
    unusualSpendingAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.billingAlertTopic.topicArn }),
    });

    // CloudWatch Alarm for Failed Parsing Bucket Size (20MB limit)
    const failedParsingBucketSizeAlarm = new cloudwatch.Alarm(
      this,
      'FailedParsingBucketSizeAlarm',
      {
        alarmName: `RecipeArchive-FailedParsingBucketSize-${props.environment}`,
        alarmDescription: 'Alert when failed parsing bucket exceeds 20MB to prevent cost overruns',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/S3',
          metricName: 'BucketSizeBytes',
          dimensionsMap: {
            BucketName: this.failedParsingBucket.bucketName,
            StorageType: 'StandardStorage',
          },
          statistic: 'Average',
          period: cdk.Duration.hours(6), // Check 4 times daily
        }),
        threshold: 20 * 1024 * 1024, // 20MB in bytes
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // Connect the bucket size alarm to SNS topic
    failedParsingBucketSizeAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.billingAlertTopic.topicArn }),
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });


    new cdk.CfnOutput(this, 'StorageBucketName', {
      value: this.storageBucket.bucketName,
      description: 'S3 Storage Bucket Name (Recipe Photos & Documents)',
    });

    new cdk.CfnOutput(this, 'TempBucketName', {
      value: this.tempBucket.bucketName,
      description: 'S3 Temporary Bucket Name (Processing & Uploads)',
    });

    new cdk.CfnOutput(this, 'FailedParsingBucketName', {
      value: this.failedParsingBucket.bucketName,
      description: 'S3 Failed Parsing Bucket Name (HTML from failed recipe extractions)',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'BillingAlertTopicArn', {
      value: this.billingAlertTopic.topicArn,
      description: 'SNS Topic ARN for Billing Alerts',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });

    new cdk.CfnOutput(this, 'AdminEmail', {
      value: props.adminEmail,
      description: 'Admin Email for Billing Alerts and Initial User Creation',
    });
  }
}
