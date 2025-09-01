"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeArchiveStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
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
        // DynamoDB Table for Recipes (Optimized for AWS Free Tier)
        this.recipesTable = new dynamodb.Table(this, 'RecipesTable', {
            tableName: `recipeArchive-recipes-${props.environment}`,
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
            // Pay-per-request is better for Free Tier with low usage
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            // Disable Point-in-Time Recovery for dev to save costs
            pointInTimeRecovery: false,
            // Enable DynamoDB Streams only if needed
            stream: dynamodb.StreamViewType.KEYS_ONLY,
            removalPolicy: props.environment === 'prod'
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });
        // Global Secondary Indexes
        this.recipesTable.addGlobalSecondaryIndex({
            indexName: 'recipes-by-created',
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'createdAt',
                type: dynamodb.AttributeType.STRING,
            },
        });
        this.recipesTable.addGlobalSecondaryIndex({
            indexName: 'recipes-by-title',
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'title',
                type: dynamodb.AttributeType.STRING,
            },
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
                DynamoDBAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'dynamodb:GetItem',
                                'dynamodb:PutItem',
                                'dynamodb:UpdateItem',
                                'dynamodb:DeleteItem',
                                'dynamodb:Query',
                                'dynamodb:Scan',
                            ],
                            resources: [
                                this.recipesTable.tableArn,
                                `${this.recipesTable.tableArn}/index/*`,
                            ],
                        }),
                    ],
                }),
                S3Access: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                's3:GetObject',
                                's3:PutObject',
                                's3:DeleteObject',
                                's3:GetObjectUrl',
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
                DYNAMODB_TABLE_NAME: this.recipesTable.tableName,
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
                DYNAMODB_TABLE_NAME: this.recipesTable.tableName,
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
        new cdk.CfnOutput(this, 'RecipesTableName', {
            value: this.recipesTable.tableName,
            description: 'DynamoDB Recipes Table Name',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZWNpcGUtYXJjaGl2ZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsbURBQW1EO0FBQ25ELHFEQUFxRDtBQUNyRCx5Q0FBeUM7QUFDekMsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCwyQ0FBMkM7QUFDM0MseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyxzRUFBc0U7QUFDdEUsbURBQW1EO0FBT25ELE1BQWEsa0JBQW1CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFVL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE4QjtRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2xFLFlBQVksRUFBRSx1QkFBdUIsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUN4RCxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRTtnQkFDYixLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0QsVUFBVSxFQUFFO2dCQUNWLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxrQkFBa0IsRUFBRTtnQkFDbEIsS0FBSyxFQUFFO29CQUNMLFFBQVEsRUFBRSxJQUFJO29CQUNkLE9BQU8sRUFBRSxJQUFJO2lCQUNkO2dCQUNELFNBQVMsRUFBRTtvQkFDVCxRQUFRLEVBQUUsS0FBSztvQkFDZixPQUFPLEVBQUUsSUFBSTtpQkFDZDtnQkFDRCxVQUFVLEVBQUU7b0JBQ1YsUUFBUSxFQUFFLEtBQUs7b0JBQ2YsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7YUFDRjtZQUNELGNBQWMsRUFBRTtnQkFDZCxTQUFTLEVBQUUsQ0FBQztnQkFDWixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixhQUFhLEVBQUUsSUFBSTtnQkFDbkIsY0FBYyxFQUFFLEtBQUs7YUFDdEI7WUFDRCxlQUFlLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxVQUFVO1lBQ25ELGFBQWEsRUFDWCxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDaEMsQ0FBQyxDQUFDO1FBRUgsMkJBQTJCO1FBQzNCLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUM5QyxJQUFJLEVBQ0osNkJBQTZCLEVBQzdCO1lBQ0UsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLGtCQUFrQixFQUFFLHdCQUF3QixLQUFLLENBQUMsV0FBVyxFQUFFO1lBQy9ELGNBQWMsRUFBRSxLQUFLO1lBQ3JCLFNBQVMsRUFBRTtnQkFDVCxZQUFZLEVBQUUsSUFBSTtnQkFDbEIsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsaUJBQWlCLEVBQUUsS0FBSzthQUN6QjtZQUNELEtBQUssRUFBRTtnQkFDTCxLQUFLLEVBQUU7b0JBQ0wsc0JBQXNCLEVBQUUsSUFBSTtpQkFDN0I7Z0JBQ0QsTUFBTSxFQUFFO29CQUNOLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBTTtvQkFDekIsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLO29CQUN4QixPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU87aUJBQzNCO2FBQ0Y7WUFDRCxtQkFBbUIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDMUMsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUN0QyxvQkFBb0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDM0MscUJBQXFCLEVBQUUsSUFBSTtTQUM1QixDQUNGLENBQUM7UUFFRiwyREFBMkQ7UUFDM0QsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUMzRCxTQUFTLEVBQUUseUJBQXlCLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDdkQsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELHlEQUF5RDtZQUN6RCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELFVBQVUsRUFBRSxRQUFRLENBQUMsZUFBZSxDQUFDLFdBQVc7WUFDaEQsdURBQXVEO1lBQ3ZELG1CQUFtQixFQUFFLEtBQUs7WUFDMUIseUNBQXlDO1lBQ3pDLE1BQU0sRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLFNBQVM7WUFDekMsYUFBYSxFQUNYLEtBQUssQ0FBQyxXQUFXLEtBQUssTUFBTTtnQkFDMUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtnQkFDMUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUNoQyxDQUFDLENBQUM7UUFFSCwyQkFBMkI7UUFDM0IsSUFBSSxDQUFDLFlBQVksQ0FBQyx1QkFBdUIsQ0FBQztZQUN4QyxTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFlBQVksQ0FBQyx1QkFBdUIsQ0FBQztZQUN4QyxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxPQUFPO2dCQUNiLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7U0FDRixDQUFDLENBQUM7UUFFSCwwREFBMEQ7UUFFMUQseURBQXlEO1FBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUMvRCxVQUFVLEVBQUUseUJBQXlCLEtBQUssQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUN4RSxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsU0FBUyxFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssTUFBTTtZQUN2QyxjQUFjLEVBQUU7Z0JBQ2Q7b0JBQ0UsRUFBRSxFQUFFLDJCQUEyQjtvQkFDL0IsbUNBQW1DLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUMxRDtnQkFDRCwwQ0FBMEM7Z0JBQzFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU07b0JBQzlCLENBQUMsQ0FBQzt3QkFDRTs0QkFDRSxFQUFFLEVBQUUsbUJBQW1COzRCQUN2QixVQUFVLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUseUJBQXlCO3lCQUMvRDt3QkFDRDs0QkFDRSxFQUFFLEVBQUUsc0JBQXNCOzRCQUMxQiwyQkFBMkIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7eUJBQ3BEO3FCQUNGO29CQUNILENBQUMsQ0FBQzt3QkFDRTs0QkFDRSwrQ0FBK0M7NEJBQy9DLEVBQUUsRUFBRSxrQkFBa0I7NEJBQ3RCLFVBQVUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQ2pDLE9BQU8sRUFBRSxJQUFJO3lCQUNkO3FCQUNGLENBQUM7YUFDUDtZQUNELGFBQWEsRUFDWCxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDaEMsQ0FBQyxDQUFDO1FBRUgseURBQXlEO1FBQ3pELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN6RCxVQUFVLEVBQUUsc0JBQXNCLEtBQUssQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNyRSxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsU0FBUyxFQUFFLEtBQUs7WUFDaEIsY0FBYyxFQUFFO2dCQUNkO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLFVBQVUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ25FLG1DQUFtQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLG1DQUFtQztpQkFDL0Y7YUFDRjtZQUNELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSw2QkFBNkI7U0FDeEUsQ0FBQyxDQUFDO1FBRUgsK0RBQStEO1FBQy9ELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQzNFLFVBQVUsRUFBRSxnQ0FBZ0MsS0FBSyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQy9FLFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUMxQyxpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxTQUFTLEVBQUUsS0FBSztZQUNoQixjQUFjLEVBQUU7Z0JBQ2Q7b0JBQ0UsRUFBRSxFQUFFLDRCQUE0QjtvQkFDaEMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDakMsbUNBQW1DLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUMxRDthQUNGO1lBQ0QsOEVBQThFO1lBQzlFLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSw2Q0FBNkM7U0FDeEYsQ0FBQyxDQUFDO1FBRUgsbUVBQW1FO1FBQ25FLDZEQUE2RDtRQUM3RCxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQy9ELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUMzRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FDeEMsMENBQTBDLENBQzNDO2FBQ0Y7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsY0FBYyxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDckMsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLGtCQUFrQjtnQ0FDbEIsa0JBQWtCO2dDQUNsQixxQkFBcUI7Z0NBQ3JCLHFCQUFxQjtnQ0FDckIsZ0JBQWdCO2dDQUNoQixlQUFlOzZCQUNoQjs0QkFDRCxTQUFTLEVBQUU7Z0NBQ1QsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRO2dDQUMxQixHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxVQUFVOzZCQUN4Qzt5QkFDRixDQUFDO3FCQUNIO2lCQUNGLENBQUM7Z0JBQ0YsUUFBUSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDL0IsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLGNBQWM7Z0NBQ2QsY0FBYztnQ0FDZCxpQkFBaUI7Z0NBQ2pCLGlCQUFpQjs2QkFDbEI7NEJBQ0QsU0FBUyxFQUFFO2dDQUNULEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLElBQUk7Z0NBQ25DLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLElBQUk7Z0NBQ2hDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsSUFBSTs2QkFDMUM7eUJBQ0YsQ0FBQzt3QkFDRixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7NEJBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7NEJBQ3hCLE9BQU8sRUFBRSxDQUFDLGVBQWUsQ0FBQzs0QkFDMUIsU0FBUyxFQUFFO2dDQUNULElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUztnQ0FDNUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTO2dDQUN6QixJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUzs2QkFDbkM7eUJBQ0YsQ0FBQztxQkFDSDtpQkFDRixDQUFDO2FBQ0g7U0FDRixDQUFDLENBQUM7UUFFSCxtQ0FBbUM7UUFDbkMsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFELFdBQVcsRUFBRSxxQkFBcUIsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUNyRCxXQUFXLEVBQUUsMkJBQTJCO1lBQ3hDLDJCQUEyQixFQUFFO2dCQUMzQixZQUFZLEVBQUUsQ0FBQyx3QkFBd0IsRUFBRSwyQkFBMkIsRUFBRSx1Q0FBdUMsQ0FBQztnQkFDOUcsWUFBWSxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQztnQkFDekQsWUFBWSxFQUFFO29CQUNaLGNBQWM7b0JBQ2QsWUFBWTtvQkFDWixlQUFlO29CQUNmLFdBQVc7aUJBQ1o7Z0JBQ0QsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLHVDQUF1QzthQUNoRTtZQUNELGFBQWEsRUFBRTtnQkFDYixTQUFTLEVBQUUsTUFBTTthQUNsQjtTQUNGLENBQUMsQ0FBQztRQUVILGlEQUFpRDtRQUNqRCxNQUFNLFNBQVMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ3pFLElBQUksRUFBRSw0QkFBNEIsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUNyRCxXQUFXLEVBQUUsZ0NBQWdDO1lBQzdDLFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUUsR0FBRztnQkFDZCxVQUFVLEVBQUUsR0FBRyxFQUFJLHNCQUFzQjthQUMxQztZQUNELEtBQUssRUFBRTtnQkFDTCxLQUFLLEVBQUUsS0FBSztnQkFDWixNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLO2FBQ2hDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLFdBQVcsQ0FBQztZQUNwQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlO1NBQ2hDLENBQUMsQ0FBQztRQUVILHdFQUF3RTtRQUN4RSxNQUFNLGlCQUFpQixHQUFHLElBQUksVUFBVSxDQUFDLDBCQUEwQixDQUNqRSxJQUFJLEVBQ0osbUJBQW1CLEVBQ25CO1lBQ0UsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQ2pDLGNBQWMsRUFBRSxrQ0FBa0M7WUFDbEQsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLG9DQUFvQztTQUMvRSxDQUNGLENBQUM7UUFFRiwwRUFBMEU7UUFDMUUsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDakYsT0FBTyxFQUFFLElBQUksQ0FBQyxHQUFHO1lBQ2pCLG9CQUFvQixFQUFFLDBCQUEwQjtZQUNoRCxtQkFBbUIsRUFBRSxJQUFJO1lBQ3pCLHlCQUF5QixFQUFFLElBQUk7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsbUJBQW1CO1FBQ25CLE1BQU0sY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDakUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWTtZQUNwQyxPQUFPLEVBQUUsV0FBVztZQUNwQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsa0NBQWtDLENBQUM7WUFDL0QsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztZQUNmLFdBQVcsRUFBRTtnQkFDWCxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7Z0JBQzlCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDbkIsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTO2dCQUNoRCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVU7Z0JBQ2hELGNBQWMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVU7Z0JBQzFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVO2dCQUM3RCxvQkFBb0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVU7YUFDL0M7WUFDRCxJQUFJLEVBQUUsVUFBVTtTQUNqQixDQUFDLENBQUM7UUFFSCxNQUFNLGVBQWUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ25FLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVk7WUFDcEMsT0FBTyxFQUFFLFdBQVc7WUFDcEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLG1DQUFtQyxDQUFDO1lBQ2hFLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLEdBQUc7WUFDZixXQUFXLEVBQUU7Z0JBQ1gsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO2dCQUM5QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07Z0JBQ25CLG1CQUFtQixFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUztnQkFDaEQsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVO2dCQUNoRCxjQUFjLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVO2dCQUMxQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVTtnQkFDN0Qsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVO2FBQy9DO1lBQ0QsSUFBSSxFQUFFLFVBQVU7U0FDakIsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsY0FBYyxFQUFFO1lBQ3pFLGdCQUFnQixFQUFFLEVBQUUsa0JBQWtCLEVBQUUseUJBQXlCLEVBQUU7U0FDcEUsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCO1FBQ2hCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzRCxjQUFjLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBRW5ELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUzQyx1Q0FBdUM7UUFDdkMsTUFBTSxtQkFBbUIsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzFELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQzdELGNBQWMsQ0FDZixDQUFDO1FBQ0YsbUJBQW1CLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBRTdELDBCQUEwQjtRQUMxQiw2REFBNkQ7UUFDN0QsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVsRCw2Q0FBNkM7UUFDN0MsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU3RSwwREFBMEQ7UUFDMUQsZUFBZSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLEVBQUU7WUFDbkQsVUFBVSxFQUFFLGlCQUFpQjtZQUM3QixnQkFBZ0IsRUFBRSxnQkFBZ0I7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsNERBQTREO1FBQzVELGVBQWUsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLGtCQUFrQixFQUFFO1lBQ3BELFVBQVUsRUFBRSxpQkFBaUI7WUFDN0IsZ0JBQWdCLEVBQUUsZ0JBQWdCO1NBQ25DLENBQUMsQ0FBQztRQUVILHNGQUFzRjtRQUN0RixNQUFNLGNBQWMsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNELGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLGtCQUFrQixFQUFFO1lBQ2xELFVBQVUsRUFBRSxpQkFBaUI7U0FDOUIsQ0FBQyxDQUFDO1FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLEVBQUU7WUFDbEQsVUFBVSxFQUFFLGlCQUFpQjtZQUM3QixnQkFBZ0IsRUFBRSxnQkFBZ0I7U0FDbkMsQ0FBQyxDQUFDO1FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUU7WUFDckQsVUFBVSxFQUFFLGlCQUFpQjtTQUM5QixDQUFDLENBQUM7UUFFSCwrRUFBK0U7UUFDL0UsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLEVBQUU7WUFDMUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxZQUFZLENBQUMsWUFBWTtZQUMxQyxlQUFlLEVBQUU7Z0JBQ2YsNkJBQTZCLEVBQUUseUNBQXlDO2dCQUN4RSxrQ0FBa0MsRUFBRSxRQUFRO2dCQUM1Qyw4QkFBOEIsRUFBRSw4QkFBOEI7YUFDL0Q7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLGVBQWUsRUFBRTtZQUMzQyxJQUFJLEVBQUUsVUFBVSxDQUFDLFlBQVksQ0FBQyxhQUFhO1lBQzNDLGVBQWUsRUFBRTtnQkFDZiw2QkFBNkIsRUFBRSx5Q0FBeUM7Z0JBQ3hFLGtDQUFrQyxFQUFFLFFBQVE7Z0JBQzVDLDhCQUE4QixFQUFFLDhCQUE4QjthQUMvRDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsYUFBYSxFQUFFO1lBQ3pDLElBQUksRUFBRSxVQUFVLENBQUMsWUFBWSxDQUFDLFdBQVc7WUFDekMsZUFBZSxFQUFFO2dCQUNmLDZCQUE2QixFQUFFLHlDQUF5QztnQkFDeEUsa0NBQWtDLEVBQUUsUUFBUTtnQkFDNUMsOEJBQThCLEVBQUUsOEJBQThCO2FBQy9EO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxhQUFhLEVBQUU7WUFDekMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxZQUFZLENBQUMsV0FBVztZQUN6QyxlQUFlLEVBQUU7Z0JBQ2YsNkJBQTZCLEVBQUUseUNBQXlDO2dCQUN4RSxrQ0FBa0MsRUFBRSxRQUFRO2dCQUM1Qyw4QkFBOEIsRUFBRSw4QkFBOEI7YUFDL0Q7U0FDRixDQUFDLENBQUM7UUFFSCx5Q0FBeUM7UUFFekMsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM1RCxTQUFTLEVBQUUsZ0NBQWdDLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDOUQsV0FBVyxFQUFFLDhCQUE4QjtTQUM1QyxDQUFDLENBQUM7UUFFSCx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FDcEMsSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQ3pELENBQUM7UUFFRiwwRUFBMEU7UUFDMUUsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMvQyxNQUFNLEVBQUU7Z0JBQ04sVUFBVSxFQUFFLHFDQUFxQyxLQUFLLENBQUMsV0FBVyxFQUFFO2dCQUNwRSxVQUFVLEVBQUUsTUFBTTtnQkFDbEIsUUFBUSxFQUFFLFNBQVM7Z0JBQ25CLFdBQVcsRUFBRTtvQkFDWCxNQUFNLEVBQUUsRUFBRTtvQkFDVixJQUFJLEVBQUUsS0FBSztpQkFDWjtnQkFDRCxXQUFXLEVBQUU7Z0JBQ1gsb0NBQW9DO2lCQUNyQztnQkFDRCxVQUFVLEVBQUU7b0JBQ1YsS0FBSyxFQUFFLFlBQVk7b0JBQ25CLEdBQUcsRUFBRSxZQUFZLEVBQUUscUNBQXFDO2lCQUN6RDthQUNGO1lBQ0QsNEJBQTRCLEVBQUU7Z0JBQzVCO29CQUNFLFlBQVksRUFBRTt3QkFDWixnQkFBZ0IsRUFBRSxRQUFRO3dCQUMxQixrQkFBa0IsRUFBRSxjQUFjO3dCQUNsQyxTQUFTLEVBQUUsRUFBRTt3QkFDYixhQUFhLEVBQUUsWUFBWTtxQkFDNUI7b0JBQ0QsV0FBVyxFQUFFO3dCQUNYOzRCQUNFLGdCQUFnQixFQUFFLEtBQUs7NEJBQ3ZCLE9BQU8sRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUTt5QkFDekM7cUJBQ0Y7aUJBQ0Y7Z0JBQ0Q7b0JBQ0UsWUFBWSxFQUFFO3dCQUNaLGdCQUFnQixFQUFFLFFBQVE7d0JBQzFCLGtCQUFrQixFQUFFLGNBQWM7d0JBQ2xDLFNBQVMsRUFBRSxFQUFFO3dCQUNiLGFBQWEsRUFBRSxZQUFZO3FCQUM1QjtvQkFDRCxXQUFXLEVBQUU7d0JBQ1g7NEJBQ0UsZ0JBQWdCLEVBQUUsS0FBSzs0QkFDdkIsT0FBTyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRO3lCQUN6QztxQkFDRjtpQkFDRjtnQkFDRDtvQkFDRSxZQUFZLEVBQUU7d0JBQ1osZ0JBQWdCLEVBQUUsUUFBUTt3QkFDMUIsa0JBQWtCLEVBQUUsY0FBYzt3QkFDbEMsU0FBUyxFQUFFLEVBQUU7d0JBQ2IsYUFBYSxFQUFFLFlBQVk7cUJBQzVCO29CQUNELFdBQVcsRUFBRTt3QkFDWDs0QkFDRSxnQkFBZ0IsRUFBRSxLQUFLOzRCQUN2QixPQUFPLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVE7eUJBQ3pDO3FCQUNGO2lCQUNGO2dCQUNEO29CQUNFLFlBQVksRUFBRTt3QkFDWixnQkFBZ0IsRUFBRSxZQUFZO3dCQUM5QixrQkFBa0IsRUFBRSxjQUFjO3dCQUNsQyxTQUFTLEVBQUUsR0FBRzt3QkFDZCxhQUFhLEVBQUUsWUFBWTtxQkFDNUI7b0JBQ0QsV0FBVyxFQUFFO3dCQUNYOzRCQUNFLGdCQUFnQixFQUFFLEtBQUs7NEJBQ3ZCLE9BQU8sRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUTt5QkFDekM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGlEQUFpRDtRQUNqRCxNQUFNLG9CQUFvQixHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssQ0FDL0MsSUFBSSxFQUNKLHNCQUFzQixFQUN0QjtZQUNFLFNBQVMsRUFBRSxpQ0FBaUMsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUMvRCxnQkFBZ0IsRUFBRSxpREFBaUQ7WUFDbkUsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLGFBQWE7Z0JBQ3hCLFVBQVUsRUFBRSxrQkFBa0I7Z0JBQzlCLGFBQWEsRUFBRTtvQkFDYixRQUFRLEVBQUUsS0FBSztpQkFDaEI7Z0JBQ0QsU0FBUyxFQUFFLFNBQVM7Z0JBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxvQkFBb0I7YUFDckQsQ0FBQztZQUNGLFNBQVMsRUFBRSxFQUFFO1lBQ2IsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtTQUM1RCxDQUNGLENBQUM7UUFFRixpQ0FBaUM7UUFDakMsb0JBQW9CLENBQUMsY0FBYyxDQUFDO1lBQ2xDLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNsRSxDQUFDLENBQUM7UUFFSCwrREFBK0Q7UUFDL0QsTUFBTSw0QkFBNEIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQ3ZELElBQUksRUFDSiw4QkFBOEIsRUFDOUI7WUFDRSxTQUFTLEVBQUUseUNBQXlDLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDdkUsZ0JBQWdCLEVBQUUsd0VBQXdFO1lBQzFGLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFNBQVMsRUFBRSxRQUFRO2dCQUNuQixVQUFVLEVBQUUsaUJBQWlCO2dCQUM3QixhQUFhLEVBQUU7b0JBQ2IsVUFBVSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVO29CQUMvQyxXQUFXLEVBQUUsaUJBQWlCO2lCQUMvQjtnQkFDRCxTQUFTLEVBQUUsU0FBUztnQkFDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLHNCQUFzQjthQUN0RCxDQUFDO1lBQ0YsU0FBUyxFQUFFLEVBQUUsR0FBRyxJQUFJLEdBQUcsSUFBSTtZQUMzQixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQ0YsQ0FBQztRQUVGLDZDQUE2QztRQUM3Qyw0QkFBNEIsQ0FBQyxjQUFjLENBQUM7WUFDMUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQ2xFLENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVO1lBQy9CLFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0I7WUFDM0MsV0FBVyxFQUFFLDZCQUE2QjtTQUMzQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVM7WUFDbEMsV0FBVyxFQUFFLDZCQUE2QjtTQUMzQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVU7WUFDcEMsV0FBVyxFQUFFLG9EQUFvRDtTQUNsRSxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVU7WUFDakMsV0FBVyxFQUFFLGlEQUFpRDtTQUMvRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ2pELEtBQUssRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVTtZQUMxQyxXQUFXLEVBQUUscUVBQXFFO1NBQ25GLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDbkIsV0FBVyxFQUFFLGlCQUFpQjtTQUMvQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUTtZQUN0QyxXQUFXLEVBQUUsa0NBQWtDO1NBQ2hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQ2hDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNsQixXQUFXLEVBQUUsWUFBWTtTQUMxQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFVBQVU7WUFDdkIsV0FBVyxFQUFFLDBEQUEwRDtTQUN4RSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFqb0JELGdEQWlvQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGJ1ZGdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJ1ZGdldHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlY2lwZUFyY2hpdmVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBhZG1pbkVtYWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWNpcGVBcmNoaXZlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IHJlY2lwZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBzdG9yYWdlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSB0ZW1wQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBmYWlsZWRQYXJzaW5nQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IGJpbGxpbmdBbGVydFRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFJlY2lwZUFyY2hpdmVTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCBmb3IgQXV0aGVudGljYXRpb25cbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1JlY2lwZUFyY2hpdmVVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogYHJlY2lwZUFyY2hpdmUtdXNlcnMtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGZhbWlseU5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OlxuICAgICAgICBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCBDbGllbnRcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQoXG4gICAgICB0aGlzLFxuICAgICAgJ1JlY2lwZUFyY2hpdmVVc2VyUG9vbENsaWVudCcsXG4gICAgICB7XG4gICAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGByZWNpcGVBcmNoaXZlLWNsaWVudC0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSwgLy8gUHVibGljIGNsaWVudCBmb3IgYnJvd3Nlci9tb2JpbGUgYXBwc1xuICAgICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgICBjdXN0b206IGZhbHNlLFxuICAgICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgb0F1dGg6IHtcbiAgICAgICAgICBmbG93czoge1xuICAgICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNjb3BlczogW1xuICAgICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTCxcbiAgICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgIGVuYWJsZVRva2VuUmV2b2NhdGlvbjogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgZm9yIFJlY2lwZXMgKE9wdGltaXplZCBmb3IgQVdTIEZyZWUgVGllcilcbiAgICB0aGlzLnJlY2lwZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmVjaXBlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgcmVjaXBlQXJjaGl2ZS1yZWNpcGVzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnaWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICAvLyBQYXktcGVyLXJlcXVlc3QgaXMgYmV0dGVyIGZvciBGcmVlIFRpZXIgd2l0aCBsb3cgdXNhZ2VcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICAvLyBEaXNhYmxlIFBvaW50LWluLVRpbWUgUmVjb3ZlcnkgZm9yIGRldiB0byBzYXZlIGNvc3RzXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBmYWxzZSxcbiAgICAgIC8vIEVuYWJsZSBEeW5hbW9EQiBTdHJlYW1zIG9ubHkgaWYgbmVlZGVkXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLktFWVNfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6XG4gICAgICAgIHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCdcbiAgICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTlxuICAgICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEdsb2JhbCBTZWNvbmRhcnkgSW5kZXhlc1xuICAgIHRoaXMucmVjaXBlc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3JlY2lwZXMtYnktY3JlYXRlZCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3VzZXJJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMucmVjaXBlc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3JlY2lwZXMtYnktdGl0bGUnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd1c2VySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aXRsZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFMzIEJ1Y2tldHMgd2l0aCBFbnZpcm9ubWVudC1TcGVjaWZpYyBSZXRlbnRpb24gUG9saWNpZXNcblxuICAgIC8vIFByaW1hcnkgU3RvcmFnZSBCdWNrZXQgZm9yIFJlY2lwZSBQaG90b3MgYW5kIERvY3VtZW50c1xuICAgIHRoaXMuc3RvcmFnZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1JlY2lwZUFyY2hpdmVTdG9yYWdlJywge1xuICAgICAgYnVja2V0TmFtZTogYHJlY2lwZWFyY2hpdmUtc3RvcmFnZS0ke3Byb3BzLmVudmlyb25tZW50fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2RlbGV0ZS1pbmNvbXBsZXRlLXVwbG9hZHMnLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgcmV0ZW50aW9uIHBvbGljaWVzXG4gICAgICAgIC4uLihwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ2FyY2hpdmUtb2xkLWZpbGVzJyxcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygyNTU1KSwgLy8gNyB5ZWFycyBmb3IgcHJvZHVjdGlvblxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICdhcmNoaXZlLW9sZC12ZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXVxuICAgICAgICAgIDogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gU1RSSUNUIDE0LURBWSBSRVRFTlRJT04gRk9SIFBSRS1QUk9EIFRFU1RJTkdcbiAgICAgICAgICAgICAgICBpZDogJ2RlbGV0ZS10ZXN0LWRhdGEnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSksXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTpcbiAgICAgICAgcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJ1xuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gVGVtcG9yYXJ5L1Byb2Nlc3NpbmcgQnVja2V0IHdpdGggVWx0cmEtU2hvcnQgUmV0ZW50aW9uXG4gICAgdGhpcy50ZW1wQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUmVjaXBlQXJjaGl2ZVRlbXAnLCB7XG4gICAgICBidWNrZXROYW1lOiBgcmVjaXBlYXJjaGl2ZS10ZW1wLSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSwgLy8gTmV2ZXIgdmVyc2lvbiB0ZW1wb3JhcnkgZmlsZXNcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2RlbGV0ZS10ZW1wLWZpbGVzJyxcbiAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyhwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gNyA6IDEpLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSwgLy8gRml4ZWQ6IHVzZSBkYXlzIGluc3RlYWQgb2YgaG91cnNcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBBbHdheXMgZGVzdHJveSB0ZW1wIGJ1Y2tldFxuICAgIH0pO1xuXG4gICAgLy8gRmFpbGVkIFBhcnNpbmcgSFRNTCBTdG9yYWdlIEJ1Y2tldCB3aXRoIFNpemUgYW5kIFRpbWUgTGltaXRzXG4gICAgdGhpcy5mYWlsZWRQYXJzaW5nQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUmVjaXBlQXJjaGl2ZUZhaWxlZFBhcnNpbmcnLCB7XG4gICAgICBidWNrZXROYW1lOiBgcmVjaXBlYXJjaGl2ZS1mYWlsZWQtcGFyc2luZy0ke3Byb3BzLmVudmlyb25tZW50fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIE5vIHZlcnNpb25pbmcgbmVlZGVkIGZvciBmYWlsZWQgcGFyc2luZyBkYXRhXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdkZWxldGUtZmFpbGVkLXBhcnNpbmctZGF0YScsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApLCAvLyBBdXRvLXB1cmdlIGFmdGVyIDMwIGRheXNcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgLy8gQnVja2V0IG5vdGlmaWNhdGlvbiB0byBtb25pdG9yIHNpemUgKHdpbGwgYmUgaGFuZGxlZCBieSBDbG91ZFdhdGNoIG1ldHJpY3MpXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBBbHdheXMgc2FmZSB0byBkZXN0cm95IGZhaWxlZCBwYXJzaW5nIGRhdGFcbiAgICB9KTtcblxuICAgIC8vIElBTSBSb2xlIGZvciBMYW1iZGEgRnVuY3Rpb25zIChUT0RPOiBJbXBsZW1lbnQgTGFtYmRhIGZ1bmN0aW9ucylcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUmVjaXBlQXJjaGl2ZUxhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnXG4gICAgICAgICksXG4gICAgICBdLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgRHluYW1vREJBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0aGlzLnJlY2lwZXNUYWJsZS50YWJsZUFybixcbiAgICAgICAgICAgICAgICBgJHt0aGlzLnJlY2lwZXNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgUzNBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdFVybCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGAke3RoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMudGVtcEJ1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogWydzMzpMaXN0QnVja2V0J10sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgdGhpcy50ZW1wQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgd2l0aCBERG9TIFByb3RlY3Rpb25cbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1JlY2lwZUFyY2hpdmVBUEknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHJlY2lwZUFyY2hpdmUtYXBpLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVjaXBlQXJjaGl2ZSBCYWNrZW5kIEFQSScsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJ2h0dHBzOi8vbG9jYWxob3N0OjMwMDAnLCAnaHR0cHM6Ly9yZWNpcGVhcmNoaXZlLmNvbScsICdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0J10sIC8vIFJlc3RyaWN0IG9yaWdpbnNcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxuICAgICAgICAgICdYLUFwaS1LZXknLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLCAvLyBJbXBvcnRhbnQgZm9yIGF1dGhlbnRpY2F0ZWQgcmVxdWVzdHNcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEREb1MgUHJvdGVjdGlvbjogVXNhZ2UgUGxhbiB3aXRoIFJhdGUgTGltaXRpbmdcbiAgICBjb25zdCB1c2FnZVBsYW4gPSBuZXcgYXBpZ2F0ZXdheS5Vc2FnZVBsYW4odGhpcywgJ1JlY2lwZUFyY2hpdmVVc2FnZVBsYW4nLCB7XG4gICAgICBuYW1lOiBgcmVjaXBlYXJjaGl2ZS11c2FnZS1wbGFuLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNhZ2UgcGxhbiBmb3IgRERvUyBwcm90ZWN0aW9uJyxcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwLCAgICAvLyByZXF1ZXN0cyBwZXIgc2Vjb25kIHBlciBBUEkga2V5XG4gICAgICAgIGJ1cnN0TGltaXQ6IDIwMCwgICAvLyBjb25jdXJyZW50IHJlcXVlc3RzXG4gICAgICB9LFxuICAgICAgcXVvdGE6IHtcbiAgICAgICAgbGltaXQ6IDEwMDAwLCAgICAgIC8vIHJlcXVlc3RzIHBlciBtb250aCBwZXIgQVBJIGtleVxuICAgICAgICBwZXJpb2Q6IGFwaWdhdGV3YXkuUGVyaW9kLk1PTlRILFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5hcGkuZGVwbG95bWVudFN0YWdlLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyIGZvciBBUEkgR2F0ZXdheSAtIEREb1MgUHJvdGVjdGlvbiAmIEF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcihcbiAgICAgIHRoaXMsXG4gICAgICAnQ29nbml0b0F1dGhvcml6ZXInLFxuICAgICAge1xuICAgICAgICBjb2duaXRvVXNlclBvb2xzOiBbdGhpcy51c2VyUG9vbF0sXG4gICAgICAgIGF1dGhvcml6ZXJOYW1lOiAncmVjaXBlQXJjaGl2ZS1jb2duaXRvLWF1dGhvcml6ZXInLFxuICAgICAgICByZXN1bHRzQ2FjaGVUdGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBDYWNoZSBhdXRoIHJlc3VsdHMgdG8gcmVkdWNlIGxvYWRcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUmVxdWVzdCBWYWxpZGF0b3IgZm9yIEREb1MgUHJvdGVjdGlvbiAtIFJlamVjdCBtYWxmb3JtZWQgcmVxdWVzdHMgZWFybHlcbiAgICBjb25zdCByZXF1ZXN0VmFsaWRhdG9yID0gbmV3IGFwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcih0aGlzLCAnUmVxdWVzdFZhbGlkYXRvcicsIHtcbiAgICAgIHJlc3RBcGk6IHRoaXMuYXBpLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvck5hbWU6ICdyZWNpcGUtcmVxdWVzdC12YWxpZGF0b3InLFxuICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogdHJ1ZSxcbiAgICAgIHZhbGlkYXRlUmVxdWVzdFBhcmFtZXRlcnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25zXG4gICAgY29uc3QgaGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdIZWFsdGhGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9mdW5jdGlvbnMvZGlzdC9oZWFsdGgtcGFja2FnZScpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogMTI4LCAvLyBNaW5pbWFsIG1lbW9yeSBmb3IgRnJlZSBUaWVyIG9wdGltaXphdGlvblxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBEWU5BTU9EQl9UQUJMRV9OQU1FOiB0aGlzLnJlY2lwZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiB0aGlzLnN0b3JhZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfVEVNUF9CVUNLRVQ6IHRoaXMudGVtcEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19GQUlMRURfUEFSU0lOR19CVUNLRVQ6IHRoaXMuZmFpbGVkUGFyc2luZ0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgfSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgfSk7XG5cbiAgICBjb25zdCByZWNpcGVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWNpcGVzRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vZnVuY3Rpb25zL2Rpc3QvcmVjaXBlcy1wYWNrYWdlJyksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxNSksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsIC8vIE1vcmUgbWVtb3J5IGZvciBDUlVEIG9wZXJhdGlvbnNcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgRFlOQU1PREJfVEFCTEVfTkFNRTogdGhpcy5yZWNpcGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogdGhpcy5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFMzX1RFTVBfQlVDS0VUOiB0aGlzLnRlbXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIH0sXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgSW50ZWdyYXRpb25cbiAgICBjb25zdCBoZWFsdGhJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGhlYWx0aEZ1bmN0aW9uLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSZXNvdXJjZXNcbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2hlYWx0aCcpO1xuICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgaGVhbHRoSW50ZWdyYXRpb24pO1xuXG4gICAgY29uc3QgdjEgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCd2MScpO1xuXG4gICAgLy8gRGlhZ25vc3RpY3MgZW5kcG9pbnQgKGF1dGhlbnRpY2F0ZWQpXG4gICAgY29uc3QgZGlhZ25vc3RpY3NSZXNvdXJjZSA9IHYxLmFkZFJlc291cmNlKCdkaWFnbm9zdGljcycpO1xuICAgIGNvbnN0IGRpYWdub3N0aWNzSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgIGhlYWx0aEZ1bmN0aW9uXG4gICAgKTtcbiAgICBkaWFnbm9zdGljc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgZGlhZ25vc3RpY3NJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBGdXR1cmUgcmVjaXBlIGVuZHBvaW50c1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICBjb25zdCByZWNpcGVzUmVzb3VyY2UgPSB2MS5hZGRSZXNvdXJjZSgncmVjaXBlcycpO1xuXG4gICAgLy8gUmVjaXBlIENSVUQgb3BlcmF0aW9ucyB3aXRoIEF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgcmVjaXBlc0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocmVjaXBlc0Z1bmN0aW9uKTtcbiAgICBcbiAgICAvLyBMaXN0IHJlY2lwZXM6IEdFVCAvdjEvcmVjaXBlcyAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgcmVjaXBlc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgcmVjaXBlc0ludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHJlcXVlc3RWYWxpZGF0b3IsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIHJlY2lwZTogUE9TVCAvdjEvcmVjaXBlcyAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgcmVjaXBlc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiByZXF1ZXN0VmFsaWRhdG9yLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIFNpbmdsZSByZWNpcGUgb3BlcmF0aW9uczogR0VUL1BVVC9ERUxFVEUgL3YxL3JlY2lwZXMve2lkfSAocmVxdWlyZXMgYXV0aGVudGljYXRpb24pXG4gICAgY29uc3QgcmVjaXBlUmVzb3VyY2UgPSByZWNpcGVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgfSk7XG4gICAgcmVjaXBlUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCByZWNpcGVzSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogcmVxdWVzdFZhbGlkYXRvcixcbiAgICB9KTtcbiAgICByZWNpcGVSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIHJlY2lwZXNJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR2F0ZXdheSBSZXNwb25zZXMgdG8gaW5jbHVkZSBDT1JTIGhlYWRlcnMgb24gQVBJIEdhdGV3YXkgZXJyb3IgcmVzcG9uc2VzXG4gICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCd1bmF1dGhvcml6ZWQnLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5VTkFVVEhPUklaRUQsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnaHR0cHM6Ly9kMWpjYXBoejQ0NThxNy5jbG91ZGZyb250Lm5ldCdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBgJ3RydWUnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBgJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ2AsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCdhY2Nlc3MtZGVuaWVkJywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQUNDRVNTX0RFTklFRCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogYCdodHRwczovL2QxamNhcGh6NDQ1OHE3LmNsb3VkZnJvbnQubmV0J2AsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IGAndHJ1ZSdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IGAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFwaS5hZGRHYXRld2F5UmVzcG9uc2UoJ2RlZmF1bHQtNHh4Jywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuREVGQVVMVF80WFgsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnaHR0cHM6Ly9kMWpjYXBoejQ0NThxNy5jbG91ZGZyb250Lm5ldCdgLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBgJ3RydWUnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBgJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ2AsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCdkZWZhdWx0LTV4eCcsIHtcbiAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLkRFRkFVTFRfNVhYLFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBgJ2h0dHBzOi8vZDFqY2FwaHo0NDU4cTcuY2xvdWRmcm9udC5uZXQnYCxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogYCd0cnVlJ2AsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogYCdDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidgLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIPCfmqggQ09TVCBNT05JVE9SSU5HICYgQklMTElORyBBTEVSVFMg8J+aqFxuXG4gICAgLy8gU05TIFRvcGljIGZvciBiaWxsaW5nIGFsZXJ0c1xuICAgIHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdCaWxsaW5nQWxlcnRzJywge1xuICAgICAgdG9waWNOYW1lOiBgcmVjaXBlYXJjaGl2ZS1iaWxsaW5nLWFsZXJ0cy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkaXNwbGF5TmFtZTogJ1JlY2lwZUFyY2hpdmUgQmlsbGluZyBBbGVydHMnLFxuICAgIH0pO1xuXG4gICAgLy8gRW1haWwgc3Vic2NyaXB0aW9uIGZvciBiaWxsaW5nIGFsZXJ0c1xuICAgIHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24ocHJvcHMuYWRtaW5FbWFpbClcbiAgICApO1xuXG4gICAgLy8gQVdTIEJ1ZGdldCBmb3IgY29uc2VydmF0aXZlIG1vbnRobHkgY29zdCBtb25pdG9yaW5nICgkMjAvbW9udGggbWF4aW11bSlcbiAgICBuZXcgYnVkZ2V0cy5DZm5CdWRnZXQodGhpcywgJ01vbnRobHlDb3N0QnVkZ2V0Jywge1xuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIGJ1ZGdldE5hbWU6IGBSZWNpcGVBcmNoaXZlLU1vbnRobHlDb3N0V2F0Y2hkb2ctJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBidWRnZXRUeXBlOiAnQ09TVCcsXG4gICAgICAgIHRpbWVVbml0OiAnTU9OVEhMWScsXG4gICAgICAgIGJ1ZGdldExpbWl0OiB7XG4gICAgICAgICAgYW1vdW50OiAyMCwgLy8gJDIwL21vbnRoIG1heGltdW0gYnVkZ2V0XG4gICAgICAgICAgdW5pdDogJ1VTRCcsXG4gICAgICAgIH0sXG4gICAgICAgIGNvc3RGaWx0ZXJzOiB7XG4gICAgICAgICAgLy8gT25seSBtb25pdG9yIHRoaXMgYWNjb3VudCdzIGNvc3RzXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVQZXJpb2Q6IHtcbiAgICAgICAgICBzdGFydDogJzE3NTYwODAwOTMnLCAvLyBBdWd1c3QgMjQsIDIwMjUgaW4gZXBvY2ggc2Vjb25kc1xuICAgICAgICAgIGVuZDogJzIwODI3NjIxMDInLCAvLyBEZWNlbWJlciAzMSwgMjAzNSBpbiBlcG9jaCBzZWNvbmRzXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgbm90aWZpY2F0aW9uc1dpdGhTdWJzY3JpYmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnQUNUVUFMJyxcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogJ0dSRUFURVJfVEhBTicsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDI1LCAvLyBBbGVydCBhdCAyNSUgb2YgYnVkZ2V0ICgkNS4wMClcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6ICdQRVJDRU5UQUdFJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6ICdTTlMnLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0aGlzLmJpbGxpbmdBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnQUNUVUFMJyxcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogJ0dSRUFURVJfVEhBTicsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDUwLCAvLyBXYXJuaW5nIGF0IDUwJSBvZiBidWRnZXQgKCQxMC4wMClcbiAgICAgICAgICAgIHRocmVzaG9sZFR5cGU6ICdQRVJDRU5UQUdFJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN1YnNjcmliZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6ICdTTlMnLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0aGlzLmJpbGxpbmdBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnQUNUVUFMJyxcbiAgICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogJ0dSRUFURVJfVEhBTicsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDgwLCAvLyBDcml0aWNhbCBhdCA4MCUgb2YgYnVkZ2V0ICgkMTYuMDApXG4gICAgICAgICAgICB0aHJlc2hvbGRUeXBlOiAnUEVSQ0VOVEFHRScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb25UeXBlOiAnU05TJyxcbiAgICAgICAgICAgICAgYWRkcmVzczogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5vdGlmaWNhdGlvbjoge1xuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogJ0ZPUkVDQVNURUQnLFxuICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogMTAwLCAvLyBGb3JlY2FzdCBhbGVydCBpZiBwcm9qZWN0ZWQgdG8gZXhjZWVkICQyMFxuICAgICAgICAgICAgdGhyZXNob2xkVHlwZTogJ1BFUkNFTlRBR0UnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogJ1NOUycsXG4gICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBBbGFybSBmb3IgdW51c3VhbCBzcGVuZGluZyBwYXR0ZXJuc1xuICAgIGNvbnN0IHVudXN1YWxTcGVuZGluZ0FsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ1VudXN1YWxTcGVuZGluZ0FsYXJtJyxcbiAgICAgIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgUmVjaXBlQXJjaGl2ZS1VbnVzdWFsU3BlbmRpbmctJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBlc3RpbWF0ZWQgbW9udGhseSBjaGFyZ2VzIGV4Y2VlZCAkMjAnLFxuICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0JpbGxpbmcnLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdFc3RpbWF0ZWRDaGFyZ2VzJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBDdXJyZW5jeTogJ1VTRCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxMiksIC8vIENoZWNrIHR3aWNlIGRhaWx5XG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDIwLCAvLyAkMjAvbW9udGggdGhyZXNob2xkXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ29ubmVjdCB0aGUgYWxhcm0gdG8gU05TIHRvcGljXG4gICAgdW51c3VhbFNwZW5kaW5nQWxhcm0uYWRkQWxhcm1BY3Rpb24oe1xuICAgICAgYmluZDogKCkgPT4gKHsgYWxhcm1BY3Rpb25Bcm46IHRoaXMuYmlsbGluZ0FsZXJ0VG9waWMudG9waWNBcm4gfSksXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIEFsYXJtIGZvciBGYWlsZWQgUGFyc2luZyBCdWNrZXQgU2l6ZSAoMjBNQiBsaW1pdClcbiAgICBjb25zdCBmYWlsZWRQYXJzaW5nQnVja2V0U2l6ZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ0ZhaWxlZFBhcnNpbmdCdWNrZXRTaXplQWxhcm0nLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6IGBSZWNpcGVBcmNoaXZlLUZhaWxlZFBhcnNpbmdCdWNrZXRTaXplLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FsZXJ0IHdoZW4gZmFpbGVkIHBhcnNpbmcgYnVja2V0IGV4Y2VlZHMgMjBNQiB0byBwcmV2ZW50IGNvc3Qgb3ZlcnJ1bnMnLFxuICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL1MzJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnQnVja2V0U2l6ZUJ5dGVzJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBCdWNrZXROYW1lOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIFN0b3JhZ2VUeXBlOiAnU3RhbmRhcmRTdG9yYWdlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDYpLCAvLyBDaGVjayA0IHRpbWVzIGRhaWx5XG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDIwICogMTAyNCAqIDEwMjQsIC8vIDIwTUIgaW4gYnl0ZXNcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDb25uZWN0IHRoZSBidWNrZXQgc2l6ZSBhbGFybSB0byBTTlMgdG9waWNcbiAgICBmYWlsZWRQYXJzaW5nQnVja2V0U2l6ZUFsYXJtLmFkZEFsYXJtQWN0aW9uKHtcbiAgICAgIGJpbmQ6ICgpID0+ICh7IGFsYXJtQWN0aW9uQXJuOiB0aGlzLmJpbGxpbmdBbGVydFRvcGljLnRvcGljQXJuIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlY2lwZXNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZWNpcGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBSZWNpcGVzIFRhYmxlIE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0b3JhZ2VCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuc3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBTdG9yYWdlIEJ1Y2tldCBOYW1lIChSZWNpcGUgUGhvdG9zICYgRG9jdW1lbnRzKScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVGVtcEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy50ZW1wQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIFRlbXBvcmFyeSBCdWNrZXQgTmFtZSAoUHJvY2Vzc2luZyAmIFVwbG9hZHMpJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGYWlsZWRQYXJzaW5nQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgRmFpbGVkIFBhcnNpbmcgQnVja2V0IE5hbWUgKEhUTUwgZnJvbSBmYWlsZWQgcmVjaXBlIGV4dHJhY3Rpb25zKScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmlsbGluZ0FsZXJ0VG9waWNBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iaWxsaW5nQWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIFRvcGljIEFSTiBmb3IgQmlsbGluZyBBbGVydHMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlZ2lvbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlZ2lvbixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVdTIFJlZ2lvbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWRtaW5FbWFpbCcsIHtcbiAgICAgIHZhbHVlOiBwcm9wcy5hZG1pbkVtYWlsLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbiBFbWFpbCBmb3IgQmlsbGluZyBBbGVydHMgYW5kIEluaXRpYWwgVXNlciBDcmVhdGlvbicsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==