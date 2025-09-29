import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
export interface RecipeArchiveStackProps extends cdk.StackProps {
    environment: string;
    adminEmail: string;
}
export declare class RecipeArchiveStack extends cdk.Stack {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly storageBucket: s3.Bucket;
    readonly tempBucket: s3.Bucket;
    readonly failedParsingBucket: s3.Bucket;
    readonly api: apigateway.RestApi;
    readonly billingAlertTopic: sns.Topic;
    private readonly lambdaRole;
    private readonly recipeNormalizationQueue;
    private readonly stackEnvironment;
    private _healthFunction;
    private _recipesFunction;
    private _imageUploadFunction;
    private _diagnosticsFunction;
    private _flutterConsoleDiagnosticsFunction;
    private _contentNormalizerFunction;
    private _backgroundNormalizerFunction;
    private _diagnosticProcessorFunction;
    private _invitationManagerFunction;
    private _registrationHandlerFunction;
    private _analyticsFunction;
    constructor(scope: Construct, id: string, props: RecipeArchiveStackProps);
    getHealthFunction(): lambda.Function;
    getRecipesFunction(): lambda.Function;
    getDiagnosticsFunction(): lambda.Function;
    getImageUploadFunction(): lambda.Function;
    getFlutterConsoleDiagnosticsFunction(): lambda.Function;
    getContentNormalizerFunction(): lambda.Function;
    getBackgroundNormalizerFunction(): lambda.Function;
    getDiagnosticProcessorFunction(): lambda.Function;
    getInvitationManagerFunction(): lambda.Function;
    getRegistrationHandlerFunction(): lambda.Function;
    getAnalyticsFunction(): lambda.Function;
}
