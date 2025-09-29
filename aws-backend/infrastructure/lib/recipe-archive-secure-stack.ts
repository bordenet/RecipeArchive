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
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as crypto from 'crypto';

export interface RecipeArchiveSecureStackProps extends cdk.StackProps {
  environment: string;
  adminEmail: string;
}

export class RecipeArchiveSecureStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly storageBucket: s3.Bucket;
  public readonly tempBucket: s3.Bucket;
  public readonly failedParsingBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly billingAlertTopic: sns.Topic;

  constructor(
    scope: Construct,
    id: string,
    props: RecipeArchiveSecureStackProps
  ) {
    super(scope, id, props);

    // Generate secure random suffix for all resources
    const secureId = crypto.randomBytes(8).toString('hex');

    // Cognito User Pool for Authentication with secure name
    this.userPool = new cognito.UserPool(this, 'SecureUserPool', {
      userPoolName: `recipe-users-${secureId}`,
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
        phoneNumber: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Cognito User Pool Client with secure name
    this.userPoolClient = new cognito.UserPoolClient(
      this,
      'SecureUserPoolClient',
      {
        userPool: this.userPool,
        userPoolClientName: `recipe-client-${secureId}`,
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

    // Primary Storage Bucket with secure random name (matching original retention policies)
    this.storageBucket = new s3.Bucket(this, 'SecureStorageBucket', {
      bucketName: `recipe-storage-${secureId}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: props.environment === 'prod',
      lifecycleRules: [
        {
          id: 'delete-incomplete-uploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        // Environment-specific retention policies (matching original)
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

    // Temporary/Processing Bucket with secure random name (matching original policies)
    this.tempBucket = new s3.Bucket(this, 'SecureTempBucket', {
      bucketName: `recipe-temp-${secureId}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false, // Never version temporary files
      lifecycleRules: [
        {
          id: 'delete-temp-files',
          expiration: cdk.Duration.days(props.environment === 'prod' ? 7 : 1),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Always destroy temp bucket
    });

    // Failed Parsing Storage Bucket with secure random name (matching original policies)
    this.failedParsingBucket = new s3.Bucket(
      this,
      'SecureFailedParsingBucket',
      {
        bucketName: `recipe-failed-${secureId}-${this.account}`,
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
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Always safe to destroy failed parsing data
      }
    );

    // IAM Role for Lambda Functions with secure naming
    const lambdaRole = new iam.Role(this, 'SecureLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: `recipe-lambda-role-${secureId}`,
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
                's3:ListBucket',
                's3:GetObjectAttributes',
              ],
              resources: [
                this.storageBucket.bucketArn,
                `${this.storageBucket.bucketArn}/*`,
                this.tempBucket.bucketArn,
                `${this.tempBucket.bucketArn}/*`,
                this.failedParsingBucket.bucketArn,
                `${this.failedParsingBucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminSetUserPassword',
                'cognito-idp:AdminListGroupsForUser',
              ],
              resources: [this.userPool.userPoolArn],
            }),
          ],
        }),
      },
    });

    // SQS Queue for async recipe normalization with secure naming
    const recipeNormalizationQueue = new sqs.Queue(
      this,
      'SecureNormalizationQueue',
      {
        queueName: `recipe-normalize-${secureId}`,
        visibilityTimeout: cdk.Duration.seconds(60),
        retentionPeriod: cdk.Duration.days(14),
        deadLetterQueue: {
          queue: new sqs.Queue(this, 'SecureNormalizationDLQ', {
            queueName: `recipe-normalize-dlq-${secureId}`,
            retentionPeriod: cdk.Duration.days(14),
          }),
          maxReceiveCount: 3,
        },
      }
    );

    // Lambda Functions with secure naming and environment variables
    const healthFunction = new lambda.Function(this, 'SecureHealthFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/health-package'),
      functionName: `recipe-health-${secureId}`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
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

    const recipesFunction = new lambda.Function(this, 'SecureRecipesFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../functions/dist/recipes-package'),
      functionName: `recipe-recipes-${secureId}`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment,
        REGION: this.region,
        S3_STORAGE_BUCKET: this.storageBucket.bucketName,
        S3_TEMP_BUCKET: this.tempBucket.bucketName,
        S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        NORMALIZATION_QUEUE_URL: recipeNormalizationQueue.queueUrl,
      },
      role: lambdaRole,
    });

    // API Gateway with secure naming and DDoS protection
    this.api = new apigateway.RestApi(this, 'SecureAPI', {
      restApiName: `recipe-api-${secureId}`,
      description: 'RecipeArchive Secure Backend API',
      defaultCorsPreflightOptions: {
        allowOrigins: ['https://localhost:3000', 'https://recipearchive.com'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: 'prod',
      },
    });

    // Usage Plan with Rate Limiting for DDoS Protection (added after deployment)
    // Note: This will be added after the API deployment to avoid circular dependency

    // Cognito Authorizer for secure authentication
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'SecureCognitoAuthorizer',
      {
        cognitoUserPools: [this.userPool],
        authorizerName: `recipe-cognito-auth-${secureId}`,
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    // Request Validator for input validation
    const requestValidator = new apigateway.RequestValidator(
      this,
      'SecureRequestValidator',
      {
        restApi: this.api,
        requestValidatorName: `recipe-validator-${secureId}`,
        validateRequestBody: true,
        validateRequestParameters: true,
      }
    );

    // API Gateway Integrations and Resources
    const healthIntegration = new apigateway.LambdaIntegration(healthFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // API Resources
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', healthIntegration);

    const v1 = this.api.root.addResource('v1');
    const recipesResource = v1.addResource('recipes');
    const recipesIntegration = new apigateway.LambdaIntegration(
      recipesFunction
    );

    // Recipe CRUD operations with Authentication
    recipesResource.addMethod('GET', recipesIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });

    recipesResource.addMethod('POST', recipesIntegration, {
      authorizer: cognitoAuthorizer,
      requestValidator: requestValidator,
    });

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

    // Update Lambda functions with new API Gateway URL
    recipesFunction.addEnvironment('API_GATEWAY_URL', this.api.url);

    // Output secure resource identifiers
    new cdk.CfnOutput(this, 'SecureUserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Secure Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'SecureUserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Secure Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'SecureStorageBucketName', {
      value: this.storageBucket.bucketName,
      description: 'Secure S3 Storage Bucket Name',
    });

    new cdk.CfnOutput(this, 'SecureTempBucketName', {
      value: this.tempBucket.bucketName,
      description: 'Secure S3 Temporary Bucket Name',
    });

    new cdk.CfnOutput(this, 'SecureFailedParsingBucketName', {
      value: this.failedParsingBucket.bucketName,
      description: 'Secure S3 Failed Parsing Bucket Name',
    });

    new cdk.CfnOutput(this, 'SecureRandomId', {
      value: secureId,
      description: 'Secure Random ID used for resource naming',
    });

    new cdk.CfnOutput(this, 'SecureApiGatewayUrl', {
      value: this.api.url,
      description: 'Secure API Gateway URL',
    });

    new cdk.CfnOutput(this, 'SecureApiGatewayId', {
      value: this.api.restApiId,
      description: 'Secure API Gateway ID',
    });

    // CloudWatch Alarms for monitoring
    const apiGateway4xxAlarm = new cloudwatch.Alarm(
      this,
      'SecureApiGateway4xxAlarm',
      {
        alarmName: `recipe-api-4xx-errors-${secureId}`,
        metric: this.api.metricClientError(),
        threshold: 10,
        evaluationPeriods: 2,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    const apiGateway5xxAlarm = new cloudwatch.Alarm(
      this,
      'SecureApiGateway5xxAlarm',
      {
        alarmName: `recipe-api-5xx-errors-${secureId}`,
        metric: this.api.metricServerError(),
        threshold: 5,
        evaluationPeriods: 2,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // SNS Topic for billing alerts
    this.billingAlertTopic = new sns.Topic(this, 'SecureBillingAlertTopic', {
      topicName: `recipe-billing-alerts-${secureId}`,
      displayName: 'RecipeArchive Billing Alerts',
    });

    // Email subscription for billing alerts
    this.billingAlertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(props.adminEmail)
    );

    // Connect alarms to SNS topic
    apiGateway4xxAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.billingAlertTopic)
    );
    apiGateway5xxAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.billingAlertTopic)
    );

    // Budget for cost control
    new budgets.CfnBudget(this, 'SecureMonthlyBudget', {
      budget: {
        budgetName: `recipe-monthly-budget-${secureId}`,
        budgetLimit: {
          amount: 50,
          unit: 'USD',
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
        costFilters: {
          TagKey: ['Project'],
          TagValue: [`RecipeArchive-${secureId}`],
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'EMAIL',
              address: props.adminEmail,
            },
          ],
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'EMAIL',
              address: props.adminEmail,
            },
          ],
        },
      ],
    });

    // Add tags to all resources for cost tracking
    cdk.Tags.of(this).add('Project', `RecipeArchive-${secureId}`);
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('SecureStack', 'true');
    cdk.Tags.of(this).add('CreatedBy', 'RecipeArchive-Secure-CDK');
  }
}
