import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
export interface RecipeArchiveApiStackProps extends cdk.StackProps {
    environment: string;
    adminEmail: string;
    userPoolId: string;
    userPoolClientId: string;
    storageBucketName: string;
    tempBucketName: string;
    failedParsingBucketName: string;
    secureRandomId: string;
}
export declare class RecipeArchiveApiStack extends cdk.Stack {
    readonly api: apigateway.RestApi;
    constructor(scope: Construct, id: string, props: RecipeArchiveApiStackProps);
}
