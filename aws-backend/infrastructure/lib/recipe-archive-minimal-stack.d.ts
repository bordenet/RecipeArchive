import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
export interface RecipeArchiveMinimalStackProps extends cdk.StackProps {
    environment: string;
    adminEmail: string;
    includeApiGateway?: boolean;
    includeCloudFront?: boolean;
}
export declare class RecipeArchiveMinimalStack extends cdk.Stack {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly storageBucket: s3.Bucket;
    readonly tempBucket: s3.Bucket;
    readonly failedParsingBucket: s3.Bucket;
    readonly webAppBucket?: s3.Bucket;
    readonly api?: apigateway.RestApi;
    readonly distribution?: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props: RecipeArchiveMinimalStackProps);
}
