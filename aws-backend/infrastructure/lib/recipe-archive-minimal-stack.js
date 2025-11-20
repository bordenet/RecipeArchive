"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeArchiveMinimalStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const s3 = require("aws-cdk-lib/aws-s3");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const iam = require("aws-cdk-lib/aws-iam");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const sns = require("aws-cdk-lib/aws-sns");
const subscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
const budgets = require("aws-cdk-lib/aws-budgets");
const sqs = require("aws-cdk-lib/aws-sqs");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const crypto = require("crypto");
class RecipeArchiveMinimalStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        this.userPoolClient = new cognito.UserPoolClient(this, "SecureUserPoolClient", {
            userPool: this.userPool,
            userPoolClientName: `recipe-client-${secureId}`,
            generateSecret: false,
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
        });
        // Primary Storage Bucket with secure random name
        this.storageBucket = new s3.Bucket(this, "SecureStorageBucket", {
            bucketName: `recipe-storage-${secureId}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: new s3.BlockPublicAccess({
                blockPublicAcls: true,
                ignorePublicAcls: true,
                blockPublicPolicy: false,
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
            removalPolicy: props.environment === "prod"
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });
        // Add bucket policy to allow public read access to recipe images
        this.storageBucket.addToResourcePolicy(new iam.PolicyStatement({
            sid: "PublicReadGetObject",
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ["s3:GetObject"],
            resources: [`${this.storageBucket.bucketArn}/recipe-images/*`],
        }));
        // Add bucket policy to allow public read access to browser extensions
        this.storageBucket.addToResourcePolicy(new iam.PolicyStatement({
            sid: "PublicReadExtensions",
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ["s3:GetObject"],
            resources: [`${this.storageBucket.bucketArn}/extensions/*`],
        }));
        // Temporary/Processing Bucket with secure random name
        this.tempBucket = new s3.Bucket(this, "SecureTempBucket", {
            bucketName: `recipe-temp-${secureId}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false,
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
        this.failedParsingBucket = new s3.Bucket(this, "SecureFailedParsingBucket", {
            bucketName: `recipe-failed-${secureId}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false,
            lifecycleRules: [
                {
                    id: "delete-failed-parsing-data",
                    expiration: cdk.Duration.days(30),
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Always safe to destroy failed parsing data
        });
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
            const recipeNormalizationQueue = new sqs.Queue(this, "RecipeNormalizationQueue", {
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
            });
            // IAM Role for Lambda Functions
            const lambdaRole = new iam.Role(this, "SecureApiLambdaRole", {
                assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
                roleName: `recipe-api-lambda-role-${secureId}`,
                managedPolicies: [
                    iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
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
            const healthFunction = new lambda.Function(this, "SecureApiHealthFunction", {
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
            });
            // Recipes Lambda Function (core functionality)
            const recipesFunction = new lambda.Function(this, "SecureApiRecipesFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/recipes-package"),
                functionName: `recipe-api-recipes-${secureId}`,
                timeout: cdk.Duration.seconds(30),
                memorySize: 512,
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
            healthResource.addMethod("GET", new apigateway.LambdaIntegration(healthFunction));
            // Recipes endpoint (core functionality)
            const recipesResource = this.api.root.addResource("recipes");
            const recipesIntegration = new apigateway.LambdaIntegration(recipesFunction);
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
        costAlertTopic.addSubscription(new subscriptions.EmailSubscription(props.adminEmail));
        // AWS Budget for cost control ($5/month limit with alerts)
        const _budget = new budgets.CfnBudget(this, "RecipeArchiveBudget", {
            budget: {
                budgetName: `RecipeArchive-Budget-${secureId}`,
                budgetType: "COST",
                timeUnit: "MONTHLY",
                budgetLimit: {
                    amount: 5,
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
                        threshold: 80,
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
                        threshold: 100,
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
                threshold: 1000,
                evaluationPeriods: 2,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            }).addAlarmAction({
                bind: () => ({ alarmActionArn: costAlertTopic.topicArn }),
            });
            new cloudwatch.Alarm(this, "HighApiLatencyAlarm", {
                alarmName: `recipe-api-high-latency-${secureId}`,
                alarmDescription: "Alert when API latency is high",
                metric: apiLatency,
                threshold: 5000,
                evaluationPeriods: 3,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            }).addAlarmAction({
                bind: () => ({ alarmActionArn: costAlertTopic.topicArn }),
            });
            // Add API Gateway widgets to dashboard
            dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: "API Gateway Requests",
                left: [apiRequests],
                width: 12,
                height: 6,
            }), new cloudwatch.GraphWidget({
                title: "API Gateway Latency",
                left: [apiLatency],
                width: 12,
                height: 6,
            }), new cloudwatch.GraphWidget({
                title: "API Gateway Errors",
                left: [apiErrors],
                width: 12,
                height: 6,
            }));
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
            threshold: 1073741824,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }).addAlarmAction({
            bind: () => ({ alarmActionArn: costAlertTopic.topicArn }),
        });
        // Add S3 storage widget to dashboard
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "S3 Storage Usage (Bytes)",
            left: [s3Storage],
            width: 24,
            height: 6,
        }));
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
                publicReadAccess: false,
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
            const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, "SecureOAI", {
                comment: `OAI for RecipeArchive Web App (${secureId})`,
            });
            // Grant CloudFront read access to the web app bucket
            this.webAppBucket.grantRead(originAccessIdentity);
            // CloudFront distribution for web app
            this.distribution = new cloudfront.Distribution(this, "SecureWebDistribution", {
                comment: `RecipeArchive Web App Distribution (${secureId})`,
                defaultBehavior: {
                    origin: new origins.S3Origin(this.webAppBucket, {
                        originAccessIdentity: originAccessIdentity,
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
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
                priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
                enabled: true,
                minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
                httpVersion: cloudfront.HttpVersion.HTTP2,
            });
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
exports.RecipeArchiveMinimalStack = RecipeArchiveMinimalStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtbWluaW1hbC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlY2lwZS1hcmNoaXZlLW1pbmltYWwtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLG1EQUFtRDtBQUNuRCx5Q0FBeUM7QUFDekMsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCwyQ0FBMkM7QUFDM0MseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyxtRUFBbUU7QUFDbkUsbURBQW1EO0FBQ25ELDJDQUEyQztBQUUzQyx5REFBeUQ7QUFDekQsOERBQThEO0FBQzlELGlDQUFpQztBQVNqQyxNQUFhLHlCQUEwQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBVXRELFlBQ0UsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLEtBQXFDO1FBRXJDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtEQUFrRDtRQUNsRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV2RCx3REFBd0Q7UUFDeEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELFlBQVksRUFBRSxnQkFBZ0IsUUFBUSxFQUFFO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELGtCQUFrQixFQUFFO2dCQUNsQixLQUFLLEVBQUU7b0JBQ0wsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULFFBQVEsRUFBRSxLQUFLO29CQUNmLE9BQU8s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R0FBRyxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM3QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLDJCQUEyQixDQUFDLENBQUM7UUFDaEUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNuRCxDQUFDO0NBQ0Y7QUFqdkJELDhEQWl2QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZ25pdG9cIjtcbmltcG9ydCAqIGFzIHMzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXlcIjtcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2hcIjtcbmltcG9ydCAqIGFzIHNucyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNuc1wiO1xuaW1wb3J0ICogYXMgc3Vic2NyaXB0aW9ucyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zXCI7XG5pbXBvcnQgKiBhcyBidWRnZXRzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYnVkZ2V0c1wiO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc3FzXCI7XG5pbXBvcnQgKiBhcyBfbGFtYmRhRXZlbnRTb3VyY2VzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLWV2ZW50LXNvdXJjZXNcIjtcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSBcImF3cy1jZGstbGliL2F3cy1jbG91ZGZyb250XCI7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zXCI7XG5pbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlY2lwZUFyY2hpdmVNaW5pbWFsU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgYWRtaW5FbWFpbDogc3RyaW5nO1xuICBpbmNsdWRlQXBpR2F0ZXdheT86IGJvb2xlYW47IC8vIE9wdGlvbmFsIEFQSSBHYXRld2F5IGRlcGxveW1lbnRcbiAgaW5jbHVkZUNsb3VkRnJvbnQ/OiBib29sZWFuOyAvLyBPcHRpb25hbCBDbG91ZEZyb250IGRpc3RyaWJ1dGlvblxufVxuXG5leHBvcnQgY2xhc3MgUmVjaXBlQXJjaGl2ZU1pbmltYWxTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgc3RvcmFnZUJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgdGVtcEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZmFpbGVkUGFyc2luZ0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQXBwQnVja2V0PzogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpPzogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uPzogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG5cbiAgY29uc3RydWN0b3IoXG4gICAgc2NvcGU6IENvbnN0cnVjdCxcbiAgICBpZDogc3RyaW5nLFxuICAgIHByb3BzOiBSZWNpcGVBcmNoaXZlTWluaW1hbFN0YWNrUHJvcHNcbiAgKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBHZW5lcmF0ZSBzZWN1cmUgcmFuZG9tIHN1ZmZpeCBmb3IgYWxsIHJlc291cmNlc1xuICAgIGNvbnN0IHNlY3VyZUlkID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDgpLnRvU3RyaW5nKFwiaGV4XCIpO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgZm9yIEF1dGhlbnRpY2F0aW9uIHdpdGggc2VjdXJlIG5hbWVcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJTZWN1cmVVc2VyUG9vbFwiLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGByZWNpcGUtdXNlcnMtJHtzZWN1cmVJZH1gLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGZhbWlseU5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGhvbmVOdW1iZXI6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG1mYTogY29nbml0by5NZmEuT1BUSU9OQUwsXG4gICAgICBtZmFTZWNvbmRGYWN0b3I6IHtcbiAgICAgICAgc21zOiB0cnVlLFxuICAgICAgICBvdHA6IHRydWUsXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IHdpdGggc2VjdXJlIG5hbWVcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQoXG4gICAgICB0aGlzLFxuICAgICAgXCJTZWN1cmVVc2VyUG9vbENsaWVudFwiLFxuICAgICAge1xuICAgICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcbiAgICAgICAgdXNlclBvb2xDbGllbnROYW1lOiBgcmVjaXBlLWNsaWVudC0ke3NlY3VyZUlkfWAsXG4gICAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSwgLy8gUHVibGljIGNsaWVudCBmb3IgYnJvd3Nlci9tb2JpbGUgYXBwc1xuICAgICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgICBjdXN0b206IGZhbHNlLFxuICAgICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgb0F1dGg6IHtcbiAgICAgICAgICBmbG93czoge1xuICAgICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNjb3BlczogW1xuICAgICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTCxcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgIGVuYWJsZVRva2VuUmV2b2NhdGlvbjogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUHJpbWFyeSBTdG9yYWdlIEJ1Y2tldCB3aXRoIHNlY3VyZSByYW5kb20gbmFtZVxuICAgIHRoaXMuc3RvcmFnZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJTZWN1cmVTdG9yYWdlQnVja2V0XCIsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGUtc3RvcmFnZS0ke3NlY3VyZUlkfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLCAvLyBBbGxvdyBidWNrZXQgcG9saWNpZXNcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZSwgLy8gQWxsb3cgcHVibGljIHJlYWQgYWNjZXNzIHZpYSBidWNrZXQgcG9saWN5XG4gICAgICB9KSxcbiAgICAgIHZlcnNpb25lZDogcHJvcHMuZW52aXJvbm1lbnQgPT09IFwicHJvZFwiLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcImRlbGV0ZS1pbmNvbXBsZXRlLXVwbG9hZHNcIixcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICAgIC8vIEVudmlyb25tZW50LXNwZWNpZmljIHJldGVudGlvbiBwb2xpY2llc1xuICAgICAgICAuLi4ocHJvcHMuZW52aXJvbm1lbnQgPT09IFwicHJvZFwiXG4gICAgICAgICAgPyBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogXCJhcmNoaXZlLW9sZC1maWxlc1wiLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDI1NTUpLCAvLyA3IHllYXJzIGZvciBwcm9kdWN0aW9uXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogXCJhcmNoaXZlLW9sZC12ZXJzaW9uc1wiLFxuICAgICAgICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uRXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF1cbiAgICAgICAgICA6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIFNUUklDVCAxNC1EQVkgUkVURU5USU9OIEZPUiBQUkUtUFJPRCBURVNUSU5HXG4gICAgICAgICAgICAgICAgaWQ6IFwiZGVsZXRlLXRlc3QtZGF0YVwiLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSksXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTpcbiAgICAgICAgcHJvcHMuZW52aXJvbm1lbnQgPT09IFwicHJvZFwiXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgYnVja2V0IHBvbGljeSB0byBhbGxvdyBwdWJsaWMgcmVhZCBhY2Nlc3MgdG8gcmVjaXBlIGltYWdlc1xuICAgIHRoaXMuc3RvcmFnZUJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBzaWQ6IFwiUHVibGljUmVhZEdldE9iamVjdFwiLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFueVByaW5jaXBhbCgpXSxcbiAgICAgICAgYWN0aW9uczogW1wiczM6R2V0T2JqZWN0XCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJufS9yZWNpcGUtaW1hZ2VzLypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBidWNrZXQgcG9saWN5IHRvIGFsbG93IHB1YmxpYyByZWFkIGFjY2VzcyB0byBicm93c2VyIGV4dGVuc2lvbnNcbiAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgc2lkOiBcIlB1YmxpY1JlYWRFeHRlbnNpb25zXCIsXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbXCJzMzpHZXRPYmplY3RcIl0sXG4gICAgICAgIHJlc291cmNlczogW2Ake3RoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXRBcm59L2V4dGVuc2lvbnMvKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gVGVtcG9yYXJ5L1Byb2Nlc3NpbmcgQnVja2V0IHdpdGggc2VjdXJlIHJhbmRvbSBuYW1lXG4gICAgdGhpcy50ZW1wQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIlNlY3VyZVRlbXBCdWNrZXRcIiwge1xuICAgICAgYnVja2V0TmFtZTogYHJlY2lwZS10ZW1wLSR7c2VjdXJlSWR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSwgLy8gTmV2ZXIgdmVyc2lvbiB0ZW1wb3JhcnkgZmlsZXNcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJkZWxldGUtdGVtcC1maWxlc1wiLFxuICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKHByb3BzLmVudmlyb25tZW50ID09PSBcInByb2RcIiA/IDcgOiAxKSxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQWx3YXlzIGRlc3Ryb3kgdGVtcCBidWNrZXRcbiAgICB9KTtcblxuICAgIC8vIEZhaWxlZCBQYXJzaW5nIFN0b3JhZ2UgQnVja2V0IHdpdGggc2VjdXJlIHJhbmRvbSBuYW1lXG4gICAgdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0ID0gbmV3IHMzLkJ1Y2tldChcbiAgICAgIHRoaXMsXG4gICAgICBcIlNlY3VyZUZhaWxlZFBhcnNpbmdCdWNrZXRcIixcbiAgICAgIHtcbiAgICAgICAgYnVja2V0TmFtZTogYHJlY2lwZS1mYWlsZWQtJHtzZWN1cmVJZH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyBObyB2ZXJzaW9uaW5nIG5lZWRlZCBmb3IgZmFpbGVkIHBhcnNpbmcgZGF0YVxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBcImRlbGV0ZS1mYWlsZWQtcGFyc2luZy1kYXRhXCIsXG4gICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzMCksIC8vIEF1dG8tcHVyZ2UgYWZ0ZXIgMzAgZGF5c1xuICAgICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEFsd2F5cyBzYWZlIHRvIGRlc3Ryb3kgZmFpbGVkIHBhcnNpbmcgZGF0YVxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBPdXRwdXQgc2VjdXJlIHJlc291cmNlIGlkZW50aWZpZXJzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVVc2VyUG9vbElkXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgQ29nbml0byBVc2VyIFBvb2wgSURcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlVXNlclBvb2xDbGllbnRJZFwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIENvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVTdG9yYWdlQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgUzMgU3RvcmFnZSBCdWNrZXQgTmFtZVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVUZW1wQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgUzMgVGVtcG9yYXJ5IEJ1Y2tldCBOYW1lXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlNlY3VyZUZhaWxlZFBhcnNpbmdCdWNrZXROYW1lXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNlY3VyZSBTMyBGYWlsZWQgUGFyc2luZyBCdWNrZXQgTmFtZVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVSYW5kb21JZFwiLCB7XG4gICAgICB2YWx1ZTogc2VjdXJlSWQsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgUmFuZG9tIElEIHVzZWQgZm9yIHJlc291cmNlIG5hbWluZ1wiLFxuICAgIH0pO1xuXG4gICAgLy8gT3B0aW9uYWxseSBhZGQgQVBJIEdhdGV3YXkgKFN0ZXAgMiBvZiBkZXBsb3ltZW50KVxuICAgIGlmIChwcm9wcy5pbmNsdWRlQXBpR2F0ZXdheSkge1xuICAgICAgLy8gU1FTIFF1ZXVlIGZvciBhc3luYyByZWNpcGUgbm9ybWFsaXphdGlvblxuICAgICAgY29uc3QgcmVjaXBlTm9ybWFsaXphdGlvblF1ZXVlID0gbmV3IHNxcy5RdWV1ZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJSZWNpcGVOb3JtYWxpemF0aW9uUXVldWVcIixcbiAgICAgICAge1xuICAgICAgICAgIHF1ZXVlTmFtZTogXCJyZWNpcGUtbm9ybWFsaXphdGlvbi1kZXZcIixcbiAgICAgICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICAgICAgcXVldWU6IG5ldyBzcXMuUXVldWUodGhpcywgXCJSZWNpcGVOb3JtYWxpemF0aW9uRExRXCIsIHtcbiAgICAgICAgICAgICAgcXVldWVOYW1lOiBcInJlY2lwZS1ub3JtYWxpemF0aW9uLWRscS1kZXZcIixcbiAgICAgICAgICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1heFJlY2VpdmVDb3VudDogMyxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBJQU0gUm9sZSBmb3IgTGFtYmRhIEZ1bmN0aW9uc1xuICAgICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIlNlY3VyZUFwaUxhbWJkYVJvbGVcIiwge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImxhbWJkYS5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgICByb2xlTmFtZTogYHJlY2lwZS1hcGktbGFtYmRhLXJvbGUtJHtzZWN1cmVJZH1gLFxuICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgICBcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGVcIlxuICAgICAgICAgICksXG4gICAgICAgIF0sXG4gICAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgUzNBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgIFwiczM6R2V0T2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgICBcInMzOlB1dE9iamVjdFwiLFxuICAgICAgICAgICAgICAgICAgXCJzMzpEZWxldGVPYmplY3RcIixcbiAgICAgICAgICAgICAgICAgIFwiczM6TGlzdEJ1Y2tldFwiLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgICAgYCR7dGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgICB0aGlzLnRlbXBCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgICAgYCR7dGhpcy50ZW1wQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgICB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgICAgYCR7dGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1wiY29nbml0by1pZHA6QWRtaW5HZXRVc2VyXCJdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogW3RoaXMudXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICBcInNxczpTZW5kTWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgXCJzcXM6UmVjZWl2ZU1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgIFwic3FzOkRlbGV0ZU1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgIFwic3FzOkdldFF1ZXVlQXR0cmlidXRlc1wiLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICByZWNpcGVOb3JtYWxpemF0aW9uUXVldWUucXVldWVBcm4sXG4gICAgICAgICAgICAgICAgICBgJHtyZWNpcGVOb3JtYWxpemF0aW9uUXVldWUucXVldWVBcm59LypgLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBIZWFsdGggTGFtYmRhIEZ1bmN0aW9uIChtaW5pbWFsIGNvbmZpZ3VyYXRpb24pXG4gICAgICBjb25zdCBoZWFsdGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiU2VjdXJlQXBpSGVhbHRoRnVuY3Rpb25cIixcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Z1bmN0aW9ucy9kaXN0L2hlYWx0aC1wYWNrYWdlXCIpLFxuICAgICAgICAgIGZ1bmN0aW9uTmFtZTogYHJlY2lwZS1hcGktaGVhbHRoLSR7c2VjdXJlSWR9YCxcbiAgICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgUzNfVEVNUF9CVUNLRVQ6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBSZWNpcGVzIExhbWJkYSBGdW5jdGlvbiAoY29yZSBmdW5jdGlvbmFsaXR5KVxuICAgICAgY29uc3QgcmVjaXBlc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJTZWN1cmVBcGlSZWNpcGVzRnVuY3Rpb25cIixcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Z1bmN0aW9ucy9kaXN0L3JlY2lwZXMtcGFja2FnZVwiKSxcbiAgICAgICAgICBmdW5jdGlvbk5hbWU6IGByZWNpcGUtYXBpLXJlY2lwZXMtJHtzZWN1cmVJZH1gLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgICAgICBtZW1vcnlTaXplOiA1MTIsIC8vIE1vcmUgbWVtb3J5IGZvciByZWNpcGVzIHByb2Nlc3NpbmdcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIFMzX1RFTVBfQlVDS0VUOiB0aGlzLnRlbXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIFMzX0ZBSUxFRF9QQVJTSU5HX0JVQ0tFVDogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgICAgTk9STUFMSVpBVElPTl9RVUVVRV9VUkw6IHJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZS5xdWV1ZVVybCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIC8vIEFQSSBHYXRld2F5IChtaW5pbWFsIGNvbmZpZ3VyYXRpb24pXG4gICAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgXCJTZWN1cmVBcGlcIiwge1xuICAgICAgICByZXN0QXBpTmFtZTogYHJlY2lwZS1hcGktJHtzZWN1cmVJZH1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJSZWNpcGVBcmNoaXZlIFNlY3VyZSBBUEkgKFN0ZXAgMyAtIEhlYWx0aCArIFJlY2lwZXMpXCIsXG4gICAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICAgIGFsbG93T3JpZ2luczogW1xuICAgICAgICAgICAgXCJodHRwczovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgICAgICAgICBcImh0dHBzOi8vcmVjaXBlYXJjaGl2ZS5jb21cIixcbiAgICAgICAgICAgIFwiY2hyb21lLWV4dGVuc2lvbjovLypcIixcbiAgICAgICAgICAgIFwibW96LWV4dGVuc2lvbjovLypcIixcbiAgICAgICAgICAgIFwiKlwiLCAvLyBBbGxvdyBhbGwgb3JpZ2lucyBmb3IgZGV2ZWxvcG1lbnRcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93TWV0aG9kczogW1wiR0VUXCIsIFwiUE9TVFwiLCBcIlBVVFwiLCBcIkRFTEVURVwiLCBcIk9QVElPTlNcIl0sXG4gICAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiLFxuICAgICAgICAgICAgXCJYLUFtei1EYXRlXCIsXG4gICAgICAgICAgICBcIkF1dGhvcml6YXRpb25cIixcbiAgICAgICAgICAgIFwiWC1BcGktS2V5XCIsXG4gICAgICAgICAgICBcIlgtQW16LVNlY3VyaXR5LVRva2VuXCIsXG4gICAgICAgICAgICBcIlgtQW16LVVzZXItQWdlbnRcIixcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgICBzdGFnZU5hbWU6IFwicHJvZFwiLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBHYXRld2F5IFJlc3BvbnNlcyB0byBpbmNsdWRlIENPUlMgaGVhZGVycyBvbiBBUEkgR2F0ZXdheSBlcnJvciByZXNwb25zZXNcbiAgICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZShcInVuYXV0aG9yaXplZFwiLCB7XG4gICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLlVOQVVUSE9SSVpFRCxcbiAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbSdcIixcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzXCI6IFwiJ3RydWUnXCIsXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ1wiLFxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBcIidHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXCIsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKFwiYWNjZXNzRGVuaWVkXCIsIHtcbiAgICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQUNDRVNTX0RFTklFRCxcbiAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbSdcIixcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzXCI6IFwiJ3RydWUnXCIsXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ1wiLFxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBcIidHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXCIsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKFwiYmFkUmVxdWVzdEJvZHlcIiwge1xuICAgICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5CQURfUkVRVUVTVF9CT0RZLFxuICAgICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIidodHRwczovL3JlY2lwZWFyY2hpdmUuY29tJ1wiLFxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIjogXCIndHJ1ZSdcIixcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nXCIsXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcIixcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBIZWFsdGggZW5kcG9pbnRcbiAgICAgIGNvbnN0IGhlYWx0aFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZShcImhlYWx0aFwiKTtcbiAgICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICAgXCJHRVRcIixcbiAgICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaGVhbHRoRnVuY3Rpb24pXG4gICAgICApO1xuXG4gICAgICAvLyBSZWNpcGVzIGVuZHBvaW50IChjb3JlIGZ1bmN0aW9uYWxpdHkpXG4gICAgICBjb25zdCByZWNpcGVzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKFwicmVjaXBlc1wiKTtcbiAgICAgIGNvbnN0IHJlY2lwZXNJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgICByZWNpcGVzRnVuY3Rpb25cbiAgICAgICk7XG5cbiAgICAgIC8vIEFkZCBhbGwgcmVjaXBlcyBtZXRob2RzXG4gICAgICByZWNpcGVzUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIHJlY2lwZXNJbnRlZ3JhdGlvbik7IC8vIExpc3QgcmVjaXBlc1xuICAgICAgcmVjaXBlc1Jlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgcmVjaXBlc0ludGVncmF0aW9uKTsgLy8gQ3JlYXRlIHJlY2lwZVxuXG4gICAgICAvLyBJbmRpdmlkdWFsIHJlY2lwZSBvcGVyYXRpb25zXG4gICAgICBjb25zdCByZWNpcGVJdGVtUmVzb3VyY2UgPSByZWNpcGVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJ7cmVjaXBlSWR9XCIpO1xuICAgICAgcmVjaXBlSXRlbVJlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCByZWNpcGVzSW50ZWdyYXRpb24pOyAvLyBHZXQgc3BlY2lmaWMgcmVjaXBlXG4gICAgICByZWNpcGVJdGVtUmVzb3VyY2UuYWRkTWV0aG9kKFwiUFVUXCIsIHJlY2lwZXNJbnRlZ3JhdGlvbik7IC8vIFVwZGF0ZSByZWNpcGVcbiAgICAgIHJlY2lwZUl0ZW1SZXNvdXJjZS5hZGRNZXRob2QoXCJERUxFVEVcIiwgcmVjaXBlc0ludGVncmF0aW9uKTsgLy8gRGVsZXRlIHJlY2lwZVxuXG4gICAgICAvLyBTZWFyY2ggZW5kcG9pbnRcbiAgICAgIGNvbnN0IHNlYXJjaFJlc291cmNlID0gcmVjaXBlc1Jlc291cmNlLmFkZFJlc291cmNlKFwic2VhcmNoXCIpO1xuICAgICAgc2VhcmNoUmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLCByZWNpcGVzSW50ZWdyYXRpb24pOyAvLyBTZWFyY2ggcmVjaXBlc1xuXG4gICAgICAvLyBBZGRpdGlvbmFsIG91dHB1dHMgZm9yIEFQSSBHYXRld2F5XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlNlY3VyZUFwaUdhdGV3YXlVcmxcIiwge1xuICAgICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgQVBJIEdhdGV3YXkgVVJMXCIsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVIZWFsdGhFbmRwb2ludFwiLCB7XG4gICAgICAgIHZhbHVlOiBgJHt0aGlzLmFwaS51cmx9aGVhbHRoYCxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIEhlYWx0aCBDaGVjayBFbmRwb2ludFwiLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlUmVjaXBlc0VuZHBvaW50XCIsIHtcbiAgICAgICAgdmFsdWU6IGAke3RoaXMuYXBpLnVybH1yZWNpcGVzYCxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIFJlY2lwZXMgQVBJIEVuZHBvaW50XCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDT1NUIENPTlRST0xTIEFORCBNT05JVE9SSU5HXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBTTlMgVG9waWMgZm9yIGNvc3QgYWxlcnRzXG4gICAgY29uc3QgY29zdEFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsIFwiQ29zdEFsZXJ0VG9waWNcIiwge1xuICAgICAgdG9waWNOYW1lOiBgcmVjaXBlLWNvc3QtYWxlcnRzLSR7c2VjdXJlSWR9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiBcIlJlY2lwZUFyY2hpdmUgQ29zdCBBbGVydHNcIixcbiAgICB9KTtcblxuICAgIC8vIFN1YnNjcmliZSBhZG1pbiBlbWFpbCB0byBjb3N0IGFsZXJ0c1xuICAgIGNvc3RBbGVydFRvcGljLmFkZFN1YnNjcmlwdGlvbihcbiAgICAgIG5ldyBzdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKHByb3BzLmFkbWluRW1haWwpXG4gICAgKTtcblxuICAgIC8vIEFXUyBCdWRnZXQgZm9yIGNvc3QgY29udHJvbCAoJDUvbW9udGggbGltaXQgd2l0aCBhbGVydHMpXG4gICAgY29uc3QgX2J1ZGdldCA9IG5ldyBidWRnZXRzLkNmbkJ1ZGdldCh0aGlzLCBcIlJlY2lwZUFyY2hpdmVCdWRnZXRcIiwge1xuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIGJ1ZGdldE5hbWU6IGBSZWNpcGVBcmNoaXZlLUJ1ZGdldC0ke3NlY3VyZUlkfWAsXG4gICAgICAgIGJ1ZGdldFR5cGU6IFwiQ09TVFwiLFxuICAgICAgICB0aW1lVW5pdDogXCJNT05USExZXCIsXG4gICAgICAgIGJ1ZGdldExpbWl0OiB7XG4gICAgICAgICAgYW1vdW50OiA1LCAvLyAkNS9tb250aCBsaW1pdFxuICAgICAgICAgIHVuaXQ6IFwiVVNEXCIsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvc3QgZmlsdGVyaW5nIGJ5IEFXUyBzZXJ2aWNlcyBpbnN0ZWFkIG9mIHRhZ3MgKG1vcmUgcmVsaWFibGUpXG4gICAgICAgIGNvc3RGaWx0ZXJzOiB7XG4gICAgICAgICAgU2VydmljZTogW1xuICAgICAgICAgICAgXCJBbWF6b24gU2ltcGxlIFN0b3JhZ2UgU2VydmljZVwiLFxuICAgICAgICAgICAgXCJBbWF6b24gQVBJIEdhdGV3YXlcIixcbiAgICAgICAgICAgIFwiQVdTIExhbWJkYVwiLFxuICAgICAgICAgICAgXCJBbWF6b24gQ29nbml0b1wiLFxuICAgICAgICAgICAgXCJBbWF6b24gQ2xvdWRXYXRjaFwiLFxuICAgICAgICAgICAgXCJBbWF6b24gU2ltcGxlIE5vdGlmaWNhdGlvbiBTZXJ2aWNlXCIsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBub3RpZmljYXRpb25zV2l0aFN1YnNjcmliZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogXCJHUkVBVEVSX1RIQU5cIixcbiAgICAgICAgICAgIHRocmVzaG9sZDogODAsIC8vIEFsZXJ0IGF0IDgwJSAoJDQpXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiBcIlBFUkNFTlRBR0VcIixcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6IFwiQUNUVUFMXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBhZGRyZXNzOiBwcm9wcy5hZG1pbkVtYWlsLFxuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiBcIkVNQUlMXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogXCJHUkVBVEVSX1RIQU5cIixcbiAgICAgICAgICAgIHRocmVzaG9sZDogMTAwLCAvLyBBbGVydCBhdCAxMDAlICgkNSlcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6IFwiUEVSQ0VOVEFHRVwiLFxuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogXCJGT1JFQ0FTVEVEXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBhZGRyZXNzOiBwcm9wcy5hZG1pbkVtYWlsLFxuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiBcIkVNQUlMXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBEYXNoYm9hcmQgZm9yIG1vbml0b3JpbmdcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgXCJSZWNpcGVBcmNoaXZlRGFzaGJvYXJkXCIsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGBSZWNpcGVBcmNoaXZlLU1vbml0b3JpbmctJHtzZWN1cmVJZH1gLFxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BzLmluY2x1ZGVBcGlHYXRld2F5ICYmIHRoaXMuYXBpKSB7XG4gICAgICAvLyBBUEkgR2F0ZXdheSBtZXRyaWNzXG4gICAgICBjb25zdCBhcGlSZXF1ZXN0cyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogXCJBV1MvQXBpR2F0ZXdheVwiLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIkNvdW50XCIsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiB0aGlzLmFwaS5yZXN0QXBpTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGFwaUxhdGVuY3kgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0FwaUdhdGV3YXlcIixcbiAgICAgICAgbWV0cmljTmFtZTogXCJMYXRlbmN5XCIsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiB0aGlzLmFwaS5yZXN0QXBpTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBhcGlFcnJvcnMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0FwaUdhdGV3YXlcIixcbiAgICAgICAgbWV0cmljTmFtZTogXCI0WFhFcnJvclwiLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgQXBpTmFtZTogdGhpcy5hcGkucmVzdEFwaU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogXCJTdW1cIixcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDbG91ZFdhdGNoIEFsYXJtcyBmb3IgY29zdC91c2FnZSBzcGlrZXNcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiSGlnaEFwaVVzYWdlQWxhcm1cIiwge1xuICAgICAgICBhbGFybU5hbWU6IGByZWNpcGUtYXBpLWhpZ2gtdXNhZ2UtJHtzZWN1cmVJZH1gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBcIkFsZXJ0IHdoZW4gQVBJIHVzYWdlIGlzIHVudXN1YWxseSBoaWdoXCIsXG4gICAgICAgIG1ldHJpYzogYXBpUmVxdWVzdHMsXG4gICAgICAgIHRocmVzaG9sZDogMTAwMCwgLy8gQWxlcnQgaWYgPjEwMDAgcmVxdWVzdHMgaW4gNSBtaW51dGVzXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pLmFkZEFsYXJtQWN0aW9uKHtcbiAgICAgICAgYmluZDogKCkgPT4gKHsgYWxhcm1BY3Rpb25Bcm46IGNvc3RBbGVydFRvcGljLnRvcGljQXJuIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiSGlnaEFwaUxhdGVuY3lBbGFybVwiLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYHJlY2lwZS1hcGktaGlnaC1sYXRlbmN5LSR7c2VjdXJlSWR9YCxcbiAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJBbGVydCB3aGVuIEFQSSBsYXRlbmN5IGlzIGhpZ2hcIixcbiAgICAgICAgbWV0cmljOiBhcGlMYXRlbmN5LFxuICAgICAgICB0aHJlc2hvbGQ6IDUwMDAsIC8vIEFsZXJ0IGlmID41IHNlY29uZHMgYXZlcmFnZSBsYXRlbmN5XG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAzLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pLmFkZEFsYXJtQWN0aW9uKHtcbiAgICAgICAgYmluZDogKCkgPT4gKHsgYWxhcm1BY3Rpb25Bcm46IGNvc3RBbGVydFRvcGljLnRvcGljQXJuIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBBUEkgR2F0ZXdheSB3aWRnZXRzIHRvIGRhc2hib2FyZFxuICAgICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogXCJBUEkgR2F0ZXdheSBSZXF1ZXN0c1wiLFxuICAgICAgICAgIGxlZnQ6IFthcGlSZXF1ZXN0c10sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogXCJBUEkgR2F0ZXdheSBMYXRlbmN5XCIsXG4gICAgICAgICAgbGVmdDogW2FwaUxhdGVuY3ldLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6IFwiQVBJIEdhdGV3YXkgRXJyb3JzXCIsXG4gICAgICAgICAgbGVmdDogW2FwaUVycm9yc10sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gUzMgY29zdCBtb25pdG9yaW5nXG4gICAgY29uc3QgczNTdG9yYWdlID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogXCJBV1MvUzNcIixcbiAgICAgIG1ldHJpY05hbWU6IFwiQnVja2V0U2l6ZUJ5dGVzXCIsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEJ1Y2tldE5hbWU6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTdG9yYWdlVHlwZTogXCJTdGFuZGFyZFN0b3JhZ2VcIixcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICB9KTtcblxuICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiSGlnaFMzU3RvcmFnZUFsYXJtXCIsIHtcbiAgICAgIGFsYXJtTmFtZTogYHJlY2lwZS1zMy1oaWdoLXN0b3JhZ2UtJHtzZWN1cmVJZH1gLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJBbGVydCB3aGVuIFMzIHN0b3JhZ2UgdXNhZ2UgaXMgaGlnaFwiLFxuICAgICAgbWV0cmljOiBzM1N0b3JhZ2UsXG4gICAgICB0aHJlc2hvbGQ6IDEwNzM3NDE4MjQsIC8vIEFsZXJ0IGlmID4xR0Igc3RvcmFnZVxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KS5hZGRBbGFybUFjdGlvbih7XG4gICAgICBiaW5kOiAoKSA9PiAoeyBhbGFybUFjdGlvbkFybjogY29zdEFsZXJ0VG9waWMudG9waWNBcm4gfSksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgUzMgc3RvcmFnZSB3aWRnZXQgdG8gZGFzaGJvYXJkXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiBcIlMzIFN0b3JhZ2UgVXNhZ2UgKEJ5dGVzKVwiLFxuICAgICAgICBsZWZ0OiBbczNTdG9yYWdlXSxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDb3N0IG9wdGltaXphdGlvbiBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJDb3N0QWxlcnRUb3BpY0FyblwiLCB7XG4gICAgICB2YWx1ZTogY29zdEFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogXCJTTlMgVG9waWMgZm9yIGNvc3QgYWxlcnRzXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkNsb3VkV2F0Y2hEYXNoYm9hcmRVcmxcIiwge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5yZWdpb259LmNvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHtkYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMIGZvciBtb25pdG9yaW5nXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkJ1ZGdldE5hbWVcIiwge1xuICAgICAgdmFsdWU6IGBSZWNpcGVBcmNoaXZlLUJ1ZGdldC0ke3NlY3VyZUlkfWAsXG4gICAgICBkZXNjcmlwdGlvbjogXCJBV1MgQnVkZ2V0IG5hbWUgZm9yIGNvc3QgdHJhY2tpbmdcIixcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gKE9wdGlvbmFsKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBpZiAocHJvcHMuaW5jbHVkZUNsb3VkRnJvbnQpIHtcbiAgICAgIC8vIENyZWF0ZSBTMyBidWNrZXQgZm9yIHdlYiBhcHAgaG9zdGluZ1xuICAgICAgdGhpcy53ZWJBcHBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiU2VjdXJlV2ViQXBwQnVja2V0XCIsIHtcbiAgICAgICAgYnVja2V0TmFtZTogYHJlY2lwZWFyY2hpdmUtd2ViLWFwcC0ke3NlY3VyZUlkfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6IFwiaW5kZXguaHRtbFwiLFxuICAgICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogXCJpbmRleC5odG1sXCIsXG4gICAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLCAvLyBXaWxsIGJlIGFjY2Vzc2VkIHRocm91Z2ggQ2xvdWRGcm9udCBvbmx5XG4gICAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgICAgdmVyc2lvbmVkOiBmYWxzZSxcbiAgICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogXCJXZWJBcHBDbGVhbnVwXCIsXG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIE9yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIENsb3VkRnJvbnQgdG8gYWNjZXNzIFMzXG4gICAgICBjb25zdCBvcmlnaW5BY2Nlc3NJZGVudGl0eSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgICB0aGlzLFxuICAgICAgICBcIlNlY3VyZU9BSVwiLFxuICAgICAgICB7XG4gICAgICAgICAgY29tbWVudDogYE9BSSBmb3IgUmVjaXBlQXJjaGl2ZSBXZWIgQXBwICgke3NlY3VyZUlkfSlgLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBHcmFudCBDbG91ZEZyb250IHJlYWQgYWNjZXNzIHRvIHRoZSB3ZWIgYXBwIGJ1Y2tldFxuICAgICAgdGhpcy53ZWJBcHBCdWNrZXQuZ3JhbnRSZWFkKG9yaWdpbkFjY2Vzc0lkZW50aXR5KTtcblxuICAgICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZm9yIHdlYiBhcHBcbiAgICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKFxuICAgICAgICB0aGlzLFxuICAgICAgICBcIlNlY3VyZVdlYkRpc3RyaWJ1dGlvblwiLFxuICAgICAgICB7XG4gICAgICAgICAgY29tbWVudDogYFJlY2lwZUFyY2hpdmUgV2ViIEFwcCBEaXN0cmlidXRpb24gKCR7c2VjdXJlSWR9KWAsXG4gICAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMud2ViQXBwQnVja2V0LCB7XG4gICAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvcmlnaW5BY2Nlc3NJZGVudGl0eSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6IFwiaW5kZXguaHRtbFwiLFxuICAgICAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6IFwiL2luZGV4Lmh0bWxcIixcbiAgICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6IFwiL2luZGV4Lmh0bWxcIixcbiAgICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLCAvLyBDb3N0LW9wdGltaXplZFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgbWluaW11bVByb3RvY29sVmVyc2lvbjpcbiAgICAgICAgICAgIGNsb3VkZnJvbnQuU2VjdXJpdHlQb2xpY3lQcm90b2NvbC5UTFNfVjFfMl8yMDIxLFxuICAgICAgICAgIGh0dHBWZXJzaW9uOiBjbG91ZGZyb250Lkh0dHBWZXJzaW9uLkhUVFAyLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBDbG91ZEZyb250IG91dHB1dHNcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlV2ViQXBwQnVja2V0TmFtZVwiLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLndlYkFwcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgV2ViIEFwcCBTMyBCdWNrZXQgTmFtZVwiLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlQ2xvdWRGcm9udFVSTFwiLCB7XG4gICAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIFVSTFwiLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkXCIsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gSURcIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFkZCB0YWdzIHRvIGFsbCByZXNvdXJjZXMgZm9yIGNvc3QgdHJhY2tpbmdcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoXCJQcm9qZWN0XCIsIGBSZWNpcGVBcmNoaXZlLSR7c2VjdXJlSWR9YCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKFwiRW52aXJvbm1lbnRcIiwgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChcIlNlY3VyZVN0YWNrXCIsIFwidHJ1ZVwiKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoXCJDcmVhdGVkQnlcIiwgXCJSZWNpcGVBcmNoaXZlLU1pbmltYWwtQ0RLXCIpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChcIkNvc3RDZW50ZXJcIiwgXCJEZXZlbG9wbWVudFwiKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoXCJPd25lclwiLCBwcm9wcy5hZG1pbkVtYWlsKTtcbiAgfVxufVxuIl19