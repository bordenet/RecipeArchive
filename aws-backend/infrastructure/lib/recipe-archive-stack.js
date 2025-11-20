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
const logs = require("aws-cdk-lib/aws-logs");
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
                            id: "transition-to-glacier",
                            transitions: [
                                {
                                    storageClass: s3.StorageClass.GLACIER,
                                    transitionAfter: cdk.Duration.days(90), // Archive after 90 days
                                },
                                {
                                    storageClass: s3.StorageClass.DEEP_ARCHIVE,
                                    transitionAfter: cdk.Duration.days(365), // Deep archive after 1 year
                                },
                            ],
                        },
                        {
                            id: "archive-old-files",
                            expiration: cdk.Duration.days(2555), // 7 years for production
                        },
                        {
                            id: "archive-old-versions",
                            noncurrentVersionExpiration: cdk.Duration.days(365),
                            noncurrentVersionTransitions: [
                                {
                                    storageClass: s3.StorageClass.GLACIER,
                                    transitionAfter: cdk.Duration.days(30), // Old versions to Glacier after 30 days
                                },
                            ],
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
        // S3-Based Invitation System
        // Invitations stored as JSON files in existing S3 bucket
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
        // Backup endpoints: GET/POST /v1/backups (authenticated)
        const backupsResource = v1.addResource("backups");
        const backupIntegration = new apigateway.LambdaIntegration(this.getBackupFunction());
        // List backups: GET /v1/backups
        backupsResource.addMethod("GET", backupIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Create backup: POST /v1/backups
        backupsResource.addMethod("POST", backupIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Restore from backup: POST /v1/backups/restore
        const backupRestoreResource = backupsResource.addResource("restore");
        backupRestoreResource.addMethod("POST", backupIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        // Mobile share diagnostics: POST /v1/diagnostics/mobile-share-failure (authenticated)
        // Used by iOS/Android share extensions to report capture failures
        const diagnosticsV1Resource = v1.addResource("diagnostics");
        const mobileShareFailureResource = diagnosticsV1Resource.addResource("mobile-share-failure");
        const diagnosticsMobileShareIntegration = new apigateway.LambdaIntegration(this.getDiagnosticsMobileShareFunction());
        mobileShareFailureResource.addMethod("POST", diagnosticsMobileShareIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
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
                "Access-Control-Allow-Origin": "'https://recipearchive.com'",
                "Access-Control-Allow-Credentials": "'true'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse("access-denied", {
            type: apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'https://recipearchive.com'",
                "Access-Control-Allow-Credentials": "'true'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse("default-4xx", {
            type: apigateway.ResponseType.DEFAULT_4XX,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'https://recipearchive.com'",
                "Access-Control-Allow-Credentials": "'true'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse("default-5xx", {
            type: apigateway.ResponseType.DEFAULT_5XX,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'https://recipearchive.com'",
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
        // Initialize background normalizer to ensure SQS event source is created
        this.getBackgroundNormalizerFunction();
    }
    // Singleton getters for Lambda functions
    getHealthFunction() {
        if (!this._healthFunction) {
            const logGroup = new logs.LogGroup(this, "HealthFunctionLogGroup", {
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._healthFunction = new lambda.Function(this, "HealthFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/health-package"),
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                reservedConcurrentExecutions: 2,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "RecipesFunctionLogGroup", {
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._recipesFunction = new lambda.Function(this, "RecipesFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/recipes-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                reservedConcurrentExecutions: 10,
                logGroup: logGroup,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    S3_TEMP_BUCKET: this.tempBucket.bucketName,
                    S3_FAILED_PARSING_BUCKET: this.failedParsingBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                    // Use the deployed API Gateway URL instead of a hard-coded value
                    API_GATEWAY_URL: this.api.url,
                    NORMALIZATION_QUEUE_URL: this.recipeNormalizationQueue.queueUrl,
                },
                role: this.lambdaRole,
            });
        }
        return this._recipesFunction;
    }
    getDiagnosticsFunction() {
        if (!this._diagnosticsFunction) {
            const logGroup = new logs.LogGroup(this, "DiagnosticsFunctionLogGroup", {
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._diagnosticsFunction = new lambda.Function(this, "DiagnosticsFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/diagnostics-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 128,
                reservedConcurrentExecutions: 5,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "ImageUploadFunctionLogGroup", {
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._imageUploadFunction = new lambda.Function(this, "ImageUploadFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/image-upload-package"),
                timeout: cdk.Duration.seconds(30),
                memorySize: 128,
                reservedConcurrentExecutions: 5,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "FlutterConsoleDiagnosticsFunctionLogGroup", {
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._flutterConsoleDiagnosticsFunction = new lambda.Function(this, "FlutterConsoleDiagnosticsFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/flutter-console-diagnostics-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 128,
                reservedConcurrentExecutions: 3,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "ContentNormalizerFunctionLogGroup", {
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._contentNormalizerFunction = new lambda.Function(this, "ContentNormalizerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/content-normalizer-package"),
                timeout: cdk.Duration.seconds(30),
                memorySize: 128,
                reservedConcurrentExecutions: 5,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "BackgroundNormalizerFunctionLogGroup", {
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._backgroundNormalizerFunction = new lambda.Function(this, "BackgroundNormalizerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/background-normalizer-package"),
                timeout: cdk.Duration.seconds(45),
                memorySize: 128,
                reservedConcurrentExecutions: 5,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "DiagnosticProcessorFunctionLogGroup", {
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._diagnosticProcessorFunction = new lambda.Function(this, "DiagnosticProcessorFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/diagnostic-processor-package"),
                timeout: cdk.Duration.seconds(60),
                memorySize: 1024,
                reservedConcurrentExecutions: 2,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "InvitationManagerFunctionLogGroup", {
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._invitationManagerFunction = new lambda.Function(this, "InvitationManagerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/invitation-manager-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 128,
                reservedConcurrentExecutions: 3,
                logGroup: logGroup,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                    FRONTEND_BASE_URL: "https://recipearchive.com",
                },
                role: this.lambdaRole,
            });
        }
        return this._invitationManagerFunction;
    }
    getRegistrationHandlerFunction() {
        if (!this._registrationHandlerFunction) {
            const logGroup = new logs.LogGroup(this, "RegistrationHandlerFunctionLogGroup", {
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._registrationHandlerFunction = new lambda.Function(this, "RegistrationHandlerFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/registration-handler-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 128,
                reservedConcurrentExecutions: 3,
                logGroup: logGroup,
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
            const logGroup = new logs.LogGroup(this, "AnalyticsFunctionLogGroup", {
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._analyticsFunction = new lambda.Function(this, "RecipeAnalyticsAggregator", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/analytics-aggregator-package"),
                timeout: cdk.Duration.seconds(15),
                memorySize: 128,
                reservedConcurrentExecutions: 5,
                logGroup: logGroup,
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
    getBackupFunction() {
        if (!this._backupFunction) {
            const logGroup = new logs.LogGroup(this, "BackupFunctionLogGroup", {
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._backupFunction = new lambda.Function(this, "BackupFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/backup-package"),
                timeout: cdk.Duration.seconds(60),
                memorySize: 256,
                reservedConcurrentExecutions: 3,
                logGroup: logGroup,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                },
                role: this.lambdaRole,
            });
        }
        return this._backupFunction;
    }
    getDiagnosticsMobileShareFunction() {
        if (!this._diagnosticsMobileShareFunction) {
            const logGroup = new logs.LogGroup(this, "DiagnosticsMobileShareFunctionLogGroup", {
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            this._diagnosticsMobileShareFunction = new lambda.Function(this, "DiagnosticsMobileShareFunction", {
                runtime: lambda.Runtime.PROVIDED_AL2,
                handler: "bootstrap",
                code: lambda.Code.fromAsset("../functions/dist/diagnostics-mobile-share-package"),
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                reservedConcurrentExecutions: 5,
                logGroup: logGroup,
                environment: {
                    ENVIRONMENT: this.stackEnvironment,
                    REGION: this.region,
                    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
                    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                },
                role: this.lambdaRole,
            });
        }
        return this._diagnosticsMobileShareFunction;
    }
}
exports.RecipeArchiveStack = RecipeArchiveStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZWNpcGUtYXJjaGl2ZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsbURBQW1EO0FBQ25ELHlDQUF5QztBQUN6QyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyx5REFBeUQ7QUFDekQsNkNBQTZDO0FBQzdDLDJDQUEyQztBQUMzQyxzRUFBc0U7QUFDdEUsbURBQW1EO0FBQ25ELDJDQUEyQztBQUMzQywyRUFBMkU7QUFPM0UsTUFBYSxrQkFBbUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQTZCL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE4QjtRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwwQ0FBMEM7UUFDMUMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUM7UUFFMUMsdUNBQXVDO1FBQ3ZDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNsRSxZQUFZLEVBQUUsdUJBQXVCLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDeEQsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELFVBQVUsRUFBRTtnQkFDVixLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0Qsa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRTtvQkFDTCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxPQUFPLEVBQUUsSUFBSTtpQkFDZDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1QsUUFBUSxFQUFFLEtBQUs7b0JBQ2YsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsVUFBVSxFQUFFO29CQUNWLFFBQVEsRUFBRSxLQUFL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LENBQUM7U0FDSDtRQUNELE9BQU8sSUFBSSxDQUFDLCtCQUErQixDQUFDO0lBQzlDLENBQUM7Q0FDRjtBQTF2Q0QsZ0RBMHZDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29nbml0b1wiO1xuaW1wb3J0ICogYXMgczMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zM1wiO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaFwiO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxvZ3NcIjtcbmltcG9ydCAqIGFzIHNucyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNuc1wiO1xuaW1wb3J0ICogYXMgc25zU3Vic2NyaXB0aW9ucyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zXCI7XG5pbXBvcnQgKiBhcyBidWRnZXRzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYnVkZ2V0c1wiO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc3FzXCI7XG5pbXBvcnQgKiBhcyBsYW1iZGFFdmVudFNvdXJjZXMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlY2lwZUFyY2hpdmVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBhZG1pbkVtYWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWNpcGVBcmNoaXZlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IHN0b3JhZ2VCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHRlbXBCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGZhaWxlZFBhcnNpbmdCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgYmlsbGluZ0FsZXJ0VG9waWM6IHNucy5Ub3BpYztcblxuICAvLyBTaGFyZWQgcmVzb3VyY2VzIGZvciBzaW5nbGV0b24gcGF0dGVyblxuICBwcml2YXRlIHJlYWRvbmx5IGxhbWJkYVJvbGU6IGlhbS5Sb2xlO1xuICBwcml2YXRlIHJlYWRvbmx5IHJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZTogc3FzLlF1ZXVlO1xuICBwcml2YXRlIHJlYWRvbmx5IHN0YWNrRW52aXJvbm1lbnQ6IHN0cmluZztcblxuICAvLyBTaW5nbGV0b24gTGFtYmRhIGZ1bmN0aW9uIGluc3RhbmNlc1xuICBwcml2YXRlIF9oZWFsdGhGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9yZWNpcGVzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfaW1hZ2VVcGxvYWRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9kaWFnbm9zdGljc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2ZsdXR0ZXJDb25zb2xlRGlhZ25vc3RpY3NGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9jb250ZW50Tm9ybWFsaXplckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2JhY2tncm91bmROb3JtYWxpemVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfZGlhZ25vc3RpY1Byb2Nlc3NvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2ludml0YXRpb25NYW5hZ2VyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfcmVnaXN0cmF0aW9uSGFuZGxlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2FuYWx5dGljc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2JhY2t1cEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2RpYWdub3N0aWNzTW9iaWxlU2hhcmVGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBSZWNpcGVBcmNoaXZlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gU3RvcmUgZW52aXJvbm1lbnQgZm9yIHNpbmdsZXRvbiBtZXRob2RzXG4gICAgdGhpcy5zdGFja0Vudmlyb25tZW50ID0gcHJvcHMuZW52aXJvbm1lbnQ7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCBmb3IgQXV0aGVudGljYXRpb25cbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJSZWNpcGVBcmNoaXZlVXNlclBvb2xcIiwge1xuICAgICAgdXNlclBvb2xOYW1lOiBgcmVjaXBlQXJjaGl2ZS11c2Vycy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6XG4gICAgICAgIHByb3BzLmVudmlyb25tZW50ID09PSBcInByb2RcIlxuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50XG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KFxuICAgICAgdGhpcyxcbiAgICAgIFwiUmVjaXBlQXJjaGl2ZVVzZXJQb29sQ2xpZW50XCIsXG4gICAgICB7XG4gICAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGByZWNpcGVBcmNoaXZlLWNsaWVudC0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSwgLy8gUHVibGljIGNsaWVudCBmb3IgYnJvd3Nlci9tb2JpbGUgYXBwc1xuICAgICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgICBjdXN0b206IGZhbHNlLFxuICAgICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgb0F1dGg6IHtcbiAgICAgICAgICBmbG93czoge1xuICAgICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNjb3BlczogW1xuICAgICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTCxcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgIGVuYWJsZVRva2VuUmV2b2NhdGlvbjogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUzMgQnVja2V0cyB3aXRoIEVudmlyb25tZW50LVNwZWNpZmljIFJldGVudGlvbiBQb2xpY2llc1xuXG4gICAgLy8gUHJpbWFyeSBTdG9yYWdlIEJ1Y2tldCBmb3IgUmVjaXBlIFBob3RvcyBhbmQgRG9jdW1lbnRzXG4gICAgdGhpcy5zdG9yYWdlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIlJlY2lwZUFyY2hpdmVTdG9yYWdlXCIsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGVhcmNoaXZlLXN0b3JhZ2UtJHtwcm9wcy5lbnZpcm9ubWVudH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IHRydWUsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IHRydWUsXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSwgLy8gQWxsb3cgYnVja2V0IHBvbGljaWVzXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2UsIC8vIEFsbG93IHB1YmxpYyByZWFkIGFjY2VzcyB2aWEgYnVja2V0IHBvbGljeVxuICAgICAgfSksXG4gICAgICB2ZXJzaW9uZWQ6IHByb3BzLmVudmlyb25tZW50ID09PSBcInByb2RcIixcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJkZWxldGUtaW5jb21wbGV0ZS11cGxvYWRzXCIsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICAvLyBFbnZpcm9ubWVudC1zcGVjaWZpYyByZXRlbnRpb24gcG9saWNpZXNcbiAgICAgICAgLi4uKHByb3BzLmVudmlyb25tZW50ID09PSBcInByb2RcIlxuICAgICAgICAgID8gW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6IFwidHJhbnNpdGlvbi10by1nbGFjaWVyXCIsXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksIC8vIEFyY2hpdmUgYWZ0ZXIgOTAgZGF5c1xuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuREVFUF9BUkNISVZFLFxuICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksIC8vIERlZXAgYXJjaGl2ZSBhZnRlciAxIHllYXJcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiBcImFyY2hpdmUtb2xkLWZpbGVzXCIsXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMjU1NSksIC8vIDcgeWVhcnMgZm9yIHByb2R1Y3Rpb25cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiBcImFyY2hpdmUtb2xkLXZlcnNpb25zXCIsXG4gICAgICAgICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uVHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksIC8vIE9sZCB2ZXJzaW9ucyB0byBHbGFjaWVyIGFmdGVyIDMwIGRheXNcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF1cbiAgICAgICAgICA6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIFNUUklDVCAxNC1EQVkgUkVURU5USU9OIEZPUiBQUkUtUFJPRCBURVNUSU5HXG4gICAgICAgICAgICAgICAgaWQ6IFwiZGVsZXRlLXRlc3QtZGF0YVwiLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSksXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTpcbiAgICAgICAgcHJvcHMuZW52aXJvbm1lbnQgPT09IFwicHJvZFwiXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgYnVja2V0IHBvbGljeSB0byBhbGxvdyBwdWJsaWMgcmVhZCBhY2Nlc3MgdG8gcmVjaXBlIGltYWdlc1xuICAgIHRoaXMuc3RvcmFnZUJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBzaWQ6IFwiUHVibGljUmVhZEdldE9iamVjdFwiLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFueVByaW5jaXBhbCgpXSxcbiAgICAgICAgYWN0aW9uczogW1wiczM6R2V0T2JqZWN0XCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJufS9yZWNpcGUtaW1hZ2VzLypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFRlbXBvcmFyeS9Qcm9jZXNzaW5nIEJ1Y2tldCB3aXRoIFVsdHJhLVNob3J0IFJldGVudGlvblxuICAgIHRoaXMudGVtcEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJSZWNpcGVBcmNoaXZlVGVtcFwiLCB7XG4gICAgICBidWNrZXROYW1lOiBgcmVjaXBlYXJjaGl2ZS10ZW1wLSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSwgLy8gTmV2ZXIgdmVyc2lvbiB0ZW1wb3JhcnkgZmlsZXNcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJkZWxldGUtdGVtcC1maWxlc1wiLFxuICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKHByb3BzLmVudmlyb25tZW50ID09PSBcInByb2RcIiA/IDcgOiAxKSxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksIC8vIEZpeGVkOiB1c2UgZGF5cyBpbnN0ZWFkIG9mIGhvdXJzXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQWx3YXlzIGRlc3Ryb3kgdGVtcCBidWNrZXRcbiAgICB9KTtcblxuICAgIC8vIEZhaWxlZCBQYXJzaW5nIEhUTUwgU3RvcmFnZSBCdWNrZXQgd2l0aCBTaXplIGFuZCBUaW1lIExpbWl0c1xuICAgIHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQoXG4gICAgICB0aGlzLFxuICAgICAgXCJSZWNpcGVBcmNoaXZlRmFpbGVkUGFyc2luZ1wiLFxuICAgICAge1xuICAgICAgICBidWNrZXROYW1lOiBgcmVjaXBlYXJjaGl2ZS1mYWlsZWQtcGFyc2luZy0ke3Byb3BzLmVudmlyb25tZW50fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIE5vIHZlcnNpb25pbmcgbmVlZGVkIGZvciBmYWlsZWQgcGFyc2luZyBkYXRhXG4gICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6IFwiZGVsZXRlLWZhaWxlZC1wYXJzaW5nLWRhdGFcIixcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDIpLCAvLyBBdXRvLXB1cmdlIGFmdGVyIDQ4IGhvdXJzXG4gICAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgLy8gQnVja2V0IG5vdGlmaWNhdGlvbiB0byBtb25pdG9yIHNpemUgKHdpbGwgYmUgaGFuZGxlZCBieSBDbG91ZFdhdGNoIG1ldHJpY3MpXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEFsd2F5cyBzYWZlIHRvIGRlc3Ryb3kgZmFpbGVkIHBhcnNpbmcgZGF0YVxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBJQU0gUm9sZSBmb3IgTGFtYmRhIEZ1bmN0aW9ucyAoc2hhcmVkIGFjcm9zcyBhbGwgTGFtYmRhIGZ1bmN0aW9ucylcbiAgICB0aGlzLmxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJSZWNpcGVBcmNoaXZlTGFtYmRhUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImxhbWJkYS5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICBcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGVcIlxuICAgICAgICApLFxuICAgICAgXSxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIFMzQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiczM6R2V0T2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgXCJzMzpQdXRPYmplY3RcIixcbiAgICAgICAgICAgICAgICBcInMzOkRlbGV0ZU9iamVjdFwiLFxuICAgICAgICAgICAgICAgIFwiczM6R2V0T2JqZWN0VXJsXCIsXG4gICAgICAgICAgICAgICAgXCJzMzpQdXRPYmplY3RBY2xcIiwgLy8gRm9yIHB1YmxpYyBpbWFnZSB1cGxvYWRzXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGAke3RoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMudGVtcEJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1wiczM6TGlzdEJ1Y2tldFwiXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgICAgICB0aGlzLnRlbXBCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgIHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgXCJzcXM6U2VuZE1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICBcInNxczpSZWNlaXZlTWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgIFwic3FzOkRlbGV0ZU1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICBcInNxczpHZXRRdWV1ZUF0dHJpYnV0ZXNcIixcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLCAvLyBXaWxsIGJlIHJlc3RyaWN0ZWQgdG8gc3BlY2lmaWMgcXVldWUgaW4gcHJvZHVjdGlvblxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1wic2VzOlNlbmRFbWFpbFwiLCBcInNlczpTZW5kUmF3RW1haWxcIl0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXSwgLy8gU0VTIHBlcm1pc3Npb25zIGZvciBpbnZpdGF0aW9uIGVtYWlsc1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyXCIsXG4gICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZFwiLFxuICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlc1wiLFxuICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5HZXRVc2VyXCIsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW3RoaXMudXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgd2l0aCBERG9TIFByb3RlY3Rpb25cbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgXCJSZWNpcGVBcmNoaXZlQVBJXCIsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgcmVjaXBlQXJjaGl2ZS1hcGktJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246IFwiUmVjaXBlQXJjaGl2ZSBCYWNrZW5kIEFQSVwiLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogW1xuICAgICAgICAgIFwiaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgICAgIFwiaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbVwiLFxuICAgICAgICAgIFwiY2hyb21lLWV4dGVuc2lvbjovLypcIixcbiAgICAgICAgICBcInNhZmFyaS13ZWItZXh0ZW5zaW9uOi8vKlwiLFxuICAgICAgICBdLCAvLyBSZXN0cmljdCBvcmlnaW5zXG4gICAgICAgIGFsbG93TWV0aG9kczogW1wiR0VUXCIsIFwiUE9TVFwiLCBcIlBVVFwiLCBcIkRFTEVURVwiLCBcIk9QVElPTlNcIl0sXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCIsXG4gICAgICAgICAgXCJYLUFtei1EYXRlXCIsXG4gICAgICAgICAgXCJBdXRob3JpemF0aW9uXCIsXG4gICAgICAgICAgXCJYLUFwaS1LZXlcIixcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSwgLy8gSW1wb3J0YW50IGZvciBhdXRoZW50aWNhdGVkIHJlcXVlc3RzXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IFwicHJvZFwiLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEREb1MgUHJvdGVjdGlvbjogVXNhZ2UgUGxhbiB3aXRoIFJhdGUgTGltaXRpbmdcbiAgICBjb25zdCB1c2FnZVBsYW4gPSBuZXcgYXBpZ2F0ZXdheS5Vc2FnZVBsYW4odGhpcywgXCJSZWNpcGVBcmNoaXZlVXNhZ2VQbGFuXCIsIHtcbiAgICAgIG5hbWU6IGByZWNpcGVhcmNoaXZlLXVzYWdlLXBsYW4tJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246IFwiVXNhZ2UgcGxhbiBmb3IgRERvUyBwcm90ZWN0aW9uXCIsXG4gICAgICB0aHJvdHRsZToge1xuICAgICAgICByYXRlTGltaXQ6IDIwMCwgLy8gcmVxdWVzdHMgcGVyIHNlY29uZCBwZXIgQVBJIGtleVxuICAgICAgICBidXJzdExpbWl0OiA0MDAsIC8vIGNvbmN1cnJlbnQgcmVxdWVzdHNcbiAgICAgIH0sXG4gICAgICBxdW90YToge1xuICAgICAgICBsaW1pdDogMTAwMDAsIC8vIHJlcXVlc3RzIHBlciBtb250aCBwZXIgQVBJIGtleVxuICAgICAgICBwZXJpb2Q6IGFwaWdhdGV3YXkuUGVyaW9kLk1PTlRILFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5hcGkuZGVwbG95bWVudFN0YWdlLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyIGZvciBBUEkgR2F0ZXdheSAtIEREb1MgUHJvdGVjdGlvbiAmIEF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcihcbiAgICAgIHRoaXMsXG4gICAgICBcIkNvZ25pdG9BdXRob3JpemVyXCIsXG4gICAgICB7XG4gICAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt0aGlzLnVzZXJQb29sXSxcbiAgICAgICAgYXV0aG9yaXplck5hbWU6IFwicmVjaXBlQXJjaGl2ZS1jb2duaXRvLWF1dGhvcml6ZXJcIixcbiAgICAgICAgcmVzdWx0c0NhY2hlVHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSwgLy8gQ2FjaGUgYXV0aCByZXN1bHRzIHRvIHJlZHVjZSBsb2FkXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFJlcXVlc3QgVmFsaWRhdG9yIGZvciBERG9TIFByb3RlY3Rpb24gLSBSZWplY3QgbWFsZm9ybWVkIHJlcXVlc3RzIGVhcmx5XG4gICAgY29uc3QgcmVxdWVzdFZhbGlkYXRvciA9IG5ldyBhcGlnYXRld2F5LlJlcXVlc3RWYWxpZGF0b3IoXG4gICAgICB0aGlzLFxuICAgICAgXCJSZXF1ZXN0VmFsaWRhdG9yXCIsXG4gICAgICB7XG4gICAgICAgIHJlc3RBcGk6IHRoaXMuYXBpLFxuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yTmFtZTogXCJyZWNpcGUtcmVxdWVzdC12YWxpZGF0b3JcIixcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogdHJ1ZSxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0UGFyYW1ldGVyczogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gU1FTIFF1ZXVlIGZvciBhc3luYyByZWNpcGUgbm9ybWFsaXphdGlvbiAoc2hhcmVkIHJlc291cmNlKVxuICAgIHRoaXMucmVjaXBlTm9ybWFsaXphdGlvblF1ZXVlID0gbmV3IHNxcy5RdWV1ZShcbiAgICAgIHRoaXMsXG4gICAgICBcIlJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZVwiLFxuICAgICAge1xuICAgICAgICBxdWV1ZU5hbWU6IGByZWNpcGUtbm9ybWFsaXphdGlvbi0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksIC8vIEFsbG93IDYwIHNlY29uZHMgZm9yIHByb2Nlc3NpbmdcbiAgICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksIC8vIEtlZXAgbWVzc2FnZXMgZm9yIDIgd2Vla3NcbiAgICAgICAgZGVhZExldHRlclF1ZXVlOiB7XG4gICAgICAgICAgcXVldWU6IG5ldyBzcXMuUXVldWUodGhpcywgXCJSZWNpcGVOb3JtYWxpemF0aW9uRExRXCIsIHtcbiAgICAgICAgICAgIHF1ZXVlTmFtZTogYHJlY2lwZS1ub3JtYWxpemF0aW9uLWRscS0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsIC8vIFRyeSAzIHRpbWVzIGJlZm9yZSBtb3ZpbmcgdG8gRExRXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnMgLSBub3cgdXNpbmcgc2luZ2xldG9uIHBhdHRlcm5cblxuXG5cblxuXG5cblxuICAgIC8vIFMzLUJhc2VkIEludml0YXRpb24gU3lzdGVtXG4gICAgLy8gSW52aXRhdGlvbnMgc3RvcmVkIGFzIEpTT04gZmlsZXMgaW4gZXhpc3RpbmcgUzMgYnVja2V0XG5cblxuXG5cbiAgICAvLyBBUEkgR2F0ZXdheSBJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGhlYWx0aEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5nZXRIZWFsdGhGdW5jdGlvbigpLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7IFwiYXBwbGljYXRpb24vanNvblwiOiBcInsgXFxcInN0YXR1c0NvZGVcXFwiOiBcXFwiMjAwXFxcIiB9XCIgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSZXNvdXJjZXNcbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJoZWFsdGhcIik7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIGhlYWx0aEludGVncmF0aW9uKTtcblxuICAgIGNvbnN0IHYxID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZShcInYxXCIpO1xuXG4gICAgLy8gRGlhZ25vc3RpY3MgZW5kcG9pbnQgKHB1YmxpYyAtIG5vIGF1dGggcmVxdWlyZWQgZm9yIGVycm9yIHJlcG9ydGluZylcbiAgICBjb25zdCBkaWFnbm9zdGljc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZShcImRpYWdub3N0aWNzXCIpO1xuICAgIGNvbnN0IGRpYWdub3N0aWNzSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgIHRoaXMuZ2V0RGlhZ25vc3RpY3NGdW5jdGlvbigpXG4gICAgKTtcbiAgICBkaWFnbm9zdGljc1Jlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgZGlhZ25vc3RpY3NJbnRlZ3JhdGlvbiwge1xuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIEZsdXR0ZXIgQ29uc29sZSBEaWFnbm9zdGljcyBlbmRwb2ludCAocHVibGljIC0gbm8gYXV0aCByZXF1aXJlZClcbiAgICBjb25zdCBmbHV0dGVyQ29uc29sZVJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZShcbiAgICAgIFwiZmx1dHRlci1jb25zb2xlLWVycm9yc1wiXG4gICAgKTtcbiAgICBjb25zdCBmbHV0dGVyQ29uc29sZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldEZsdXR0ZXJDb25zb2xlRGlhZ25vc3RpY3NGdW5jdGlvbigpXG4gICAgKTtcbiAgICBmbHV0dGVyQ29uc29sZVJlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgZmx1dHRlckNvbnNvbGVJbnRlZ3JhdGlvbiwge1xuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIFJlcG9ydCBFcnJvciBlbmRwb2ludCAocHVibGljIC0gbm8gYXV0aCByZXF1aXJlZCwgdXNlZCBieSB3ZWIgZXh0ZW5zaW9ucylcbiAgICBjb25zdCByZXBvcnRFcnJvclJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZShcInJlcG9ydC1lcnJvclwiKTtcbiAgICBjb25zdCByZXBvcnRFcnJvckludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldERpYWdub3N0aWNzRnVuY3Rpb24oKVxuICAgICk7XG4gICAgcmVwb3J0RXJyb3JSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIHJlcG9ydEVycm9ySW50ZWdyYXRpb24sIHtcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyBDb250ZW50IE5vcm1hbGl6ZXIgZW5kcG9pbnQgKGludGVybmFsIHN5c3RlbSBjYWxscyAtIG5vIGF1dGggcmVxdWlyZWQpXG4gICAgY29uc3Qgbm9ybWFsaXplclJlc291cmNlID0gdjEuYWRkUmVzb3VyY2UoXCJub3JtYWxpemVcIik7XG4gICAgY29uc3Qgbm9ybWFsaXplckludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldENvbnRlbnROb3JtYWxpemVyRnVuY3Rpb24oKVxuICAgICk7XG4gICAgbm9ybWFsaXplclJlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgbm9ybWFsaXplckludGVncmF0aW9uLCB7XG4gICAgICAvLyBObyBhdXRob3JpemVyIC0gYWxsb3cgaW50ZXJuYWwgc3lzdGVtIGNhbGxzIGZyb20gcmVjaXBlcyBmdW5jdGlvblxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIERpYWdub3N0aWMgUHJvY2Vzc29yIGVuZHBvaW50IChhdXRoZW50aWNhdGVkKVxuICAgIGNvbnN0IGRpYWdub3N0aWNQcm9jZXNzb3JSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKFwiZGlhZ25vc3RpYy1zdW1tYXJ5XCIpO1xuICAgIGNvbnN0IGRpYWdub3N0aWNQcm9jZXNzb3JJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXREaWFnbm9zdGljUHJvY2Vzc29yRnVuY3Rpb24oKVxuICAgICk7XG4gICAgZGlhZ25vc3RpY1Byb2Nlc3NvclJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgIFwiR0VUXCIsXG4gICAgICBkaWFnbm9zdGljUHJvY2Vzc29ySW50ZWdyYXRpb24sXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgICAgfVxuICAgICk7XG5cblxuICAgIC8vIEZ1dHVyZSByZWNpcGUgZW5kcG9pbnRzXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgIGNvbnN0IHJlY2lwZXNSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKFwicmVjaXBlc1wiKTtcblxuICAgIC8vIFJlY2lwZSBDUlVEIG9wZXJhdGlvbnMgd2l0aCBBdXRoZW50aWNhdGlvblxuICAgIGNvbnN0IHJlY2lwZXNJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXRSZWNpcGVzRnVuY3Rpb24oKVxuICAgICk7XG5cbiAgICAvLyBMaXN0IHJlY2lwZXM6IEdFVCAvcmVjaXBlcyAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgcmVjaXBlc1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSByZWNpcGU6IFBPU1QgL3JlY2lwZXMgKHJlcXVpcmVzIGF1dGhlbnRpY2F0aW9uKVxuICAgIHJlY2lwZXNSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gU2luZ2xlIHJlY2lwZSBvcGVyYXRpb25zOiBHRVQvUFVUL0RFTEVURSAvcmVjaXBlcy97aWR9IChyZXF1aXJlcyBhdXRoZW50aWNhdGlvbilcbiAgICBjb25zdCByZWNpcGVSZXNvdXJjZSA9IHJlY2lwZXNSZXNvdXJjZS5hZGRSZXNvdXJjZShcIntpZH1cIik7XG4gICAgcmVjaXBlUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgfSk7XG4gICAgcmVjaXBlUmVzb3VyY2UuYWRkTWV0aG9kKFwiUFVUXCIsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuICAgIHJlY2lwZVJlc291cmNlLmFkZE1ldGhvZChcIkRFTEVURVwiLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgIH0pO1xuXG4gICAgLy8gU2VhcmNoIGVuZHBvaW50OiBHRVQgL3JlY2lwZXMvc2VhcmNoIChyZXF1aXJlcyBhdXRoZW50aWNhdGlvbilcbiAgICBjb25zdCBzZWFyY2hSZXNvdXJjZSA9IHJlY2lwZXNSZXNvdXJjZS5hZGRSZXNvdXJjZShcInNlYXJjaFwiKTtcbiAgICBzZWFyY2hSZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyBBbmFseXRpY3MgZW5kcG9pbnRzOiBQT1NUIC92MS9hbmFseXRpY3MvZXZlbnRzLCBHRVQgL3YxL2FuYWx5dGljcy9zdW1tYXJ5IChyZXF1aXJlcyBhdXRoZW50aWNhdGlvbilcbiAgICBjb25zdCBhbmFseXRpY3NSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKFwiYW5hbHl0aWNzXCIpO1xuICAgIGNvbnN0IGFuYWx5dGljc0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICB0aGlzLmdldEFuYWx5dGljc0Z1bmN0aW9uKClcbiAgICApO1xuXG4gICAgLy8gU3VibWl0IGFuYWx5dGljcyBldmVudHM6IFBPU1QgL3YxL2FuYWx5dGljcy9ldmVudHNcbiAgICBjb25zdCBhbmFseXRpY3NFdmVudHNSZXNvdXJjZSA9IGFuYWx5dGljc1Jlc291cmNlLmFkZFJlc291cmNlKFwiZXZlbnRzXCIpO1xuICAgIGFuYWx5dGljc0V2ZW50c1Jlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgYW5hbHl0aWNzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcblxuICAgIC8vIEdldCBhbmFseXRpY3Mgc3VtbWFyeTogR0VUIC92MS9hbmFseXRpY3Mvc3VtbWFyeVxuICAgIGNvbnN0IGFuYWx5dGljc1N1bW1hcnlSZXNvdXJjZSA9IGFuYWx5dGljc1Jlc291cmNlLmFkZFJlc291cmNlKFwic3VtbWFyeVwiKTtcbiAgICBhbmFseXRpY3NTdW1tYXJ5UmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIGFuYWx5dGljc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIC8vIEltYWdlIHVwbG9hZCBlbmRwb2ludDogUE9TVCAvaW1hZ2VzL3VwbG9hZCAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgY29uc3QgaW1hZ2VzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKFwiaW1hZ2VzXCIpO1xuICAgIGNvbnN0IHVwbG9hZFJlc291cmNlID0gaW1hZ2VzUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJ1cGxvYWRcIik7XG4gICAgY29uc3QgaW1hZ2VVcGxvYWRJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXRJbWFnZVVwbG9hZEZ1bmN0aW9uKClcbiAgICApO1xuICAgIHVwbG9hZFJlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgaW1hZ2VVcGxvYWRJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gQWRtaW4gRW5kcG9pbnRzIGZvciBNdWx0aS1UZW5hbnQgSW52aXRhdGlvbiBNYW5hZ2VtZW50XG4gICAgY29uc3QgYWRtaW5SZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJhZG1pblwiKTtcbiAgICBjb25zdCBhZG1pbkludml0YXRpb25zUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKFwiaW52aXRhdGlvbnNcIik7XG4gICAgY29uc3QgaW52aXRhdGlvbk1hbmFnZXJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXRJbnZpdGF0aW9uTWFuYWdlckZ1bmN0aW9uKClcbiAgICApO1xuXG4gICAgLy8gTGlzdCBpbnZpdGF0aW9uczogR0VUIC9hZG1pbi9pbnZpdGF0aW9ucyAocmVxdWlyZXMgYWRtaW4gYXV0aGVudGljYXRpb24pXG4gICAgYWRtaW5JbnZpdGF0aW9uc1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBpbnZpdGF0aW9uTWFuYWdlckludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBpbnZpdGF0aW9uOiBQT1NUIC9hZG1pbi9pbnZpdGF0aW9ucyAocmVxdWlyZXMgYWRtaW4gYXV0aGVudGljYXRpb24pXG4gICAgYWRtaW5JbnZpdGF0aW9uc1Jlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgaW52aXRhdGlvbk1hbmFnZXJJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gUmV2b2tlIGludml0YXRpb246IERFTEVURSAvYWRtaW4vaW52aXRhdGlvbnMve3Rva2VufSAocmVxdWlyZXMgYWRtaW4gYXV0aGVudGljYXRpb24pXG4gICAgY29uc3QgYWRtaW5JbnZpdGF0aW9uVG9rZW5SZXNvdXJjZSA9XG4gICAgICBhZG1pbkludml0YXRpb25zUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJ7dG9rZW59XCIpO1xuICAgIGFkbWluSW52aXRhdGlvblRva2VuUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgXCJERUxFVEVcIixcbiAgICAgIGludml0YXRpb25NYW5hZ2VySW50ZWdyYXRpb24sXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDaGVjayBpbnZpdGF0aW9uIHN0YXR1czogR0VUIC9hZG1pbi9pbnZpdGF0aW9ucy9zdGF0dXMve3Rva2VufSAocHVibGljLCBubyBhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IGFkbWluSW52aXRhdGlvblN0YXR1c1Jlc291cmNlID1cbiAgICAgIGFkbWluSW52aXRhdGlvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZShcInN0YXR1c1wiKTtcbiAgICBjb25zdCBhZG1pbkludml0YXRpb25TdGF0dXNUb2tlblJlc291cmNlID1cbiAgICAgIGFkbWluSW52aXRhdGlvblN0YXR1c1Jlc291cmNlLmFkZFJlc291cmNlKFwie3Rva2VufVwiKTtcbiAgICBhZG1pbkludml0YXRpb25TdGF0dXNUb2tlblJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgIFwiR0VUXCIsXG4gICAgICBpbnZpdGF0aW9uTWFuYWdlckludGVncmF0aW9uXG4gICAgKTtcblxuICAgIC8vIEJhY2t1cCBlbmRwb2ludHM6IEdFVC9QT1NUIC92MS9iYWNrdXBzIChhdXRoZW50aWNhdGVkKVxuICAgIGNvbnN0IGJhY2t1cHNSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKFwiYmFja3Vwc1wiKTtcbiAgICBjb25zdCBiYWNrdXBJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXRCYWNrdXBGdW5jdGlvbigpXG4gICAgKTtcblxuICAgIC8vIExpc3QgYmFja3VwczogR0VUIC92MS9iYWNrdXBzXG4gICAgYmFja3Vwc1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBiYWNrdXBJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGJhY2t1cDogUE9TVCAvdjEvYmFja3Vwc1xuICAgIGJhY2t1cHNSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIGJhY2t1cEludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyBSZXN0b3JlIGZyb20gYmFja3VwOiBQT1NUIC92MS9iYWNrdXBzL3Jlc3RvcmVcbiAgICBjb25zdCBiYWNrdXBSZXN0b3JlUmVzb3VyY2UgPSBiYWNrdXBzUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJyZXN0b3JlXCIpO1xuICAgIGJhY2t1cFJlc3RvcmVSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIGJhY2t1cEludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyBNb2JpbGUgc2hhcmUgZGlhZ25vc3RpY3M6IFBPU1QgL3YxL2RpYWdub3N0aWNzL21vYmlsZS1zaGFyZS1mYWlsdXJlIChhdXRoZW50aWNhdGVkKVxuICAgIC8vIFVzZWQgYnkgaU9TL0FuZHJvaWQgc2hhcmUgZXh0ZW5zaW9ucyB0byByZXBvcnQgY2FwdHVyZSBmYWlsdXJlc1xuICAgIGNvbnN0IGRpYWdub3N0aWNzVjFSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKFwiZGlhZ25vc3RpY3NcIik7XG4gICAgY29uc3QgbW9iaWxlU2hhcmVGYWlsdXJlUmVzb3VyY2UgPSBkaWFnbm9zdGljc1YxUmVzb3VyY2UuYWRkUmVzb3VyY2UoXG4gICAgICBcIm1vYmlsZS1zaGFyZS1mYWlsdXJlXCJcbiAgICApO1xuICAgIGNvbnN0IGRpYWdub3N0aWNzTW9iaWxlU2hhcmVJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXREaWFnbm9zdGljc01vYmlsZVNoYXJlRnVuY3Rpb24oKVxuICAgICk7XG4gICAgbW9iaWxlU2hhcmVGYWlsdXJlUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgXCJQT1NUXCIsXG4gICAgICBkaWFnbm9zdGljc01vYmlsZVNoYXJlSW50ZWdyYXRpb24sXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBdXRoIEVuZHBvaW50cyBmb3IgUmVnaXN0cmF0aW9uXG4gICAgY29uc3QgYXV0aFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZShcImF1dGhcIik7XG4gICAgY29uc3QgYXV0aFJlZ2lzdGVyV2l0aEludml0YXRpb25SZXNvdXJjZSA9IGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZShcbiAgICAgIFwicmVnaXN0ZXItd2l0aC1pbnZpdGF0aW9uXCJcbiAgICApO1xuICAgIGNvbnN0IHJlZ2lzdHJhdGlvbkhhbmRsZXJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgdGhpcy5nZXRSZWdpc3RyYXRpb25IYW5kbGVyRnVuY3Rpb24oKVxuICAgICk7XG5cbiAgICAvLyBSZWdpc3RlciB3aXRoIGludml0YXRpb246IFBPU1QgL2F1dGgvcmVnaXN0ZXItd2l0aC1pbnZpdGF0aW9uIChwdWJsaWMsIG5vIGF1dGggcmVxdWlyZWQpXG4gICAgYXV0aFJlZ2lzdGVyV2l0aEludml0YXRpb25SZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICBcIlBPU1RcIixcbiAgICAgIHJlZ2lzdHJhdGlvbkhhbmRsZXJJbnRlZ3JhdGlvbixcbiAgICAgIHtcbiAgICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQWRkIEdhdGV3YXkgUmVzcG9uc2VzIHRvIGluY2x1ZGUgQ09SUyBoZWFkZXJzIG9uIEFQSSBHYXRld2F5IGVycm9yIHJlc3BvbnNlc1xuICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZShcInVuYXV0aG9yaXplZFwiLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5VTkFVVEhPUklaRUQsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbSdcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFsc1wiOiBcIid0cnVlJ1wiLFxuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nXCIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKFwiYWNjZXNzLWRlbmllZFwiLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5BQ0NFU1NfREVOSUVELFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiJ2h0dHBzOi8vcmVjaXBlYXJjaGl2ZS5jb20nXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIjogXCIndHJ1ZSdcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ1wiLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZShcImRlZmF1bHQtNHh4XCIsIHtcbiAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLkRFRkFVTFRfNFhYLFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiJ2h0dHBzOi8vcmVjaXBlYXJjaGl2ZS5jb20nXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIjogXCIndHJ1ZSdcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ1wiLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZShcImRlZmF1bHQtNXh4XCIsIHtcbiAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLkRFRkFVTFRfNVhYLFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiJ2h0dHBzOi8vcmVjaXBlYXJjaGl2ZS5jb20nXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIjogXCIndHJ1ZSdcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ1wiLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIPCfmqggQ09TVCBNT05JVE9SSU5HICYgQklMTElORyBBTEVSVFMg8J+aqFxuXG4gICAgLy8gU05TIFRvcGljIGZvciBiaWxsaW5nIGFsZXJ0c1xuICAgIHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsIFwiQmlsbGluZ0FsZXJ0c1wiLCB7XG4gICAgICB0b3BpY05hbWU6IGByZWNpcGVhcmNoaXZlLWJpbGxpbmctYWxlcnRzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiBcIlJlY2lwZUFyY2hpdmUgQmlsbGluZyBBbGVydHNcIixcbiAgICB9KTtcblxuICAgIC8vIEVtYWlsIHN1YnNjcmlwdGlvbiBmb3IgYmlsbGluZyBhbGVydHNcbiAgICB0aGlzLmJpbGxpbmdBbGVydFRvcGljLmFkZFN1YnNjcmlwdGlvbihcbiAgICAgIG5ldyBzbnNTdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKHByb3BzLmFkbWluRW1haWwpXG4gICAgKTtcblxuICAgIC8vIEFXUyBCdWRnZXQgZm9yIGNvbnNlcnZhdGl2ZSBtb250aGx5IGNvc3QgbW9uaXRvcmluZyAoJDIwL21vbnRoIG1heGltdW0pXG4gICAgbmV3IGJ1ZGdldHMuQ2ZuQnVkZ2V0KHRoaXMsIFwiTW9udGhseUNvc3RCdWRnZXRcIiwge1xuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIGJ1ZGdldE5hbWU6IGBSZWNpcGVBcmNoaXZlLU1vbnRobHlDb3N0V2F0Y2hkb2ctJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBidWRnZXRUeXBlOiBcIkNPU1RcIixcbiAgICAgICAgdGltZVVuaXQ6IFwiTU9OVEhMWVwiLFxuICAgICAgICBidWRnZXRMaW1pdDoge1xuICAgICAgICAgIGFtb3VudDogMjAsIC8vICQyMC9tb250aCBtYXhpbXVtIGJ1ZGdldFxuICAgICAgICAgIHVuaXQ6IFwiVVNEXCIsXG4gICAgICAgIH0sXG4gICAgICAgIGNvc3RGaWx0ZXJzOiB7XG4gICAgICAgICAgLy8gT25seSBtb25pdG9yIHRoaXMgYWNjb3VudCdzIGNvc3RzXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVQZXJpb2Q6IHtcbiAgICAgICAgICBzdGFydDogXCIxNzU2MDgwMDkzXCIsIC8vIEF1Z3VzdCAyNCwgMjAyNSBpbiBlcG9jaCBzZWNvbmRzXG4gICAgICAgICAgZW5kOiBcIjIwODI3NjIxMDJcIiwgLy8gRGVjZW1iZXIgMzEsIDIwMzUgaW4gZXBvY2ggc2Vjb25kc1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG5vdGlmaWNhdGlvbnNXaXRoU3Vic2NyaWJlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5vdGlmaWNhdGlvbjoge1xuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogXCJBQ1RVQUxcIixcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogXCJHUkVBVEVSX1RIQU5cIixcbiAgICAgICAgICAgIHRocmVzaG9sZDogMjUsIC8vIEFsZXJ0IGF0IDI1JSBvZiBidWRnZXQgKCQ1LjAwKVxuICAgICAgICAgICAgdGhyZXNob2xkVHlwZTogXCJQRVJDRU5UQUdFXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiBcIlNOU1wiLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0aGlzLmJpbGxpbmdBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiBcIkFDVFVBTFwiLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBcIkdSRUFURVJfVEhBTlwiLFxuICAgICAgICAgICAgdGhyZXNob2xkOiA1MCwgLy8gV2FybmluZyBhdCA1MCUgb2YgYnVkZ2V0ICgkMTAuMDApXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiBcIlBFUkNFTlRBR0VcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6IFwiU05TXCIsXG4gICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6IFwiQUNUVUFMXCIsXG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IFwiR1JFQVRFUl9USEFOXCIsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDgwLCAvLyBDcml0aWNhbCBhdCA4MCUgb2YgYnVkZ2V0ICgkMTYuMDApXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiBcIlBFUkNFTlRBR0VcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6IFwiU05TXCIsXG4gICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6IFwiRk9SRUNBU1RFRFwiLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBcIkdSRUFURVJfVEhBTlwiLFxuICAgICAgICAgICAgdGhyZXNob2xkOiAxMDAsIC8vIEZvcmVjYXN0IGFsZXJ0IGlmIHByb2plY3RlZCB0byBleGNlZWQgJDIwXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiBcIlBFUkNFTlRBR0VcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6IFwiU05TXCIsXG4gICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBBbGFybSBmb3IgdW51c3VhbCBzcGVuZGluZyBwYXR0ZXJuc1xuICAgIGNvbnN0IHVudXN1YWxTcGVuZGluZ0FsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgXCJVbnVzdWFsU3BlbmRpbmdBbGFybVwiLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6IGBSZWNpcGVBcmNoaXZlLVVudXN1YWxTcGVuZGluZy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246IFwiQWxlcnQgd2hlbiBlc3RpbWF0ZWQgbW9udGhseSBjaGFyZ2VzIGV4Y2VlZCAkMjBcIixcbiAgICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvQmlsbGluZ1wiLFxuICAgICAgICAgIG1ldHJpY05hbWU6IFwiRXN0aW1hdGVkQ2hhcmdlc1wiLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIEN1cnJlbmN5OiBcIlVTRFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiBcIk1heGltdW1cIixcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxMiksIC8vIENoZWNrIHR3aWNlIGRhaWx5XG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDIwLCAvLyAkMjAvbW9udGggdGhyZXNob2xkXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ29ubmVjdCB0aGUgYWxhcm0gdG8gU05TIHRvcGljXG4gICAgdW51c3VhbFNwZW5kaW5nQWxhcm0uYWRkQWxhcm1BY3Rpb24oe1xuICAgICAgYmluZDogKCkgPT4gKHsgYWxhcm1BY3Rpb25Bcm46IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4gfSksXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIEFsYXJtIGZvciBGYWlsZWQgUGFyc2luZyBCdWNrZXQgU2l6ZSAoNE1CIGxpbWl0KVxuICAgIGNvbnN0IGZhaWxlZFBhcnNpbmdCdWNrZXRTaXplQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICBcIkZhaWxlZFBhcnNpbmdCdWNrZXRTaXplQWxhcm1cIixcbiAgICAgIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgUmVjaXBlQXJjaGl2ZS1GYWlsZWRQYXJzaW5nQnVja2V0U2l6ZS0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246XG4gICAgICAgICAgXCJBbGVydCB3aGVuIGZhaWxlZCBwYXJzaW5nIGJ1Y2tldCBleGNlZWRzIDRNQiB0byBwcmV2ZW50IGNvc3Qgb3ZlcnJ1bnNcIixcbiAgICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvUzNcIixcbiAgICAgICAgICBtZXRyaWNOYW1lOiBcIkJ1Y2tldFNpemVCeXRlc1wiLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIEJ1Y2tldE5hbWU6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgU3RvcmFnZVR5cGU6IFwiU3RhbmRhcmRTdG9yYWdlXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDYpLCAvLyBDaGVjayA0IHRpbWVzIGRhaWx5XG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDQgKiAxMDI0ICogMTAyNCwgLy8gNE1CIGluIGJ5dGVzXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ29ubmVjdCB0aGUgYnVja2V0IHNpemUgYWxhcm0gdG8gU05TIHRvcGljXG4gICAgZmFpbGVkUGFyc2luZ0J1Y2tldFNpemVBbGFybS5hZGRBbGFybUFjdGlvbih7XG4gICAgICBiaW5kOiAoKSA9PiAoeyBhbGFybUFjdGlvbkFybjogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybiB9KSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sSWRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvZ25pdG8gVXNlciBQb29sIElEXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTdG9yYWdlQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTMyBTdG9yYWdlIEJ1Y2tldCBOYW1lIChSZWNpcGUgUGhvdG9zICYgRG9jdW1lbnRzKVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJUZW1wQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTMyBUZW1wb3JhcnkgQnVja2V0IE5hbWUgKFByb2Nlc3NpbmcgJiBVcGxvYWRzKVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJGYWlsZWRQYXJzaW5nQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgXCJTMyBGYWlsZWQgUGFyc2luZyBCdWNrZXQgTmFtZSAoSFRNTCBmcm9tIGZhaWxlZCByZWNpcGUgZXh0cmFjdGlvbnMpXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkFwaUdhdGV3YXlVcmxcIiwge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkFQSSBHYXRld2F5IFVSTFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCaWxsaW5nQWxlcnRUb3BpY0FyblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNOUyBUb3BpYyBBUk4gZm9yIEJpbGxpbmcgQWxlcnRzXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlJlZ2lvblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICBkZXNjcmlwdGlvbjogXCJBV1MgUmVnaW9uXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkFkbWluRW1haWxcIiwge1xuICAgICAgdmFsdWU6IHByb3BzLmFkbWluRW1haWwsXG4gICAgICBkZXNjcmlwdGlvbjogXCJBZG1pbiBFbWFpbCBmb3IgQmlsbGluZyBBbGVydHMgYW5kIEluaXRpYWwgVXNlciBDcmVhdGlvblwiLFxuICAgIH0pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSBiYWNrZ3JvdW5kIG5vcm1hbGl6ZXIgdG8gZW5zdXJlIFNRUyBldmVudCBzb3VyY2UgaXMgY3JlYXRlZFxuICAgIHRoaXMuZ2V0QmFja2dyb3VuZE5vcm1hbGl6ZXJGdW5jdGlvbigpO1xuICB9XG5cbiAgLy8gU2luZ2xldG9uIGdldHRlcnMgZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgcHVibGljIGdldEhlYWx0aEZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLl9oZWFsdGhGdW5jdGlvbikge1xuICAgICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBcIkhlYWx0aEZ1bmN0aW9uTG9nR3JvdXBcIiwge1xuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5faGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiSGVhbHRoRnVuY3Rpb25cIiwge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgIGhhbmRsZXI6IFwiYm9vdHN0cmFwXCIsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Z1bmN0aW9ucy9kaXN0L2hlYWx0aC1wYWNrYWdlXCIpLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgIG1lbW9yeVNpemU6IDEyOCwgLy8gTWluaW1hbCBtZW1vcnkgZm9yIEZyZWUgVGllciBvcHRpbWl6YXRpb25cbiAgICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMiwgLy8gTG93LWZyZXF1ZW5jeSBmdW5jdGlvblxuICAgICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBTM19URU1QX0JVQ0tFVDogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICB9LFxuICAgICAgICByb2xlOiB0aGlzLmxhbWJkYVJvbGUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2hlYWx0aEZ1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldFJlY2lwZXNGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5fcmVjaXBlc0Z1bmN0aW9uKSB7XG4gICAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiUmVjaXBlc0Z1bmN0aW9uTG9nR3JvdXBcIiwge1xuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9yZWNpcGVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiUmVjaXBlc0Z1bmN0aW9uXCIsIHtcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi9mdW5jdGlvbnMvZGlzdC9yZWNpcGVzLXBhY2thZ2VcIiksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgICAgbWVtb3J5U2l6ZTogMjU2LCAvLyBNb3JlIG1lbW9yeSBmb3IgQ1JVRCBvcGVyYXRpb25zXG4gICAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDEwLCAvLyBIaWdoLWZyZXF1ZW5jeSBmdW5jdGlvbiAoQ1JVRCArIHNlYXJjaClcbiAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIEVOVklST05NRU5UOiB0aGlzLnN0YWNrRW52aXJvbm1lbnQsXG4gICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgUzNfVEVNUF9CVUNLRVQ6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgIFMzX0ZBSUxFRF9QQVJTSU5HX0JVQ0tFVDogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICAvLyBVc2UgdGhlIGRlcGxveWVkIEFQSSBHYXRld2F5IFVSTCBpbnN0ZWFkIG9mIGEgaGFyZC1jb2RlZCB2YWx1ZVxuICAgICAgICAgIEFQSV9HQVRFV0FZX1VSTDogdGhpcy5hcGkudXJsLFxuICAgICAgICAgIE5PUk1BTElaQVRJT05fUVVFVUVfVVJMOiB0aGlzLnJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZS5xdWV1ZVVybCxcbiAgICAgICAgfSxcbiAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9yZWNpcGVzRnVuY3Rpb247XG4gIH1cblxuICBwdWJsaWMgZ2V0RGlhZ25vc3RpY3NGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5fZGlhZ25vc3RpY3NGdW5jdGlvbikge1xuICAgICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBcIkRpYWdub3N0aWNzRnVuY3Rpb25Mb2dHcm91cFwiLCB7XG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9kaWFnbm9zdGljc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJEaWFnbm9zdGljc0Z1bmN0aW9uXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogXCJib290c3RyYXBcIixcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi9mdW5jdGlvbnMvZGlzdC9kaWFnbm9zdGljcy1wYWNrYWdlXCIpLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsIC8vIE9wdGltaXplZDogbG93LWZyZXF1ZW5jeSBkaWFnbm9zdGljIG9wZXJhdGlvbnNcbiAgICAgICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiA1LCAvLyBNZWRpdW0tZnJlcXVlbmN5IGZ1bmN0aW9uXG4gICAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5zdGFja0Vudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIFMzX0ZBSUxFRF9QQVJTSU5HX0JVQ0tFVDogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZGlhZ25vc3RpY3NGdW5jdGlvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRJbWFnZVVwbG9hZEZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLl9pbWFnZVVwbG9hZEZ1bmN0aW9uKSB7XG4gICAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiSW1hZ2VVcGxvYWRGdW5jdGlvbkxvZ0dyb3VwXCIsIHtcbiAgICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuVFdPX1dFRUtTLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX2ltYWdlVXBsb2FkRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgICB0aGlzLFxuICAgICAgICBcIkltYWdlVXBsb2FkRnVuY3Rpb25cIixcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Z1bmN0aW9ucy9kaXN0L2ltYWdlLXVwbG9hZC1wYWNrYWdlXCIpLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSwgLy8gTW9yZSB0aW1lIGZvciBpbWFnZSBwcm9jZXNzaW5nXG4gICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LCAvLyBPcHRpbWl6ZWQ6IHVzYWdlIHNob3dzIH4zM01CLCByZWR1Y2VkIGZyb20gNTEyTUJcbiAgICAgICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiA1LCAvLyBNZWRpdW0tZnJlcXVlbmN5IGZ1bmN0aW9uXG4gICAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5zdGFja0Vudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByb2xlOiB0aGlzLmxhbWJkYVJvbGUsXG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9pbWFnZVVwbG9hZEZ1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldEZsdXR0ZXJDb25zb2xlRGlhZ25vc3RpY3NGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5fZmx1dHRlckNvbnNvbGVEaWFnbm9zdGljc0Z1bmN0aW9uKSB7XG4gICAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiRmx1dHRlckNvbnNvbGVEaWFnbm9zdGljc0Z1bmN0aW9uTG9nR3JvdXBcIiwge1xuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fZmx1dHRlckNvbnNvbGVEaWFnbm9zdGljc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJGbHV0dGVyQ29uc29sZURpYWdub3N0aWNzRnVuY3Rpb25cIixcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgICAgIFwiLi4vZnVuY3Rpb25zL2Rpc3QvZmx1dHRlci1jb25zb2xlLWRpYWdub3N0aWNzLXBhY2thZ2VcIlxuICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDEyOCwgLy8gT3B0aW1pemVkOiBsb3ctZnJlcXVlbmN5IGRpYWdub3N0aWMgdXBsb2Fkc1xuICAgICAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDMsIC8vIExvdy1mcmVxdWVuY3kgZnVuY3Rpb25cbiAgICAgICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIEVOVklST05NRU5UOiB0aGlzLnN0YWNrRW52aXJvbm1lbnQsXG4gICAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZmx1dHRlckNvbnNvbGVEaWFnbm9zdGljc0Z1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldENvbnRlbnROb3JtYWxpemVyRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX2NvbnRlbnROb3JtYWxpemVyRnVuY3Rpb24pIHtcbiAgICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgXCJDb250ZW50Tm9ybWFsaXplckZ1bmN0aW9uTG9nR3JvdXBcIiwge1xuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5UV09fV0VFS1MsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fY29udGVudE5vcm1hbGl6ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiQ29udGVudE5vcm1hbGl6ZXJGdW5jdGlvblwiLFxuICAgICAgICB7XG4gICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgICAgIGhhbmRsZXI6IFwiYm9vdHN0cmFwXCIsXG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxuICAgICAgICAgICAgXCIuLi9mdW5jdGlvbnMvZGlzdC9jb250ZW50LW5vcm1hbGl6ZXItcGFja2FnZVwiXG4gICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksIC8vIExvbmdlciB0aW1lb3V0IGZvciBPcGVuQUkgQVBJIGNhbGxzXG4gICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LCAvLyBPcHRpbWl6ZWQ6IHVzYWdlIHNob3dzIH4zM01CLCByZWR1Y2VkIGZyb20gNTEyTUJcbiAgICAgICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiA1LCAvLyBNZWRpdW0tZnJlcXVlbmN5IGZ1bmN0aW9uXG4gICAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5zdGFja0Vudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgICBPUEVOQUlfQVBJX0tFWTogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVkgfHwgXCJcIiwgLy8gUmVhZCBmcm9tIGVudmlyb25tZW50XG4gICAgICAgICAgfSxcbiAgICAgICAgICByb2xlOiB0aGlzLmxhbWJkYVJvbGUsXG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jb250ZW50Tm9ybWFsaXplckZ1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldEJhY2tncm91bmROb3JtYWxpemVyRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX2JhY2tncm91bmROb3JtYWxpemVyRnVuY3Rpb24pIHtcbiAgICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgXCJCYWNrZ3JvdW5kTm9ybWFsaXplckZ1bmN0aW9uTG9nR3JvdXBcIiwge1xuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5UV09fV0VFS1MsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fYmFja2dyb3VuZE5vcm1hbGl6ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiQmFja2dyb3VuZE5vcm1hbGl6ZXJGdW5jdGlvblwiLFxuICAgICAgICB7XG4gICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgICAgIGhhbmRsZXI6IFwiYm9vdHN0cmFwXCIsXG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxuICAgICAgICAgICAgXCIuLi9mdW5jdGlvbnMvZGlzdC9iYWNrZ3JvdW5kLW5vcm1hbGl6ZXItcGFja2FnZVwiXG4gICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg0NSksIC8vIExvbmdlciB0aW1lb3V0IGZvciBPcGVuQUkgcHJvY2Vzc2luZ1xuICAgICAgICAgIG1lbW9yeVNpemU6IDEyOCwgLy8gT3B0aW1pemVkOiB1c2FnZSBzaG93cyB+MzNNQiwgcmVkdWNlZCBmcm9tIDUxMk1CXG4gICAgICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogNSwgLy8gQmFja2dyb3VuZCBxdWV1ZSBwcm9jZXNzaW5nXG4gICAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5zdGFja0Vudmlyb25tZW50LFxuICAgICAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIE9QRU5BSV9BUElfS0VZOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSB8fCBcIlwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgICAgLy8gQ29ubmVjdCBTUVMgcXVldWUgdG8gYmFja2dyb3VuZCBub3JtYWxpemVyIExhbWJkYVxuICAgICAgdGhpcy5fYmFja2dyb3VuZE5vcm1hbGl6ZXJGdW5jdGlvbi5hZGRFdmVudFNvdXJjZShcbiAgICAgICAgbmV3IGxhbWJkYUV2ZW50U291cmNlcy5TcXNFdmVudFNvdXJjZSh0aGlzLnJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZSwge1xuICAgICAgICAgIGJhdGNoU2l6ZTogMSwgLy8gUHJvY2VzcyBvbmUgcmVjaXBlIGF0IGEgdGltZVxuICAgICAgICAgIG1heEJhdGNoaW5nV2luZG93OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9iYWNrZ3JvdW5kTm9ybWFsaXplckZ1bmN0aW9uO1xuICB9XG5cbiAgcHVibGljIGdldERpYWdub3N0aWNQcm9jZXNzb3JGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5fZGlhZ25vc3RpY1Byb2Nlc3NvckZ1bmN0aW9uKSB7XG4gICAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiRGlhZ25vc3RpY1Byb2Nlc3NvckZ1bmN0aW9uTG9nR3JvdXBcIiwge1xuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fZGlhZ25vc3RpY1Byb2Nlc3NvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJEaWFnbm9zdGljUHJvY2Vzc29yRnVuY3Rpb25cIixcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgICAgIFwiLi4vZnVuY3Rpb25zL2Rpc3QvZGlhZ25vc3RpYy1wcm9jZXNzb3ItcGFja2FnZVwiXG4gICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksIC8vIExvbmdlciB0aW1lb3V0IGZvciBTMyBhbmFseXNpc1xuICAgICAgICAgIG1lbW9yeVNpemU6IDEwMjQsIC8vIE1vcmUgbWVtb3J5IGZvciBwcm9jZXNzaW5nIGRpYWdub3N0aWMgZGF0YVxuICAgICAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDIsIC8vIExvdy1mcmVxdWVuY3kgZnVuY3Rpb25cbiAgICAgICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIEVOVklST05NRU5UOiB0aGlzLnN0YWNrRW52aXJvbm1lbnQsXG4gICAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByb2xlOiB0aGlzLmxhbWJkYVJvbGUsXG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9kaWFnbm9zdGljUHJvY2Vzc29yRnVuY3Rpb247XG4gIH1cblxuICBwdWJsaWMgZ2V0SW52aXRhdGlvbk1hbmFnZXJGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5faW52aXRhdGlvbk1hbmFnZXJGdW5jdGlvbikge1xuICAgICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBcIkludml0YXRpb25NYW5hZ2VyRnVuY3Rpb25Mb2dHcm91cFwiLCB7XG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9pbnZpdGF0aW9uTWFuYWdlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJJbnZpdGF0aW9uTWFuYWdlckZ1bmN0aW9uXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogXCJib290c3RyYXBcIixcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgICAgICBcIi4uL2Z1bmN0aW9ucy9kaXN0L2ludml0YXRpb24tbWFuYWdlci1wYWNrYWdlXCJcbiAgICAgICAgICApLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsIC8vIE9wdGltaXplZDogbG93LWZyZXF1ZW5jeSBhZG1pbiBvcGVyYXRpb25zXG4gICAgICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMywgLy8gTG93LWZyZXF1ZW5jeSBmdW5jdGlvblxuICAgICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgICAgRlJPTlRFTkRfQkFTRV9VUkw6IFwiaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5faW52aXRhdGlvbk1hbmFnZXJGdW5jdGlvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRSZWdpc3RyYXRpb25IYW5kbGVyRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX3JlZ2lzdHJhdGlvbkhhbmRsZXJGdW5jdGlvbikge1xuICAgICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBcIlJlZ2lzdHJhdGlvbkhhbmRsZXJGdW5jdGlvbkxvZ0dyb3VwXCIsIHtcbiAgICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3JlZ2lzdHJhdGlvbkhhbmRsZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiUmVnaXN0cmF0aW9uSGFuZGxlckZ1bmN0aW9uXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogXCJib290c3RyYXBcIixcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgICAgICBcIi4uL2Z1bmN0aW9ucy9kaXN0L3JlZ2lzdHJhdGlvbi1oYW5kbGVyLXBhY2thZ2VcIlxuICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDEyOCwgLy8gT3B0aW1pemVkOiBsb3ctZnJlcXVlbmN5IHJlZ2lzdHJhdGlvbiBvcGVyYXRpb25zXG4gICAgICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMywgLy8gTG93LWZyZXF1ZW5jeSBmdW5jdGlvblxuICAgICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgICAgQ09HTklUT19DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdHJhdGlvbkhhbmRsZXJGdW5jdGlvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRBbmFseXRpY3NGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5fYW5hbHl0aWNzRnVuY3Rpb24pIHtcbiAgICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgXCJBbmFseXRpY3NGdW5jdGlvbkxvZ0dyb3VwXCIsIHtcbiAgICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuVFdPX1dFRUtTLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX2FuYWx5dGljc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJSZWNpcGVBbmFseXRpY3NBZ2dyZWdhdG9yXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogXCJib290c3RyYXBcIixcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgICAgICBcIi4uL2Z1bmN0aW9ucy9kaXN0L2FuYWx5dGljcy1hZ2dyZWdhdG9yLXBhY2thZ2VcIlxuICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgIG1lbW9yeVNpemU6IDEyOCwgLy8gT3B0aW1pemVkOiBzaW1wbGUgUzMgcmVhZC93cml0ZSBvcGVyYXRpb25zXG4gICAgICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogNSwgLy8gTWVkaXVtLWZyZXF1ZW5jeSBmdW5jdGlvblxuICAgICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fYW5hbHl0aWNzRnVuY3Rpb247XG4gIH1cblxuICBwdWJsaWMgZ2V0QmFja3VwRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMuX2JhY2t1cEZ1bmN0aW9uKSB7XG4gICAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiQmFja3VwRnVuY3Rpb25Mb2dHcm91cFwiLCB7XG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9iYWNrdXBGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiQmFja3VwRnVuY3Rpb25cIixcbiAgICAgICAge1xuICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Z1bmN0aW9ucy9kaXN0L2JhY2t1cC1wYWNrYWdlXCIpLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSwgLy8gQmFja3VwIG9wZXJhdGlvbnMgbWF5IHRha2UgdGltZVxuICAgICAgICAgIG1lbW9yeVNpemU6IDI1NiwgLy8gSGlnaGVyIG1lbW9yeSBmb3IgWklQIGNvbXByZXNzaW9uXG4gICAgICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMywgLy8gTG93LWZyZXF1ZW5jeSB1c2VyLWluaXRpYXRlZCBmdW5jdGlvblxuICAgICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fYmFja3VwRnVuY3Rpb247XG4gIH1cblxuICBwdWJsaWMgZ2V0RGlhZ25vc3RpY3NNb2JpbGVTaGFyZUZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLl9kaWFnbm9zdGljc01vYmlsZVNoYXJlRnVuY3Rpb24pIHtcbiAgICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgXCJEaWFnbm9zdGljc01vYmlsZVNoYXJlRnVuY3Rpb25Mb2dHcm91cFwiLCB7XG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX2RpYWdub3N0aWNzTW9iaWxlU2hhcmVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiRGlhZ25vc3RpY3NNb2JpbGVTaGFyZUZ1bmN0aW9uXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgICAgaGFuZGxlcjogXCJib290c3RyYXBcIixcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgICAgICBcIi4uL2Z1bmN0aW9ucy9kaXN0L2RpYWdub3N0aWNzLW1vYmlsZS1zaGFyZS1wYWNrYWdlXCJcbiAgICAgICAgICApLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsIC8vIFNpbXBsZSB0ZWxlbWV0cnkgY29sbGVjdGlvblxuICAgICAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDUsIC8vIE1lZGl1bS1mcmVxdWVuY3kgZGlhZ25vc3RpYyBmdW5jdGlvblxuICAgICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuc3RhY2tFbnZpcm9ubWVudCxcbiAgICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcm9sZTogdGhpcy5sYW1iZGFSb2xlLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZGlhZ25vc3RpY3NNb2JpbGVTaGFyZUZ1bmN0aW9uO1xuICB9XG59XG4iXX0=