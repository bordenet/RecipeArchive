# Infrastructure as Code (IaC) - RecipeArchive

## 🏗️ Complete Infrastructure Definition

All infrastructure components are defined as code in CDK TypeScript. Zero manual configuration required except for:

- AWS CLI credentials
- Email confirmation for SNS subscriptions

## 📦 Infrastructure Components

### 1. Authentication & Authorization

```typescript
// Cognito User Pool with email-based authentication
this.userPool = new cognito.UserPool(this, 'RecipeArchiveUserPool', {
  userPoolName: `recipeArchive-users-${props.environment}`,
  selfSignUpEnabled: true,
  signInAliases: { email: true },
  autoVerify: { email: true },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
});

// User Pool Client for application integration
this.userPoolClient = new cognito.UserPoolClient(
  this,
  'RecipeArchiveUserPoolClient',
  {
    userPool: this.userPool,
    generateSecret: false, // For frontend applications
    authFlows: {
      userPassword: true,
      userSrp: true,
    },
  }
);
```

### 2. Database Layer

```typescript
// DynamoDB table with GSI for efficient querying
this.recipesTable = new dynamodb.Table(this, 'RecipesTable', {
  tableName: `recipeArchive-recipes-${props.environment}`,
  partitionKey: { name: 'recipeId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Free Tier friendly
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  removalPolicy:
    props.environment === 'prod'
      ? cdk.RemovalPolicy.RETAIN
      : cdk.RemovalPolicy.DESTROY,
});

// Global Secondary Indices for search optimization
this.recipesTable.addGlobalSecondaryIndex({
  indexName: 'recipes-by-created',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
});

this.recipesTable.addGlobalSecondaryIndex({
  indexName: 'recipes-by-title',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'title', type: dynamodb.AttributeType.STRING },
});
```

### 3. Storage Layer

```typescript
// Primary storage for recipe photos and documents
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
    // Environment-specific retention
    ...(props.environment === 'prod'
      ? [{ id: 'archive-old-files', expiration: cdk.Duration.days(2555) }]
      : [
          {
            id: 'delete-test-data',
            expiration: cdk.Duration.days(14),
            enabled: true,
          },
        ]),
  ],
});

// Temporary processing bucket
this.tempBucket = new s3.Bucket(this, 'RecipeArchiveTemp', {
  bucketName: `recipearchive-temp-${props.environment}-${this.account}`,
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  versioned: false,
  lifecycleRules: [
    {
      id: 'delete-temp-files',
      expiration: cdk.Duration.days(props.environment === 'prod' ? 7 : 1),
      abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
    },
  ],
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

### 4. Cost Monitoring Infrastructure

```typescript
// SNS Topic for billing alerts (IaC-managed)
this.billingAlertTopic = new sns.Topic(this, 'BillingAlerts', {
  topicName: `recipearchive-billing-alerts-${props.environment}`,
  displayName: 'RecipeArchive Billing Alerts',
});

// Email subscription (IaC-managed, requires manual confirmation)
this.billingAlertTopic.addSubscription(
  new snsSubscriptions.EmailSubscription(props.adminEmail)
);

// AWS Budget with conservative $20/month limit
new budgets.CfnBudget(this, 'MonthlyCostBudget', {
  budget: {
    budgetName: `RecipeArchive-MonthlyCostWatchdog-${props.environment}`,
    budgetType: 'COST',
    timeUnit: 'MONTHLY',
    budgetLimit: { amount: 20, unit: 'USD' }, // $20/month maximum
    timePeriod: {
      start: '1756080093', // Epoch seconds
      end: '2082762102',
    },
  },
  notificationsWithSubscribers: [
    // 25% threshold ($5.00)
    // 50% threshold ($10.00)
    // 80% threshold ($16.00)
    // 100% forecast threshold
  ],
});

