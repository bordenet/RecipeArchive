import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
export interface RecipeArchiveStackProps extends cdk.StackProps {
    environment: string;
    adminEmail: string;
}
export declare class RecipeArchiveStack extends cdk.Stack {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly recipesTable: dynamodb.Table;
    readonly storageBucket: s3.Bucket;
    readonly tempBucket: s3.Bucket;
    readonly failedParsingBucket: s3.Bucket;
    readonly api: apigateway.RestApi;
    readonly billingAlertTopic: sns.Topic;
    constructor(scope: Construct, id: string, props: RecipeArchiveStackProps);
}
