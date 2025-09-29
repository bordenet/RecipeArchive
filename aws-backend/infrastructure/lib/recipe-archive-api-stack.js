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
        const userPool = cognito.UserPool.fromUserPoolId(this, 'ImportedUserPool', props.userPoolId);
        // IAM Role for Lambda Functions with secure naming
        const lambdaRole = new iam.Role(this, 'SecureApiLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            roleName: `recipe-api-lambda-role-${props.secureRandomId}`,
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
                                's3:ListBucket',
                                's3:GetObjectAttributes',
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
                                'cognito-idp:AdminGetUser',
                                'cognito-idp:AdminCreateUser',
                                'cognito-idp:AdminSetUserPassword',
                                'cognito-idp:AdminListGroupsForUser',
                            ],
                            resources: [userPool.userPoolArn],
                        }),
                    ],
                }),
            },
        });
        // Health Lambda Function (minimal, cost-effective)
        const healthFunction = new lambda.Function(this, 'SecureApiHealthFunction', {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../functions/dist/health-package'),
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
        this.api = new apigateway.RestApi(this, 'SecureApi', {
            restApiName: `recipe-api-${props.secureRandomId}`,
            description: 'RecipeArchive Secure API - Step 2 (Health endpoint only)',
            defaultCorsPreflightOptions: {
                allowOrigins: [
                    'https://localhost:3000',
                    'https://d1jcaphz4458q7.cloudfront.net',
                ],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                    'X-Amz-Date',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
                allowCredentials: true,
            },
            deployOptions: {
                stageName: 'prod',
                description: 'Production stage for secure API',
            },
        });
        // Health endpoint integration (simplified to avoid circular dependencies)
        const healthIntegration = new apigateway.LambdaIntegration(healthFunction);
        // Add health resource and method (minimal configuration)
        const healthResource = this.api.root.addResource('health');
        healthResource.addMethod('GET', healthIntegration);
        // Update Lambda function with new API Gateway URL
        healthFunction.addEnvironment('API_GATEWAY_URL', this.api.url);
        // Output secure API identifiers
        new cdk.CfnOutput(this, 'SecureApiGatewayUrl', {
            value: this.api.url,
            description: 'Secure API Gateway URL',
        });
        new cdk.CfnOutput(this, 'SecureApiGatewayId', {
            value: this.api.restApiId,
            description: 'Secure API Gateway ID',
        });
        new cdk.CfnOutput(this, 'SecureHealthEndpoint', {
            value: `${this.api.url}health`,
            description: 'Secure Health Check Endpoint',
        });
        // Add tags for cost tracking
        cdk.Tags.of(this).add('Project', `RecipeArchive-${props.secureRandomId}`);
        cdk.Tags.of(this).add('Environment', props.environment);
        cdk.Tags.of(this).add('SecureStack', 'true');
        cdk.Tags.of(this).add('StackType', 'API-Gateway');
        cdk.Tags.of(this).add('CreatedBy', 'RecipeArchive-API-CDK');
    }
}
exports.RecipeArchiveApiStack = RecipeArchiveApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjaXBlLWFyY2hpdmUtYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmVjaXBlLWFyY2hpdmUtYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyxtREFBbUQ7QUFjbkQsTUFBYSxxQkFBc0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUdsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG9DQUFvQztRQUNwQyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FDOUMsSUFBSSxFQUNKLGtCQUFrQixFQUNsQixLQUFLLENBQUMsVUFBVSxDQUNqQixDQUFDO1FBRUYsbURBQW1EO1FBQ25ELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0QsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELFFBQVEsRUFBRSwwQkFBMEIsS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUMxRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FDeEMsMENBQTBDLENBQzNDO2FBQ0Y7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsUUFBUSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDL0IsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLGNBQWM7Z0NBQ2QsY0FBYztnQ0FDZCxpQkFBaUI7Z0NBQ2pCLGVBQWU7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QUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztJQUM5RCxDQUFDO0NBQ0Y7QUEzSUQsc0RBMklDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcblxuZXhwb3J0IGludGVyZmFjZSBSZWNpcGVBcmNoaXZlQXBpU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgYWRtaW5FbWFpbDogc3RyaW5nO1xuICAvLyBSZWZlcmVuY2VzIHRvIGV4aXN0aW5nIG1pbmltYWwgaW5mcmFzdHJ1Y3R1cmVcbiAgdXNlclBvb2xJZDogc3RyaW5nO1xuICB1c2VyUG9vbENsaWVudElkOiBzdHJpbmc7XG4gIHN0b3JhZ2VCdWNrZXROYW1lOiBzdHJpbmc7XG4gIHRlbXBCdWNrZXROYW1lOiBzdHJpbmc7XG4gIGZhaWxlZFBhcnNpbmdCdWNrZXROYW1lOiBzdHJpbmc7XG4gIHNlY3VyZVJhbmRvbUlkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWNpcGVBcmNoaXZlQXBpU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFJlY2lwZUFyY2hpdmVBcGlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBJbXBvcnQgZXhpc3RpbmcgQ29nbml0byBVc2VyIFBvb2xcbiAgICBjb25zdCB1c2VyUG9vbCA9IGNvZ25pdG8uVXNlclBvb2wuZnJvbVVzZXJQb29sSWQoXG4gICAgICB0aGlzLFxuICAgICAgJ0ltcG9ydGVkVXNlclBvb2wnLFxuICAgICAgcHJvcHMudXNlclBvb2xJZFxuICAgICk7XG5cbiAgICAvLyBJQU0gUm9sZSBmb3IgTGFtYmRhIEZ1bmN0aW9ucyB3aXRoIHNlY3VyZSBuYW1pbmdcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdTZWN1cmVBcGlMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICByb2xlTmFtZTogYHJlY2lwZS1hcGktbGFtYmRhLXJvbGUtJHtwcm9wcy5zZWN1cmVSYW5kb21JZH1gLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICAnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZSdcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBTM0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdEF0dHJpYnV0ZXMnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOmF3czpzMzo6OiR7cHJvcHMuc3RvcmFnZUJ1Y2tldE5hbWV9YCxcbiAgICAgICAgICAgICAgICBgYXJuOmF3czpzMzo6OiR7cHJvcHMuc3RvcmFnZUJ1Y2tldE5hbWV9LypgLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOnMzOjo6JHtwcm9wcy50ZW1wQnVja2V0TmFtZX1gLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOnMzOjo6JHtwcm9wcy50ZW1wQnVja2V0TmFtZX0vKmAsXG4gICAgICAgICAgICAgICAgYGFybjphd3M6czM6Ojoke3Byb3BzLmZhaWxlZFBhcnNpbmdCdWNrZXROYW1lfWAsXG4gICAgICAgICAgICAgICAgYGFybjphd3M6czM6Ojoke3Byb3BzLmZhaWxlZFBhcnNpbmdCdWNrZXROYW1lfS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5TZXRVc2VyUGFzc3dvcmQnLFxuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkxpc3RHcm91cHNGb3JVc2VyJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbdXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gSGVhbHRoIExhbWJkYSBGdW5jdGlvbiAobWluaW1hbCwgY29zdC1lZmZlY3RpdmUpXG4gICAgY29uc3QgaGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdTZWN1cmVBcGlIZWFsdGhGdW5jdGlvbicsXG4gICAgICB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vZnVuY3Rpb25zL2Rpc3QvaGVhbHRoLXBhY2thZ2UnKSxcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBgcmVjaXBlLWFwaS1oZWFsdGgtJHtwcm9wcy5zZWN1cmVSYW5kb21JZH1gLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgIG1lbW9yeVNpemU6IDEyOCwgLy8gTWluaW1hbCBtZW1vcnkgZm9yIGNvc3QgY29udHJvbFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICAgIFMzX1NUT1JBR0VfQlVDS0VUOiBwcm9wcy5zdG9yYWdlQnVja2V0TmFtZSxcbiAgICAgICAgICBTM19URU1QX0JVQ0tFVDogcHJvcHMudGVtcEJ1Y2tldE5hbWUsXG4gICAgICAgICAgUzNfRkFJTEVEX1BBUlNJTkdfQlVDS0VUOiBwcm9wcy5mYWlsZWRQYXJzaW5nQnVja2V0TmFtZSxcbiAgICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogcHJvcHMudXNlclBvb2xJZCxcbiAgICAgICAgfSxcbiAgICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgd2l0aCBzZWN1cmUgbmFtaW5nIGFuZCBtaW5pbWFsIGNvbmZpZ3VyYXRpb25cbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1NlY3VyZUFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgcmVjaXBlLWFwaS0ke3Byb3BzLnNlY3VyZVJhbmRvbUlkfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JlY2lwZUFyY2hpdmUgU2VjdXJlIEFQSSAtIFN0ZXAgMiAoSGVhbHRoIGVuZHBvaW50IG9ubHkpJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IFtcbiAgICAgICAgICAnaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgICAgJ2h0dHBzOi8vZDFqY2FwaHo0NDU4cTcuY2xvdWRmcm9udC5uZXQnLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd01ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb2R1Y3Rpb24gc3RhZ2UgZm9yIHNlY3VyZSBBUEknLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEhlYWx0aCBlbmRwb2ludCBpbnRlZ3JhdGlvbiAoc2ltcGxpZmllZCB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmNpZXMpXG4gICAgY29uc3QgaGVhbHRoSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihoZWFsdGhGdW5jdGlvbik7XG5cbiAgICAvLyBBZGQgaGVhbHRoIHJlc291cmNlIGFuZCBtZXRob2QgKG1pbmltYWwgY29uZmlndXJhdGlvbilcbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2hlYWx0aCcpO1xuICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgaGVhbHRoSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gVXBkYXRlIExhbWJkYSBmdW5jdGlvbiB3aXRoIG5ldyBBUEkgR2F0ZXdheSBVUkxcbiAgICBoZWFsdGhGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnQVBJX0dBVEVXQVlfVVJMJywgdGhpcy5hcGkudXJsKTtcblxuICAgIC8vIE91dHB1dCBzZWN1cmUgQVBJIGlkZW50aWZpZXJzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlY3VyZUFwaUdhdGV3YXlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cmUgQVBJIEdhdGV3YXkgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZWN1cmVBcGlHYXRld2F5SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkucmVzdEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cmUgQVBJIEdhdGV3YXkgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlY3VyZUhlYWx0aEVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IGAke3RoaXMuYXBpLnVybH1oZWFsdGhgLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cmUgSGVhbHRoIENoZWNrIEVuZHBvaW50JyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIGZvciBjb3N0IHRyYWNraW5nXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgYFJlY2lwZUFyY2hpdmUtJHtwcm9wcy5zZWN1cmVSYW5kb21JZH1gKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU2VjdXJlU3RhY2snLCAndHJ1ZScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2tUeXBlJywgJ0FQSS1HYXRld2F5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDcmVhdGVkQnknLCAnUmVjaXBlQXJjaGl2ZS1BUEktQ0RLJyk7XG4gIH1cbn1cbiJdfQ==