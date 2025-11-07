"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeArchiveStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const s3 = require("aws-cdk-lib/aws-s3");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const iam = require("aws-cdk-lib/aws-iam");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const sns = require("aws-cdk-lib/aws-sns");
const snsSubscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
const budgets = require("aws-cdk-lib/aws-budgets");
const sqs = require("aws-cdk-lib/aws-sqs");
const lambdaEventSources = require("aws-cdk-lib/aws-lambda-event-sources");
class RecipeArchiveStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Store environment for singleton methods
        this.stackEnvironment = props.environment;
        // Cognito User Pool for Authentication
        this.userPool = new cognito.UserPool(this, "RecipeArchiveUserPool", {
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
            removalPolicy: props.environment === "prod"
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });
        // Cognito User Pool Client
        this.userPoolClient = new cognito.UserPoolClient(this, "RecipeArchiveUserPoolClient", {
            userPool: this.userPool,
            userPoolClientName: `recipeArchive-client-${props.environment}`,
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
        // S3 Buckets with Environment-Specific Retention Policies
        // Primary Storage Bucket for Recipe Photos and Documents
        this.storageBucket = new s3.Bucket(this, "RecipeArchiveStorage", {
            bucketName: `recipearchive-storage-${props.environment}-${this.account}`,
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
        // Temporary/Processing Bucket with Ultra-Short Retention
        this.tempBucket = new s3.Bucket(this, "RecipeArchiveTemp", {
            bucketName: `recipearchive-temp-${props.environment}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false,
            lifecycleRules: [
                {
                    id: "delete-temp-files",
                    expiration: cdk.Duration.days(props.environment === "prod" ? 7 : 1),
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(1), // Fixed: use days instead of hours
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Always destroy temp bucket
        });
        // Failed Parsing HTML Storage Bucket with Size and Time Limits
        this.failedParsingBucket = new s3.Bucket(this, "RecipeArchiveFailedParsing", {
            bucketName: `recipearchive-failed-parsing-${props.environment}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false,
            lifecycleRules: [
                {
                    id: "delete-failed-parsing-data",
                    expiration: cdk.Duration.days(2),
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
                },
            ],
            // Bucket notification to monitor size (will be handled by CloudWatch metrics)
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Always safe to destroy failed parsing data
        });
        // IAM Role for Lambda Functions (shared across all Lambda functions)
        this.lambdaRole = new iam.Role(this, "RecipeArchiveLambdaRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
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
                                "s3:GetObjectUrl",
                                "s3:PutObjectAcl", // For public image uploads
                            ],
                            resources: [
                                `${this.storageBucket.bucketArn}/*`,
                                `${this.tempBucket.bucketArn}/*`,
                                `${this.failedParsingBucket.bucketArn}/*`,
                            ],
                        }),
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: ["s3:ListBucket"],
                            resources: [
                                this.storageBucket.bucketArn,
                                this.tempBucket.bucketArn,
                                this.failedParsingBucket.bucketArn,
                            ],
                        }),
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "sqs:SendMessage",
                                "sqs:ReceiveMessage",
                                "sqs:DeleteMessage",
                                "sqs:GetQueueAttributes",
                            ],
                            resources: ["*"], // Will be restricted to specific queue in production
                        }),
                        // DynamoDB permissions removed - invitation system now uses S3 JSON storage
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: ["ses:SendEmail", "ses:SendRawEmail"],
                            resources: ["*"], // SES permissions for invitation emails
                        }),
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "cognito-idp:AdminCreateUser",
                                "cognito-idp:AdminSetUserPassword",
                                "cognito-idp:AdminUpdateUserAttributes",
                                "cognito-idp:AdminGetUser",
                            ],
                            resources: [this.userPool.userPoolArn],
                        }),
                    ],
                }),
            },
        });
        // API Gateway with DDoS Protection
        this.api = new apigateway.RestApi(this, "RecipeArchiveAPI", {
            restApiName: `recipeArchive-api-${props.environment}`,
            description: "RecipeArchive Backend API",
            defaultCorsPreflightOptions: {
                allowOrigins: [
                    "https://localhost:3000",
                    "https://recipearchive.com",
                    "https://d1jcaphz4458q7.cloudfront.net",
                    "chrome-extension://*",
                    "safari-web-extension://*",
                ],
                allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allowHeaders: [
                    "Content-Type",
                    "X-Amz-Date",
                    "Authorization",
                    "X-Api-Key",
                ],
                allowCredentials: true, // Important for authenticated requests
            },
            deployOptions: {
                stageName: "prod",
            },
        });
        // DDoS Protection: Usage Plan with Rate Limiting
        const usagePlan = new apigateway.UsagePlan(this, "RecipeArchiveUsagePlan", {
            name: `recipearchive-usage-plan-${props.environment}`,
            description: "Usage plan for DDoS protection",
            throttle: {
                rateLimit: 200,
                burstLimit: 400, // concurrent requests
            },
            quota: {
                limit: 10000,
                period: apigateway.Period.MONTH,
            },
        });
        usagePlan.addApiStage({
            stage: this.api.deploymentStage,
        });
        // Cognito Authorizer for API Gateway - DDoS Protection & Authentication
        const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
            cognitoUserPools: [this.userPool],
            authorizerName: "recipeArchive-cognito-authorizer",
            resultsCacheTtl: cdk.Duration.minutes(5), // Cache auth results to reduce load
        });
        // Request Validator for DDoS Protection - Reject malformed requests early
        const requestValidator = new apigateway.RequestValidator(this, "RequestValidator", {
            restApi: this.api,
            requestValidatorName: "recipe-request-validator",
            validateRequestBody: true,
            validateRequestParameters: true,
        });
        // SQS Queue for async recipe normalization (shared resource)
        this.recipeNormalizationQueue = new sqs.Queue(this, "RecipeNormalizationQueue", {
            queueName: `recipe-normalization-${props.environment}`,
            visibilityTimeout: cdk.Duration.seconds(60),
            retentionPeriod: cdk.Duration.days(14),
            deadLetterQueue: {
                queue: new sqs.Queue(this, "RecipeNormalizationDLQ", {
                    queueName: `recipe-normalization-dlq-${props.environment}`,
                    retentionPeriod: cdk.Duration.days(14),
                }),
                maxReceiveCount: 3, // Try 3 times before moving to DLQ
            },
        });
        // Lambda Functions - now using singleton pattern
        // S3-Based Invitation System (Cost Optimized - no DynamoDB needed)
        // Invitations now stored as JSON files in existing S3 bucket
        // Cost savings: ~70-90% reduction from DynamoDB approach
        // API Gateway Integration
        const healthIntegration = new apigateway.LambdaIntegration(this.getHealthFunction(), {
            requestTemplates: { "application/json": "{ \"statusCode\": \"200\" }" },
        });
        // API Resources
        const healthResource = this.api.root.addResource("health");
        healthResource.addMethod("GET", healthIntegration);
        const v1 = this.api.root.addResource("v1");
        // Diagnostics endpoint (public - no auth required for error reporting)
        const diagnosticsResource = this.api.root.addResource("diagnostics");
        const diagnosticsIntegration = new apigateway.LambdaIntegration(this.getDiagnosticsFunction());
        diagnosticsResource.addMethod("POST", diagnosticsIntegration, {
            requestValidator: requestValidator,
        });
        // Flutter Console Diagnostics endpoint (public - no auth required)
        const flutterConsoleResource = this.api.root.addResource("flutter-console-errors");
        const flutterConsoleIntegration = new apigateway.LambdaIntegration(this.getFlutterConsoleDiagnosticsFunction());
        flutterConsoleResource.addMethod("POST", flutterConsoleIntegration, {
            requestValidator: requestValidator,
        });
        // Report Error endpoint (public - no auth required, used by web extensions)
        const reportErrorResource = this.api.root.addResource("report-error");
        const reportErrorIntegration = new apigateway.LambdaIntegration(this.getDiagnosticsFunction());
        reportErrorResource.addMethod("POST", reportErrorIntegration, {
            requestValidator: requestValidator,
        });
        // Content Normalizer endpoint (internal system calls - no auth required)
        const normalizerResource = v1.addResource("normalize");
        const normalizerIntegration = new apigateway.LambdaIntegration(this.getContentNormalizerFunction());
        normalizerResource.addMethod("POST", normalizerIntegration, {
            // No authorizer - allow internal system calls from recipes function
            requestValidator: requestValidator,
        });
        // Diagnostic Processor endpoint (authenticated)
        const diagnosticProcessorResource = v1.addResource("diagnostic-summary");
        const diagnosticProcessorIntegration = new apigateway.LambdaIntegration(this.getDiagnosticProcessorFunction());
        diagnosticProcessorResource.addMethod("GET", diagnosticProcessorIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Future recipe endpoints
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const recipesResource = v1.addResource("recipes");
        // Recipe CRUD operations with Authentication
        const recipesIntegration = new apigateway.LambdaIntegration(this.getRecipesFunction());
        // List recipes: GET /recipes (requires authentication)
        recipesResource.addMethod("GET", recipesIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Create recipe: POST /recipes (requires authentication)
        recipesResource.addMethod("POST", recipesIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Single recipe operations: GET/PUT/DELETE /recipes/{id} (requires authentication)
        const recipeResource = recipesResource.addResource("{id}");
        recipeResource.addMethod("GET", recipesIntegration, {
            authorizer: cognitoAuthorizer,
        });
        recipeResource.addMethod("PUT", recipesIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        recipeResource.addMethod("DELETE", recipesIntegration, {
            authorizer: cognitoAuthorizer,
        });
        // Search endpoint: GET /recipes/search (requires authentication)
        const searchResource = recipesResource.addResource("search");
        searchResource.addMethod("GET", recipesIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Analytics endpoints: POST /v1/analytics/events, GET /v1/analytics/summary (requires authentication)
        const analyticsResource = v1.addResource("analytics");
        const analyticsIntegration = new apigateway.LambdaIntegration(this.getAnalyticsFunction());
        // Submit analytics events: POST /v1/analytics/events
        const analyticsEventsResource = analyticsResource.addResource("events");
        analyticsEventsResource.addMethod("POST", analyticsIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Get analytics summary: GET /v1/analytics/summary
        const analyticsSummaryResource = analyticsResource.addResource("summary");
        analyticsSummaryResource.addMethod("GET", analyticsIntegration, {
            authorizer: cognitoAuthorizer,
        });
        // Image upload endpoint: POST /images/upload (requires authentication)
        const imagesResource = this.api.root.addResource("images");
        const uploadResource = imagesResource.addResource("upload");
        const imageUploadIntegration = new apigateway.LambdaIntegration(this.getImageUploadFunction());
        uploadResource.addMethod("POST", imageUploadIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Admin Endpoints for Multi-Tenant Invitation Management
        const adminResource = this.api.root.addResource("admin");
        const adminInvitationsResource = adminResource.addResource("invitations");
        const invitationManagerIntegration = new apigateway.LambdaIntegration(this.getInvitationManagerFunction());
        // List invitations: GET /admin/invitations (requires admin authentication)
        adminInvitationsResource.addMethod("GET", invitationManagerIntegration, {
            authorizer: cognitoAuthorizer,
        });
        // Create invitation: POST /admin/invitations (requires admin authentication)
        adminInvitationsResource.addMethod("POST", invitationManagerIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Revoke invitation: DELETE /admin/invitations/{token} (requires admin authentication)
        const adminInvitationTokenResource = adminInvitationsResource.addResource("{token}");
        adminInvitationTokenResource.addMethod("DELETE", invitationManagerIntegration, {
            authorizer: cognitoAuthorizer,
        });
        // Check invitation status: GET /admin/invitations/status/{token} (public, no auth required)
        const adminInvitationStatusResource = adminInvitationsResource.addResource("status");
        const adminInvitationStatusTokenResource = adminInvitationStatusResource.addResource("{token}");
        adminInvitationStatusTokenResource.addMethod("GET", invitationManagerIntegration);
        // Auth Endpoints for Registration
        const authResource = this.api.root.addResource("auth");
        const authRegisterWithInvitationResource = authResource.addResource("register-with-invitation");
        const registrationHandlerIntegration = new apigateway.LambdaIntegration(this.getRegistrationHandlerFunction());
        // Register with invitation: POST /auth/register-with-invitation (public, no auth required)
        authRegisterWithInvitationResource.addMethod("POST", registrationHandlerIntegration, {
            requestValidator: requestValidator,
        });
        // Add Gateway Responses to include CORS headers on API Gateway error responses
        this.api.addGatewayResponse("unauthorized", {
            type: apigateway.ResponseType.UNAUTHORIZED,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'https://d1jcaphz4458q7.cloudfront.net'",
                "Access-Control-Allow-Credentials": "'true'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse("access-denied", {
            type: apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'https://d1jcaphz4458q7.cloudfront.net'",
                "Access-Control-Allow-Credentials": "'true'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse("default-4xx", {
            type: apigateway.ResponseType.DEFAULT_4XX,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'https://d1jcaphz4458q7.cloudfront.net'",
                "Access-Control-Allow-Credentials": "'true'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse("default-5xx", {
            type: apigateway.ResponseType.DEFAULT_5XX,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'https://d1jcaphz4458q7.cloudfront.net'",
                "Access-Control-Allow-Credentials": "'true'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        });
        // 🚨 COST MONITORING & BILLING ALERTS 🚨
        // SNS Topic for billing alerts
        this.billingAlertTopic = new sns.Topic(this, "BillingAlerts", {
            topicName: `recipearchive-billing-alerts-${props.environment}`,
            displayName: "RecipeArchive Billing Alerts",
        });
        // Email subscription for billing alerts
        this.billingAlertTopic.addSubscription(new snsSubscriptions.EmailSubscription(props.adminEmail));
        // AWS Budget for conservative monthly cost monitoring ($20/month maximum)
        new budgets.CfnBudget(this, "MonthlyCostBudget", {
            budget: {
                budgetName: `RecipeArchive-MonthlyCostWatchdog-${props.environment}`,
                budgetType: "COST",
                timeUnit: "MONTHLY",
                budgetLimit: {
                    amount: 20,
                    unit: "USD",
                },
                costFilters: {
                // Only monitor this account's costs
                },
                timePeriod: {
                    start: "1756080093",
                    end: "2082762102", // December 31, 2035 in epoch seconds
                },
            },
            notificationsWithSubscribers: [
                {
                    notification: {
                        notificationType: "ACTUAL",
                        comparisonOperator: "GREATER_THAN",
                        threshold: 25,
                        thresholdType: "PERCENTAGE",
                    },
                    subscribers: [
                        {
                            subscriptionType: "SNS",
                            address: this.billingAlertTopic.topicArn,
                        },
                    ],
                },
                {
                    notification: {
                        notificationType: "ACTUAL",
                        comparisonOperator: "GREATER_THAN",
                        threshold: 50,
                        thresholdType: "PERCENTAGE",
                    },
                    subscribers: [
                        {
                            subscriptionType: "SNS",
                            address: this.billingAlertTopic.topicArn,
                        },
                    ],
                },
                {
                    notification: {
                        notificationType: "ACTUAL",
                        comparisonOperator: "GREATER_THAN",
                        threshold: 80,
                        thresholdType: "PERCENTAGE",
                    },
                    subscribers: [
                        {
                            subscriptionType: "SNS",
                            address: this.billingAlertTopic.topicArn,
                        },
                    ],
                },
                {
                    notification: {
                        notificationType: "FORECASTED",
                        comparisonOperator: "GREATER_THAN",
                        threshold: 100,
                        thresholdType: "PERCENTAGE",
                    },
                    subscribers: [
                        {
                            subscriptionType: "SNS",
                            address: this.billingAlertTopic.topicArn,
                        },
                    ],
                },
            ],
        });
        // CloudWatch Alarm for unusual spending patterns
        const unusualSpendingAlarm = new cloudwatch.Alarm(this, "UnusualSpendingAlarm", {
            alarmName: `RecipeArchive-UnusualSpending-${props.environment}`,
            alarmDescription: "Alert when estimated monthly charges exceed $20",
            metric: new cloudwatch.Metric({
                namespace: "AWS/Billing",
                metricName: "EstimatedCharges",
                dimensionsMap: {
                    Currency: "USD",
                },
                statistic: "Maximum",
                period: cdk.Duration.hours(12), // Check twice daily
            }),
            threshold: 20,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // Connect the alarm to SNS topic
        unusualSpendingAlarm.addAlarmAction({
            bind: () => ({ alarmActionArn: this.billingAlertTopic.topicArn }),
        });
        // CloudWatch Alarm for Failed Parsing Bucket Size (4MB limit)
        const failedParsingBucketSizeAlarm = new cloudwatch.Alarm(this, "FailedParsingBucketSizeAlarm", {
            alarmName: `RecipeArchive-FailedParsingBucketSize-${props.environment}`,
            alarmDescription: "Alert when failed parsing bucket exceeds 4MB to prevent cost overruns",
            metric: new cloudwatch.Metric({
                namespace: "AWS/S3",
                metricName: "BucketSizeBytes",
                dimensionsMap: {
                    BucketName: this.failedParsingBucket.bucketName,
                    StorageType: "StandardStorage",
                },
                statistic: "Average",
                period: cdk.Duration.hours(6), // Check 4 times daily
            }),
            threshold: 4 * 1024 * 1024,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // Connect the bucket size alarm to SNS topic
        failedParsingBucketSizeAlarm.addAlarmAction({
            bind: () => ({ alarmActionArn: this.billingAlertTopic.topicArn }),
        });
        // Outputs
        new cdk.CfnOutput(this, "UserPoolId", {
            value: this.userPool.userPoolId,
            description: "Cognito User Pool ID",
        });
        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: this.userPoolClient.userPoolClientId,
            description: "Cognito User Pool Client ID",
        });
        new cdk.CfnOutput(this, "StorageBucketName", {
            value: this.storageBucket.bucketName,
            description: "S3 Storage Bucket Name (Recipe Photos & Documents)",
        });
        new cdk.CfnOutput(this, "TempBucketName", {
            value: this.tempBucket.bucketName,
            description: "S3 Temporary Bucket Name (Processing & Uploads)",
        });
        new cdk.CfnOutput(this, "FailedParsingBucketName", {
            value: this.failedParsingBucket.bucketName,
            description: "S3 Failed Parsing Bucket Name (HTML from failed recipe extractions)",
        });
        new cdk.CfnOutput(this, "ApiGatewayUrl", {
            value: this.api.url,
            description: "API Gateway URL",
        });
        new cdk.CfnOutput(this, "BillingAlertTopicArn", {
            value: this.billingAlertTopic.topicArn,
            description: "SNS Topic ARN for Billing Alerts",
        });
        new cdk.CfnOutput(this, "Region", {
            value: this.region,
            description: "AWS Region",
        });
        new cdk.CfnOutput(this, "AdminEmail", {
            value: props.adminEmail,
            description: "Admin Email for Billing Alerts and Initial User Creation",
        });
        // DynamoDB outputs removed - invitation system now uses S3 JSON storage
        // Cost savings: ~$4.50-13.50/month for low-volume usage
        // Initialize background normalizer to ensure SQS event source is created
        this.getBackgroundNormalizerFunction();
    }
    // Singleton getters for Lambda functions
    getHealthFunction() {
        if (!this._healthFunction) {
            this._healthFunction = new lambda.Function(this, "HealthFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/health-package"),
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    S3_TEMP_BUCKET: this.tempBucket.bucketName,
                    S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                },
                role: this.lambdaRole,
            });
        }
        return this._healthFunction;
    }
    getRecipesFunction() {
        if (!this._recipesFunction) {
            this._recipesFunction = new lambda.Function(this, "RecipesFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/recipes-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    S3_TEMP_BUCKET: this.tempBucket.bucketName,
                    S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                    API_GATEWAY_URL: "https://4eprojzbrc.execute-api.us-west-2.amazonaws.com/prod",
                    NORMALIZATION_QUEUE_URL: this.recipeNormalizationQueue.queueUrl,
                },
                role: this.lambdaRole,
            });
        }
        return this._recipesFunction;
    }
    getDiagnosticsFunction() {
        if (!this._diagnosticsFunction) {
            this._diagnosticsFunction = new lambda.Function(this, "DiagnosticsFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/diagnostics-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                },
                role: this.lambdaRole,
            });
        }
        return this._diagnosticsFunction;
    }
    getImageUploadFunction() {
        if (!this._imageUploadFunction) {
            this._imageUploadFunction = new lambda.Function(this, "ImageUploadFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/image-upload-package"),
                timeout: cdk.Duration.seconds(30),
                memorySize: 512,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                },
                role: this.lambdaRole,
            });
        }
        return this._imageUploadFunction;
    }
    getFlutterConsoleDiagnosticsFunction() {
        if (!this._flutterConsoleDiagnosticsFunction) {
            this._flutterConsoleDiagnosticsFunction = new lambda.Function(this, "FlutterConsoleDiagnosticsFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/flutter-console-diagnostics-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                },
                role: this.lambdaRole,
            });
        }
        return this._flutterConsoleDiagnosticsFunction;
    }
    getContentNormalizerFunction() {
        if (!this._contentNormalizerFunction) {
            this._contentNormalizerFunction = new lambda.Function(this, "ContentNormalizerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/content-normalizer-package"),
                timeout: cdk.Duration.seconds(30),
                memorySize: 512,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "", // Read from environment
                },
                role: this.lambdaRole,
            });
        }
        return this._contentNormalizerFunction;
    }
    getBackgroundNormalizerFunction() {
        if (!this._backgroundNormalizerFunction) {
            this._backgroundNormalizerFunction = new lambda.Function(this, "BackgroundNormalizerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/background-normalizer-package"),
                timeout: cdk.Duration.seconds(45),
                memorySize: 512,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
                },
                role: this.lambdaRole,
            });
            // Connect SQS queue to background normalizer Lambda
            this._backgroundNormalizerFunction.addEventSource(new lambdaEventSources.SqsEventSource(this.recipeNormalizationQueue, {
                batchSize: 1,
                maxBatchingWindow: cdk.Duration.seconds(5),
            }));
        }
        return this._backgroundNormalizerFunction;
    }
    getDiagnosticProcessorFunction() {
        if (!this._diagnosticProcessorFunction) {
            this._diagnosticProcessorFunction = new lambda.Function(this, "DiagnosticProcessorFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/diagnostic-processor-package"),
                timeout: cdk.Duration.seconds(60),
                memorySize: 1024,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                },
                role: this.lambdaRole,
            });
        }
        return this._diagnosticProcessorFunction;
    }
    getInvitationManagerFunction() {
        if (!this._invitationManagerFunction) {
            this._invitationManagerFunction = new lambda.Function(this, "InvitationManagerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/invitation-manager-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                    FRONTEND_BASE_URL: "https://d1jcaphz4458q7.cloudfront.net",
                },
                role: this.lambdaRole,
            });
        }
        return this._invitationManagerFunction;
    }
    getRegistrationHandlerFunction() {
        if (!this._registrationHandlerFunction) {
            this._registrationHandlerFunction = new lambda.Function(this, "RegistrationHandlerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/registration-handler-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                    COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
                },
                role: this.lambdaRole,
            });
        }
        return this._registrationHandlerFunction;
    }
    getAnalyticsFunction() {
        if (!this._analyticsFunction) {
            this._analyticsFunction = new lambda.Function(this, "RecipeAnalyticsAggregator", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/analytics-aggregator-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                },
                role: this.lambdaRole,
            });
        }
        return this._analyticsFunction;
    }
}
exports.RecipeArchiveStack = RecipeArchiveStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZWNpcGUtYXJjaGl2ZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsbURBQW1EO0FBQ25ELHlDQUF5QztBQUN6QyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyx5REFBeUQ7QUFDekQsMkNBQTJDO0FBQzNDLHNFQUFzRTtBQUN0RSxtREFBbUQ7QUFDbkQsMkNBQTJDO0FBQzNDLDJFQUEyRTtBQU8zRSxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBMkIvQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQThCO1FBQ3RFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDBDQUEwQztRQUMxQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztRQUUxQyx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2xFLFlBQVksRUFBRSx1QkFBdUIsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUN4RCxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRTtnQkFDYixLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0QsVUFBVSxFQUFFO2dCQUNWLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxrQkFBa0IsRUFBRTtnQkFDbEIsS0FBSyxFQUFFO29CQUNMLFFBQVEsRUFBRSxJQUFJO29CQUNkLE9BQU8sRUFBRSxJQUFJO2lCQUNkO2dCQUNELFNBQVMsRUFBRTtvQkFDVCxRQUFRLEVBQUUsS0FBSztvQkFDZixPQUFPLEVBQUUsSUFBSTtpQkFDZDtnQkFDRCxVQUFVLEVBQUU7b0JBQ1YsUUFBUSxFQUFFLEtBQUs7b0JBQ2YsT0FBTyxF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QixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVTtpQkFDL0M7Z0JBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVO2FBQ3RCLENBQ0YsQ0FBQztTQUNIO1FBQ0QsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBbGpDRCxnREFrakNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGJ1ZGdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJ1ZGdldHMnO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgbGFtYmRhRXZlbnRTb3VyY2VzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjaXBlQXJjaGl2ZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGFkbWluRW1haWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFJlY2lwZUFyY2hpdmVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgc3RvcmFnZUJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgdGVtcEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZmFpbGVkUGFyc2luZ0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBiaWxsaW5nQWxlcnRUb3BpYzogc25zLlRvcGljO1xuXG4gIC8vIFNoYXJlZCByZXNvdXJjZXMgZm9yIHNpbmdsZXRvbiBwYXR0ZXJuXG4gIHByaXZhdGUgcmVhZG9ubHkgbGFtYmRhUm9sZTogaWFtLlJvbGU7XG4gIHByaXZhdGUgcmVhZG9ubHkgcmVjaXBlTm9ybWFsaXphdGlvblF1ZXVlOiBzcXMuUXVldWU7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3RhY2tFbnZpcm9ubWVudDogc3RyaW5nO1xuXG4gIC8vIFNpbmdsZXRvbiBMYW1iZGEgZnVuY3Rpb24gaW5zdGFuY2VzXG4gIHByaXZhdGUgX2hlYWx0aEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX3JlY2lwZXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9pbWFnZVVwbG9hZEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2RpYWdub3N0aWNzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfZmx1dHRlckNvbnNvbGVEaWFnbm9zdGljc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2NvbnRlbnROb3JtYWxpemVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfYmFja2dyb3VuZE5vcm1hbGl6ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9kaWFnbm9zdGljUHJvY2Vzc29yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfaW52aXRhdGlvbk1hbmFnZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9yZWdpc3RyYXRpb25IYW5kbGVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfYW5hbHl0aWNzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUmVjaXBlQXJjaGl2ZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFN0b3JlIGVudmlyb25tZW50IGZvciBzaW5nbGV0b24gbWV0aG9kc1xuICAgIHRoaXMuc3RhY2tFbnZpcm9ubWVudCA9IHByb3BzLmVudmlyb25tZW50O1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgZm9yIEF1dGhlbnRpY2F0aW9uXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdSZWNpcGVBcmNoaXZlVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGByZWNpcGVBcmNoaXZlLXVzZXJzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGdpdmVuTmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTpcbiAgICAgICAgcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50XG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KFxuICAgICAgdGhpcyxcbiAgICAgICdSZWNpcGVBcmNoaXZlVXNlclBvb2xDbGllbnQnLFxuICAgICAge1xuICAgICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcbiAgICAgICAgdXNlclBvb2xDbGllbnROYW1lOiBgcmVjaXBlQXJjaGl2ZS1jbGllbnQtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIFB1YmxpYyBjbGllbnQgZm9yIGJyb3dzZXIvbW9iaWxlIGFwcHNcbiAgICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgICAgY3VzdG9tOiBmYWxzZSxcbiAgICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIG9BdXRoOiB7XG4gICAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICByZWZyZXNoVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICBlbmFibGVUb2tlblJldm9jYXRpb246IHRydWUsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFMzIEJ1Y2tldHMgd2l0aCBFbnZpcm9ubWVudC1TcGVjaWZpYyBSZXRlbnRpb24gUG9saWNpZXNcblxuICAgIC8vIFByaW1hcnkgU3RvcmFnZSBCdWNrZXQgZm9yIFJlY2lwZSBQaG90b3MgYW5kIERvY3VtZW50c1xuICAgIHRoaXMuc3RvcmFnZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1JlY2lwZUFyY2hpdmVTdG9yYWdlJywge1xuICAgICAgYnVja2V0TmFtZTogYHJlY2lwZWFyY2hpdmUtc3RvcmFnZS0ke3Byb3BzLmVudmlyb25tZW50fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLCAvLyBBbGxvdyBidWNrZXQgcG9saWNpZXNcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZSwgLy8gQWxsb3cgcHVibGljIHJlYWQgYWNjZXNzIHZpYSBidWNrZXQgcG9saWN5XG4gICAgICB9KSxcbiAgICAgIHZlcnNpb25lZDogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2RlbGV0ZS1pbmNvbXBsZXRlLXVwbG9hZHMnLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgcmV0ZW50aW9uIHBvbGljaWVzXG4gICAgICAgIC4uLihwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ2FyY2hpdmUtb2xkLWZpbGVzJyxcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygyNTU1KSwgLy8gNyB5ZWFycyBmb3IgcHJvZHVjdGlvblxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICdhcmNoaXZlLW9sZC12ZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXVxuICAgICAgICAgIDogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gU1RSSUNUIDE0LURBWSBSRVRFTlRJT04gRk9SIFBSRS1QUk9EIFRFU1RJTkdcbiAgICAgICAgICAgICAgICBpZDogJ2RlbGV0ZS10ZXN0LWRhdGEnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSksXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTpcbiAgICAgICAgcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGJ1Y2tldCBwb2xpY3kgdG8gYWxsb3cgcHVibGljIHJlYWQgYWNjZXNzIHRvIHJlY2lwZSBpbWFnZXNcbiAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgc2lkOiAnUHVibGljUmVhZEdldE9iamVjdCcsXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJufS9yZWNpcGUtaW1hZ2VzLypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFRlbXBvcmFyeS9Qcm9jZXNzaW5nIEJ1Y2tldCB3aXRoIFVsdHJhLVNob3J0IFJldGVudGlvblxuICAgIHRoaXMudGVtcEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1JlY2lwZUFyY2hpdmVUZW1wJywge1xuICAgICAgYnVja2V0TmFtZTogYHJlY2lwZWFyY2hpdmUtdGVtcC0ke3Byb3BzLmVudmlyb25tZW50fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIE5ldmVyIHZlcnNpb24gdGVtcG9yYXJ5IGZpbGVzXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdkZWxldGUtdGVtcC1maWxlcycsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMocHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDcgOiAxKSxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksIC8vIEZpeGVkOiB1c2UgZGF5cyBpbnN0ZWFkIG9mIGhvdXJzXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQWx3YXlzIGRlc3Ryb3kgdGVtcCBidWNrZXRcbiAgICB9KTtcblxuICAgIC8vIEZhaWxlZCBQYXJzaW5nIEhUTUwgU3RvcmFnZSBCdWNrZXQgd2l0aCBTaXplIGFuZCBUaW1lIExpbWl0c1xuICAgIHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQoXG4gICAgICB0aGlzLFxuICAgICAgJ1JlY2lwZUFyY2hpdmVGYWlsZWRQYXJzaW5nJyxcbiAgICAgIHtcbiAgICAgICAgYnVja2V0TmFtZTogYHJlY2lwZWFyY2hpdmUtZmFpbGVkLXBhcnNpbmctJHtwcm9wcy5lbnZpcm9ubWVudH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyBObyB2ZXJzaW9uaW5nIG5lZWRlZCBmb3IgZmFpbGVkIHBhcnNpbmcgZGF0YVxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnZGVsZXRlLWZhaWxlZC1wYXJzaW5nLWRhdGEnLFxuICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMiksIC8vIEF1dG8tcHVyZ2UgYWZ0ZXIgNDggaG91cnNcbiAgICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICAvLyBCdWNrZXQgbm90aWZpY2F0aW9uIHRvIG1vbml0b3Igc2l6ZSAod2lsbCBiZSBoYW5kbGVkIGJ5IENsb3VkV2F0Y2ggbWV0cmljcylcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQWx3YXlzIHNhZmUgdG8gZGVzdHJveSBmYWlsZWQgcGFyc2luZyBkYXRhXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIElBTSBSb2xlIGZvciBMYW1iZGEgRnVuY3Rpb25zIChzaGFyZWQgYWNyb3NzIGFsbCBMYW1iZGEgZnVuY3Rpb25zKVxuICAgIHRoaXMubGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUmVjaXBlQXJjaGl2ZUxhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnXG4gICAgICAgICksXG4gICAgICBdLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgUzNBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdFVybCcsXG4gICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdEFjbCcsIC8vIEZvciBwdWJsaWMgaW1hZ2UgdXBsb2Fkc1xuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgJHt0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICAgICAgICBgJHt0aGlzLnRlbXBCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICAgICAgICBgJHt0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFsnczM6TGlzdEJ1Y2tldCddLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgIHRoaXMudGVtcEJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnc3FzOlNlbmRNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAnc3FzOlJlY2VpdmVNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAnc3FzOkRlbGV0ZU1lc3NhZ2UnLFxuICAgICAgICAgICAgICAgICdzcXM6R2V0UXVldWVBdHRyaWJ1dGVzJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gV2lsbCBiZSByZXN0cmljdGVkIHRvIHNwZWNpZmljIHF1ZXVlIGluIHByb2R1Y3Rpb25cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgLy8gRHluYW1vREIgcGVybWlzc2lvbnMgcmVtb3ZlZCAtIGludml0YXRpb24gc3lzdGVtIG5vdyB1c2VzIFMzIEpTT04gc3RvcmFnZVxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFsnc2VzOlNlbmRFbWFpbCcsICdzZXM6U2VuZFJhd0VtYWlsJ10sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sIC8vIFNFUyBwZXJtaXNzaW9ucyBmb3IgaW52aXRhdGlvbiBlbWFpbHNcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5TZXRVc2VyUGFzc3dvcmQnLFxuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSB3aXRoIEREb1MgUHJvdGVjdGlvblxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUmVjaXBlQXJjaGl2ZUFQSScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgcmVjaXBlQXJjaGl2ZS1hcGktJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWNpcGVBcmNoaXZlIEJhY2tlbmQgQVBJJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IFtcbiAgICAgICAgICAnaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgICAgJ2h0dHBzOi8vcmVjaXBlYXJjaGl2ZS5jb20nLFxuICAgICAgICAgICdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0JyxcbiAgICAgICAgICAnY2hyb21lLWV4dGVuc2lvbjovLyonLFxuICAgICAgICAgICdzYWZhcmktd2ViLWV4dGVuc2lvbjovLyonLFxuICAgICAgICBdLCAvLyBSZXN0cmljdCBvcmlnaW5zXG4gICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BcGktS2V5JyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSwgLy8gSW1wb3J0YW50IGZvciBhdXRoZW50aWNhdGVkIHJlcXVlc3RzXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6ICdwcm9kJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBERG9TIFByb3RlY3Rpb246IFVzYWdlIFBsYW4gd2l0aCBSYXRlIExpbWl0aW5nXG4gICAgY29uc3QgdXNhZ2VQbGFuID0gbmV3IGFwaWdhdGV3YXkuVXNhZ2VQbGFuKHRoaXMsICdSZWNpcGVBcmNoaXZlVXNhZ2VQbGFuJywge1xuICAgICAgbmFtZTogYHJlY2lwZWFyY2hpdmUtdXNhZ2UtcGxhbi0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzYWdlIHBsYW4gZm9yIEREb1MgcHJvdGVjdGlvbicsXG4gICAgICB0aHJvdHRsZToge1xuICAgICAgICByYXRlTGltaXQ6IDIwMCwgLy8gcmVxdWVzdHMgcGVyIHNlY29uZCBwZXIgQVBJIGtleVxuICAgICAgICBidXJzdExpbWl0OiA0MDAsIC8vIGNvbmN1cnJlbnQgcmVxdWVzdHNcbiAgICAgIH0sXG4gICAgICBxdW90YToge1xuICAgICAgICBsaW1pdDogMTAwMDAsIC8vIHJlcXVlc3RzIHBlciBtb250aCBwZXIgQVBJIGtleVxuICAgICAgICBwZXJpb2Q6IGFwaWdhdGV3YXkuUGVyaW9kLk1PTlRILFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5hcGkuZGVwbG95bWVudFN0YWdlLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyIGZvciBBUEkgR2F0ZXdheSAtIEREb1MgUHJvdGVjdGlvbiAmIEF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcihcbiAgICAgIHRoaXMsXG4gICAgICAnQ29nbml0b0F1dGhvcml6ZXInLFxuICAgICAge1xuICAgICAgICBjb2duaXRvVXNlclBvb2xzOiBbdGhpcy51c2VyUG9vbF0sXG4gICAgICAgIGF1dGhvcml6ZXJOYW1lOiAncmVjaXBlQXJjaGl2ZS1jb2duaXRvLWF1dGhvcml6ZXInLFxuICAgICAgICByZXN1bHRzQ2FjaGVUdGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBDYWNoZSBhdXRoIHJlc3VsdHMgdG8gcmVkdWNlIGxvYWRcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUmVxdWVzdCBWYWxpZGF0b3IgZm9yIEREb1MgUHJvdGVjdGlvbiAtIFJlamVjdCBtYWxmb3JtZWQgcmVxdWVzdHMgZWFybHlcbiAgICBjb25zdCByZXF1ZXN0VmFsaWRhdG9yID0gbmV3IGFwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcihcbiAgICAgIHRoaXMsXG4gICAgICAnUmVxdWVzdFZhbGlkYXRvcicsXG4gICAgICB7XG4gICAgICAgIHJlc3RBcGk6IHRoaXMuYXBpLFxuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yTmFtZTogJ3JlY2lwZS1yZXF1ZXN0LXZhbGlkYXRvcicsXG4gICAgICAgIHZhbGlkYXRlUmVxdWVzdEJvZHk6IHRydWUsXG4gICAgICAgIHZhbGlkYXRlUmVxdWVzdFBhcmFtZXRlcnM6IHRydWUsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFNRUyBRdWV1ZSBmb3IgYXN5bmMgcmVjaXBlIG5vcm1hbGl6YXRpb24gKHNoYXJlZCByZXNvdXJjZSlcbiAgICB0aGlzLnJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZSA9IG5ldyBzcXMuUXVldWUoXG4gICAgICB0aGlzLFxuICAgICAgJ1JlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZScsXG4gICAgICB7XG4gICAgICAgIHF1ZXVlTmFtZTogYHJlY2lwZS1ub3JtYWxpemF0aW9uLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSwgLy8gQWxsb3cgNjAgc2Vjb25kcyBmb3IgcHJvY2Vzc2luZ1xuICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSwgLy8gS2VlcCBtZXNzYWdlcyBmb3IgMiB3ZWVrc1xuICAgICAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgICAgICBxdWV1ZTogbmV3IHNxcy5RdWV1ZSh0aGlzLCAnUmVjaXBlTm9ybWFsaXphdGlvbkRMUScsIHtcbiAgICAgICAgICAgIHF1ZXVlTmFtZTogYHJlY2lwZS1ub3JtYWxpemF0aW9uLWRscS0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsIC8vIFRyeSAzIHRpbWVzIGJlZm9yZSBtb3ZpbmcgdG8gRExRXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnMgLSBub3cgdXNpbmcgc2luZ2xldG9uIHBhdHRlcm5cblxuXG5cblxuXG5cblxuICAgIC8vIFMzLUJhc2VkIEludml0YXRpb24gU3lzdGVtIChDb3N0IE9wdGltaXplZCAtIG5vIER5bmFtb0RCIG5lZWRlZClcbiAgICAvLyBJbnZpdGF0aW9ucyBub3cgc3RvcmVkIGFzIEpTT04gZmlsZXMgaW4gZXhpc3RpbmcgUzMgYnVja2V0XG4gICAgLy8gQ29zdCBzYXZpbmdzOiB+NzAtOTAlIHJlZHVjdGlvbiBmcm9tIER5bmFtb0RCIGFwcHJvYWNoXG5cblxuXG5cbiAgICAvLyBBUEkgR2F0ZXdheSBJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGhlYWx0aEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5nZXRIZWFsdGhGdW5jdGlvbigpLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSZXNvdXJjZXNcbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2hlYWx0aCcpO1xuICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgaGVhbHRoSW50ZWdyYXRpb24pO1xuXG4gICAgY29uc3QgdjEgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCd2MScpO1xuXG4gICAgLy8gRGlhZ25vc3RpY3MgZW5kcG9pbnQgKHB1YmxpYyAtIG5vIGF1dGggcmVxdWlyZWQgZm9yIGVycm9yIHJlcG9ydGluZylcbiAgICBjb25zdCBkaWFnbm9zdGljc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnZGlhZ25vc3RpY3MnKTtcbiAgICBjb25zdCBkaWFnbm9zdGljc0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldERpYWdub3N0aWNzRnVuY3Rpb24oKVxuICAgICk7XG4gICAgZGlhZ25vc3RpY3NSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBkaWFnbm9zdGljc0ludGVncmF0aW9uLCB7XG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gRmx1dHRlciBDb25zb2xlIERpYWdub3N0aWNzIGVuZHBvaW50IChwdWJsaWMgLSBubyBhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IGZsdXR0ZXJDb25zb2xlUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKFxuICAgICAgJ2ZsdXR0ZXItY29uc29sZS1lcnJvcnMnXG4gICAgKTtcbiAgICBjb25zdCBmbHV0dGVyQ29uc29sZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldEZsdXR0ZXJDb25zb2xlRGlhZ25vc3RpY3NGdW5jdGlvbigpXG4gICAgKTtcbiAgICBmbHV0dGVyQ29uc29sZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGZsdXR0ZXJDb25zb2xlSW50ZWdyYXRpb24sIHtcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyBSZXBvcnQgRXJyb3IgZW5kcG9pbnQgKHB1YmxpYyAtIG5vIGF1dGggcmVxdWlyZWQsIHVzZWQgYnkgd2ViIGV4dGVuc2lvbnMpXG4gICAgY29uc3QgcmVwb3J0RXJyb3JSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3JlcG9ydC1lcnJvcicpO1xuICAgIGNvbnN0IHJlcG9ydEVycm9ySW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgIHRoaXMuZ2V0RGlhZ25vc3RpY3NGdW5jdGlvbigpXG4gICAgKTtcbiAgICByZXBvcnRFcnJvclJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIHJlcG9ydEVycm9ySW50ZWdyYXRpb24sIHtcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyBDb250ZW50IE5vcm1hbGl6ZXIgZW5kcG9pbnQgKGludGVybmFsIHN5c3RlbSBjYWxscyAtIG5vIGF1dGggcmVxdWlyZWQpXG4gICAgY29uc3Qgbm9ybWFsaXplclJlc291cmNlID0gdjEuYWRkUmVzb3VyY2UoJ25vcm1hbGl6ZScpO1xuICAgIGNvbnN0IG5vcm1hbGl6ZXJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXRDb250ZW50Tm9ybWFsaXplckZ1bmN0aW9uKClcbiAgICApO1xuICAgIG5vcm1hbGl6ZXJSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBub3JtYWxpemVySW50ZWdyYXRpb24sIHtcbiAgICAgIC8vIE5vIGF1dGhvcml6ZXIgLSBhbGxvdyBpbnRlcm5hbCBzeXN0ZW0gY2FsbHMgZnJvbSByZWNpcGVzIGZ1bmN0aW9uXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gRGlhZ25vc3RpYyBQcm9jZXNzb3IgZW5kcG9pbnQgKGF1dGhlbnRpY2F0ZWQpXG4gICAgY29uc3QgZGlhZ25vc3RpY1Byb2Nlc3NvclJlc291cmNlID0gdjEuYWRkUmVzb3VyY2UoJ2RpYWdub3N0aWMtc3VtbWFyeScpO1xuICAgIGNvbnN0IGRpYWdub3N0aWNQcm9jZXNzb3JJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXREaWFnbm9zdGljUHJvY2Vzc29yRnVuY3Rpb24oKVxuICAgICk7XG4gICAgZGlhZ25vc3RpY1Byb2Nlc3NvclJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgZGlhZ25vc3RpY1Byb2Nlc3NvckludGVncmF0aW9uLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICAgIH1cbiAgICApO1xuXG5cbiAgICAvLyBGdXR1cmUgcmVjaXBlIGVuZHBvaW50c1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICBjb25zdCByZWNpcGVzUmVzb3VyY2UgPSB2MS5hZGRSZXNvdXJjZSgncmVjaXBlcycpO1xuXG4gICAgLy8gUmVjaXBlIENSVUQgb3BlcmF0aW9ucyB3aXRoIEF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgcmVjaXBlc0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldFJlY2lwZXNGdW5jdGlvbigpXG4gICAgKTtcblxuICAgIC8vIExpc3QgcmVjaXBlczogR0VUIC9yZWNpcGVzIChyZXF1aXJlcyBhdXRoZW50aWNhdGlvbilcbiAgICByZWNpcGVzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSByZWNpcGU6IFBPU1QgL3JlY2lwZXMgKHJlcXVpcmVzIGF1dGhlbnRpY2F0aW9uKVxuICAgIHJlY2lwZXNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIFNpbmdsZSByZWNpcGUgb3BlcmF0aW9uczogR0VUL1BVVC9ERUxFVEUgL3JlY2lwZXMve2lkfSAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgY29uc3QgcmVjaXBlUmVzb3VyY2UgPSByZWNpcGVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgfSk7XG4gICAgcmVjaXBlUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICAvLyBTZWFyY2ggZW5kcG9pbnQ6IEdFVCAvcmVjaXBlcy9zZWFyY2ggKHJlcXVpcmVzIGF1dGhlbnRpY2F0aW9uKVxuICAgIGNvbnN0IHNlYXJjaFJlc291cmNlID0gcmVjaXBlc1Jlc291cmNlLmFkZFJlc291cmNlKCdzZWFyY2gnKTtcbiAgICBzZWFyY2hSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gQW5hbHl0aWNzIGVuZHBvaW50czogUE9TVCAvdjEvYW5hbHl0aWNzL2V2ZW50cywgR0VUIC92MS9hbmFseXRpY3Mvc3VtbWFyeSAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgY29uc3QgYW5hbHl0aWNzUmVzb3VyY2UgPSB2MS5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XG4gICAgY29uc3QgYW5hbHl0aWNzSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgIHRoaXMuZ2V0QW5hbHl0aWNzRnVuY3Rpb24oKVxuICAgICk7XG5cbiAgICAvLyBTdWJtaXQgYW5hbHl0aWNzIGV2ZW50czogUE9TVCAvdjEvYW5hbHl0aWNzL2V2ZW50c1xuICAgIGNvbnN0IGFuYWx5dGljc0V2ZW50c1Jlc291cmNlID0gYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2V2ZW50cycpO1xuICAgIGFuYWx5dGljc0V2ZW50c1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGFuYWx5dGljc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyBHZXQgYW5hbHl0aWNzIHN1bW1hcnk6IEdFVCAvdjEvYW5hbHl0aWNzL3N1bW1hcnlcbiAgICBjb25zdCBhbmFseXRpY3NTdW1tYXJ5UmVzb3VyY2UgPSBhbmFseXRpY3NSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3VtbWFyeScpO1xuICAgIGFuYWx5dGljc1N1bW1hcnlSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFuYWx5dGljc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIC8vIEltYWdlIHVwbG9hZCBlbmRwb2ludDogUE9TVCAvaW1hZ2VzL3VwbG9hZCAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgY29uc3QgaW1hZ2VzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdpbWFnZXMnKTtcbiAgICBjb25zdCB1cGxvYWRSZXNvdXJjZSA9IGltYWdlc1Jlc291cmNlLmFkZFJlc291cmNlKCd1cGxvYWQnKTtcbiAgICBjb25zdCBpbWFnZVVwbG9hZEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldEltYWdlVXBsb2FkRnVuY3Rpb24oKVxuICAgICk7XG4gICAgdXBsb2FkUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgaW1hZ2VVcGxvYWRJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gQWRtaW4gRW5kcG9pbnRzIGZvciBNdWx0aS1UZW5hbnQgSW52aXRhdGlvbiBNYW5hZ2VtZW50XG4gICAgY29uc3QgYWRtaW5SZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FkbWluJyk7XG4gICAgY29uc3QgYWRtaW5JbnZpdGF0aW9uc1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnaW52aXRhdGlvbnMnKTtcbiAgICBjb25zdCBpbnZpdGF0aW9uTWFuYWdlckludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldEludml0YXRpb25NYW5hZ2VyRnVuY3Rpb24oKVxuICAgICk7XG5cbiAgICAvLyBMaXN0IGludml0YXRpb25zOiBHRVQgL2FkbWluL2ludml0YXRpb25zIChyZXF1aXJlcyBhZG1pbiBhdXRoZW50aWNhdGlvbilcbiAgICBhZG1pbkludml0YXRpb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBpbnZpdGF0aW9uTWFuYWdlckludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBpbnZpdGF0aW9uOiBQT1NUIC9hZG1pbi9pbnZpdGF0aW9ucyAocmVxdWlyZXMgYWRtaW4gYXV0aGVudGljYXRpb24pXG4gICAgYWRtaW5JbnZpdGF0aW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGludml0YXRpb25NYW5hZ2VySW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIFJldm9rZSBpbnZpdGF0aW9uOiBERUxFVEUgL2FkbWluL2ludml0YXRpb25zL3t0b2tlbn0gKHJlcXVpcmVzIGFkbWluIGF1dGhlbnRpY2F0aW9uKVxuICAgIGNvbnN0IGFkbWluSW52aXRhdGlvblRva2VuUmVzb3VyY2UgPVxuICAgICAgYWRtaW5JbnZpdGF0aW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd7dG9rZW59Jyk7XG4gICAgYWRtaW5JbnZpdGF0aW9uVG9rZW5SZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnREVMRVRFJyxcbiAgICAgIGludml0YXRpb25NYW5hZ2VySW50ZWdyYXRpb24sXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDaGVjayBpbnZpdGF0aW9uIHN0YXR1czogR0VUIC9hZG1pbi9pbnZpdGF0aW9ucy9zdGF0dXMve3Rva2VufSAocHVibGljLCBubyBhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IGFkbWluSW52aXRhdGlvblN0YXR1c1Jlc291cmNlID1cbiAgICAgIGFkbWluSW52aXRhdGlvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3RhdHVzJyk7XG4gICAgY29uc3QgYWRtaW5JbnZpdGF0aW9uU3RhdHVzVG9rZW5SZXNvdXJjZSA9XG4gICAgICBhZG1pbkludml0YXRpb25TdGF0dXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3Rva2VufScpO1xuICAgIGFkbWluSW52aXRhdGlvblN0YXR1c1Rva2VuUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBpbnZpdGF0aW9uTWFuYWdlckludGVncmF0aW9uXG4gICAgKTtcblxuICAgIC8vIEF1dGggRW5kcG9pbnRzIGZvciBSZWdpc3RyYXRpb25cbiAgICBjb25zdCBhdXRoUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdhdXRoJyk7XG4gICAgY29uc3QgYXV0aFJlZ2lzdGVyV2l0aEludml0YXRpb25SZXNvdXJjZSA9IGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZShcbiAgICAgICdyZWdpc3Rlci13aXRoLWludml0YXRpb24nXG4gICAgKTtcbiAgICBjb25zdCByZWdpc3RyYXRpb25IYW5kbGVySW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgIHRoaXMuZ2V0UmVnaXN0cmF0aW9uSGFuZGxlckZ1bmN0aW9uKClcbiAgICApO1xuXG4gICAgLy8gUmVnaXN0ZXIgd2l0aCBpbnZpdGF0aW9uOiBQT1NUIC9hdXRoL3JlZ2lzdGVyLXdpdGgtaW52aXRhdGlvbiAocHVibGljLCBubyBhdXRoIHJlcXVpcmVkKVxuICAgIGF1dGhSZWdpc3RlcldpdGhJbnZpdGF0aW9uUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgcmVnaXN0cmF0aW9uSGFuZGxlckludGVncmF0aW9uLFxuICAgICAge1xuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBZGQgR2F0ZXdheSBSZXNwb25zZXMgdG8gaW5jbHVkZSBDT1JTIGhlYWRlcnMgb24gQVBJIEdhdGV3YXkgZXJyb3IgcmVzcG9uc2VzXG4gICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCd1bmF1dGhvcml6ZWQnLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5VTkFVVEhPUklaRUQsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnaHR0cHM6Ly9kMWpjYXBoejQ0NThxNy5jbG91ZGZyb250Lm5ldCdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBgJ3RydWUnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBgJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ2AsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCdhY2Nlc3MtZGVuaWVkJywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQUNDRVNTX0RFTklFRCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogYCdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0J2AsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IGAndHJ1ZSdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IGAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFwaS5hZGRHYXRld2F5UmVzcG9uc2UoJ2RlZmF1bHQtNHh4Jywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuREVGQVVMVF80WFgsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnaHR0cHM6Ly9kMWpjYXBoejQ0NThxNy5jbG91ZGZyb250Lm5ldCdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBgJ3RydWUnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBgJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ2AsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCdkZWZhdWx0LTV4eCcsIHtcbiAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLkRFRkFVTFRfNVhYLFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBgJ2h0dHBzOi8vZDFqY2FwaHo0NDU4cTcuY2xvdWRmcm9udC5uZXQnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogYCd0cnVlJ2AsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogYCdDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidgLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIPCfmqggQ09TVCBNT05JVE9SSU5HICYgQklMTElORyBBTEVSVFMg8J+aqFxuXG4gICAgLy8gU05TIFRvcGljIGZvciBiaWxsaW5nIGFsZXJ0c1xuICAgIHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdCaWxsaW5nQWxlcnRzJywge1xuICAgICAgdG9waWNOYW1lOiBgcmVjaXBlYXJjaGl2ZS1iaWxsaW5nLWFsZXJ0cy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkaXNwbGF5TmFtZTogJ1JlY2lwZUFyY2hpdmUgQmlsbGluZyBBbGVydHMnLFxuICAgIH0pO1xuXG4gICAgLy8gRW1haWwgc3Vic2NyaXB0aW9uIGZvciBiaWxsaW5nIGFsZXJ0c1xuICAgIHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24ocHJvcHMuYWRtaW5FbWFpbClcbiAgICApO1xuXG4gICAgLy8gQVdTIEJ1ZGdldCBmb3IgY29uc2VydmF0aXZlIG1vbnRobHkgY29zdCBtb25pdG9yaW5nICgkMjAvbW9udGggbWF4aW11bSlcbiAgICBuZXcgYnVkZ2V0cy5DZm5CdWRnZXQodGhpcywgJ01vbnRobHlDb3N0QnVkZ2V0Jywge1xuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIGJ1ZGdldE5hbWU6IGBSZWNpcGVBcmNoaXZlLU1vbnRobHlDb3N0V2F0Y2hkb2ctJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBidWRnZXRUeXBlOiAnQ09TVCcsXG4gICAgICAgIHRpbWVVbml0OiAnTU9OVEhMWScsXG4gICAgICAgIGJ1ZGdldExpbWl0OiB7XG4gICAgICAgICAgYW1vdW50OiAyMCwgLy8gJDIwL21vbnRoIG1heGltdW0gYnVkZ2V0XG4gICAgICAgICAgdW5pdDogJ1VTRCcsXG4gICAgICAgIH0sXG4gICAgICAgIGNvc3RGaWx0ZXJzOiB7XG4gICAgICAgICAgLy8gT25seSBtb25pdG9yIHRoaXMgYWNjb3VudCdzIGNvc3RzXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVQZXJpb2Q6IHtcbiAgICAgICAgICBzdGFydDogJzE3NTYwODAwOTMnLCAvLyBBdWd1c3QgMjQsIDIwMjUgaW4gZXBvY2ggc2Vjb25kc1xuICAgICAgICAgIGVuZDogJzIwODI3NjIxMDInLCAvLyBEZWNlbWJlciAzMSwgMjAzNSBpbiBlcG9jaCBzZWNvbmRzXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgbm90aWZpY2F0aW9uc1dpdGhTdWJzY3JpYmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnQUNUVUFMJyxcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogJ0dSRUFURVJfVEhBTicsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDI1LCAvLyBBbGVydCBhdCAyNSUgb2YgYnVkZ2V0ICgkNS4wMClcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6ICdQRVJDRU5UQUdFJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6ICdTTlMnLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0aGlzLmJpbGxpbmdBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnQUNUVUFMJyxcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogJ0dSRUFURVJfVEhBTicsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDUwLCAvLyBXYXJuaW5nIGF0IDUwJSBvZiBidWRnZXQgKCQxMC4wMClcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6ICdQRVJDRU5UQUdFJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6ICdTTlMnLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0aGlzLmJpbGxpbmdBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnQUNUVUFMJyxcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogJ0dSRUFURVJfVEhBTicsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDgwLCAvLyBDcml0aWNhbCBhdCA4MCUgb2YgYnVkZ2V0ICgkMTYuMDApXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiAnUEVSQ0VOVEFHRScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiAnU05TJyxcbiAgICAgICAgICAgICAgYWRkcmVzczogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5vdGlmaWNhdGlvbjoge1xuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogJ0ZPUkVDQVNURUQnLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogMTAwLCAvLyBGb3JlY2FzdCBhbGVydCBpZiBwcm9qZWN0ZWQgdG8gZXhjZWVkICQyMFxuICAgICAgICAgICAgdGhyZXNob2xkVHlwZTogJ1BFUkNFTlRBR0UnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogJ1NOUycsXG4gICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBBbGFybSBmb3IgdW51c3VhbCBzcGVuZGluZyBwYXR0ZXJuc1xuICAgIGNvbnN0IHVudXN1YWxTcGVuZGluZ0FsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ1VudXN1YWxTcGVuZGluZ0FsYXJtJyxcbiAgICAgIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgUmVjaXBlQXJjaGl2ZS1VbnVzdWFsU3BlbmRpbmctJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBlc3RpbWF0ZWQgbW9udGhseSBjaGFyZ2VzIGV4Y2VlZCAkMjAnLFxuICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0JpbGxpbmcnLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdFc3RpbWF0ZWRDaGFyZ2VzJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBDdXJyZW5jeTogJ1VTRCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxMiksIC8vIENoZWNrIHR3aWNlIGRhaWx5XG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDIwLCAvLyAkMjAvbW9udGggdGhyZXNob2xkXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ29ubmVjdCB0aGUgYWxhcm0gdG8gU05TIHRvcGljXG4gICAgdW51c3VhbFNwZW5kaW5nQWxhcm0uYWRkQWxhcm1BY3Rpb24oe1xuICAgICAgYmluZDogKCkgPT4gKHsgYWxhcm1BY3Rpb25Bcm46IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4gfSksXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIEFsYXJtIGZvciBGYWlsZWQgUGFyc2luZyBCdWNrZXQgU2l6ZSAoNE1CIGxpbWl0KVxuICAgIGNvbnN0IGZhaWxlZFBhcnNpbmdCdWNrZXRTaXplQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICAnRmFpbGVkUGFyc2luZ0J1Y2tldFNpemVBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogYFJlY2lwZUFyY2hpdmUtRmFpbGVkUGFyc2luZ0J1Y2tldFNpemUtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOlxuICAgICAgICAgICdBbGVydCB3aGVuIGZhaWxlZCBwYXJzaW5nIGJ1Y2tldCBleGNlZWRzIDRNQiB0byBwcmV2ZW50IGNvc3Qgb3ZlcnJ1bnMnLFxuICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL1MzJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnQnVja2V0U2l6ZUJ5dGVzJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBCdWNrZXROYW1lOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIFN0b3JhZ2VUeXBlOiAnU3RhbmRhcmRTdG9yYWdlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDYpLCAvLyBDaGVjayA0IHRpbWVzIGRhaWx5XG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDQgKiAxMDI0ICogMTAyNCwgLy8gNE1CIGluIGJ5dGVzXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ29ubmVjdCB0aGUgYnVja2V0IHNpemUgYWxhcm0gdG8gU05TIHRvcGljXG4gICAgZmFpbGVkUGFyc2luZ0J1Y2tldFNpemVBbGFybS5hZGRBbGFybUFjdGlvbih7XG4gICAgICBiaW5kOiAoKSA9PiAoeyBhbGFybUFjdGlvbkFybjogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybiB9KSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdG9yYWdlQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgU3RvcmFnZSBCdWNrZXQgTmFtZSAoUmVjaXBlIFBob3RvcyAmIERvY3VtZW50cyknLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RlbXBCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBUZW1wb3JhcnkgQnVja2V0IE5hbWUgKFByb2Nlc3NpbmcgJiBVcGxvYWRzKScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRmFpbGVkUGFyc2luZ0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgJ1MzIEZhaWxlZCBQYXJzaW5nIEJ1Y2tldCBOYW1lIChIVE1MIGZyb20gZmFpbGVkIHJlY2lwZSBleHRyYWN0aW9ucyknLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JpbGxpbmdBbGVydFRvcGljQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIEJpbGxpbmcgQWxlcnRzJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZWdpb24nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FXUyBSZWdpb24nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FkbWluRW1haWwnLCB7XG4gICAgICB2YWx1ZTogcHJvcHMuYWRtaW5FbWFpbCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4gRW1haWwgZm9yIEJpbGxpbmcgQWxlcnRzIGFuZCBJbml0aWFsIFVzZXIgQ3JlYXRpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgb3V0cHV0cyByZW1vdmVkIC0gaW52aXRhdGlvbiBzeXN0ZW0gbm93IHVzZXMgUzMgSlNPTiBzdG9yYWdlXG4gICAgLy8gQ29zdCBzYXZpbmdzOiB+JDQuNTAtMTMuNTAvbW9udGggZm9yIGxvdy12b2x1bWUgdXNhZ2VcblxuICAgIC8vIEluaXRpYWxpemUgYmFja2dyb3VuZCBub3JtYWxpemVyIHRvIGVuc3VyZSBTUVMgZXZlbnQgc291cmNlIGlzIGNyZWF0ZWRcbiAgICB0aGlzLmdldEJhY2tncm91bmROb3JtYWxpemVyRnVuY3Rpb24oKTtcbiAgfVxuXG4gIC8vIFNpbmdsZXRvbiBnZXR0ZXJzIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gIHB1YmxpYyBnZXRIZWFsdGhGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5faGVhbHRoRnVuY3Rpb24pIHtcbiAgICAgIHRoaXMuX2hlYWx0aEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSGVhbHRoRnVuY3Rpb24nLCB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vZnVuY3Rpb25zL2Rpc3QvaGVhbHRoLXBhY2thZ2UnKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgICBtZW1vcnlTaXplOiAxMjgsIC8vIE1pbmltYWwgbWVtb3J5IGZvciBGcmVlIFRpZXIgb3B0aW1pemF0aW9uXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBTM19URU1QX0JVQ0tFVDogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICB9LFxuICAgICAgICByb2xlOiB0aGlzLmxhbWJkYVJvbGUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2hlYWx0aEZ1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldFJlY2lwZXNGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5fcmVjaXBlc0Z1bmN0aW9uKSB7XG4gICAgICB0aGlzLl9yZWNpcGVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWNpcGVzRnVuY3Rpb24nLCB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vZnVuY3Rpb25zL2Rpc3QvcmVjaXBlcy1wYWNrYWdlJyksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgICAgbWVtb3J5U2l6ZTogMjU2LCAvLyBNb3JlIG1lbW9yeSBmb3IgQ1JVRCBvcGVyYXRpb25zXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBTM19URU1QX0JVQ0tFVDogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIEFQSV9HQVRFV0FZX1VSTDogYGh0dHBzOi8vNGVwcm9qemJyYy5leGVjdXRlLWFwaS51cy13ZXN0LTIuYW1hem9uYXdzLmNvbS9wcm9kYCxcbiAgICAgICAgICBOT1JNQUxJWkFUSU9OX1FVRVVFX1VSTDogdGhpcy5yZWNpcGVOb3JtYWxpemF0aW9uUXVldWUucXVldWVVcmwsXG4gICAgICAgIH0sXG4gICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fcmVjaXBlc0Z1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldERpYWdub3N0aWNzRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX2RpYWdub3N0aWNzRnVuY3Rpb24pIHtcbiAgICAgIHRoaXMuX2RpYWdub3N0aWNzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnRGlhZ25vc3RpY3NGdW5jdGlvbicsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9mdW5jdGlvbnMvZGlzdC9kaWFnbm9zdGljcy1wYWNrYWdlJyksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBTM19GQUlMRURfUEFSU0lOR19CVUNLRVQ6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2RpYWdub3N0aWNzRnVuY3Rpb247XG4gIH1cblxuICBwdWJsaWMgZ2V0SW1hZ2VVcGxvYWRGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5faW1hZ2VVcGxvYWRGdW5jdGlvbikge1xuICAgICAgdGhpcy5faW1hZ2VVcGxvYWRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdJbWFnZVVwbG9hZEZ1bmN0aW9uJyxcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2Z1bmN0aW9ucy9kaXN0L2ltYWdlLXVwbG9hZC1wYWNrYWdlJyksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLCAvLyBNb3JlIHRpbWUgZm9yIGltYWdlIHByb2Nlc3NpbmdcbiAgICAgICAgICBtZW1vcnlTaXplOiA1MTIsIC8vIE1vcmUgbWVtb3J5IGZvciBpbWFnZSBwcm9jZXNzaW5nXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIEVOVklST05NRU5UOiB0aGlzLnN0YWNrRW52aXJvbm1lbnQsXG4gICAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2ltYWdlVXBsb2FkRnVuY3Rpb247XG4gIH1cblxuICBwdWJsaWMgZ2V0Rmx1dHRlckNvbnNvbGVEaWFnbm9zdGljc0Z1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLl9mbHV0dGVyQ29uc29sZURpYWdub3N0aWNzRnVuY3Rpb24pIHtcbiAgICAgIHRoaXMuX2ZsdXR0ZXJDb25zb2xlRGlhZ25vc3RpY3NGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdGbHV0dGVyQ29uc29sZURpYWdub3N0aWNzRnVuY3Rpb24nLFxuICAgICAgICB7XG4gICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgICAgICcuLi9mdW5jdGlvbnMvZGlzdC9mbHV0dGVyLWNvbnNvbGUtZGlhZ25vc3RpY3MtcGFja2FnZSdcbiAgICAgICAgICApLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIEVOVklST05NRU5UOiB0aGlzLnN0YWNrRW52aXJvbm1lbnQsXG4gICAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZmx1dHRlckNvbnNvbGVEaWFnbm9zdGljc0Z1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldENvbnRlbnROb3JtYWxpemVyRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX2NvbnRlbnROb3JtYWxpemVyRnVuY3Rpb24pIHtcbiAgICAgIHRoaXMuX2NvbnRlbnROb3JtYWxpemVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnQ29udGVudE5vcm1hbGl6ZXJGdW5jdGlvbicsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxuICAgICAgICAgICAgJy4uL2Z1bmN0aW9ucy9kaXN0L2NvbnRlbnQtbm9ybWFsaXplci1wYWNrYWdlJ1xuICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLCAvLyBMb25nZXIgdGltZW91dCBmb3IgT3BlbkFJIEFQSSBjYWxsc1xuICAgICAgICAgIG1lbW9yeVNpemU6IDUxMiwgLy8gTW9yZSBtZW1vcnkgZm9yIEpTT04gcHJvY2Vzc2luZ1xuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5zdGFja0Vudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgICBPUEVOQUlfQVBJX0tFWTogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVkgfHwgJycsIC8vIFJlYWQgZnJvbSBlbnZpcm9ubWVudFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY29udGVudE5vcm1hbGl6ZXJGdW5jdGlvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRCYWNrZ3JvdW5kTm9ybWFsaXplckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLl9iYWNrZ3JvdW5kTm9ybWFsaXplckZ1bmN0aW9uKSB7XG4gICAgICB0aGlzLl9iYWNrZ3JvdW5kTm9ybWFsaXplckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ0JhY2tncm91bmROb3JtYWxpemVyRnVuY3Rpb24nLFxuICAgICAgICB7XG4gICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgICAgICcuLi9mdW5jdGlvbnMvZGlzdC9iYWNrZ3JvdW5kLW5vcm1hbGl6ZXItcGFja2FnZSdcbiAgICAgICAgICApLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDQ1KSwgLy8gTG9uZ2VyIHRpbWVvdXQgZm9yIE9wZW5BSSBwcm9jZXNzaW5nXG4gICAgICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5zdGFja0Vudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIE9QRU5BSV9BUElfS0VZOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSB8fCAnJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICAgIC8vIENvbm5lY3QgU1FTIHF1ZXVlIHRvIGJhY2tncm91bmQgbm9ybWFsaXplciBMYW1iZGFcbiAgICAgIHRoaXMuX2JhY2tncm91bmROb3JtYWxpemVyRnVuY3Rpb24uYWRkRXZlbnRTb3VyY2UoXG4gICAgICAgIG5ldyBsYW1iZGFFdmVudFNvdXJjZXMuU3FzRXZlbnRTb3VyY2UodGhpcy5yZWNpcGVOb3JtYWxpemF0aW9uUXVldWUsIHtcbiAgICAgICAgICBiYXRjaFNpemU6IDEsIC8vIFByb2Nlc3Mgb25lIHJlY2lwZSBhdCBhIHRpbWVcbiAgICAgICAgICBtYXhCYXRjaGluZ1dpbmRvdzogY2RrLkR1cmF0aW9uLnNlY29uZHMoNSksXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fYmFja2dyb3VuZE5vcm1hbGl6ZXJGdW5jdGlvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXREaWFnbm9zdGljUHJvY2Vzc29yRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX2RpYWdub3N0aWNQcm9jZXNzb3JGdW5jdGlvbikge1xuICAgICAgdGhpcy5fZGlhZ25vc3RpY1Byb2Nlc3NvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ0RpYWdub3N0aWNQcm9jZXNzb3JGdW5jdGlvbicsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxuICAgICAgICAgICAgJy4uL2Z1bmN0aW9ucy9kaXN0L2RpYWdub3N0aWMtcHJvY2Vzc29yLXBhY2thZ2UnXG4gICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksIC8vIExvbmdlciB0aW1lb3V0IGZvciBTMyBhbmFseXNpc1xuICAgICAgICAgIG1lbW9yeVNpemU6IDEwMjQsIC8vIE1vcmUgbWVtb3J5IGZvciBwcm9jZXNzaW5nIGRpYWdub3N0aWMgZGF0YVxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5zdGFja0Vudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIFMzX0ZBSUxFRF9QQVJTSU5HX0JVQ0tFVDogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZGlhZ25vc3RpY1Byb2Nlc3NvckZ1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldEludml0YXRpb25NYW5hZ2VyRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX2ludml0YXRpb25NYW5hZ2VyRnVuY3Rpb24pIHtcbiAgICAgIHRoaXMuX2ludml0YXRpb25NYW5hZ2VyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnSW52aXRhdGlvbk1hbmFnZXJGdW5jdGlvbicsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxuICAgICAgICAgICAgJy4uL2Z1bmN0aW9ucy9kaXN0L2ludml0YXRpb24tbWFuYWdlci1wYWNrYWdlJ1xuICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgICAgRlJPTlRFTkRfQkFTRV9VUkw6ICdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2ludml0YXRpb25NYW5hZ2VyRnVuY3Rpb247XG4gIH1cblxuICBwdWJsaWMgZ2V0UmVnaXN0cmF0aW9uSGFuZGxlckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLl9yZWdpc3RyYXRpb25IYW5kbGVyRnVuY3Rpb24pIHtcbiAgICAgIHRoaXMuX3JlZ2lzdHJhdGlvbkhhbmRsZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdSZWdpc3RyYXRpb25IYW5kbGVyRnVuY3Rpb24nLFxuICAgICAgICB7XG4gICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgICAgICcuLi9mdW5jdGlvbnMvZGlzdC9yZWdpc3RyYXRpb24taGFuZGxlci1wYWNrYWdlJ1xuICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgICAgQ09HTklUT19DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdHJhdGlvbkhhbmRsZXJGdW5jdGlvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRBbmFseXRpY3NGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5fYW5hbHl0aWNzRnVuY3Rpb24pIHtcbiAgICAgIHRoaXMuX2FuYWx5dGljc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ1JlY2lwZUFuYWx5dGljc0FnZ3JlZ2F0b3InLFxuICAgICAgICB7XG4gICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgICAgICcuLi9mdW5jdGlvbnMvZGlzdC9hbmFseXRpY3MtYWdncmVnYXRvci1wYWNrYWdlJ1xuICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fYW5hbHl0aWNzRnVuY3Rpb247XG4gIH1cbn1cbiJdfQ==