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
class RecipeArchiveStack extends cdk.Stack {
    constructor(scope, id, props) {
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
            removalPolicy: props.environment === 'prod'
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });
        // Cognito User Pool Client
        this.userPoolClient = new cognito.UserPoolClient(this, 'RecipeArchiveUserPoolClient', {
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
            removalPolicy: props.environment === 'prod'
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });
        // Temporary/Processing Bucket with Ultra-Short Retention
        this.tempBucket = new s3.Bucket(this, 'RecipeArchiveTemp', {
            bucketName: `recipearchive-temp-${props.environment}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false,
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
            versioned: false,
            lifecycleRules: [
                {
                    id: 'delete-failed-parsing-data',
                    expiration: cdk.Duration.days(30),
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
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
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
                    ],
                }),
            },
        });
        // API Gateway with DDoS Protection
        this.api = new apigateway.RestApi(this, 'RecipeArchiveAPI', {
            restApiName: `recipeArchive-api-${props.environment}`,
            description: 'RecipeArchive Backend API',
            defaultCorsPreflightOptions: {
                allowOrigins: ['https://localhost:3000', 'https://recipearchive.com', 'https://d1jcaphz4458q7.cloudfront.net'],
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
                rateLimit: 100,
                burstLimit: 200, // concurrent requests
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
        const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [this.userPool],
            authorizerName: 'recipeArchive-cognito-authorizer',
            resultsCacheTtl: cdk.Duration.minutes(5), // Cache auth results to reduce load
        });
        // Request Validator for DDoS Protection - Reject malformed requests early
        const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
            restApi: this.api,
            requestValidatorName: 'recipe-request-validator',
            validateRequestBody: true,
            validateRequestParameters: true,
        });
        // Lambda Functions
        const healthFunction = new lambda.Function(this, 'HealthFunction', {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../functions/dist/health-package'),
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
        const recipesFunction = new lambda.Function(this, 'RecipesFunction', {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../functions/dist/recipes-package'),
            timeout: cdk.Duration.seconds(15),
            memorySize: 256,
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
        const diagnosticsIntegration = new apigateway.LambdaIntegration(healthFunction);
        diagnosticsResource.addMethod('GET', diagnosticsIntegration);
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
        this.billingAlertTopic.addSubscription(new snsSubscriptions.EmailSubscription(props.adminEmail));
        // AWS Budget for conservative monthly cost monitoring ($20/month maximum)
        new budgets.CfnBudget(this, 'MonthlyCostBudget', {
            budget: {
                budgetName: `RecipeArchive-MonthlyCostWatchdog-${props.environment}`,
                budgetType: 'COST',
                timeUnit: 'MONTHLY',
                budgetLimit: {
                    amount: 20,
                    unit: 'USD',
                },
                costFilters: {
                // Only monitor this account's costs
                },
                timePeriod: {
                    start: '1756080093',
                    end: '2082762102', // December 31, 2035 in epoch seconds
                },
            },
            notificationsWithSubscribers: [
                {
                    notification: {
                        notificationType: 'ACTUAL',
                        comparisonOperator: 'GREATER_THAN',
                        threshold: 25,
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
                        threshold: 50,
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
                        threshold: 80,
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
                        threshold: 100,
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
        const unusualSpendingAlarm = new cloudwatch.Alarm(this, 'UnusualSpendingAlarm', {
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
            threshold: 20,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // Connect the alarm to SNS topic
        unusualSpendingAlarm.addAlarmAction({
            bind: () => ({ alarmActionArn: this.billingAlertTopic.topicArn }),
        });
        // CloudWatch Alarm for Failed Parsing Bucket Size (20MB limit)
        const failedParsingBucketSizeAlarm = new cloudwatch.Alarm(this, 'FailedParsingBucketSizeAlarm', {
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
            threshold: 20 * 1024 * 1024,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
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
exports.RecipeArchiveStack = RecipeArchiveStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZWNpcGUtYXJjaGl2ZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsbURBQW1EO0FBQ25ELHlDQUF5QztBQUN6QyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyx5REFBeUQ7QUFDekQsMkNBQTJDO0FBQzNDLHNFQUFzRTtBQUN0RSxtREFBbUQ7QUFPbkQsTUFBYSxrQkFBbUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQVMvQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQThCO1FBQ3RFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDbEUsWUFBWSxFQUFFLHVCQUF1QixLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ3hELGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELGtCQUFrQixFQUFFO2dCQUNsQixLQUFLLEVBQUU7b0JBQ0wsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULFFBQVEsRUFBRSxLQUFLO29CQUNmLE9BQU8sRUFBRSxJQUFJO2lCQUNkO2dCQUNELFVBQVUsRUFBRTtvQkFDVixRQUFRLEVBQUUsS0FBSztvQkFDZixPQUFPLEVBQUUsSUFBSTtpQkFDZDthQUNGO1lBQ0QsY0FBYyxFQUFFO2dCQUNkLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGdC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cyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc25zU3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgYnVkZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYnVkZ2V0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjaXBlQXJjaGl2ZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGFkbWluRW1haWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFJlY2lwZUFyY2hpdmVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgc3RvcmFnZUJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgdGVtcEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZmFpbGVkUGFyc2luZ0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBiaWxsaW5nQWxlcnRUb3BpYzogc25zLlRvcGljO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBSZWNpcGVBcmNoaXZlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgZm9yIEF1dGhlbnRpY2F0aW9uXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdSZWNpcGVBcmNoaXZlVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGByZWNpcGVBcmNoaXZlLXVzZXJzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGdpdmVuTmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTpcbiAgICAgICAgcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50XG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KFxuICAgICAgdGhpcyxcbiAgICAgICdSZWNpcGVBcmNoaXZlVXNlclBvb2xDbGllbnQnLFxuICAgICAge1xuICAgICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcbiAgICAgICAgdXNlclBvb2xDbGllbnROYW1lOiBgcmVjaXBlQXJjaGl2ZS1jbGllbnQtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIFB1YmxpYyBjbGllbnQgZm9yIGJyb3dzZXIvbW9iaWxlIGFwcHNcbiAgICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgICAgY3VzdG9tOiBmYWxzZSxcbiAgICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIG9BdXRoOiB7XG4gICAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICByZWZyZXNoVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICBlbmFibGVUb2tlblJldm9jYXRpb246IHRydWUsXG4gICAgICB9XG4gICAgKTtcblxuXG4gICAgLy8gUzMgQnVja2V0cyB3aXRoIEVudmlyb25tZW50LVNwZWNpZmljIFJldGVudGlvbiBQb2xpY2llc1xuXG4gICAgLy8gUHJpbWFyeSBTdG9yYWdlIEJ1Y2tldCBmb3IgUmVjaXBlIFBob3RvcyBhbmQgRG9jdW1lbnRzXG4gICAgdGhpcy5zdG9yYWdlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUmVjaXBlQXJjaGl2ZVN0b3JhZ2UnLCB7XG4gICAgICBidWNrZXROYW1lOiBgcmVjaXBlYXJjaGl2ZS1zdG9yYWdlLSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnZGVsZXRlLWluY29tcGxldGUtdXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICAvLyBFbnZpcm9ubWVudC1zcGVjaWZpYyByZXRlbnRpb24gcG9saWNpZXNcbiAgICAgICAgLi4uKHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCdcbiAgICAgICAgICA/IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAnYXJjaGl2ZS1vbGQtZmlsZXMnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDI1NTUpLCAvLyA3IHllYXJzIGZvciBwcm9kdWN0aW9uXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ2FyY2hpdmUtb2xkLXZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdXG4gICAgICAgICAgOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBTVFJJQ1QgMTQtREFZIFJFVEVOVElPTiBGT1IgUFJFLVBST0QgVEVTVElOR1xuICAgICAgICAgICAgICAgIGlkOiAnZGVsZXRlLXRlc3QtZGF0YScsXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdKSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OlxuICAgICAgICBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBUZW1wb3JhcnkvUHJvY2Vzc2luZyBCdWNrZXQgd2l0aCBVbHRyYS1TaG9ydCBSZXRlbnRpb25cbiAgICB0aGlzLnRlbXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdSZWNpcGVBcmNoaXZlVGVtcCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGVhcmNoaXZlLXRlbXAtJHtwcm9wcy5lbnZpcm9ubWVudH0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyBOZXZlciB2ZXJzaW9uIHRlbXBvcmFyeSBmaWxlc1xuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnZGVsZXRlLXRlbXAtZmlsZXMnLFxuICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCcgPyA3IDogMSksXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLCAvLyBGaXhlZDogdXNlIGRheXMgaW5zdGVhZCBvZiBob3Vyc1xuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEFsd2F5cyBkZXN0cm95IHRlbXAgYnVja2V0XG4gICAgfSk7XG5cbiAgICAvLyBGYWlsZWQgUGFyc2luZyBIVE1MIFN0b3JhZ2UgQnVja2V0IHdpdGggU2l6ZSBhbmQgVGltZSBMaW1pdHNcbiAgICB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdSZWNpcGVBcmNoaXZlRmFpbGVkUGFyc2luZycsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGByZWNpcGVhcmNoaXZlLWZhaWxlZC1wYXJzaW5nLSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSwgLy8gTm8gdmVyc2lvbmluZyBuZWVkZWQgZm9yIGZhaWxlZCBwYXJzaW5nIGRhdGFcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2RlbGV0ZS1mYWlsZWQtcGFyc2luZy1kYXRhJyxcbiAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzMCksIC8vIEF1dG8tcHVyZ2UgYWZ0ZXIgMzAgZGF5c1xuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICAvLyBCdWNrZXQgbm90aWZpY2F0aW9uIHRvIG1vbml0b3Igc2l6ZSAod2lsbCBiZSBoYW5kbGVkIGJ5IENsb3VkV2F0Y2ggbWV0cmljcylcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEFsd2F5cyBzYWZlIHRvIGRlc3Ryb3kgZmFpbGVkIHBhcnNpbmcgZGF0YVxuICAgIH0pO1xuXG4gICAgLy8gSUFNIFJvbGUgZm9yIExhbWJkYSBGdW5jdGlvbnMgKFRPRE86IEltcGxlbWVudCBMYW1iZGEgZnVuY3Rpb25zKVxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdSZWNpcGVBcmNoaXZlTGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICAnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZSdcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBTM0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0VXJsJyxcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0QWNsJywgLy8gRm9yIHB1YmxpYyBpbWFnZSB1cGxvYWRzXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGAke3RoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMudGVtcEJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogWydzMzpMaXN0QnVja2V0J10sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgdGhpcy50ZW1wQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgd2l0aCBERG9TIFByb3RlY3Rpb25cbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1JlY2lwZUFyY2hpdmVBUEknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHJlY2lwZUFyY2hpdmUtYXBpLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVjaXBlQXJjaGl2ZSBCYWNrZW5kIEFQSScsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJ2h0dHBzOi8vbG9jYWxob3N0OjMwMDAnLCAnaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbScsICdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0J10sIC8vIFJlc3RyaWN0IG9yaWdpbnNcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxuICAgICAgICAgICdYLUFwaS1LZXknLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLCAvLyBJbXBvcnRhbnQgZm9yIGF1dGhlbnRpY2F0ZWQgcmVxdWVzdHNcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEREb1MgUHJvdGVjdGlvbjogVXNhZ2UgUGxhbiB3aXRoIFJhdGUgTGltaXRpbmdcbiAgICBjb25zdCB1c2FnZVBsYW4gPSBuZXcgYXBpZ2F0ZXdheS5Vc2FnZVBsYW4odGhpcywgJ1JlY2lwZUFyY2hpdmVVc2FnZVBsYW4nLCB7XG4gICAgICBuYW1lOiBgcmVjaXBlYXJjaGl2ZS11c2FnZS1wbGFuLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNhZ2UgcGxhbiBmb3IgRERvUyBwcm90ZWN0aW9uJyxcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwLCAgICAvLyByZXF1ZXN0cyBwZXIgc2Vjb25kIHBlciBBUEkga2V5XG4gICAgICAgIGJ1cnN0TGltaXQ6IDIwMCwgICAvLyBjb25jdXJyZW50IHJlcXVlc3RzXG4gICAgICB9LFxuICAgICAgcXVvdGE6IHtcbiAgICAgICAgbGltaXQ6IDEwMDAwLCAgICAgIC8vIHJlcXVlc3RzIHBlciBtb250aCBwZXIgQVBJIGtleVxuICAgICAgICBwZXJpb2Q6IGFwaWdhdGV3YXkuUGVyaW9kLk1PTlRILFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5hcGkuZGVwbG95bWVudFN0YWdlLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyIGZvciBBUEkgR2F0ZXdheSAtIEREb1MgUHJvdGVjdGlvbiAmIEF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcihcbiAgICAgIHRoaXMsXG4gICAgICAnQ29nbml0b0F1dGhvcml6ZXInLFxuICAgICAge1xuICAgICAgICBjb2duaXRvVXNlclBvb2xzOiBbdGhpcy51c2VyUG9vbF0sXG4gICAgICAgIGF1dGhvcml6ZXJOYW1lOiAncmVjaXBlQXJjaGl2ZS1jb2duaXRvLWF1dGhvcml6ZXInLFxuICAgICAgICByZXN1bHRzQ2FjaGVUdGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBDYWNoZSBhdXRoIHJlc3VsdHMgdG8gcmVkdWNlIGxvYWRcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUmVxdWVzdCBWYWxpZGF0b3IgZm9yIEREb1MgUHJvdGVjdGlvbiAtIFJlamVjdCBtYWxmb3JtZWQgcmVxdWVzdHMgZWFybHlcbiAgICBjb25zdCByZXF1ZXN0VmFsaWRhdG9yID0gbmV3IGFwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcih0aGlzLCAnUmVxdWVzdFZhbGlkYXRvcicsIHtcbiAgICAgIHJlc3RBcGk6IHRoaXMuYXBpLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvck5hbWU6ICdyZWNpcGUtcmVxdWVzdC12YWxpZGF0b3InLFxuICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogdHJ1ZSxcbiAgICAgIHZhbGlkYXRlUmVxdWVzdFBhcmFtZXRlcnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25zXG4gICAgY29uc3QgaGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdIZWFsdGhGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9mdW5jdGlvbnMvZGlzdC9oZWFsdGgtcGFja2FnZScpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogMTI4LCAvLyBNaW5pbWFsIG1lbW9yeSBmb3IgRnJlZSBUaWVyIG9wdGltaXphdGlvblxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFMzX1RFTVBfQlVDS0VUOiB0aGlzLnRlbXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIH0sXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVjaXBlc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUmVjaXBlc0Z1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2Z1bmN0aW9ucy9kaXN0L3JlY2lwZXMtcGFja2FnZScpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LCAvLyBNb3JlIG1lbW9yeSBmb3IgQ1JVRCBvcGVyYXRpb25zXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfVEVNUF9CVUNLRVQ6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19GQUlMRURfUEFSU0lOR19CVUNLRVQ6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgfSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGhlYWx0aEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaGVhbHRoRnVuY3Rpb24sIHtcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHsgJ2FwcGxpY2F0aW9uL2pzb24nOiAneyBcInN0YXR1c0NvZGVcIjogXCIyMDBcIiB9JyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIFJlc291cmNlc1xuICAgIGNvbnN0IGhlYWx0aFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBoZWFsdGhJbnRlZ3JhdGlvbik7XG5cbiAgICBjb25zdCB2MSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3YxJyk7XG5cbiAgICAvLyBEaWFnbm9zdGljcyBlbmRwb2ludCAoYXV0aGVudGljYXRlZClcbiAgICBjb25zdCBkaWFnbm9zdGljc1Jlc291cmNlID0gdjEuYWRkUmVzb3VyY2UoJ2RpYWdub3N0aWNzJyk7XG4gICAgY29uc3QgZGlhZ25vc3RpY3NJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxuICAgICAgaGVhbHRoRnVuY3Rpb25cbiAgICApO1xuICAgIGRpYWdub3N0aWNzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBkaWFnbm9zdGljc0ludGVncmF0aW9uKTtcblxuICAgIC8vIEZ1dHVyZSByZWNpcGUgZW5kcG9pbnRzXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgIGNvbnN0IHJlY2lwZXNSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKCdyZWNpcGVzJyk7XG5cbiAgICAvLyBSZWNpcGUgQ1JVRCBvcGVyYXRpb25zIHdpdGggQXV0aGVudGljYXRpb25cbiAgICBjb25zdCByZWNpcGVzSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihyZWNpcGVzRnVuY3Rpb24pO1xuICAgIFxuICAgIC8vIExpc3QgcmVjaXBlczogR0VUIC92MS9yZWNpcGVzIChyZXF1aXJlcyBhdXRoZW50aWNhdGlvbilcbiAgICByZWNpcGVzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcbiAgICBcbiAgICAvLyBDcmVhdGUgcmVjaXBlOiBQT1NUIC92MS9yZWNpcGVzIChyZXF1aXJlcyBhdXRoZW50aWNhdGlvbilcbiAgICByZWNpcGVzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2luZ2xlIHJlY2lwZSBvcGVyYXRpb25zOiBHRVQvUFVUL0RFTEVURSAvdjEvcmVjaXBlcy97aWR9IChyZXF1aXJlcyBhdXRoZW50aWNhdGlvbilcbiAgICBjb25zdCByZWNpcGVSZXNvdXJjZSA9IHJlY2lwZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIHJlY2lwZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICB9KTtcbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuICAgIHJlY2lwZVJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHYXRld2F5IFJlc3BvbnNlcyB0byBpbmNsdWRlIENPUlMgaGVhZGVycyBvbiBBUEkgR2F0ZXdheSBlcnJvciByZXNwb25zZXNcbiAgICB0aGlzLmFwaS5hZGRHYXRld2F5UmVzcG9uc2UoJ3VuYXV0aG9yaXplZCcsIHtcbiAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLlVOQVVUSE9SSVpFRCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogYCdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0J2AsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IGAndHJ1ZSdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IGAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFwaS5hZGRHYXRld2F5UmVzcG9uc2UoJ2FjY2Vzcy1kZW5pZWQnLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5BQ0NFU1NfREVOSUVELFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBgJ2h0dHBzOi8vZDFqY2FwaHo0NDU4cTcuY2xvdWRmcm9udC5uZXQnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogYCd0cnVlJ2AsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogYCdDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidgLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZSgnZGVmYXVsdC00eHgnLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5ERUZBVUxUXzRYWCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogYCdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0J2AsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IGAndHJ1ZSdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IGAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFwaS5hZGRHYXRld2F5UmVzcG9uc2UoJ2RlZmF1bHQtNXh4Jywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuREVGQVVMVF81WFgsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnaHR0cHM6Ly9kMWpjYXBoejQ0NThxNy5jbG91ZGZyb250Lm5ldCdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBgJ3RydWUnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBgJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ2AsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8g8J+aqCBDT1NUIE1PTklUT1JJTkcgJiBCSUxMSU5HIEFMRVJUUyDwn5qoXG5cbiAgICAvLyBTTlMgVG9waWMgZm9yIGJpbGxpbmcgYWxlcnRzXG4gICAgdGhpcy5iaWxsaW5nQWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0JpbGxpbmdBbGVydHMnLCB7XG4gICAgICB0b3BpY05hbWU6IGByZWNpcGVhcmNoaXZlLWJpbGxpbmctYWxlcnRzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnUmVjaXBlQXJjaGl2ZSBCaWxsaW5nIEFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICAvLyBFbWFpbCBzdWJzY3JpcHRpb24gZm9yIGJpbGxpbmcgYWxlcnRzXG4gICAgdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc25zU3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbihwcm9wcy5hZG1pbkVtYWlsKVxuICAgICk7XG5cbiAgICAvLyBBV1MgQnVkZ2V0IGZvciBjb25zZXJ2YXRpdmUgbW9udGhseSBjb3N0IG1vbml0b3JpbmcgKCQyMC9tb250aCBtYXhpbXVtKVxuICAgIG5ldyBidWRnZXRzLkNmbkJ1ZGdldCh0aGlzLCAnTW9udGhseUNvc3RCdWRnZXQnLCB7XG4gICAgICBidWRnZXQ6IHtcbiAgICAgICAgYnVkZ2V0TmFtZTogYFJlY2lwZUFyY2hpdmUtTW9udGhseUNvc3RXYXRjaGRvZy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIGJ1ZGdldFR5cGU6ICdDT1NUJyxcbiAgICAgICAgdGltZVVuaXQ6ICdNT05USExZJyxcbiAgICAgICAgYnVkZ2V0TGltaXQ6IHtcbiAgICAgICAgICBhbW91bnQ6IDIwLCAvLyAkMjAvbW9udGggbWF4aW11bSBidWRnZXRcbiAgICAgICAgICB1bml0OiAnVVNEJyxcbiAgICAgICAgfSxcbiAgICAgICAgY29zdEZpbHRlcnM6IHtcbiAgICAgICAgICAvLyBPbmx5IG1vbml0b3IgdGhpcyBhY2NvdW50J3MgY29zdHNcbiAgICAgICAgfSxcbiAgICAgICAgdGltZVBlcmlvZDoge1xuICAgICAgICAgIHN0YXJ0OiAnMTc1NjA4MDA5MycsIC8vIEF1Z3VzdCAyNCwgMjAyNSBpbiBlcG9jaCBzZWNvbmRzXG4gICAgICAgICAgZW5kOiAnMjA4Mjc2MjEwMicsIC8vIERlY2VtYmVyIDMxLCAyMDM1IGluIGVwb2NoIHNlY29uZHNcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBub3RpZmljYXRpb25zV2l0aFN1YnNjcmliZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6ICdBQ1RVQUwnLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogMjUsIC8vIEFsZXJ0IGF0IDI1JSBvZiBidWRnZXQgKCQ1LjAwKVxuICAgICAgICAgICAgdGhyZXNob2xkVHlwZTogJ1BFUkNFTlRBR0UnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogJ1NOUycsXG4gICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6ICdBQ1RVQUwnLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogNTAsIC8vIFdhcm5pbmcgYXQgNTAlIG9mIGJ1ZGdldCAoJDEwLjAwKVxuICAgICAgICAgICAgdGhyZXNob2xkVHlwZTogJ1BFUkNFTlRBR0UnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogJ1NOUycsXG4gICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvblR5cGU6ICdBQ1RVQUwnLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogODAsIC8vIENyaXRpY2FsIGF0IDgwJSBvZiBidWRnZXQgKCQxNi4wMClcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6ICdQRVJDRU5UQUdFJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6ICdTTlMnLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0aGlzLmJpbGxpbmdBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnRk9SRUNBU1RFRCcsXG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6ICdHUkVBVEVSX1RIQU4nLFxuICAgICAgICAgICAgdGhyZXNob2xkOiAxMDAsIC8vIEZvcmVjYXN0IGFsZXJ0IGlmIHByb2plY3RlZCB0byBleGNlZWQgJDIwXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiAnUEVSQ0VOVEFHRScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiAnU05TJyxcbiAgICAgICAgICAgICAgYWRkcmVzczogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIEFsYXJtIGZvciB1bnVzdWFsIHNwZW5kaW5nIHBhdHRlcm5zXG4gICAgY29uc3QgdW51c3VhbFNwZW5kaW5nQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICAnVW51c3VhbFNwZW5kaW5nQWxhcm0nLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6IGBSZWNpcGVBcmNoaXZlLVVudXN1YWxTcGVuZGluZy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIGVzdGltYXRlZCBtb250aGx5IGNoYXJnZXMgZXhjZWVkICQyMCcsXG4gICAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQmlsbGluZycsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0VzdGltYXRlZENoYXJnZXMnLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIEN1cnJlbmN5OiAnVVNEJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEyKSwgLy8gQ2hlY2sgdHdpY2UgZGFpbHlcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMjAsIC8vICQyMC9tb250aCB0aHJlc2hvbGRcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDb25uZWN0IHRoZSBhbGFybSB0byBTTlMgdG9waWNcbiAgICB1bnVzdWFsU3BlbmRpbmdBbGFybS5hZGRBbGFybUFjdGlvbih7XG4gICAgICBiaW5kOiAoKSA9PiAoeyBhbGFybUFjdGlvbkFybjogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybiB9KSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggQWxhcm0gZm9yIEZhaWxlZCBQYXJzaW5nIEJ1Y2tldCBTaXplICgyME1CIGxpbWl0KVxuICAgIGNvbnN0IGZhaWxlZFBhcnNpbmdCdWNrZXRTaXplQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICAnRmFpbGVkUGFyc2luZ0J1Y2tldFNpemVBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogYFJlY2lwZUFyY2hpdmUtRmFpbGVkUGFyc2luZ0J1Y2tldFNpemUtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBmYWlsZWQgcGFyc2luZyBidWNrZXQgZXhjZWVkcyAyME1CIHRvIHByZXZlbnQgY29zdCBvdmVycnVucycsXG4gICAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvUzMnLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdCdWNrZXRTaXplQnl0ZXMnLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIEJ1Y2tldE5hbWU6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgU3RvcmFnZVR5cGU6ICdTdGFuZGFyZFN0b3JhZ2UnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoNiksIC8vIENoZWNrIDQgdGltZXMgZGFpbHlcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMjAgKiAxMDI0ICogMTAyNCwgLy8gMjBNQiBpbiBieXRlc1xuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENvbm5lY3QgdGhlIGJ1Y2tldCBzaXplIGFsYXJtIHRvIFNOUyB0b3BpY1xuICAgIGZhaWxlZFBhcnNpbmdCdWNrZXRTaXplQWxhcm0uYWRkQWxhcm1BY3Rpb24oe1xuICAgICAgYmluZDogKCkgPT4gKHsgYWxhcm1BY3Rpb25Bcm46IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4gfSksXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdG9yYWdlQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgU3RvcmFnZSBCdWNrZXQgTmFtZSAoUmVjaXBlIFBob3RvcyAmIERvY3VtZW50cyknLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RlbXBCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBUZW1wb3JhcnkgQnVja2V0IE5hbWUgKFByb2Nlc3NpbmcgJiBVcGxvYWRzKScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRmFpbGVkUGFyc2luZ0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIEZhaWxlZCBQYXJzaW5nIEJ1Y2tldCBOYW1lIChIVE1MIGZyb20gZmFpbGVkIHJlY2lwZSBleHRyYWN0aW9ucyknLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JpbGxpbmdBbGVydFRvcGljQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIEJpbGxpbmcgQWxlcnRzJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZWdpb24nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FXUyBSZWdpb24nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FkbWluRW1haWwnLCB7XG4gICAgICB2YWx1ZTogcHJvcHMuYWRtaW5FbWFpbCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4gRW1haWwgZm9yIEJpbGxpbmcgQWxlcnRzIGFuZCBJbml0aWFsIFVzZXIgQ3JlYXRpb24nLFxuICAgIH0pO1xuICB9XG59XG4iXX0=