"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeArchiveSecureStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const s3 = require("aws-cdk-lib/aws-s3");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const iam = require("aws-cdk-lib/aws-iam");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const sns = require("aws-cdk-lib/aws-sns");
const snsSubscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
const cloudwatchActions = require("aws-cdk-lib/aws-cloudwatch-actions");
const budgets = require("aws-cdk-lib/aws-budgets");
const sqs = require("aws-cdk-lib/aws-sqs");
const crypto = require("crypto");
class RecipeArchiveSecureStack extends cdk.Stack {
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
        // Primary Storage Bucket with secure random name (matching original retention policies)
        this.storageBucket = new s3.Bucket(this, "SecureStorageBucket", {
            bucketName: `recipe-storage-${secureId}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: props.environment === "prod",
            lifecycleRules: [
                {
                    id: "delete-incomplete-uploads",
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
                },
                // Environment-specific retention policies (matching original)
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
        // Temporary/Processing Bucket with secure random name (matching original policies)
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
        // Failed Parsing Storage Bucket with secure random name (matching original policies)
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
        // IAM Role for Lambda Functions with secure naming
        const lambdaRole = new iam.Role(this, "SecureLambdaRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            roleName: `recipe-lambda-role-${secureId}`,
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
                                "s3:GetObjectAttributes",
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
                                "cognito-idp:AdminGetUser",
                                "cognito-idp:AdminCreateUser",
                                "cognito-idp:AdminSetUserPassword",
                                "cognito-idp:AdminListGroupsForUser",
                            ],
                            resources: [this.userPool.userPoolArn],
                        }),
                    ],
                }),
            },
        });
        // SQS Queue for async recipe normalization with secure naming
        const recipeNormalizationQueue = new sqs.Queue(this, "SecureNormalizationQueue", {
            queueName: `recipe-normalize-${secureId}`,
            visibilityTimeout: cdk.Duration.seconds(60),
            retentionPeriod: cdk.Duration.days(14),
            deadLetterQueue: {
                queue: new sqs.Queue(this, "SecureNormalizationDLQ", {
                    queueName: `recipe-normalize-dlq-${secureId}`,
                    retentionPeriod: cdk.Duration.days(14),
                }),
                maxReceiveCount: 3,
            },
        });
        // Lambda Functions with secure naming and environment variables
        const healthFunction = new lambda.Function(this, "SecureHealthFunction", {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: "bootstrap",
            code: lambda.Code.fromAsset("../functions/dist/health-package"),
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
        const recipesFunction = new lambda.Function(this, "SecureRecipesFunction", {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: "bootstrap",
            code: lambda.Code.fromAsset("../functions/dist/recipes-package"),
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
        this.api = new apigateway.RestApi(this, "SecureAPI", {
            restApiName: `recipe-api-${secureId}`,
            description: "RecipeArchive Secure Backend API",
            defaultCorsPreflightOptions: {
                allowOrigins: ["https://localhost:3000", "https://recipearchive.com"],
                allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allowHeaders: [
                    "Content-Type",
                    "Authorization",
                    "X-Amz-Date",
                    "X-Api-Key",
                    "X-Amz-Security-Token",
                ],
                allowCredentials: true,
            },
            deployOptions: {
                stageName: "prod",
            },
        });
        // Usage Plan with Rate Limiting for DDoS Protection (added after deployment)
        // Note: This will be added after the API deployment to avoid circular dependency
        // Cognito Authorizer for secure authentication
        const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "SecureCognitoAuthorizer", {
            cognitoUserPools: [this.userPool],
            authorizerName: `recipe-cognito-auth-${secureId}`,
            resultsCacheTtl: cdk.Duration.minutes(5),
        });
        // Request Validator for input validation
        const requestValidator = new apigateway.RequestValidator(this, "SecureRequestValidator", {
            restApi: this.api,
            requestValidatorName: `recipe-validator-${secureId}`,
            validateRequestBody: true,
            validateRequestParameters: true,
        });
        // API Gateway Integrations and Resources
        const healthIntegration = new apigateway.LambdaIntegration(healthFunction, {
            requestTemplates: { "application/json": "{ \"statusCode\": \"200\" }" },
        });
        // API Resources
        const healthResource = this.api.root.addResource("health");
        healthResource.addMethod("GET", healthIntegration);
        const v1 = this.api.root.addResource("v1");
        const recipesResource = v1.addResource("recipes");
        const recipesIntegration = new apigateway.LambdaIntegration(recipesFunction);
        // Recipe CRUD operations with Authentication
        recipesResource.addMethod("GET", recipesIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
        recipesResource.addMethod("POST", recipesIntegration, {
            authorizer: cognitoAuthorizer,
            requestValidator: requestValidator,
        });
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
        // Update Lambda functions with new API Gateway URL
        recipesFunction.addEnvironment("API_GATEWAY_URL", this.api.url);
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
        new cdk.CfnOutput(this, "SecureApiGatewayUrl", {
            value: this.api.url,
            description: "Secure API Gateway URL",
        });
        new cdk.CfnOutput(this, "SecureApiGatewayId", {
            value: this.api.restApiId,
            description: "Secure API Gateway ID",
        });
        // CloudWatch Alarms for monitoring
        const apiGateway4xxAlarm = new cloudwatch.Alarm(this, "SecureApiGateway4xxAlarm", {
            alarmName: `recipe-api-4xx-errors-${secureId}`,
            metric: this.api.metricClientError(),
            threshold: 10,
            evaluationPeriods: 2,
            datapointsToAlarm: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        const apiGateway5xxAlarm = new cloudwatch.Alarm(this, "SecureApiGateway5xxAlarm", {
            alarmName: `recipe-api-5xx-errors-${secureId}`,
            metric: this.api.metricServerError(),
            threshold: 5,
            evaluationPeriods: 2,
            datapointsToAlarm: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // SNS Topic for billing alerts
        this.billingAlertTopic = new sns.Topic(this, "SecureBillingAlertTopic", {
            topicName: `recipe-billing-alerts-${secureId}`,
            displayName: "RecipeArchive Billing Alerts",
        });
        // Email subscription for billing alerts
        this.billingAlertTopic.addSubscription(new snsSubscriptions.EmailSubscription(props.adminEmail));
        // Connect alarms to SNS topic
        apiGateway4xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.billingAlertTopic));
        apiGateway5xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.billingAlertTopic));
        // Budget for cost control
        new budgets.CfnBudget(this, "SecureMonthlyBudget", {
            budget: {
                budgetName: `recipe-monthly-budget-${secureId}`,
                budgetLimit: {
                    amount: 50,
                    unit: "USD",
                },
                timeUnit: "MONTHLY",
                budgetType: "COST",
                costFilters: {
                    TagKey: ["Project"],
                    TagValue: [`RecipeArchive-${secureId}`],
                },
            },
            notificationsWithSubscribers: [
                {
                    notification: {
                        notificationType: "ACTUAL",
                        comparisonOperator: "GREATER_THAN",
                        threshold: 80,
                        thresholdType: "PERCENTAGE",
                    },
                    subscribers: [
                        {
                            subscriptionType: "EMAIL",
                            address: props.adminEmail,
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
                            subscriptionType: "EMAIL",
                            address: props.adminEmail,
                        },
                    ],
                },
            ],
        });
        // Add tags to all resources for cost tracking
        cdk.Tags.of(this).add("Project", `RecipeArchive-${secureId}`);
        cdk.Tags.of(this).add("Environment", props.environment);
        cdk.Tags.of(this).add("SecureStack", "true");
        cdk.Tags.of(this).add("CreatedBy", "RecipeArchive-Secure-CDK");
    }
}
exports.RecipeArchiveSecureStack = RecipeArchiveSecureStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtc2VjdXJlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmVjaXBlLWFyY2hpdmUtc2VjdXJlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyxtREFBbUQ7QUFDbkQseUNBQXlDO0FBQ3pDLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsMkNBQTJDO0FBQzNDLHlEQUF5RDtBQUN6RCwyQ0FBMkM7QUFDM0Msc0VBQXNFO0FBQ3RFLHdFQUF3RTtBQUN4RSxtREFBbUQ7QUFDbkQsMkNBQTJDO0FBRTNDLGlDQUFpQztBQU9qQyxNQUFhLHdCQUF5QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBU3JELFlBQ0UsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLEtBQW9DO1FBRXBDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtEQUFrRDtRQUNsRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV2RCx3REFBd0Q7UUFDeEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELFlBQVksRUFBRSxnQkFBZ0IsUUFBUSxFQUFFO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELGtCQUFrQixFQUFFO2dCQUNsQixLQUFLLEVBQUU7b0JBQ0wsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULFFBQVEsRUFBRSxLQUFLO29CQUNmLE9BQU8sRUFBRSxJQUFJO2lCQUNk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LFNBQVMsRUFBRSxpQkFBaUIsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUM5RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztJQUNqRSxDQUFDO0NBQ0Y7QUFuZkQsNERBbWZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hBY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgYnVkZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYnVkZ2V0cyc7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBsYW1iZGFFdmVudFNvdXJjZXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzJztcbmltcG9ydCAqIGFzIGNyeXB0byBmcm9tICdjcnlwdG8nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlY2lwZUFyY2hpdmVTZWN1cmVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBhZG1pbkVtYWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWNpcGVBcmNoaXZlU2VjdXJlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IHN0b3JhZ2VCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHRlbXBCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGZhaWxlZFBhcnNpbmdCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgYmlsbGluZ0FsZXJ0VG9waWM6IHNucy5Ub3BpYztcblxuICBjb25zdHJ1Y3RvcihcbiAgICBzY29wZTogQ29uc3RydWN0LFxuICAgIGlkOiBzdHJpbmcsXG4gICAgcHJvcHM6IFJlY2lwZUFyY2hpdmVTZWN1cmVTdGFja1Byb3BzXG4gICkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gR2VuZXJhdGUgc2VjdXJlIHJhbmRvbSBzdWZmaXggZm9yIGFsbCByZXNvdXJjZXNcbiAgICBjb25zdCBzZWN1cmVJZCA9IGNyeXB0by5yYW5kb21CeXRlcyg4KS50b1N0cmluZygnaGV4Jyk7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCBmb3IgQXV0aGVudGljYXRpb24gd2l0aCBzZWN1cmUgbmFtZVxuICAgIHRoaXMudXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnU2VjdXJlVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGByZWNpcGUtdXNlcnMtJHtzZWN1cmVJZH1gLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGZhbWlseU5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGhvbmVOdW1iZXI6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG1mYTogY29nbml0by5NZmEuT1BUSU9OQUwsXG4gICAgICBtZmFTZWNvbmRGYWN0b3I6IHtcbiAgICAgICAgc21zOiB0cnVlLFxuICAgICAgICBvdHA6IHRydWUsXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IHdpdGggc2VjdXJlIG5hbWVcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQoXG4gICAgICB0aGlzLFxuICAgICAgJ1NlY3VyZVVzZXJQb29sQ2xpZW50JyxcbiAgICAgIHtcbiAgICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogYHJlY2lwZS1jbGllbnQtJHtzZWN1cmVJZH1gLFxuICAgICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIFB1YmxpYyBjbGllbnQgZm9yIGJyb3dzZXIvbW9iaWxlIGFwcHNcbiAgICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgICAgY3VzdG9tOiBmYWxzZSxcbiAgICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIG9BdXRoOiB7XG4gICAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICByZWZyZXNoVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICBlbmFibGVUb2tlblJldm9jYXRpb246IHRydWUsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFByaW1hcnkgU3RvcmFnZSBCdWNrZXQgd2l0aCBzZWN1cmUgcmFuZG9tIG5hbWUgKG1hdGNoaW5nIG9yaWdpbmFsIHJldGVudGlvbiBwb2xpY2llcylcbiAgICB0aGlzLnN0b3JhZ2VCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTZWN1cmVTdG9yYWdlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHJlY2lwZS1zdG9yYWdlLSR7c2VjdXJlSWR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnZGVsZXRlLWluY29tcGxldGUtdXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICAvLyBFbnZpcm9ubWVudC1zcGVjaWZpYyByZXRlbnRpb24gcG9saWNpZXMgKG1hdGNoaW5nIG9yaWdpbmFsKVxuICAgICAgICAuLi4ocHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICdhcmNoaXZlLW9sZC1maWxlcycsXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMjU1NSksIC8vIDcgeWVhcnMgZm9yIHByb2R1Y3Rpb25cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAnYXJjaGl2ZS1vbGQtdmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uRXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF1cbiAgICAgICAgICA6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIFNUUklDVCAxNC1EQVkgUkVURU5USU9OIEZPUiBQUkUtUFJPRCBURVNUSU5HXG4gICAgICAgICAgICAgICAgaWQ6ICdkZWxldGUtdGVzdC1kYXRhJyxcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgXSxcbiAgICAgIHJlbW92YWxQb2xpY3k6XG4gICAgICAgIHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCdcbiAgICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTlxuICAgICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFRlbXBvcmFyeS9Qcm9jZXNzaW5nIEJ1Y2tldCB3aXRoIHNlY3VyZSByYW5kb20gbmFtZSAobWF0Y2hpbmcgb3JpZ2luYWwgcG9saWNpZXMpXG4gICAgdGhpcy50ZW1wQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnU2VjdXJlVGVtcEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGUtdGVtcC0ke3NlY3VyZUlkfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIE5ldmVyIHZlcnNpb24gdGVtcG9yYXJ5IGZpbGVzXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdkZWxldGUtdGVtcC1maWxlcycsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMocHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDcgOiAxKSxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQWx3YXlzIGRlc3Ryb3kgdGVtcCBidWNrZXRcbiAgICB9KTtcblxuICAgIC8vIEZhaWxlZCBQYXJzaW5nIFN0b3JhZ2UgQnVja2V0IHdpdGggc2VjdXJlIHJhbmRvbSBuYW1lIChtYXRjaGluZyBvcmlnaW5hbCBwb2xpY2llcylcbiAgICB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQgPSBuZXcgczMuQnVja2V0KFxuICAgICAgdGhpcyxcbiAgICAgICdTZWN1cmVGYWlsZWRQYXJzaW5nQnVja2V0JyxcbiAgICAgIHtcbiAgICAgICAgYnVja2V0TmFtZTogYHJlY2lwZS1mYWlsZWQtJHtzZWN1cmVJZH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyBObyB2ZXJzaW9uaW5nIG5lZWRlZCBmb3IgZmFpbGVkIHBhcnNpbmcgZGF0YVxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnZGVsZXRlLWZhaWxlZC1wYXJzaW5nLWRhdGEnLFxuICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApLCAvLyBBdXRvLXB1cmdlIGFmdGVyIDMwIGRheXNcbiAgICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBBbHdheXMgc2FmZSB0byBkZXN0cm95IGZhaWxlZCBwYXJzaW5nIGRhdGFcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gSUFNIFJvbGUgZm9yIExhbWJkYSBGdW5jdGlvbnMgd2l0aCBzZWN1cmUgbmFtaW5nXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnU2VjdXJlTGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgcm9sZU5hbWU6IGByZWNpcGUtbGFtYmRhLXJvbGUtJHtzZWN1cmVJZH1gLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICAnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZSdcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBTM0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdEF0dHJpYnV0ZXMnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgIGAke3RoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIHRoaXMudGVtcEJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgYCR7dGhpcy50ZW1wQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgICAgdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgICAgICBgJHt0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5TZXRVc2VyUGFzc3dvcmQnLFxuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkxpc3RHcm91cHNGb3JVc2VyJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTUVMgUXVldWUgZm9yIGFzeW5jIHJlY2lwZSBub3JtYWxpemF0aW9uIHdpdGggc2VjdXJlIG5hbWluZ1xuICAgIGNvbnN0IHJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZSA9IG5ldyBzcXMuUXVldWUoXG4gICAgICB0aGlzLFxuICAgICAgJ1NlY3VyZU5vcm1hbGl6YXRpb25RdWV1ZScsXG4gICAgICB7XG4gICAgICAgIHF1ZXVlTmFtZTogYHJlY2lwZS1ub3JtYWxpemUtJHtzZWN1cmVJZH1gLFxuICAgICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgZGVhZExldHRlclF1ZXVlOiB7XG4gICAgICAgICAgcXVldWU6IG5ldyBzcXMuUXVldWUodGhpcywgJ1NlY3VyZU5vcm1hbGl6YXRpb25ETFEnLCB7XG4gICAgICAgICAgICBxdWV1ZU5hbWU6IGByZWNpcGUtbm9ybWFsaXplLWRscS0ke3NlY3VyZUlkfWAsXG4gICAgICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnMgd2l0aCBzZWN1cmUgbmFtaW5nIGFuZCBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBjb25zdCBoZWFsdGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1NlY3VyZUhlYWx0aEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2Z1bmN0aW9ucy9kaXN0L2hlYWx0aC1wYWNrYWdlJyksXG4gICAgICBmdW5jdGlvbk5hbWU6IGByZWNpcGUtaGVhbHRoLSR7c2VjdXJlSWR9YCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgIG1lbW9yeVNpemU6IDEyOCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19URU1QX0JVQ0tFVDogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFMzX0ZBSUxFRF9QQVJTSU5HX0JVQ0tFVDogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICB9LFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlY2lwZXNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1NlY3VyZVJlY2lwZXNGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9mdW5jdGlvbnMvZGlzdC9yZWNpcGVzLXBhY2thZ2UnKSxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYHJlY2lwZS1yZWNpcGVzLSR7c2VjdXJlSWR9YCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19URU1QX0JVQ0tFVDogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFMzX0ZBSUxFRF9QQVJTSU5HX0JVQ0tFVDogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIE5PUk1BTElaQVRJT05fUVVFVUVfVVJMOiByZWNpcGVOb3JtYWxpemF0aW9uUXVldWUucXVldWVVcmwsXG4gICAgICB9LFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IHdpdGggc2VjdXJlIG5hbWluZyBhbmQgRERvUyBwcm90ZWN0aW9uXG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdTZWN1cmVBUEknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHJlY2lwZS1hcGktJHtzZWN1cmVJZH1gLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWNpcGVBcmNoaXZlIFNlY3VyZSBCYWNrZW5kIEFQSScsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJ2h0dHBzOi8vbG9jYWxob3N0OjMwMDAnLCAnaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbSddLFxuICAgICAgICBhbGxvd01ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFVzYWdlIFBsYW4gd2l0aCBSYXRlIExpbWl0aW5nIGZvciBERG9TIFByb3RlY3Rpb24gKGFkZGVkIGFmdGVyIGRlcGxveW1lbnQpXG4gICAgLy8gTm90ZTogVGhpcyB3aWxsIGJlIGFkZGVkIGFmdGVyIHRoZSBBUEkgZGVwbG95bWVudCB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmN5XG5cbiAgICAvLyBDb2duaXRvIEF1dGhvcml6ZXIgZm9yIHNlY3VyZSBhdXRoZW50aWNhdGlvblxuICAgIGNvbnN0IGNvZ25pdG9BdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIoXG4gICAgICB0aGlzLFxuICAgICAgJ1NlY3VyZUNvZ25pdG9BdXRob3JpemVyJyxcbiAgICAgIHtcbiAgICAgICAgY29nbml0b1VzZXJQb29sczogW3RoaXMudXNlclBvb2xdLFxuICAgICAgICBhdXRob3JpemVyTmFtZTogYHJlY2lwZS1jb2duaXRvLWF1dGgtJHtzZWN1cmVJZH1gLFxuICAgICAgICByZXN1bHRzQ2FjaGVUdGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBSZXF1ZXN0IFZhbGlkYXRvciBmb3IgaW5wdXQgdmFsaWRhdGlvblxuICAgIGNvbnN0IHJlcXVlc3RWYWxpZGF0b3IgPSBuZXcgYXBpZ2F0ZXdheS5SZXF1ZXN0VmFsaWRhdG9yKFxuICAgICAgdGhpcyxcbiAgICAgICdTZWN1cmVSZXF1ZXN0VmFsaWRhdG9yJyxcbiAgICAgIHtcbiAgICAgICAgcmVzdEFwaTogdGhpcy5hcGksXG4gICAgICAgIHJlcXVlc3RWYWxpZGF0b3JOYW1lOiBgcmVjaXBlLXZhbGlkYXRvci0ke3NlY3VyZUlkfWAsXG4gICAgICAgIHZhbGlkYXRlUmVxdWVzdEJvZHk6IHRydWUsXG4gICAgICAgIHZhbGlkYXRlUmVxdWVzdFBhcmFtZXRlcnM6IHRydWUsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEFQSSBHYXRld2F5IEludGVncmF0aW9ucyBhbmQgUmVzb3VyY2VzXG4gICAgY29uc3QgaGVhbHRoSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihoZWFsdGhGdW5jdGlvbiwge1xuICAgICAgcmVxdWVzdFRlbXBsYXRlczogeyAnYXBwbGljYXRpb24vanNvbic6ICd7IFwic3RhdHVzQ29kZVwiOiBcIjIwMFwiIH0nIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgUmVzb3VyY2VzXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdoZWFsdGgnKTtcbiAgICBoZWFsdGhSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGhlYWx0aEludGVncmF0aW9uKTtcblxuICAgIGNvbnN0IHYxID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgndjEnKTtcbiAgICBjb25zdCByZWNpcGVzUmVzb3VyY2UgPSB2MS5hZGRSZXNvdXJjZSgncmVjaXBlcycpO1xuICAgIGNvbnN0IHJlY2lwZXNJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgcmVjaXBlc0Z1bmN0aW9uXG4gICAgKTtcblxuICAgIC8vIFJlY2lwZSBDUlVEIG9wZXJhdGlvbnMgd2l0aCBBdXRoZW50aWNhdGlvblxuICAgIHJlY2lwZXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgcmVjaXBlc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVjaXBlUmVzb3VyY2UgPSByZWNpcGVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgcmVjaXBlUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgIH0pO1xuXG4gICAgLy8gVXBkYXRlIExhbWJkYSBmdW5jdGlvbnMgd2l0aCBuZXcgQVBJIEdhdGV3YXkgVVJMXG4gICAgcmVjaXBlc0Z1bmN0aW9uLmFkZEVudmlyb25tZW50KCdBUElfR0FURVdBWV9VUkwnLCB0aGlzLmFwaS51cmwpO1xuXG4gICAgLy8gT3V0cHV0IHNlY3VyZSByZXNvdXJjZSBpZGVudGlmaWVyc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIENvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIENvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlU3RvcmFnZUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBTMyBTdG9yYWdlIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVUZW1wQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnRlbXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIFMzIFRlbXBvcmFyeSBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlRmFpbGVkUGFyc2luZ0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBTMyBGYWlsZWQgUGFyc2luZyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlUmFuZG9tSWQnLCB7XG4gICAgICB2YWx1ZTogc2VjdXJlSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyZSBSYW5kb20gSUQgdXNlZCBmb3IgcmVzb3VyY2UgbmFtaW5nJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVBcGlHYXRld2F5VXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIEFQSSBHYXRld2F5IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJlQXBpR2F0ZXdheUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJlIEFQSSBHYXRld2F5IElEJyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggQWxhcm1zIGZvciBtb25pdG9yaW5nXG4gICAgY29uc3QgYXBpR2F0ZXdheTR4eEFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ1NlY3VyZUFwaUdhdGV3YXk0eHhBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogYHJlY2lwZS1hcGktNHh4LWVycm9ycy0ke3NlY3VyZUlkfWAsXG4gICAgICAgIG1ldHJpYzogdGhpcy5hcGkubWV0cmljQ2xpZW50RXJyb3IoKSxcbiAgICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgIGRhdGFwb2ludHNUb0FsYXJtOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgYXBpR2F0ZXdheTV4eEFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ1NlY3VyZUFwaUdhdGV3YXk1eHhBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogYHJlY2lwZS1hcGktNXh4LWVycm9ycy0ke3NlY3VyZUlkfWAsXG4gICAgICAgIG1ldHJpYzogdGhpcy5hcGkubWV0cmljU2VydmVyRXJyb3IoKSxcbiAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgZGF0YXBvaW50c1RvQWxhcm06IDEsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBTTlMgVG9waWMgZm9yIGJpbGxpbmcgYWxlcnRzXG4gICAgdGhpcy5iaWxsaW5nQWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1NlY3VyZUJpbGxpbmdBbGVydFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgcmVjaXBlLWJpbGxpbmctYWxlcnRzLSR7c2VjdXJlSWR9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnUmVjaXBlQXJjaGl2ZSBCaWxsaW5nIEFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICAvLyBFbWFpbCBzdWJzY3JpcHRpb24gZm9yIGJpbGxpbmcgYWxlcnRzXG4gICAgdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc25zU3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbihwcm9wcy5hZG1pbkVtYWlsKVxuICAgICk7XG5cbiAgICAvLyBDb25uZWN0IGFsYXJtcyB0byBTTlMgdG9waWNcbiAgICBhcGlHYXRld2F5NHh4QWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMpXG4gICAgKTtcbiAgICBhcGlHYXRld2F5NXh4QWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIEJ1ZGdldCBmb3IgY29zdCBjb250cm9sXG4gICAgbmV3IGJ1ZGdldHMuQ2ZuQnVkZ2V0KHRoaXMsICdTZWN1cmVNb250aGx5QnVkZ2V0Jywge1xuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIGJ1ZGdldE5hbWU6IGByZWNpcGUtbW9udGhseS1idWRnZXQtJHtzZWN1cmVJZH1gLFxuICAgICAgICBidWRnZXRMaW1pdDoge1xuICAgICAgICAgIGFtb3VudDogNTAsXG4gICAgICAgICAgdW5pdDogJ1VTRCcsXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVVbml0OiAnTU9OVEhMWScsXG4gICAgICAgIGJ1ZGdldFR5cGU6ICdDT1NUJyxcbiAgICAgICAgY29zdEZpbHRlcnM6IHtcbiAgICAgICAgICBUYWdLZXk6IFsnUHJvamVjdCddLFxuICAgICAgICAgIFRhZ1ZhbHVlOiBbYFJlY2lwZUFyY2hpdmUtJHtzZWN1cmVJZH1gXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBub3RpZmljYXRpb25zV2l0aFN1YnNjcmliZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6ICdBQ1RVQUwnLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogODAsXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiAnUEVSQ0VOVEFHRScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiAnRU1BSUwnLFxuICAgICAgICAgICAgICBhZGRyZXNzOiBwcm9wcy5hZG1pbkVtYWlsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnRk9SRUNBU1RFRCcsXG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6ICdHUkVBVEVSX1RIQU4nLFxuICAgICAgICAgICAgdGhyZXNob2xkOiAxMDAsXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiAnUEVSQ0VOVEFHRScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiAnRU1BSUwnLFxuICAgICAgICAgICAgICBhZGRyZXNzOiBwcm9wcy5hZG1pbkVtYWlsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIHRvIGFsbCByZXNvdXJjZXMgZm9yIGNvc3QgdHJhY2tpbmdcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCBgUmVjaXBlQXJjaGl2ZS0ke3NlY3VyZUlkfWApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZWN1cmVTdGFjaycsICd0cnVlJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDcmVhdGVkQnknLCAnUmVjaXBlQXJjaGl2ZS1TZWN1cmUtQ0RLJyk7XG4gIH1cbn1cbiJdfQ==