// CloudWatch billing alarm
const unusualSpendingAlarm = new cloudwatch.Alarm(
  this,
  'UnusualSpendingAlarm',
  {
    alarmName: `RecipeArchive-UnusualSpending-${props.environment}`,
    metric: new cloudwatch.Metric({
      namespace: 'AWS/Billing',
      metricName: 'EstimatedCharges',
      dimensionsMap: { Currency: 'USD' },
      statistic: 'Maximum',
      period: cdk.Duration.hours(12),
    }),
    threshold: 20, // $20/month
    evaluationPeriods: 1,
  }
);
```

### 5. Compute Layer

```typescript
// Lambda function with minimal resources for cost optimization
const healthFunction = new lambda.Function(this, 'HealthFunction', {
  runtime: lambda.Runtime.PROVIDED_AL2, // Modern Go runtime
  handler: 'bootstrap',
  code: lambda.Code.fromAsset('../functions/dist'),
  timeout: cdk.Duration.seconds(10),
  memorySize: 128, // Minimum for Free Tier
  environment: {
    ENVIRONMENT: props.environment,
    REGION: this.region,
    DYNAMODB_TABLE_NAME: this.recipesTable.tableName,
    S3_STORAGE_BUCKET: this.storageBucket.bucketName,
    S3_TEMP_BUCKET: this.tempBucket.bucketName,
    COGNITO_USER_POOL_ID: this.userPool.userPoolId,
  },
  role: lambdaRole, // IAM role with least-privilege access
});
```

### 6. API Gateway

```typescript
// RESTful API with CORS configuration
this.api = new apigateway.RestApi(this, 'RecipeArchiveAPI', {
  restApiName: `recipeArchive-api-${props.environment}`,
  description: 'RecipeArchive Backend API',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
  },
  deployOptions: { stageName: 'prod' },
});

// API Resources and integrations
const healthResource = this.api.root.addResource('health');
healthResource.addMethod(
  'GET',
  new apigateway.LambdaIntegration(healthFunction)
);

const v1 = this.api.root.addResource('v1');
const diagnosticsResource = v1.addResource('diagnostics');
diagnosticsResource.addMethod(
  'GET',
  new apigateway.LambdaIntegration(healthFunction)
);
```

### 7. IAM Security

```typescript
// Least-privilege IAM role for Lambda functions
const lambdaRole = new iam.Role(this, 'RecipeArchiveLambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    ),
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
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListBucket'],
          resources: [this.storageBucket.bucketArn, this.tempBucket.bucketArn],
        }),
      ],
    }),
  },
});
```

## 💰 Conservative Cost Management

### Budget Thresholds ($20/month maximum)

- **25% Alert ($5.00)**: Early warning
- **50% Alert ($10.00)**: Action recommended
- **80% Alert ($16.00)**: Critical threshold
- **100% Forecast**: Projected overage warning

### Cost Optimization Features

- **Pay-per-request DynamoDB**: No fixed costs
- **Minimal Lambda memory**: 128MB for cost efficiency
- **Aggressive S3 lifecycle**: 14-day dev, 1-day temp retention
- **No S3 versioning in dev**: Prevents duplicate storage costs

## 🚀 Deployment Commands

```bash
# Deploy all infrastructure
cd aws-backend/infrastructure
npx cdk deploy --require-approval never

# Build and deploy Lambda functions
cd ../functions
make clean && make package

# Redeploy with updated functions
cd ../infrastructure
npx cdk deploy --require-approval never
```

## 📊 Infrastructure Outputs

All critical information is exposed as CDK outputs:

- **UserPoolId**: For frontend Cognito integration
- **UserPoolClientId**: For authentication flows
- **ApiGatewayUrl**: For API client configuration
- **StorageBucketName**: For file upload operations
- **TempBucketName**: For processing workflows
- **BillingAlertTopicArn**: For monitoring integration

## 🔐 Security & Compliance

### Data Protection

- **Encryption at rest**: All S3 and DynamoDB data encrypted
- **Private buckets**: No public access configured
- **IAM least privilege**: Minimal required permissions only

### Cost Protection

- **Automatic cleanup**: Lifecycle policies prevent data accumulation
- **Multi-tier alerts**: Early warning system for cost overruns
- **Resource tagging**: Environment-based cost tracking

## 📝 What Requires Manual Setup

**Only these items require manual intervention:**

1. **AWS CLI credentials**: Initial AWS account setup
2. **SNS email confirmation**: Click confirmation link in email
3. **Domain/SSL certificates**: If custom domain needed (optional)

**Everything else is 100% Infrastructure as Code! 🎉**
