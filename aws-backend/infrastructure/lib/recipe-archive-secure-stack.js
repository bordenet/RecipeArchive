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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtc2VjdXJlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmVjaXBlLWFyY2hpdmUtc2VjdXJlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyxtREFBbUQ7QUFDbkQseUNBQXlDO0FBQ3pDLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsMkNBQTJDO0FBQzNDLHlEQUF5RDtBQUN6RCwyQ0FBMkM7QUFDM0Msc0VBQXNFO0FBQ3RFLHdFQUF3RTtBQUN4RSxtREFBbUQ7QUFDbkQsMkNBQTJDO0FBRTNDLGlDQUFpQztBQU9qQyxNQUFhLHdCQUF5QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBU3JELFlBQ0UsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLEtBQW9DO1FBRXBDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtEQUFrRDtRQUNsRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV2RCx3REFBd0Q7UUFDeEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELFlBQVksRUFBRSxnQkFBZ0IsUUFBUSxFQUFFO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELGtCQUFrQixFQUFFO2dCQUNsQixLQUFLLEVBQUU7b0JBQ0wsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULFFBQVEsRUFBRSxLQUFLO29CQUNmLE9BQU8sRUFBRSxJQUFJO2lCQUNk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LFNBQVMsRUFBRSxpQkFBaUIsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUM5RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztJQUNqRSxDQUFDO0NBQ0Y7QUFuZkQsNERBbWZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSBcImF3cy1jZGstbGliL2F3cy1jb2duaXRvXCI7XG5pbXBvcnQgKiBhcyBzMyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXMzXCI7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSBcImF3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoXCI7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnNcIjtcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9uc1wiO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaEFjdGlvbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnNcIjtcbmltcG9ydCAqIGFzIGJ1ZGdldHMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1idWRnZXRzXCI7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zcXNcIjtcbmltcG9ydCAqIGFzIF9sYW1iZGFFdmVudFNvdXJjZXMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlc1wiO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcblxuZXhwb3J0IGludGVyZmFjZSBSZWNpcGVBcmNoaXZlU2VjdXJlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgYWRtaW5FbWFpbDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgUmVjaXBlQXJjaGl2ZVNlY3VyZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSBzdG9yYWdlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSB0ZW1wQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBmYWlsZWRQYXJzaW5nQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IGJpbGxpbmdBbGVydFRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgc2NvcGU6IENvbnN0cnVjdCxcbiAgICBpZDogc3RyaW5nLFxuICAgIHByb3BzOiBSZWNpcGVBcmNoaXZlU2VjdXJlU3RhY2tQcm9wc1xuICApIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIEdlbmVyYXRlIHNlY3VyZSByYW5kb20gc3VmZml4IGZvciBhbGwgcmVzb3VyY2VzXG4gICAgY29uc3Qgc2VjdXJlSWQgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoOCkudG9TdHJpbmcoXCJoZXhcIik7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCBmb3IgQXV0aGVudGljYXRpb24gd2l0aCBzZWN1cmUgbmFtZVxuICAgIHRoaXMudXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCBcIlNlY3VyZVVzZXJQb29sXCIsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogYHJlY2lwZS11c2Vycy0ke3NlY3VyZUlkfWAsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBwaG9uZU51bWJlcjoge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHRydWUsXG4gICAgICB9LFxuICAgICAgbWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcbiAgICAgIG1mYVNlY29uZEZhY3Rvcjoge1xuICAgICAgICBzbXM6IHRydWUsXG4gICAgICAgIG90cDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgd2l0aCBzZWN1cmUgbmFtZVxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudChcbiAgICAgIHRoaXMsXG4gICAgICBcIlNlY3VyZVVzZXJQb29sQ2xpZW50XCIsXG4gICAgICB7XG4gICAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGByZWNpcGUtY2xpZW50LSR7c2VjdXJlSWR9YCxcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLCAvLyBQdWJsaWMgY2xpZW50IGZvciBicm93c2VyL21vYmlsZSBhcHBzXG4gICAgICAgIGF1dGhGbG93czoge1xuICAgICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgICAgIGN1c3RvbTogZmFsc2UsXG4gICAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBvQXV0aDoge1xuICAgICAgICAgIGZsb3dzOiB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELFxuICAgICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLFxuICAgICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEUsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgYWNjZXNzVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICBpZFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgZW5hYmxlVG9rZW5SZXZvY2F0aW9uOiB0cnVlLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBQcmltYXJ5IFN0b3JhZ2UgQnVja2V0IHdpdGggc2VjdXJlIHJhbmRvbSBuYW1lIChtYXRjaGluZyBvcmlnaW5hbCByZXRlbnRpb24gcG9saWNpZXMpXG4gICAgdGhpcy5zdG9yYWdlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIlNlY3VyZVN0b3JhZ2VCdWNrZXRcIiwge1xuICAgICAgYnVja2V0TmFtZTogYHJlY2lwZS1zdG9yYWdlLSR7c2VjdXJlSWR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gXCJwcm9kXCIsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiZGVsZXRlLWluY29tcGxldGUtdXBsb2Fkc1wiLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgcmV0ZW50aW9uIHBvbGljaWVzIChtYXRjaGluZyBvcmlnaW5hbClcbiAgICAgICAgLi4uKHByb3BzLmVudmlyb25tZW50ID09PSBcInByb2RcIlxuICAgICAgICAgID8gW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6IFwiYXJjaGl2ZS1vbGQtZmlsZXNcIixcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygyNTU1KSwgLy8gNyB5ZWFycyBmb3IgcHJvZHVjdGlvblxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6IFwiYXJjaGl2ZS1vbGQtdmVyc2lvbnNcIixcbiAgICAgICAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdXG4gICAgICAgICAgOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBTVFJJQ1QgMTQtREFZIFJFVEVOVElPTiBGT1IgUFJFLVBST0QgVEVTVElOR1xuICAgICAgICAgICAgICAgIGlkOiBcImRlbGV0ZS10ZXN0LWRhdGFcIixcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgXSxcbiAgICAgIHJlbW92YWxQb2xpY3k6XG4gICAgICAgIHByb3BzLmVudmlyb25tZW50ID09PSBcInByb2RcIlxuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gVGVtcG9yYXJ5L1Byb2Nlc3NpbmcgQnVja2V0IHdpdGggc2VjdXJlIHJhbmRvbSBuYW1lIChtYXRjaGluZyBvcmlnaW5hbCBwb2xpY2llcylcbiAgICB0aGlzLnRlbXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiU2VjdXJlVGVtcEJ1Y2tldFwiLCB7XG4gICAgICBidWNrZXROYW1lOiBgcmVjaXBlLXRlbXAtJHtzZWN1cmVJZH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyBOZXZlciB2ZXJzaW9uIHRlbXBvcmFyeSBmaWxlc1xuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcImRlbGV0ZS10ZW1wLWZpbGVzXCIsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMocHJvcHMuZW52aXJvbm1lbnQgPT09IFwicHJvZFwiID8gNyA6IDEpLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBBbHdheXMgZGVzdHJveSB0ZW1wIGJ1Y2tldFxuICAgIH0pO1xuXG4gICAgLy8gRmFpbGVkIFBhcnNpbmcgU3RvcmFnZSBCdWNrZXQgd2l0aCBzZWN1cmUgcmFuZG9tIG5hbWUgKG1hdGNoaW5nIG9yaWdpbmFsIHBvbGljaWVzKVxuICAgIHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQoXG4gICAgICB0aGlzLFxuICAgICAgXCJTZWN1cmVGYWlsZWRQYXJzaW5nQnVja2V0XCIsXG4gICAgICB7XG4gICAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGUtZmFpbGVkLSR7c2VjdXJlSWR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgICAgdmVyc2lvbmVkOiBmYWxzZSwgLy8gTm8gdmVyc2lvbmluZyBuZWVkZWQgZm9yIGZhaWxlZCBwYXJzaW5nIGRhdGFcbiAgICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogXCJkZWxldGUtZmFpbGVkLXBhcnNpbmctZGF0YVwiLFxuICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApLCAvLyBBdXRvLXB1cmdlIGFmdGVyIDMwIGRheXNcbiAgICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBBbHdheXMgc2FmZSB0byBkZXN0cm95IGZhaWxlZCBwYXJzaW5nIGRhdGFcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gSUFNIFJvbGUgZm9yIExhbWJkYSBGdW5jdGlvbnMgd2l0aCBzZWN1cmUgbmFtaW5nXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIlNlY3VyZUxhbWJkYVJvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJsYW1iZGEuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgIHJvbGVOYW1lOiBgcmVjaXBlLWxhbWJkYS1yb2xlLSR7c2VjdXJlSWR9YCxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCJcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBTM0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcInMzOkdldE9iamVjdFwiLFxuICAgICAgICAgICAgICAgIFwiczM6UHV0T2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgXCJzMzpEZWxldGVPYmplY3RcIixcbiAgICAgICAgICAgICAgICBcInMzOkxpc3RCdWNrZXRcIixcbiAgICAgICAgICAgICAgICBcInMzOkdldE9iamVjdEF0dHJpYnV0ZXNcIixcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgICAgICBgJHt0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0QXJufS8qYCxcbiAgICAgICAgICAgICAgICB0aGlzLnRlbXBCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgIGAke3RoaXMudGVtcEJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgYCR7dGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpBZG1pbkdldFVzZXJcIixcbiAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlclwiLFxuICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5TZXRVc2VyUGFzc3dvcmRcIixcbiAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRwOkFkbWluTGlzdEdyb3Vwc0ZvclVzZXJcIixcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTUVMgUXVldWUgZm9yIGFzeW5jIHJlY2lwZSBub3JtYWxpemF0aW9uIHdpdGggc2VjdXJlIG5hbWluZ1xuICAgIGNvbnN0IHJlY2lwZU5vcm1hbGl6YXRpb25RdWV1ZSA9IG5ldyBzcXMuUXVldWUoXG4gICAgICB0aGlzLFxuICAgICAgXCJTZWN1cmVOb3JtYWxpemF0aW9uUXVldWVcIixcbiAgICAgIHtcbiAgICAgICAgcXVldWVOYW1lOiBgcmVjaXBlLW5vcm1hbGl6ZS0ke3NlY3VyZUlkfWAsXG4gICAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgICAgICBxdWV1ZTogbmV3IHNxcy5RdWV1ZSh0aGlzLCBcIlNlY3VyZU5vcm1hbGl6YXRpb25ETFFcIiwge1xuICAgICAgICAgICAgcXVldWVOYW1lOiBgcmVjaXBlLW5vcm1hbGl6ZS1kbHEtJHtzZWN1cmVJZH1gLFxuICAgICAgICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25zIHdpdGggc2VjdXJlIG5hbWluZyBhbmQgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgY29uc3QgaGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiU2VjdXJlSGVhbHRoRnVuY3Rpb25cIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgaGFuZGxlcjogXCJib290c3RyYXBcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Z1bmN0aW9ucy9kaXN0L2hlYWx0aC1wYWNrYWdlXCIpLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgcmVjaXBlLWhlYWx0aC0ke3NlY3VyZUlkfWAsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfVEVNUF9CVUNLRVQ6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19GQUlMRURfUEFSU0lOR19CVUNLRVQ6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgfSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgfSk7XG5cbiAgICBjb25zdCByZWNpcGVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiU2VjdXJlUmVjaXBlc0Z1bmN0aW9uXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgIGhhbmRsZXI6IFwiYm9vdHN0cmFwXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi9mdW5jdGlvbnMvZGlzdC9yZWNpcGVzLXBhY2thZ2VcIiksXG4gICAgICBmdW5jdGlvbk5hbWU6IGByZWNpcGUtcmVjaXBlcy0ke3NlY3VyZUlkfWAsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxNSksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfVEVNUF9CVUNLRVQ6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19GQUlMRURfUEFSU0lOR19CVUNLRVQ6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBOT1JNQUxJWkFUSU9OX1FVRVVFX1VSTDogcmVjaXBlTm9ybWFsaXphdGlvblF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgfSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSB3aXRoIHNlY3VyZSBuYW1pbmcgYW5kIEREb1MgcHJvdGVjdGlvblxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCBcIlNlY3VyZUFQSVwiLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHJlY2lwZS1hcGktJHtzZWN1cmVJZH1gLFxuICAgICAgZGVzY3JpcHRpb246IFwiUmVjaXBlQXJjaGl2ZSBTZWN1cmUgQmFja2VuZCBBUElcIixcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IFtcImh0dHBzOi8vbG9jYWxob3N0OjMwMDBcIiwgXCJodHRwczovL3JlY2lwZWFyY2hpdmUuY29tXCJdLFxuICAgICAgICBhbGxvd01ldGhvZHM6IFtcIkdFVFwiLCBcIlBPU1RcIiwgXCJQVVRcIiwgXCJERUxFVEVcIiwgXCJPUFRJT05TXCJdLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiLFxuICAgICAgICAgIFwiQXV0aG9yaXphdGlvblwiLFxuICAgICAgICAgIFwiWC1BbXotRGF0ZVwiLFxuICAgICAgICAgIFwiWC1BcGktS2V5XCIsXG4gICAgICAgICAgXCJYLUFtei1TZWN1cml0eS1Ub2tlblwiLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBcInByb2RcIixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBVc2FnZSBQbGFuIHdpdGggUmF0ZSBMaW1pdGluZyBmb3IgRERvUyBQcm90ZWN0aW9uIChhZGRlZCBhZnRlciBkZXBsb3ltZW50KVxuICAgIC8vIE5vdGU6IFRoaXMgd2lsbCBiZSBhZGRlZCBhZnRlciB0aGUgQVBJIGRlcGxveW1lbnQgdG8gYXZvaWQgY2lyY3VsYXIgZGVwZW5kZW5jeVxuXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyIGZvciBzZWN1cmUgYXV0aGVudGljYXRpb25cbiAgICBjb25zdCBjb2duaXRvQXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKFxuICAgICAgdGhpcyxcbiAgICAgIFwiU2VjdXJlQ29nbml0b0F1dGhvcml6ZXJcIixcbiAgICAgIHtcbiAgICAgICAgY29nbml0b1VzZXJQb29sczogW3RoaXMudXNlclBvb2xdLFxuICAgICAgICBhdXRob3JpemVyTmFtZTogYHJlY2lwZS1jb2duaXRvLWF1dGgtJHtzZWN1cmVJZH1gLFxuICAgICAgICByZXN1bHRzQ2FjaGVUdGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBSZXF1ZXN0IFZhbGlkYXRvciBmb3IgaW5wdXQgdmFsaWRhdGlvblxuICAgIGNvbnN0IHJlcXVlc3RWYWxpZGF0b3IgPSBuZXcgYXBpZ2F0ZXdheS5SZXF1ZXN0VmFsaWRhdG9yKFxuICAgICAgdGhpcyxcbiAgICAgIFwiU2VjdXJlUmVxdWVzdFZhbGlkYXRvclwiLFxuICAgICAge1xuICAgICAgICByZXN0QXBpOiB0aGlzLmFwaSxcbiAgICAgICAgcmVxdWVzdFZhbGlkYXRvck5hbWU6IGByZWNpcGUtdmFsaWRhdG9yLSR7c2VjdXJlSWR9YCxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogdHJ1ZSxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0UGFyYW1ldGVyczogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgSW50ZWdyYXRpb25zIGFuZCBSZXNvdXJjZXNcbiAgICBjb25zdCBoZWFsdGhJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGhlYWx0aEZ1bmN0aW9uLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7IFwiYXBwbGljYXRpb24vanNvblwiOiBcInsgXFxcInN0YXR1c0NvZGVcXFwiOiBcXFwiMjAwXFxcIiB9XCIgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSZXNvdXJjZXNcbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJoZWFsdGhcIik7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIGhlYWx0aEludGVncmF0aW9uKTtcblxuICAgIGNvbnN0IHYxID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZShcInYxXCIpO1xuICAgIGNvbnN0IHJlY2lwZXNSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKFwicmVjaXBlc1wiKTtcbiAgICBjb25zdCByZWNpcGVzSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgIHJlY2lwZXNGdW5jdGlvblxuICAgICk7XG5cbiAgICAvLyBSZWNpcGUgQ1JVRCBvcGVyYXRpb25zIHdpdGggQXV0aGVudGljYXRpb25cbiAgICByZWNpcGVzUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuXG4gICAgcmVjaXBlc1Jlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICBjb25zdCByZWNpcGVSZXNvdXJjZSA9IHJlY2lwZXNSZXNvdXJjZS5hZGRSZXNvdXJjZShcIntpZH1cIik7XG4gICAgcmVjaXBlUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoXCJQVVRcIiwgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG5cbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoXCJERUxFVEVcIiwgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIC8vIFVwZGF0ZSBMYW1iZGEgZnVuY3Rpb25zIHdpdGggbmV3IEFQSSBHYXRld2F5IFVSTFxuICAgIHJlY2lwZXNGdW5jdGlvbi5hZGRFbnZpcm9ubWVudChcIkFQSV9HQVRFV0FZX1VSTFwiLCB0aGlzLmFwaS51cmwpO1xuXG4gICAgLy8gT3V0cHV0IHNlY3VyZSByZXNvdXJjZSBpZGVudGlmaWVyc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlVXNlclBvb2xJZFwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIENvZ25pdG8gVXNlciBQb29sIElEXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlNlY3VyZVVzZXJQb29sQ2xpZW50SWRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNlY3VyZSBDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSURcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlU3RvcmFnZUJ1Y2tldE5hbWVcIiwge1xuICAgICAgdmFsdWU6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIFMzIFN0b3JhZ2UgQnVja2V0IE5hbWVcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlVGVtcEJ1Y2tldE5hbWVcIiwge1xuICAgICAgdmFsdWU6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIFMzIFRlbXBvcmFyeSBCdWNrZXQgTmFtZVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVGYWlsZWRQYXJzaW5nQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgUzMgRmFpbGVkIFBhcnNpbmcgQnVja2V0IE5hbWVcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlUmFuZG9tSWRcIiwge1xuICAgICAgdmFsdWU6IHNlY3VyZUlkLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIFJhbmRvbSBJRCB1c2VkIGZvciByZXNvdXJjZSBuYW1pbmdcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlQXBpR2F0ZXdheVVybFwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIEFQSSBHYXRld2F5IFVSTFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVBcGlHYXRld2F5SWRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNlY3VyZSBBUEkgR2F0ZXdheSBJRFwiLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBBbGFybXMgZm9yIG1vbml0b3JpbmdcbiAgICBjb25zdCBhcGlHYXRld2F5NHh4QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICBcIlNlY3VyZUFwaUdhdGV3YXk0eHhBbGFybVwiLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6IGByZWNpcGUtYXBpLTR4eC1lcnJvcnMtJHtzZWN1cmVJZH1gLFxuICAgICAgICBtZXRyaWM6IHRoaXMuYXBpLm1ldHJpY0NsaWVudEVycm9yKCksXG4gICAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICBkYXRhcG9pbnRzVG9BbGFybTogMSxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGFwaUdhdGV3YXk1eHhBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgdGhpcyxcbiAgICAgIFwiU2VjdXJlQXBpR2F0ZXdheTV4eEFsYXJtXCIsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogYHJlY2lwZS1hcGktNXh4LWVycm9ycy0ke3NlY3VyZUlkfWAsXG4gICAgICAgIG1ldHJpYzogdGhpcy5hcGkubWV0cmljU2VydmVyRXJyb3IoKSxcbiAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgZGF0YXBvaW50c1RvQWxhcm06IDEsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBTTlMgVG9waWMgZm9yIGJpbGxpbmcgYWxlcnRzXG4gICAgdGhpcy5iaWxsaW5nQWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgXCJTZWN1cmVCaWxsaW5nQWxlcnRUb3BpY1wiLCB7XG4gICAgICB0b3BpY05hbWU6IGByZWNpcGUtYmlsbGluZy1hbGVydHMtJHtzZWN1cmVJZH1gLFxuICAgICAgZGlzcGxheU5hbWU6IFwiUmVjaXBlQXJjaGl2ZSBCaWxsaW5nIEFsZXJ0c1wiLFxuICAgIH0pO1xuXG4gICAgLy8gRW1haWwgc3Vic2NyaXB0aW9uIGZvciBiaWxsaW5nIGFsZXJ0c1xuICAgIHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24ocHJvcHMuYWRtaW5FbWFpbClcbiAgICApO1xuXG4gICAgLy8gQ29ubmVjdCBhbGFybXMgdG8gU05TIHRvcGljXG4gICAgYXBpR2F0ZXdheTR4eEFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmJpbGxpbmdBbGVydFRvcGljKVxuICAgICk7XG4gICAgYXBpR2F0ZXdheTV4eEFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmJpbGxpbmdBbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBCdWRnZXQgZm9yIGNvc3QgY29udHJvbFxuICAgIG5ldyBidWRnZXRzLkNmbkJ1ZGdldCh0aGlzLCBcIlNlY3VyZU1vbnRobHlCdWRnZXRcIiwge1xuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIGJ1ZGdldE5hbWU6IGByZWNpcGUtbW9udGhseS1idWRnZXQtJHtzZWN1cmVJZH1gLFxuICAgICAgICBidWRnZXRMaW1pdDoge1xuICAgICAgICAgIGFtb3VudDogNTAsXG4gICAgICAgICAgdW5pdDogXCJVU0RcIixcbiAgICAgICAgfSxcbiAgICAgICAgdGltZVVuaXQ6IFwiTU9OVEhMWVwiLFxuICAgICAgICBidWRnZXRUeXBlOiBcIkNPU1RcIixcbiAgICAgICAgY29zdEZpbHRlcnM6IHtcbiAgICAgICAgICBUYWdLZXk6IFtcIlByb2plY3RcIl0sXG4gICAgICAgICAgVGFnVmFsdWU6IFtgUmVjaXBlQXJjaGl2ZS0ke3NlY3VyZUlkfWBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG5vdGlmaWNhdGlvbnNXaXRoU3Vic2NyaWJlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5vdGlmaWNhdGlvbjoge1xuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogXCJBQ1RVQUxcIixcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogXCJHUkVBVEVSX1RIQU5cIixcbiAgICAgICAgICAgIHRocmVzaG9sZDogODAsXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiBcIlBFUkNFTlRBR0VcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6IFwiRU1BSUxcIixcbiAgICAgICAgICAgICAgYWRkcmVzczogcHJvcHMuYWRtaW5FbWFpbCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5vdGlmaWNhdGlvbjoge1xuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogXCJGT1JFQ0FTVEVEXCIsXG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IFwiR1JFQVRFUl9USEFOXCIsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDEwMCxcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6IFwiUEVSQ0VOVEFHRVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogXCJFTUFJTFwiLFxuICAgICAgICAgICAgICBhZGRyZXNzOiBwcm9wcy5hZG1pbkVtYWlsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIHRvIGFsbCByZXNvdXJjZXMgZm9yIGNvc3QgdHJhY2tpbmdcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoXCJQcm9qZWN0XCIsIGBSZWNpcGVBcmNoaXZlLSR7c2VjdXJlSWR9YCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKFwiRW52aXJvbm1lbnRcIiwgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChcIlNlY3VyZVN0YWNrXCIsIFwidHJ1ZVwiKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoXCJDcmVhdGVkQnlcIiwgXCJSZWNpcGVBcmNoaXZlLVNlY3VyZS1DREtcIik7XG4gIH1cbn1cbiJdfQ==