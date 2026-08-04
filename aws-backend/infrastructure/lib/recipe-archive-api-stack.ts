import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";

export interface RecipeArchiveApiStackProps extends cdk.StackProps {
  environment: string;
  adminEmail: string;
  // References to existing minimal infrastructure
  userPoolId: string;
  userPoolClientId: string;
  storageBucketName: string;
  tempBucketName: string;
  failedParsingBucketName: string;
  secureRandomId: string;
}

export class RecipeArchiveApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: RecipeArchiveApiStackProps) {
    super(scope, id, props);

    // Import existing Cognito User Pool
    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      "ImportedUserPool",
      props.userPoolId
    );

    // IAM Role for Lambda Functions with secure naming
    const lambdaRole = new iam.Role(this, "SecureApiLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      roleName: `recipe-api-lambda-role-${props.secureRandomId}`,
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
                "s3:GetObjectAttributes",
              ],
              resources: [
                `arn:aws:s3:::${props.storageBucketName}`,
                `arn:aws:s3:::${props.storageBucketName}/*`,
                `arn:aws:s3:::${props.tempBucketName}`,
                `arn:aws:s3:::${props.tempBucketName}/*`,
                `arn:aws:s3:::${props.failedParsingBucketName}`,
                `arn:aws:s3:::${props.failedParsingBucketName}/*`,
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
              resources: [userPool.userPoolArn],
            }),
          ],
        }),
      },
    });

    // Health Lambda Function (minimal, cost-effective)
    const healthFunction = new lambda.Function(
      this,
      "SecureApiHealthFunction",
      {
        runtime: lambda.Runtime.PROVIDED_AL2023,
        handler: "bootstrap",
        code: lambda.Code.fromAsset("../functions/dist/health-package"),
        functionName: `recipe-api-health-${props.secureRandomId}`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128, // Minimal memory for cost control
        environment: {
          ENVIRONMENT: props.environment,
          REGION: this.region,
          S3_STORAGE_BUCKET: props.storageBucketName,
          S3_TEMP_BUCKET: props.tempBucketName,
          S3_FAILED_PARSING_BUCKET: props.failedParsingBucketName,
          COGNITO_USER_POOL_ID: props.userPoolId,
        },
        role: lambdaRole,
      }
    );

    // API Gateway with secure naming and minimal configuration
    this.api = new apigateway.RestApi(this, "SecureApi", {
      restApiName: `recipe-api-${props.secureRandomId}`,
      description: "RecipeArchive Secure API - Step 2 (Health endpoint only)",
      defaultCorsPreflightOptions: {
        allowOrigins: [
          "https://localhost:3000",
          "https://recipearchive.com",
        ],
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
        description: "Production stage for secure API",
      },
    });

    // Health endpoint integration (simplified to avoid circular dependencies)
    const healthIntegration = new apigateway.LambdaIntegration(healthFunction);

    // Add health resource and method (minimal configuration)
    const healthResource = this.api.root.addResource("health");
    healthResource.addMethod("GET", healthIntegration);

    // Update Lambda function with new API Gateway URL
    healthFunction.addEnvironment("API_GATEWAY_URL", this.api.url);

    // Output secure API identifiers
    new cdk.CfnOutput(this, "SecureApiGatewayUrl", {
      value: this.api.url,
      description: "Secure API Gateway URL",
    });

    new cdk.CfnOutput(this, "SecureApiGatewayId", {
      value: this.api.restApiId,
      description: "Secure API Gateway ID",
    });

    new cdk.CfnOutput(this, "SecureHealthEndpoint", {
      value: `${this.api.url}health`,
      description: "Secure Health Check Endpoint",
    });

    // Add tags for cost tracking
    cdk.Tags.of(this).add("Project", `RecipeArchive-${props.secureRandomId}`);
    cdk.Tags.of(this).add("Environment", props.environment);
    cdk.Tags.of(this).add("SecureStack", "true");
    cdk.Tags.of(this).add("StackType", "API-Gateway");
    cdk.Tags.of(this).add("CreatedBy", "RecipeArchive-API-CDK");
  }
}
