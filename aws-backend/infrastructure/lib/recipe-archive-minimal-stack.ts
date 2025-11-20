import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as _lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as crypto from "crypto";

export interface RecipeArchiveMinimalStackProps extends cdk.StackProps {
  environment: string;
  adminEmail: string;
  includeApiGateway?: boolean; // Optional API Gateway deployment
  includeCloudFront?: boolean; // Optional CloudFront distribution
}

export class RecipeArchiveMinimalStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly storageBucket: s3.Bucket;
  public readonly tempBucket: s3.Bucket;
  public readonly failedParsingBucket: s3.Bucket;
  public readonly webAppBucket?: s3.Bucket;
  public readonly api?: apigateway.RestApi;
  public readonly distribution?: cloudfront.Distribution;

  constructor(
    scope: Construct,
    id: string,
    props: RecipeArchiveMinimalStackProps
  ) {
    super(scope, id, props);

    // Generate secure random suffix for all resources
    const secureId = crypto.randomBytes(8).toString("hex");

    // Cognito User Pool for Authentication with secure name
    this.userPool = new cognito.UserPool(this, "SecureUserPool", {
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
      "SecureUserPoolClient",
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

    // Primary Storage Bucket with secure random name
    this.storageBucket = new s3.Bucket(this, "SecureStorageBucket", {
      bucketName: `recipe-storage-${secureId}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false, // Allow bucket policies
        restrictPublicBuckets: false, // Allow public read access via bucket policy
      }),
      versioned: props.environment === "prod",
      lifecycleRules: [
        {
          id: "delete-incomplete-uploads",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        // Environment-specific retention policies
        ...(props.environment === "prod"
          ? [
              {
                id: "archive-old-files",
                expiration: cdk.Duration.days(2555), // 7 years for production
              },
              {
                id: "archive-old-versions",
                noncurrentVersionExpiration: cdk.Duration.days(365),
              },
            ]
          : [
              {
                // STRICT 14-DAY RETENTION FOR PRE-PROD TESTING
                id: "delete-test-data",
                expiration: cdk.Duration.days(14),
                enabled: true,
              },
            ]),
      ],
      removalPolicy:
        props.environment === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // Add bucket policy to allow public read access to recipe images
    this.storageBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "PublicReadGetObject",
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:GetObject"],
        resources: [`${this.storageBucket.bucketArn}/recipe-images/*`],
      })
    );

    // Add bucket policy to allow public read access to browser extensions
    this.storageBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "PublicReadExtensions",
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:GetObject"],
        resources: [`${this.storageBucket.bucketArn}/extensions/*`],
      })
    );

    // Temporary/Processing Bucket with secure random name
    this.tempBucket = new s3.Bucket(this, "SecureTempBucket", {
      bucketName: `recipe-temp-${secureId}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false, // Never version temporary files
      lifecycleRules: [
        {
          id: "delete-temp-files",
          expiration: cdk.Duration.days(props.environment === "prod" ? 7 : 1),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Always destroy temp bucket
    });

    // Failed Parsing Storage Bucket with secure random name
    this.failedParsingBucket = new s3.Bucket(
      this,
      "SecureFailedParsingBucket",
      {
        bucketName: `recipe-failed-${secureId}-${this.account}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        versioned: false, // No versioning needed for failed parsing data
        lifecycleRules: [
          {
            id: "delete-failed-parsing-data",
            expiration: cdk.Duration.days(30), // Auto-purge after 30 days
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
          },
        ],
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Always safe to destroy failed parsing data
      }
    );

    // Output secure resource identifiers
    new cdk.CfnOutput(this, "SecureUserPoolId", {
      value: this.userPool.userPoolId,
      description: "Secure Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "SecureUserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Secure Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "SecureStorageBucketName", {
      value: this.storageBucket.bucketName,
      description: "Secure S3 Storage Bucket Name",
    });

    new cdk.CfnOutput(this, "SecureTempBucketName", {
      value: this.tempBucket.bucketName,
      description: "Secure S3 Temporary Bucket Name",
    });

    new cdk.CfnOutput(this, "SecureFailedParsingBucketName", {
      value: this.failedParsingBucket.bucketName,
      description: "Secure S3 Failed Parsing Bucket Name",
    });

    new cdk.CfnOutput(this, "SecureRandomId", {
      value: secureId,
      description: "Secure Random ID used for resource naming",
    });

    // Optionally add API Gateway (Step 2 of deployment)
    if (props.includeApiGateway) {
      // SQS Queue for async recipe normalization
      const recipeNormalizationQueue = new sqs.Queue(
        this,
        "RecipeNormalizationQueue",
        {
          queueName: "recipe-normalization-dev",
          visibilityTimeout: cdk.Duration.seconds(60),
          retentionPeriod: cdk.Duration.days(14),
          deadLetterQueue: {
            queue: new sqs.Queue(this, "RecipeNormalizationDLQ", {
              queueName: "recipe-normalization-dlq-dev",
              retentionPeriod: cdk.Duration.days(14),
            }),
            maxReceiveCount: 3,
          },
        }
      );

      // IAM Role for Lambda Functions
      const lambdaRole = new iam.Role(this, "SecureApiLambdaRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        roleName: `recipe-api-lambda-role-${secureId}`,
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaBasicExecutionRole"
          ),
        ],
        inlinePolicies: {
          S3Access: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  "s3:GetObject",
                  "s3:PutObject",
                  "s3:DeleteObject",
                  "s3:ListBucket",
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
                actions: ["cognito-idp:AdminGetUser"],
                resources: [this.userPool.userPoolArn],
              }),
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  "sqs:SendMessage",
                  "sqs:ReceiveMessage",
                  "sqs:DeleteMessage",
                  "sqs:GetQueueAttributes",
                ],
                resources: [
                  recipeNormalizationQueue.queueArn,
                  `${recipeNormalizationQueue.queueArn}/*`,
                ],
              }),
            ],
          }),
        },
      });

      // Health Lambda Function (minimal configuration)
      const healthFunction = new lambda.Function(
        this,
        "SecureApiHealthFunction",
        {
          runtime: lambda.Runtime.PROVIDED_AL2,
          handler: "bootstrap",
          code: lambda.Code.fromAsset("../functions/dist/health-package"),
          functionName: `recipe-api-health-${secureId}`,
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
        }
      );

      // Recipes Lambda Function (core functionality)
      const recipesFunction = new lambda.Function(
        this,
        "SecureApiRecipesFunction",
        {
          runtime: lambda.Runtime.PROVIDED_AL2,
          handler: "bootstrap",
          code: lambda.Code.fromAsset("../functions/dist/recipes-package"),
          functionName: `recipe-api-recipes-${secureId}`,
          timeout: cdk.Duration.seconds(30),
          memorySize: 512, // More memory for recipes processing
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
        }
      );

      // API Gateway (minimal configuration)
      this.api = new apigateway.RestApi(this, "SecureApi", {
        restApiName: `recipe-api-${secureId}`,
        description: "RecipeArchive Secure API (Step 3 - Health + Recipes)",
        defaultCorsPreflightOptions: {
          allowOrigins: [
            "https://localhost:3000",
            "https://recipearchive.com",
            "chrome-extension://*",
            "moz-extension://*",
            "*", // Allow all origins for development
          ],
          allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowHeaders: [
            "Content-Type",
            "X-Amz-Date",
            "Authorization",
            "X-Api-Key",
            "X-Amz-Security-Token",
            "X-Amz-User-Agent",
          ],
          allowCredentials: true,
        },
        deployOptions: {
          stageName: "prod",
        },
      });

      // Add Gateway Responses to include CORS headers on API Gateway error responses
      this.api.addGatewayResponse("unauthorized", {
        type: apigateway.ResponseType.UNAUTHORIZED,
        responseHeaders: {
          "Access-Control-Allow-Origin": "'https://recipearchive.com'",
          "Access-Control-Allow-Credentials": "'true'",
          "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
          "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
        },
      });

      this.api.addGatewayResponse("accessDenied", {
        type: apigateway.ResponseType.ACCESS_DENIED,
        responseHeaders: {
          "Access-Control-Allow-Origin": "'https://recipearchive.com'",
          "Access-Control-Allow-Credentials": "'true'",
          "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
          "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
        },
      });

      this.api.addGatewayResponse("badRequestBody", {
        type: apigateway.ResponseType.BAD_REQUEST_BODY,
        responseHeaders: {
          "Access-Control-Allow-Origin": "'https://recipearchive.com'",
          "Access-Control-Allow-Credentials": "'true'",
          "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
          "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
        },
      });

      // Health endpoint
      const healthResource = this.api.root.addResource("health");
      healthResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(healthFunction)
      );

      // Recipes endpoint (core functionality)
      const recipesResource = this.api.root.addResource("recipes");
      const recipesIntegration = new apigateway.LambdaIntegration(
        recipesFunction
      );

      // Add all recipes methods
      recipesResource.addMethod("GET", recipesIntegration); // List recipes
      recipesResource.addMethod("POST", recipesIntegration); // Create recipe

      // Individual recipe operations
      const recipeItemResource = recipesResource.addResource("{recipeId}");
      recipeItemResource.addMethod("GET", recipesIntegration); // Get specific recipe
      recipeItemResource.addMethod("PUT", recipesIntegration); // Update recipe
      recipeItemResource.addMethod("DELETE", recipesIntegration); // Delete recipe

      // Search endpoint
      const searchResource = recipesResource.addResource("search");
      searchResource.addMethod("POST", recipesIntegration); // Search recipes

      // Additional outputs for API Gateway
      new cdk.CfnOutput(this, "SecureApiGatewayUrl", {
        value: this.api.url,
        description: "Secure API Gateway URL",
      });

      new cdk.CfnOutput(this, "SecureHealthEndpoint", {
        value: `${this.api.url}health`,
        description: "Secure Health Check Endpoint",
      });

      new cdk.CfnOutput(this, "SecureRecipesEndpoint", {
        value: `${this.api.url}recipes`,
        description: "Secure Recipes API Endpoint",
      });
    }

    // ================================================
    // COST CONTROLS AND MONITORING
    // ================================================

    // SNS Topic for cost alerts
    const costAlertTopic = new sns.Topic(this, "CostAlertTopic", {
      topicName: `recipe-cost-alerts-${secureId}`,
      displayName: "RecipeArchive Cost Alerts",
    });

    // Subscribe admin email to cost alerts
    costAlertTopic.addSubscription(
      new subscriptions.EmailSubscription(props.adminEmail)
    );

    // AWS Budget for cost control ($5/month limit with alerts)
    const _budget = new budgets.CfnBudget(this, "RecipeArchiveBudget", {
      budget: {
        budgetName: `RecipeArchive-Budget-${secureId}`,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: 5, // $5/month limit
          unit: "USD",
        },
        // Cost filtering by AWS services instead of tags (more reliable)
        costFilters: {
          Service: [
            "Amazon Simple Storage Service",
            "Amazon API Gateway",
            "AWS Lambda",
            "Amazon Cognito",
            "Amazon CloudWatch",
            "Amazon Simple Notification Service",
          ],
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: "GREATER_THAN",
            threshold: 80, // Alert at 80% ($4)
            thresholdType: "PERCENTAGE",
            notificationType: "ACTUAL",
          },
          subscribers: [
            {
              address: props.adminEmail,
              subscriptionType: "EMAIL",
            },
          ],
        },
        {
          notification: {
            comparisonOperator: "GREATER_THAN",
            threshold: 100, // Alert at 100% ($5)
            thresholdType: "PERCENTAGE",
            notificationType: "FORECASTED",
          },
          subscribers: [
            {
              address: props.adminEmail,
              subscriptionType: "EMAIL",
            },
          ],
        },
      ],
    });

    // CloudWatch Dashboard for monitoring
    const dashboard = new cloudwatch.Dashboard(this, "RecipeArchiveDashboard", {
      dashboardName: `RecipeArchive-Monitoring-${secureId}`,
    });

    if (props.includeApiGateway && this.api) {
      // API Gateway metrics
      const apiRequests = new cloudwatch.Metric({
        namespace: "AWS/ApiGateway",
        metricName: "Count",
        dimensionsMap: {
          ApiName: this.api.restApiName,
        },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      });

      const apiLatency = new cloudwatch.Metric({
        namespace: "AWS/ApiGateway",
        metricName: "Latency",
        dimensionsMap: {
          ApiName: this.api.restApiName,
        },
        statistic: "Average",
        period: cdk.Duration.minutes(5),
      });

      const apiErrors = new cloudwatch.Metric({
        namespace: "AWS/ApiGateway",
        metricName: "4XXError",
        dimensionsMap: {
          ApiName: this.api.restApiName,
        },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      });

      // CloudWatch Alarms for cost/usage spikes
      new cloudwatch.Alarm(this, "HighApiUsageAlarm", {
        alarmName: `recipe-api-high-usage-${secureId}`,
        alarmDescription: "Alert when API usage is unusually high",
        metric: apiRequests,
        threshold: 1000, // Alert if >1000 requests in 5 minutes
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction({
        bind: () => ({ alarmActionArn: costAlertTopic.topicArn }),
      });

      new cloudwatch.Alarm(this, "HighApiLatencyAlarm", {
        alarmName: `recipe-api-high-latency-${secureId}`,
        alarmDescription: "Alert when API latency is high",
        metric: apiLatency,
        threshold: 5000, // Alert if >5 seconds average latency
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction({
        bind: () => ({ alarmActionArn: costAlertTopic.topicArn }),
      });

      // Add API Gateway widgets to dashboard
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: "API Gateway Requests",
          left: [apiRequests],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: "API Gateway Latency",
          left: [apiLatency],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: "API Gateway Errors",
          left: [apiErrors],
          width: 12,
          height: 6,
        })
      );
    }

    // S3 cost monitoring
    const s3Storage = new cloudwatch.Metric({
      namespace: "AWS/S3",
      metricName: "BucketSizeBytes",
      dimensionsMap: {
        BucketName: this.storageBucket.bucketName,
        StorageType: "StandardStorage",
      },
      statistic: "Average",
      period: cdk.Duration.days(1),
    });

    new cloudwatch.Alarm(this, "HighS3StorageAlarm", {
      alarmName: `recipe-s3-high-storage-${secureId}`,
      alarmDescription: "Alert when S3 storage usage is high",
      metric: s3Storage,
      threshold: 1073741824, // Alert if >1GB storage
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction({
      bind: () => ({ alarmActionArn: costAlertTopic.topicArn }),
    });

    // Add S3 storage widget to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "S3 Storage Usage (Bytes)",
        left: [s3Storage],
        width: 24,
        height: 6,
      })
    );

    // Cost optimization outputs
    new cdk.CfnOutput(this, "CostAlertTopicArn", {
      value: costAlertTopic.topicArn,
      description: "SNS Topic for cost alerts",
    });

    new cdk.CfnOutput(this, "CloudWatchDashboardUrl", {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: "CloudWatch Dashboard URL for monitoring",
    });

    new cdk.CfnOutput(this, "BudgetName", {
      value: `RecipeArchive-Budget-${secureId}`,
      description: "AWS Budget name for cost tracking",
    });

    // =============================================================================
    // CloudFront Distribution (Optional)
    // =============================================================================

    if (props.includeCloudFront) {
      // Create S3 bucket for web app hosting
      this.webAppBucket = new s3.Bucket(this, "SecureWebAppBucket", {
        bucketName: `recipearchive-web-app-${secureId}-${this.account}`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        websiteIndexDocument: "index.html",
        websiteErrorDocument: "index.html",
        publicReadAccess: false, // Will be accessed through CloudFront only
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: false,
        lifecycleRules: [
          {
            id: "WebAppCleanup",
            enabled: true,
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
            noncurrentVersionExpiration: cdk.Duration.days(7),
          },
        ],
      });

      // Origin Access Identity for CloudFront to access S3
      const originAccessIdentity = new cloudfront.OriginAccessIdentity(
        this,
        "SecureOAI",
        {
          comment: `OAI for RecipeArchive Web App (${secureId})`,
        }
      );

      // Grant CloudFront read access to the web app bucket
      this.webAppBucket.grantRead(originAccessIdentity);

      // CloudFront distribution for web app
      this.distribution = new cloudfront.Distribution(
        this,
        "SecureWebDistribution",
        {
          comment: `RecipeArchive Web App Distribution (${secureId})`,
          defaultBehavior: {
            origin: new origins.S3Origin(this.webAppBucket, {
              originAccessIdentity: originAccessIdentity,
            }),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            compress: true,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          },
          defaultRootObject: "index.html",
          errorResponses: [
            {
              httpStatus: 404,
              responseHttpStatus: 200,
              responsePagePath: "/index.html",
              ttl: cdk.Duration.minutes(1),
            },
            {
              httpStatus: 403,
              responseHttpStatus: 200,
              responsePagePath: "/index.html",
              ttl: cdk.Duration.minutes(1),
            },
          ],
          priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Cost-optimized
          enabled: true,
          minimumProtocolVersion:
            cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
          httpVersion: cloudfront.HttpVersion.HTTP2,
        }
      );

      // CloudFront outputs
      new cdk.CfnOutput(this, "SecureWebAppBucketName", {
        value: this.webAppBucket.bucketName,
        description: "Secure Web App S3 Bucket Name",
      });

      new cdk.CfnOutput(this, "SecureCloudFrontURL", {
        value: `https://${this.distribution.distributionDomainName}`,
        description: "Secure CloudFront Distribution URL",
      });

      new cdk.CfnOutput(this, "SecureCloudFrontDistributionId", {
        value: this.distribution.distributionId,
        description: "Secure CloudFront Distribution ID",
      });
    }

    // Add tags to all resources for cost tracking
    cdk.Tags.of(this).add("Project", `RecipeArchive-${secureId}`);
    cdk.Tags.of(this).add("Environment", props.environment);
    cdk.Tags.of(this).add("SecureStack", "true");
    cdk.Tags.of(this).add("CreatedBy", "RecipeArchive-Minimal-CDK");
    cdk.Tags.of(this).add("CostCenter", "Development");
    cdk.Tags.of(this).add("Owner", props.adminEmail);
  }
}
