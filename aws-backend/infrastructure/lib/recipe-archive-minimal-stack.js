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
                        "https://d1jcaphz4458q7.cloudfront.net",
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
                    "Access-Control-Allow-Origin": "'https://d1jcaphz4458q7.cloudfront.net'",
                    "Access-Control-Allow-Credentials": "'true'",
                    "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
                    "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
                },
            });
            this.api.addGatewayResponse("accessDenied", {
                type: apigateway.ResponseType.ACCESS_DENIED,
                responseHeaders: {
                    "Access-Control-Allow-Origin": "'https://d1jcaphz4458q7.cloudfront.net'",
                    "Access-Control-Allow-Credentials": "'true'",
                    "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
                    "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
                },
            });
            this.api.addGatewayResponse("badRequestBody", {
                type: apigateway.ResponseType.BAD_REQUEST_BODY,
                responseHeaders: {
                    "Access-Control-Allow-Origin": "'https://d1jcaphz4458q7.cloudfront.net'",
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtbWluaW1hbC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlY2lwZS1hcmNoaXZlLW1pbmltYWwtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLG1EQUFtRDtBQUNuRCx5Q0FBeUM7QUFDekMsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCwyQ0FBMkM7QUFDM0MseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyxtRUFBbUU7QUFDbkUsbURBQW1EO0FBQ25ELDJDQUEyQztBQUUzQyx5REFBeUQ7QUFDekQsOERBQThEO0FBQzlELGlDQUFpQztBQVNqQyxNQUFhLHlCQUEwQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBVXRELFlBQ0UsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLEtBQXFDO1FBRXJDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtEQUFrRDtRQUNsRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV2RCx3REFBd0Q7UUFDeEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELFlBQVksRUFBRSxnQkFBZ0IsUUFBUSxFQUFFO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELGtCQUFrQixFQUFFO2dCQUNsQixLQUFLLEVBQUU7b0JBQ0wsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULFFBQVEsRUFBRSxLQUFLO29CQUNmLE9BQU8s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QUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztRQUNoRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ25ELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25ELENBQUM7Q0FDRjtBQWx2QkQsOERBa3ZCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgKiBhcyBidWRnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1idWRnZXRzJztcbmltcG9ydCAqIGFzIHNxcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3FzJztcbmltcG9ydCAqIGFzIGxhbWJkYUV2ZW50U291cmNlcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLWV2ZW50LXNvdXJjZXMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjaXBlQXJjaGl2ZU1pbmltYWxTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBhZG1pbkVtYWlsOiBzdHJpbmc7XG4gIGluY2x1ZGVBcGlHYXRld2F5PzogYm9vbGVhbjsgLy8gT3B0aW9uYWwgQVBJIEdhdGV3YXkgZGVwbG95bWVudFxuICBpbmNsdWRlQ2xvdWRGcm9udD86IGJvb2xlYW47IC8vIE9wdGlvbmFsIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uXG59XG5cbmV4cG9ydCBjbGFzcyBSZWNpcGVBcmNoaXZlTWluaW1hbFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSBzdG9yYWdlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSB0ZW1wQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBmYWlsZWRQYXJzaW5nQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJBcHBCdWNrZXQ/OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBhcGk/OiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb24/OiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBzY29wZTogQ29uc3RydWN0LFxuICAgIGlkOiBzdHJpbmcsXG4gICAgcHJvcHM6IFJlY2lwZUFyY2hpdmVNaW5pbWFsU3RhY2tQcm9wc1xuICApIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIEdlbmVyYXRlIHNlY3VyZSByYW5kb20gc3VmZml4IGZvciBhbGwgcmVzb3VyY2VzXG4gICAgY29uc3Qgc2VjdXJlSWQgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoOCkudG9TdHJpbmcoJ2hleCcpO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgZm9yIEF1dGhlbnRpY2F0aW9uIHdpdGggc2VjdXJlIG5hbWVcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1NlY3VyZVVzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiBgcmVjaXBlLXVzZXJzLSR7c2VjdXJlSWR9YCxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGdpdmVuTmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHBob25lTnVtYmVyOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBtZmE6IGNvZ25pdG8uTWZhLk9QVElPTkFMLFxuICAgICAgbWZhU2Vjb25kRmFjdG9yOiB7XG4gICAgICAgIHNtczogdHJ1ZSxcbiAgICAgICAgb3RwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sIENsaWVudCB3aXRoIHNlY3VyZSBuYW1lXG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KFxuICAgICAgdGhpcyxcbiAgICAgICdTZWN1cmVVc2VyUG9vbENsaWVudCcsXG4gICAgICB7XG4gICAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGByZWNpcGUtY2xpZW50LSR7c2VjdXJlSWR9YCxcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLCAvLyBQdWJsaWMgY2xpZW50IGZvciBicm93c2VyL21vYmlsZSBhcHBzXG4gICAgICAgIGF1dGhGbG93czoge1xuICAgICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgICAgIGN1c3RvbTogZmFsc2UsXG4gICAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBvQXV0aDoge1xuICAgICAgICAgIGZsb3dzOiB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELFxuICAgICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLFxuICAgICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEUsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgYWNjZXNzVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICBpZFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgZW5hYmxlVG9rZW5SZXZvY2F0aW9uOiB0cnVlLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBQcmltYXJ5IFN0b3JhZ2UgQnVja2V0IHdpdGggc2VjdXJlIHJhbmRvbSBuYW1lXG4gICAgdGhpcy5zdG9yYWdlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnU2VjdXJlU3RvcmFnZUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGUtc3RvcmFnZS0ke3NlY3VyZUlkfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLCAvLyBBbGxvdyBidWNrZXQgcG9saWNpZXNcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZSwgLy8gQWxsb3cgcHVibGljIHJlYWQgYWNjZXNzIHZpYSBidWNrZXQgcG9saWN5XG4gICAgICB9KSxcbiAgICAgIHZlcnNpb25lZDogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2RlbGV0ZS1pbmNvbXBsZXRlLXVwbG9hZHMnLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgcmV0ZW50aW9uIHBvbGljaWVzXG4gICAgICAgIC4uLihwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ2FyY2hpdmUtb2xkLWZpbGVzJyxcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygyNTU1KSwgLy8gNyB5ZWFycyBmb3IgcHJvZHVjdGlvblxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICdhcmNoaXZlLW9sZC12ZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXVxuICAgICAgICAgIDogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gU1RSSUNUIDE0LURBWSBSRVRFTlRJT04gRk9SIFBSRS1QUk9EIFRFU1RJTkdcbiAgICAgICAgICAgICAgICBpZDogJ2RlbGV0ZS10ZXN0LWRhdGEnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSksXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTpcbiAgICAgICAgcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGJ1Y2tldCBwb2xpY3kgdG8gYWxsb3cgcHVibGljIHJlYWQgYWNjZXNzIHRvIHJlY2lwZSBpbWFnZXNcbiAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgc2lkOiAnUHVibGljUmVhZEdldE9iamVjdCcsXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJufS9yZWNpcGUtaW1hZ2VzLypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBidWNrZXQgcG9saWN5IHRvIGFsbG93IHB1YmxpYyByZWFkIGFjY2VzcyB0byBicm93c2VyIGV4dGVuc2lvbnNcbiAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgc2lkOiAnUHVibGljUmVhZEV4dGVuc2lvbnMnLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFueVByaW5jaXBhbCgpXSxcbiAgICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbYCR7dGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldEFybn0vZXh0ZW5zaW9ucy8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBUZW1wb3JhcnkvUHJvY2Vzc2luZyBCdWNrZXQgd2l0aCBzZWN1cmUgcmFuZG9tIG5hbWVcbiAgICB0aGlzLnRlbXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTZWN1cmVUZW1wQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHJlY2lwZS10ZW1wLSR7c2VjdXJlSWR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSwgLy8gTmV2ZXIgdmVyc2lvbiB0ZW1wb3JhcnkgZmlsZXNcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2RlbGV0ZS10ZW1wLWZpbGVzJyxcbiAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyhwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gNyA6IDEpLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBBbHdheXMgZGVzdHJveSB0ZW1wIGJ1Y2tldFxuICAgIH0pO1xuXG4gICAgLy8gRmFpbGVkIFBhcnNpbmcgU3RvcmFnZSBCdWNrZXQgd2l0aCBzZWN1cmUgcmFuZG9tIG5hbWVcbiAgICB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQgPSBuZXcgczMuQnVja2V0KFxuICAgICAgdGhpcyxcbiAgICAgICdTZWN1cmVGYWlsZWRQYXJzaW5nQnVja2V0JyxcbiAgICAgIHtcbiAgICAgICAgYnVja2V0TmFtZTogYHJlY2lwZS1mYWlsZWQtJHtzZWN1cmVJZH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyBObyB2ZXJzaW9uaW5nIG5lZWRlZCBmb3IgZmFpbGVkIHBhcnNpbmcgZGF0YVxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnZGVsZXRlLWZhaWxlZC1wYXJzaW5nLWRhdGEnLFxuICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApLCAvLyBBdXRvLXB1cmdlIGFmdGVyIDMwIGRheXNcbiAgICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBBbHdheXMgc2FmZSB0byBkZXN0cm95IGZhaWxlZCBwYXJzaW5nIGRhdGFcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gT3V0cHV0IHNlY3VyZSByZXNvdXJjZSBpZGVudGlmaWVyc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIENvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIENvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlU3RvcmFnZUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBTMyBTdG9yYWdlIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVUZW1wQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnRlbXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIFMzIFRlbXBvcmFyeSBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlRmFpbGVkUGFyc2luZ0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBTMyBGYWlsZWQgUGFyc2luZyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlUmFuZG9tSWQnLCB7XG4gICAgICB2YWx1ZTogc2VjdXJlSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBSYW5kb20gSUQgdXNlZCBmb3IgcmVzb3VyY2UgbmFtaW5nJyxcbiAgICB9KTtcblxuICAgIC8vIE9wdGlvbmFsbHkgYWRkIEFQSSBHYXRld2F5IChTdGVwIDIgb2YgZGVwbG95bWVudClcbiAgICBpZiAocHJvcHMuaW5jbHVkZUFwaUdhdGV3YXkpIHtcbiAgICAgIC8vIFNRUyBRdWV1ZSBmb3IgYXN5bmMgcmVjaXBlIG5vcm1hbGl6YXRpb25cbiAgICAgIGNvbnN0IHJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZSA9IG5ldyBzcXMuUXVldWUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdSZWNpcGVOb3JtYWxpemF0aW9uUXVldWUnLFxuICAgICAgICB7XG4gICAgICAgICAgcXVldWVOYW1lOiBgcmVjaXBlLW5vcm1hbGl6YXRpb24tZGV2YCxcbiAgICAgICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICAgICAgcXVldWU6IG5ldyBzcXMuUXVldWUodGhpcywgJ1JlY2lwZU5vcm1hbGl6YXRpb25ETFEnLCB7XG4gICAgICAgICAgICAgIHF1ZXVlTmFtZTogYHJlY2lwZS1ub3JtYWxpemF0aW9uLWRscS1kZXZgLFxuICAgICAgICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIC8vIElBTSBSb2xlIGZvciBMYW1iZGEgRnVuY3Rpb25zXG4gICAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdTZWN1cmVBcGlMYW1iZGFSb2xlJywge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgICAgcm9sZU5hbWU6IGByZWNpcGUtYXBpLWxhbWJkYS1yb2xlLSR7c2VjdXJlSWR9YCxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFxuICAgICAgICAgICAgJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnXG4gICAgICAgICAgKSxcbiAgICAgICAgXSxcbiAgICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgICBTM0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgICAgYCR7dGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgICB0aGlzLnRlbXBCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgICAgYCR7dGhpcy50ZW1wQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgICB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgICAgYCR7dGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogWydjb2duaXRvLWlkcDpBZG1pbkdldFVzZXInXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFt0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgJ3NxczpTZW5kTWVzc2FnZScsXG4gICAgICAgICAgICAgICAgICAnc3FzOlJlY2VpdmVNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgICdzcXM6RGVsZXRlTWVzc2FnZScsXG4gICAgICAgICAgICAgICAgICAnc3FzOkdldFF1ZXVlQXR0cmlidXRlcycsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICAgIHJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZS5xdWV1ZUFybixcbiAgICAgICAgICAgICAgICAgIGAke3JlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZS5xdWV1ZUFybn0vKmAsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEhlYWx0aCBMYW1iZGEgRnVuY3Rpb24gKG1pbmltYWwgY29uZmlndXJhdGlvbilcbiAgICAgIGNvbnN0IGhlYWx0aEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ1NlY3VyZUFwaUhlYWx0aEZ1bmN0aW9uJyxcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2Z1bmN0aW9ucy9kaXN0L2hlYWx0aC1wYWNrYWdlJyksXG4gICAgICAgICAgZnVuY3Rpb25OYW1lOiBgcmVjaXBlLWFwaS1oZWFsdGgtJHtzZWN1cmVJZH1gLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBTM19URU1QX0JVQ0tFVDogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBTM19GQUlMRURfUEFSU0lOR19CVUNLRVQ6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIC8vIFJlY2lwZXMgTGFtYmRhIEZ1bmN0aW9uIChjb3JlIGZ1bmN0aW9uYWxpdHkpXG4gICAgICBjb25zdCByZWNpcGVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnU2VjdXJlQXBpUmVjaXBlc0Z1bmN0aW9uJyxcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2Z1bmN0aW9ucy9kaXN0L3JlY2lwZXMtcGFja2FnZScpLFxuICAgICAgICAgIGZ1bmN0aW9uTmFtZTogYHJlY2lwZS1hcGktcmVjaXBlcy0ke3NlY3VyZUlkfWAsXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDUxMiwgLy8gTW9yZSBtZW1vcnkgZm9yIHJlY2lwZXMgcHJvY2Vzc2luZ1xuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgUzNfVEVNUF9CVUNLRVQ6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgICBOT1JNQUxJWkFUSU9OX1FVRVVFX1VSTDogcmVjaXBlTm9ybWFsaXphdGlvblF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgLy8gQVBJIEdhdGV3YXkgKG1pbmltYWwgY29uZmlndXJhdGlvbilcbiAgICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnU2VjdXJlQXBpJywge1xuICAgICAgICByZXN0QXBpTmFtZTogYHJlY2lwZS1hcGktJHtzZWN1cmVJZH1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1JlY2lwZUFyY2hpdmUgU2VjdXJlIEFQSSAoU3RlcCAzIC0gSGVhbHRoICsgUmVjaXBlcyknLFxuICAgICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgICBhbGxvd09yaWdpbnM6IFtcbiAgICAgICAgICAgICdodHRwczovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgICAgICdodHRwczovL3JlY2lwZWFyY2hpdmUuY29tJyxcbiAgICAgICAgICAgICdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0JyxcbiAgICAgICAgICAgICdjaHJvbWUtZXh0ZW5zaW9uOi8vKicsXG4gICAgICAgICAgICAnbW96LWV4dGVuc2lvbjovLyonLFxuICAgICAgICAgICAgJyonLCAvLyBBbGxvdyBhbGwgb3JpZ2lucyBmb3IgZGV2ZWxvcG1lbnRcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcbiAgICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxuICAgICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nLFxuICAgICAgICAgICAgJ1gtQW16LVVzZXItQWdlbnQnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBHYXRld2F5IFJlc3BvbnNlcyB0byBpbmNsdWRlIENPUlMgaGVhZGVycyBvbiBBUEkgR2F0ZXdheSBlcnJvciByZXNwb25zZXNcbiAgICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZSgndW5hdXRob3JpemVkJywge1xuICAgICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5VTkFVVEhPUklaRUQsXG4gICAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBgJ2h0dHBzOi8vZDFqY2FwaHo0NDU4cTcuY2xvdWRmcm9udC5uZXQnYCxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBgJ3RydWUnYCxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IGAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nYCxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IGAnR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ2AsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCdhY2Nlc3NEZW5pZWQnLCB7XG4gICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLkFDQ0VTU19ERU5JRUQsXG4gICAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBgJ2h0dHBzOi8vZDFqY2FwaHo0NDU4cTcuY2xvdWRmcm9udC5uZXQnYCxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBgJ3RydWUnYCxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IGAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nYCxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IGAnR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ2AsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCdiYWRSZXF1ZXN0Qm9keScsIHtcbiAgICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQkFEX1JFUVVFU1RfQk9EWSxcbiAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnaHR0cHM6Ly9kMWpjYXBoejQ0NThxNy5jbG91ZGZyb250Lm5ldCdgLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IGAndHJ1ZSdgLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogYCdDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidgLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogYCdHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnYCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBIZWFsdGggZW5kcG9pbnRcbiAgICAgIGNvbnN0IGhlYWx0aFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgICBoZWFsdGhSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAgICdHRVQnLFxuICAgICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihoZWFsdGhGdW5jdGlvbilcbiAgICAgICk7XG5cbiAgICAgIC8vIFJlY2lwZXMgZW5kcG9pbnQgKGNvcmUgZnVuY3Rpb25hbGl0eSlcbiAgICAgIGNvbnN0IHJlY2lwZXNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3JlY2lwZXMnKTtcbiAgICAgIGNvbnN0IHJlY2lwZXNJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgICByZWNpcGVzRnVuY3Rpb25cbiAgICAgICk7XG5cbiAgICAgIC8vIEFkZCBhbGwgcmVjaXBlcyBtZXRob2RzXG4gICAgICByZWNpcGVzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCByZWNpcGVzSW50ZWdyYXRpb24pOyAvLyBMaXN0IHJlY2lwZXNcbiAgICAgIHJlY2lwZXNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCByZWNpcGVzSW50ZWdyYXRpb24pOyAvLyBDcmVhdGUgcmVjaXBlXG5cbiAgICAgIC8vIEluZGl2aWR1YWwgcmVjaXBlIG9wZXJhdGlvbnNcbiAgICAgIGNvbnN0IHJlY2lwZUl0ZW1SZXNvdXJjZSA9IHJlY2lwZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3JlY2lwZUlkfScpO1xuICAgICAgcmVjaXBlSXRlbVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgcmVjaXBlc0ludGVncmF0aW9uKTsgLy8gR2V0IHNwZWNpZmljIHJlY2lwZVxuICAgICAgcmVjaXBlSXRlbVJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgcmVjaXBlc0ludGVncmF0aW9uKTsgLy8gVXBkYXRlIHJlY2lwZVxuICAgICAgcmVjaXBlSXRlbVJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgcmVjaXBlc0ludGVncmF0aW9uKTsgLy8gRGVsZXRlIHJlY2lwZVxuXG4gICAgICAvLyBTZWFyY2ggZW5kcG9pbnRcbiAgICAgIGNvbnN0IHNlYXJjaFJlc291cmNlID0gcmVjaXBlc1Jlc291cmNlLmFkZFJlc291cmNlKCdzZWFyY2gnKTtcbiAgICAgIHNlYXJjaFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbik7IC8vIFNlYXJjaCByZWNpcGVzXG5cbiAgICAgIC8vIEFkZGl0aW9uYWwgb3V0cHV0cyBmb3IgQVBJIEdhdGV3YXlcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVBcGlHYXRld2F5VXJsJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBBUEkgR2F0ZXdheSBVUkwnLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVIZWFsdGhFbmRwb2ludCcsIHtcbiAgICAgICAgdmFsdWU6IGAke3RoaXMuYXBpLnVybH1oZWFsdGhgLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBIZWFsdGggQ2hlY2sgRW5kcG9pbnQnLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVSZWNpcGVzRW5kcG9pbnQnLCB7XG4gICAgICAgIHZhbHVlOiBgJHt0aGlzLmFwaS51cmx9cmVjaXBlc2AsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIFJlY2lwZXMgQVBJIEVuZHBvaW50JyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENPU1QgQ09OVFJPTFMgQU5EIE1PTklUT1JJTkdcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIFNOUyBUb3BpYyBmb3IgY29zdCBhbGVydHNcbiAgICBjb25zdCBjb3N0QWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0Nvc3RBbGVydFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgcmVjaXBlLWNvc3QtYWxlcnRzLSR7c2VjdXJlSWR9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnUmVjaXBlQXJjaGl2ZSBDb3N0IEFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICAvLyBTdWJzY3JpYmUgYWRtaW4gZW1haWwgdG8gY29zdCBhbGVydHNcbiAgICBjb3N0QWxlcnRUb3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbihwcm9wcy5hZG1pbkVtYWlsKVxuICAgICk7XG5cbiAgICAvLyBBV1MgQnVkZ2V0IGZvciBjb3N0IGNvbnRyb2wgKCQ1L21vbnRoIGxpbWl0IHdpdGggYWxlcnRzKVxuICAgIGNvbnN0IGJ1ZGdldCA9IG5ldyBidWRnZXRzLkNmbkJ1ZGdldCh0aGlzLCAnUmVjaXBlQXJjaGl2ZUJ1ZGdldCcsIHtcbiAgICAgIGJ1ZGdldDoge1xuICAgICAgICBidWRnZXROYW1lOiBgUmVjaXBlQXJjaGl2ZS1CdWRnZXQtJHtzZWN1cmVJZH1gLFxuICAgICAgICBidWRnZXRUeXBlOiAnQ09TVCcsXG4gICAgICAgIHRpbWVVbml0OiAnTU9OVEhMWScsXG4gICAgICAgIGJ1ZGdldExpbWl0OiB7XG4gICAgICAgICAgYW1vdW50OiA1LCAvLyAkNS9tb250aCBsaW1pdFxuICAgICAgICAgIHVuaXQ6ICdVU0QnLFxuICAgICAgICB9LFxuICAgICAgICAvLyBDb3N0IGZpbHRlcmluZyBieSBBV1Mgc2VydmljZXMgaW5zdGVhZCBvZiB0YWdzIChtb3JlIHJlbGlhYmxlKVxuICAgICAgICBjb3N0RmlsdGVyczoge1xuICAgICAgICAgIFNlcnZpY2U6IFtcbiAgICAgICAgICAgICdBbWF6b24gU2ltcGxlIFN0b3JhZ2UgU2VydmljZScsXG4gICAgICAgICAgICAnQW1hem9uIEFQSSBHYXRld2F5JyxcbiAgICAgICAgICAgICdBV1MgTGFtYmRhJyxcbiAgICAgICAgICAgICdBbWF6b24gQ29nbml0bycsXG4gICAgICAgICAgICAnQW1hem9uIENsb3VkV2F0Y2gnLFxuICAgICAgICAgICAgJ0FtYXpvbiBTaW1wbGUgTm90aWZpY2F0aW9uIFNlcnZpY2UnLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgbm90aWZpY2F0aW9uc1dpdGhTdWJzY3JpYmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6ICdHUkVBVEVSX1RIQU4nLFxuICAgICAgICAgICAgdGhyZXNob2xkOiA4MCwgLy8gQWxlcnQgYXQgODAlICgkNClcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6ICdQRVJDRU5UQUdFJyxcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6ICdBQ1RVQUwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgYWRkcmVzczogcHJvcHMuYWRtaW5FbWFpbCxcbiAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogJ0VNQUlMJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5vdGlmaWNhdGlvbjoge1xuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogMTAwLCAvLyBBbGVydCBhdCAxMDAlICgkNSlcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6ICdQRVJDRU5UQUdFJyxcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6ICdGT1JFQ0FTVEVEJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGFkZHJlc3M6IHByb3BzLmFkbWluRW1haWwsXG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6ICdFTUFJTCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBEYXNoYm9hcmQgZm9yIG1vbml0b3JpbmdcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ1JlY2lwZUFyY2hpdmVEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiBgUmVjaXBlQXJjaGl2ZS1Nb25pdG9yaW5nLSR7c2VjdXJlSWR9YCxcbiAgICB9KTtcblxuICAgIGlmIChwcm9wcy5pbmNsdWRlQXBpR2F0ZXdheSAmJiB0aGlzLmFwaSkge1xuICAgICAgLy8gQVBJIEdhdGV3YXkgbWV0cmljc1xuICAgICAgY29uc3QgYXBpUmVxdWVzdHMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdDb3VudCcsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiB0aGlzLmFwaS5yZXN0QXBpTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBhcGlMYXRlbmN5ID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiB0aGlzLmFwaS5yZXN0QXBpTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgYXBpRXJyb3JzID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNFhYRXJyb3InLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgQXBpTmFtZTogdGhpcy5hcGkucmVzdEFwaU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KTtcblxuICAgICAgLy8gQ2xvdWRXYXRjaCBBbGFybXMgZm9yIGNvc3QvdXNhZ2Ugc3Bpa2VzXG4gICAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaEFwaVVzYWdlQWxhcm0nLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYHJlY2lwZS1hcGktaGlnaC11c2FnZS0ke3NlY3VyZUlkfWAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIEFQSSB1c2FnZSBpcyB1bnVzdWFsbHkgaGlnaCcsXG4gICAgICAgIG1ldHJpYzogYXBpUmVxdWVzdHMsXG4gICAgICAgIHRocmVzaG9sZDogMTAwMCwgLy8gQWxlcnQgaWYgPjEwMDAgcmVxdWVzdHMgaW4gNSBtaW51dGVzXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pLmFkZEFsYXJtQWN0aW9uKHtcbiAgICAgICAgYmluZDogKCkgPT4gKHsgYWxhcm1BY3Rpb25Bcm46IGNvc3RBbGVydFRvcGljLnRvcGljQXJuIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoQXBpTGF0ZW5jeUFsYXJtJywge1xuICAgICAgICBhbGFybU5hbWU6IGByZWNpcGUtYXBpLWhpZ2gtbGF0ZW5jeS0ke3NlY3VyZUlkfWAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIEFQSSBsYXRlbmN5IGlzIGhpZ2gnLFxuICAgICAgICBtZXRyaWM6IGFwaUxhdGVuY3ksXG4gICAgICAgIHRocmVzaG9sZDogNTAwMCwgLy8gQWxlcnQgaWYgPjUgc2Vjb25kcyBhdmVyYWdlIGxhdGVuY3lcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfSkuYWRkQWxhcm1BY3Rpb24oe1xuICAgICAgICBiaW5kOiAoKSA9PiAoeyBhbGFybUFjdGlvbkFybjogY29zdEFsZXJ0VG9waWMudG9waWNBcm4gfSksXG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIEFQSSBHYXRld2F5IHdpZGdldHMgdG8gZGFzaGJvYXJkXG4gICAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgUmVxdWVzdHMnLFxuICAgICAgICAgIGxlZnQ6IFthcGlSZXF1ZXN0c10sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IExhdGVuY3knLFxuICAgICAgICAgIGxlZnQ6IFthcGlMYXRlbmN5XSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgRXJyb3JzJyxcbiAgICAgICAgICBsZWZ0OiBbYXBpRXJyb3JzXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBTMyBjb3N0IG1vbml0b3JpbmdcbiAgICBjb25zdCBzM1N0b3JhZ2UgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL1MzJyxcbiAgICAgIG1ldHJpY05hbWU6ICdCdWNrZXRTaXplQnl0ZXMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBCdWNrZXROYW1lOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgU3RvcmFnZVR5cGU6ICdTdGFuZGFyZFN0b3JhZ2UnLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICB9KTtcblxuICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoUzNTdG9yYWdlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGByZWNpcGUtczMtaGlnaC1zdG9yYWdlLSR7c2VjdXJlSWR9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIFMzIHN0b3JhZ2UgdXNhZ2UgaXMgaGlnaCcsXG4gICAgICBtZXRyaWM6IHMzU3RvcmFnZSxcbiAgICAgIHRocmVzaG9sZDogMTA3Mzc0MTgyNCwgLy8gQWxlcnQgaWYgPjFHQiBzdG9yYWdlXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pLmFkZEFsYXJtQWN0aW9uKHtcbiAgICAgIGJpbmQ6ICgpID0+ICh7IGFsYXJtQWN0aW9uQXJuOiBjb3N0QWxlcnRUb3BpYy50b3BpY0FybiB9KSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBTMyBzdG9yYWdlIHdpZGdldCB0byBkYXNoYm9hcmRcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdTMyBTdG9yYWdlIFVzYWdlIChCeXRlcyknLFxuICAgICAgICBsZWZ0OiBbczNTdG9yYWdlXSxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDb3N0IG9wdGltaXphdGlvbiBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nvc3RBbGVydFRvcGljQXJuJywge1xuICAgICAgdmFsdWU6IGNvc3RBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgVG9waWMgZm9yIGNvc3QgYWxlcnRzJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZFdhdGNoRGFzaGJvYXJkVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5yZWdpb259LmNvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHtkYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIERhc2hib2FyZCBVUkwgZm9yIG1vbml0b3JpbmcnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0J1ZGdldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogYFJlY2lwZUFyY2hpdmUtQnVkZ2V0LSR7c2VjdXJlSWR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVdTIEJ1ZGdldCBuYW1lIGZvciBjb3N0IHRyYWNraW5nJyxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gKE9wdGlvbmFsKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBpZiAocHJvcHMuaW5jbHVkZUNsb3VkRnJvbnQpIHtcbiAgICAgIC8vIENyZWF0ZSBTMyBidWNrZXQgZm9yIHdlYiBhcHAgaG9zdGluZ1xuICAgICAgdGhpcy53ZWJBcHBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTZWN1cmVXZWJBcHBCdWNrZXQnLCB7XG4gICAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGVhcmNoaXZlLXdlYi1hcHAtJHtzZWN1cmVJZH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLCAvLyBXaWxsIGJlIGFjY2Vzc2VkIHRocm91Z2ggQ2xvdWRGcm9udCBvbmx5XG4gICAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgICAgdmVyc2lvbmVkOiBmYWxzZSxcbiAgICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ1dlYkFwcENsZWFudXAnLFxuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uRXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoNyksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBPcmlnaW4gQWNjZXNzIElkZW50aXR5IGZvciBDbG91ZEZyb250IHRvIGFjY2VzcyBTM1xuICAgICAgY29uc3Qgb3JpZ2luQWNjZXNzSWRlbnRpdHkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ1NlY3VyZU9BSScsXG4gICAgICAgIHtcbiAgICAgICAgICBjb21tZW50OiBgT0FJIGZvciBSZWNpcGVBcmNoaXZlIFdlYiBBcHAgKCR7c2VjdXJlSWR9KWAsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIC8vIEdyYW50IENsb3VkRnJvbnQgcmVhZCBhY2Nlc3MgdG8gdGhlIHdlYiBhcHAgYnVja2V0XG4gICAgICB0aGlzLndlYkFwcEJ1Y2tldC5ncmFudFJlYWQob3JpZ2luQWNjZXNzSWRlbnRpdHkpO1xuXG4gICAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBmb3Igd2ViIGFwcFxuICAgICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdTZWN1cmVXZWJEaXN0cmlidXRpb24nLFxuICAgICAgICB7XG4gICAgICAgICAgY29tbWVudDogYFJlY2lwZUFyY2hpdmUgV2ViIEFwcCBEaXN0cmlidXRpb24gKCR7c2VjdXJlSWR9KWAsXG4gICAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMud2ViQXBwQnVja2V0LCB7XG4gICAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvcmlnaW5BY2Nlc3NJZGVudGl0eSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaHR0cFN0YXR1czogNDAzLFxuICAgICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLCAvLyBDb3N0LW9wdGltaXplZFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgbWluaW11bVByb3RvY29sVmVyc2lvbjpcbiAgICAgICAgICAgIGNsb3VkZnJvbnQuU2VjdXJpdHlQb2xpY3lQcm90b2NvbC5UTFNfVjFfMl8yMDIxLFxuICAgICAgICAgIGh0dHBWZXJzaW9uOiBjbG91ZGZyb250Lkh0dHBWZXJzaW9uLkhUVFAyLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBDbG91ZEZyb250IG91dHB1dHNcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVXZWJBcHBCdWNrZXROYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy53ZWJBcHBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZWN1cmUgV2ViIEFwcCBTMyBCdWNrZXQgTmFtZScsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlY3VyZUNsb3VkRnJvbnRVUkwnLCB7XG4gICAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZWN1cmUgQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJMJyxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIElEJyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFkZCB0YWdzIHRvIGFsbCByZXNvdXJjZXMgZm9yIGNvc3QgdHJhY2tpbmdcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCBgUmVjaXBlQXJjaGl2ZS0ke3NlY3VyZUlkfWApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZWN1cmVTdGFjaycsICd0cnVlJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDcmVhdGVkQnknLCAnUmVjaXBlQXJjaGl2ZS1NaW5pbWFsLUNESycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29zdENlbnRlcicsICdEZXZlbG9wbWVudCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnT3duZXInLCBwcm9wcy5hZG1pbkVtYWlsKTtcbiAgfVxufVxuIl19