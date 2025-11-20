"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeArchiveApiStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const iam = require("aws-cdk-lib/aws-iam");
const cognito = require("aws-cdk-lib/aws-cognito");
class RecipeArchiveApiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Import existing Cognito User Pool
        const userPool = cognito.UserPool.fromUserPoolId(this, "ImportedUserPool", props.userPoolId);
        // IAM Role for Lambda Functions with secure naming
        const lambdaRole = new iam.Role(this, "SecureApiLambdaRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            roleName: `recipe-api-lambda-role-${props.secureRandomId}`,
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
        const healthFunction = new lambda.Function(this, "SecureApiHealthFunction", {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: "bootstrap",
            code: lambda.Code.fromAsset("../functions/dist/health-package"),
            functionName: `recipe-api-health-${props.secureRandomId}`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                ENVIRONMENT: props.environment,
                REGION: this.region,
                S3_STORAGE_BUCKET: props.storageBucketName,
                S3_TEMP_BUCKET: props.tempBucketName,
                S3_FAILED_PARSING_BUCKET: props.failedParsingBucketName,
                COGNITO_USER_POOL_ID: props.userPoolId,
            },
            role: lambdaRole,
        });
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
exports.RecipeArchiveApiStack = RecipeArchiveApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmVjaXBlLWFyY2hpdmUtYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyxtREFBbUQ7QUFjbkQsTUFBYSxxQkFBc0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUdsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG9DQUFvQztRQUNwQyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FDOUMsSUFBSSxFQUNKLGtCQUFrQixFQUNsQixLQUFLLENBQUMsVUFBVSxDQUNqQixDQUFDO1FBRUYsbURBQW1EO1FBQ25ELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0QsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELFFBQVEsRUFBRSwwQkFBMEIsS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUMxRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FDeEMsMENBQTBDLENBQzNDO2FBQ0Y7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsUUFBUSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDL0IsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLGNBQWM7Z0NBQ2QsY0FBYztnQ0FDZCxpQkFBaUI7Z0NBQ2pCLGVBQWU7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QUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztJQUM5RCxDQUFDO0NBQ0Y7QUEzSUQsc0RBMklDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXlcIjtcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZ25pdG9cIjtcblxuZXhwb3J0IGludGVyZmFjZSBSZWNpcGVBcmNoaXZlQXBpU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgYWRtaW5FbWFpbDogc3RyaW5nO1xuICAvLyBSZWZlcmVuY2VzIHRvIGV4aXN0aW5nIG1pbmltYWwgaW5mcmFzdHJ1Y3R1cmVcbiAgdXNlclBvb2xJZDogc3RyaW5nO1xuICB1c2VyUG9vbENsaWVudElkOiBzdHJpbmc7XG4gIHN0b3JhZ2VCdWNrZXROYW1lOiBzdHJpbmc7XG4gIHRlbXBCdWNrZXROYW1lOiBzdHJpbmc7XG4gIGZhaWxlZFBhcnNpbmdCdWNrZXROYW1lOiBzdHJpbmc7XG4gIHNlY3VyZVJhbmRvbUlkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWNpcGVBcmNoaXZlQXBpU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFJlY2lwZUFyY2hpdmVBcGlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBJbXBvcnQgZXhpc3RpbmcgQ29nbml0byBVc2VyIFBvb2xcbiAgICBjb25zdCB1c2VyUG9vbCA9IGNvZ25pdG8uVXNlclBvb2wuZnJvbVVzZXJQb29sSWQoXG4gICAgICB0aGlzLFxuICAgICAgXCJJbXBvcnRlZFVzZXJQb29sXCIsXG4gICAgICBwcm9wcy51c2VyUG9vbElkXG4gICAgKTtcblxuICAgIC8vIElBTSBSb2xlIGZvciBMYW1iZGEgRnVuY3Rpb25zIHdpdGggc2VjdXJlIG5hbWluZ1xuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJTZWN1cmVBcGlMYW1iZGFSb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwibGFtYmRhLmFtYXpvbmF3cy5jb21cIiksXG4gICAgICByb2xlTmFtZTogYHJlY2lwZS1hcGktbGFtYmRhLXJvbGUtJHtwcm9wcy5zZWN1cmVSYW5kb21JZH1gLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICBcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGVcIlxuICAgICAgICApLFxuICAgICAgXSxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIFMzQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiczM6R2V0T2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgXCJzMzpQdXRPYmplY3RcIixcbiAgICAgICAgICAgICAgICBcInMzOkRlbGV0ZU9iamVjdFwiLFxuICAgICAgICAgICAgICAgIFwiczM6TGlzdEJ1Y2tldFwiLFxuICAgICAgICAgICAgICAgIFwiczM6R2V0T2JqZWN0QXR0cmlidXRlc1wiLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOmF3czpzMzo6OiR7cHJvcHMuc3RvcmFnZUJ1Y2tldE5hbWV9YCxcbiAgICAgICAgICAgICAgICBgYXJuOmF3czpzMzo6OiR7cHJvcHMuc3RvcmFnZUJ1Y2tldE5hbWV9LypgLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOnMzOjo6JHtwcm9wcy50ZW1wQnVja2V0TmFtZX1gLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOnMzOjo6JHtwcm9wcy50ZW1wQnVja2V0TmFtZX0vKmAsXG4gICAgICAgICAgICAgICAgYGFybjphd3M6czM6Ojoke3Byb3BzLmZhaWxlZFBhcnNpbmdCdWNrZXROYW1lfWAsXG4gICAgICAgICAgICAgICAgYGFybjphd3M6czM6Ojoke3Byb3BzLmZhaWxlZFBhcnNpbmdCdWNrZXROYW1lfS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRwOkFkbWluR2V0VXNlclwiLFxuICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyXCIsXG4gICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZFwiLFxuICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5MaXN0R3JvdXBzRm9yVXNlclwiLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFt1c2VyUG9vbC51c2VyUG9vbEFybl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBIZWFsdGggTGFtYmRhIEZ1bmN0aW9uIChtaW5pbWFsLCBjb3N0LWVmZmVjdGl2ZSlcbiAgICBjb25zdCBoZWFsdGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgXCJTZWN1cmVBcGlIZWFsdGhGdW5jdGlvblwiLFxuICAgICAge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICAgIGhhbmRsZXI6IFwiYm9vdHN0cmFwXCIsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Z1bmN0aW9ucy9kaXN0L2hlYWx0aC1wYWNrYWdlXCIpLFxuICAgICAgICBmdW5jdGlvbk5hbWU6IGByZWNpcGUtYXBpLWhlYWx0aC0ke3Byb3BzLnNlY3VyZVJhbmRvbUlkfWAsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgbWVtb3J5U2l6ZTogMTI4LCAvLyBNaW5pbWFsIG1lbW9yeSBmb3IgY29zdCBjb250cm9sXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgUzNfU1RPUkFHRV9CVUNLRVQ6IHByb3BzLnN0b3JhZ2VCdWNrZXROYW1lLFxuICAgICAgICAgIFMzX1RFTVBfQlVDS0VUOiBwcm9wcy50ZW1wQnVja2V0TmFtZSxcbiAgICAgICAgICBTM19GQUlMRURfUEFSU0lOR19CVUNLRVQ6IHByb3BzLmZhaWxlZFBhcnNpbmdCdWNrZXROYW1lLFxuICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiBwcm9wcy51c2VyUG9vbElkLFxuICAgICAgICB9LFxuICAgICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSB3aXRoIHNlY3VyZSBuYW1pbmcgYW5kIG1pbmltYWwgY29uZmlndXJhdGlvblxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCBcIlNlY3VyZUFwaVwiLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHJlY2lwZS1hcGktJHtwcm9wcy5zZWN1cmVSYW5kb21JZH1gLFxuICAgICAgZGVzY3JpcHRpb246IFwiUmVjaXBlQXJjaGl2ZSBTZWN1cmUgQVBJIC0gU3RlcCAyIChIZWFsdGggZW5kcG9pbnQgb25seSlcIixcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IFtcbiAgICAgICAgICBcImh0dHBzOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgICAgICAgICBcImh0dHBzOi8vcmVjaXBlYXJjaGl2ZS5jb21cIixcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbXCJHRVRcIiwgXCJQT1NUXCIsIFwiUFVUXCIsIFwiREVMRVRFXCIsIFwiT1BUSU9OU1wiXSxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIixcbiAgICAgICAgICBcIkF1dGhvcml6YXRpb25cIixcbiAgICAgICAgICBcIlgtQW16LURhdGVcIixcbiAgICAgICAgICBcIlgtQXBpLUtleVwiLFxuICAgICAgICAgIFwiWC1BbXotU2VjdXJpdHktVG9rZW5cIixcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogXCJwcm9kXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlByb2R1Y3Rpb24gc3RhZ2UgZm9yIHNlY3VyZSBBUElcIixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBIZWFsdGggZW5kcG9pbnQgaW50ZWdyYXRpb24gKHNpbXBsaWZpZWQgdG8gYXZvaWQgY2lyY3VsYXIgZGVwZW5kZW5jaWVzKVxuICAgIGNvbnN0IGhlYWx0aEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaGVhbHRoRnVuY3Rpb24pO1xuXG4gICAgLy8gQWRkIGhlYWx0aCByZXNvdXJjZSBhbmQgbWV0aG9kIChtaW5pbWFsIGNvbmZpZ3VyYXRpb24pXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKFwiaGVhbHRoXCIpO1xuICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBoZWFsdGhJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBVcGRhdGUgTGFtYmRhIGZ1bmN0aW9uIHdpdGggbmV3IEFQSSBHYXRld2F5IFVSTFxuICAgIGhlYWx0aEZ1bmN0aW9uLmFkZEVudmlyb25tZW50KFwiQVBJX0dBVEVXQVlfVVJMXCIsIHRoaXMuYXBpLnVybCk7XG5cbiAgICAvLyBPdXRwdXQgc2VjdXJlIEFQSSBpZGVudGlmaWVyc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2VjdXJlQXBpR2F0ZXdheVVybFwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJlIEFQSSBHYXRld2F5IFVSTFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVBcGlHYXRld2F5SWRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNlY3VyZSBBUEkgR2F0ZXdheSBJRFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTZWN1cmVIZWFsdGhFbmRwb2ludFwiLCB7XG4gICAgICB2YWx1ZTogYCR7dGhpcy5hcGkudXJsfWhlYWx0aGAsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cmUgSGVhbHRoIENoZWNrIEVuZHBvaW50XCIsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFncyBmb3IgY29zdCB0cmFja2luZ1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChcIlByb2plY3RcIiwgYFJlY2lwZUFyY2hpdmUtJHtwcm9wcy5zZWN1cmVSYW5kb21JZH1gKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoXCJFbnZpcm9ubWVudFwiLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKFwiU2VjdXJlU3RhY2tcIiwgXCJ0cnVlXCIpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChcIlN0YWNrVHlwZVwiLCBcIkFQSS1HYXRld2F5XCIpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChcIkNyZWF0ZWRCeVwiLCBcIlJlY2lwZUFyY2hpdmUtQVBJLUNES1wiKTtcbiAgfVxufVxuIl19