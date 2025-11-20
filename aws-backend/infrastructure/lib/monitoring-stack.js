"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringStack = void 0;
const cdk = require("aws-cdk-lib");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const sns = require("aws-cdk-lib/aws-sns");
const subscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
const cloudwatch_actions = require("aws-cdk-lib/aws-cloudwatch-actions");
const s3 = require("aws-cdk-lib/aws-s3");
class MonitoringStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // SNS Topic for alerts
        const alertTopic = new sns.Topic(this, "RecipeArchiveAlerts", {
            displayName: "RecipeArchive Production Alerts",
        });
        // Add email subscription (replace with your email)
        alertTopic.addSubscription(new subscriptions.EmailSubscription("your-email@example.com"));
        // Alarm: High parsing failure rate
        const parsingFailureAlarm = new cloudwatch.Alarm(this, "HighParsingFailures", {
            metric: new cloudwatch.Metric({
                namespace: "RecipeArchive/Diagnostics",
                metricName: "ParsingFailures",
                statistic: "Sum",
                period: cdk.Duration.minutes(5),
            }),
            threshold: 10,
            evaluationPeriods: 2,
            datapointsToAlarm: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            alarmDescription: "Parser is failing frequently - check diagnostics S3 bucket",
        });
        parsingFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        // Alarm: Garbage recipes being produced
        const garbageRecipeAlarm = new cloudwatch.Alarm(this, "GarbageRecipes", {
            metric: new cloudwatch.Metric({
                namespace: "RecipeArchive/Normalizer",
                metricName: "GarbageRecipes",
                statistic: "Sum",
                period: cdk.Duration.minutes(15),
            }),
            threshold: 5,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            alarmDescription: "Normalizer producing recipes with 0 ingredients AND 0 instructions",
        });
        garbageRecipeAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        // Alarm: Lambda errors
        const lambdaErrorAlarm = new cloudwatch.Alarm(this, "LambdaErrors", {
            metric: new cloudwatch.Metric({
                metricName: "Errors",
                namespace: "AWS/Lambda",
                dimensionsMap: { FunctionName: "background-normalizer" },
                statistic: "Sum",
                period: cdk.Duration.minutes(5),
            }),
            threshold: 3,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: "Lambda function errors detected",
        });
        lambdaErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
        // CloudWatch Dashboard
        const dashboard = new cloudwatch.Dashboard(this, "RecipeArchiveDashboard", {
            dashboardName: "RecipeArchive-Production",
        });
        dashboard.addWidgets(
        // Parsing Failures by Error Type
        new cloudwatch.GraphWidget({
            title: "Parsing Failures by Error Type",
            left: [
                new cloudwatch.Metric({
                    namespace: "RecipeArchive/Diagnostics",
                    metricName: "ParsingFailures",
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    dimensionsMap: { ErrorType: "EMPTY_RECIPE" },
                    label: "Empty Recipe",
                }),
                new cloudwatch.Metric({
                    namespace: "RecipeArchive/Diagnostics",
                    metricName: "ParsingFailures",
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    dimensionsMap: { ErrorType: "PARSE_ERROR" },
                    label: "Parse Error",
                }),
            ],
        }), 
        // Recipe Quality Distribution
        new cloudwatch.GraphWidget({
            title: "Recipe Quality",
            left: [
                new cloudwatch.Metric({
                    namespace: "RecipeArchive/Normalizer",
                    metricName: "RecipeQuality",
                    statistic: "Sum",
                    period: cdk.Duration.minutes(15),
                    dimensionsMap: { Quality: "GOOD" },
                    label: "Good Quality",
                }),
                new cloudwatch.Metric({
                    namespace: "RecipeArchive/Normalizer",
                    metricName: "RecipeQuality",
                    statistic: "Sum",
                    period: cdk.Duration.minutes(15),
                    dimensionsMap: { Quality: "LOW" },
                    label: "Low Quality",
                }),
                new cloudwatch.Metric({
                    namespace: "RecipeArchive/Normalizer",
                    metricName: "RecipeQuality",
                    statistic: "Sum",
                    period: cdk.Duration.minutes(15),
                    dimensionsMap: { Quality: "POOR" },
                    label: "Poor (0 ingredients OR 0 instructions)",
                }),
                new cloudwatch.Metric({
                    namespace: "RecipeArchive/Normalizer",
                    metricName: "RecipeQuality",
                    statistic: "Sum",
                    period: cdk.Duration.minutes(15),
                    dimensionsMap: { Quality: "GARBAGE" },
                    label: "Garbage (0/0)",
                }),
            ],
        }), 
        // Lambda Performance
        new cloudwatch.GraphWidget({
            title: "Lambda Duration",
            left: [
                new cloudwatch.Metric({
                    namespace: "AWS/Lambda",
                    metricName: "Duration",
                    statistic: "Average",
                    dimensionsMap: { FunctionName: "background-normalizer" },
                    period: cdk.Duration.minutes(5),
                }),
            ],
        }));
        // S3 Event Metrics
        const failedParsingBucketName = new cdk.CfnParameter(this, "FailedParsingBucketName", {
            type: "String",
            default: "recipe-failed-<RANDOM_ID>-<ACCOUNT_ID>",
            description: "Name of the S3 bucket used to store failed parsing diagnostics. Replace with your actual bucket name when deploying.",
        });
        const failedParsingBucket = s3.Bucket.fromBucketName(this, "FailedParsingBucket", failedParsingBucketName.valueAsString);
        // Add metric filter for diagnostics/ prefix
        const diagnosticsMetric = new cloudwatch.Metric({
            namespace: "AWS/S3",
            metricName: "NumberOfObjects",
            dimensionsMap: {
                BucketName: failedParsingBucket.bucketName,
                StorageType: "AllStorageTypes",
            },
            statistic: "Average",
            period: cdk.Duration.hours(1),
        });
        new cloudwatch.Alarm(this, "HighDiagnosticVolume", {
            metric: diagnosticsMetric,
            threshold: 100,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: "Large number of diagnostic files - possible parser regression",
        });
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLHlEQUF5RDtBQUN6RCwyQ0FBMkM7QUFDM0MsbUVBQW1FO0FBQ25FLHlFQUF5RTtBQUN6RSx5Q0FBeUM7QUFFekMsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVDLFlBQVksS0FBYyxFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix1QkFBdUI7UUFDdkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM1RCxXQUFXLEVBQUUsaUNBQWlDO1NBQy9DLENBQUMsQ0FBQztRQUVILG1EQUFtRDtRQUNuRCxVQUFVLENBQUMsZUFBZSxDQUN4QixJQUFJLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyx3QkFBd0IsQ0FBQyxDQUM5RCxDQUFDO1FBRUYsbUNBQW1DO1FBQ25DLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM1RSxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsMkJBQTJCO2dCQUN0QyxVQUFVLEVBQUUsaUJBQWlCO2dCQUM3QixTQUFTLEVBQUUsS0FBSztnQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsU0FBUyxFQUFFLEVBQUU7WUFDYixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLHNCQUFz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QUM3QixhQUFhLEVBQUU7Z0JBQ2IsVUFBVSxFQUFFLG1CQUFtQixDQUFDLFVBQVU7Z0JBQzFDLFdBQVcsRUFBRSxpQkFBaUI7YUFDL0I7WUFDRCxTQUFTLEVBQUUsU0FBUztZQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQzlCLENBQUMsQ0FBQztRQUVILElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDakQsTUFBTSxFQUFFLGlCQUFpQjtZQUN6QixTQUFTLEVBQUUsR0FBRztZQUNkLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLHNCQUFzQjtZQUN4RSxnQkFBZ0IsRUFBRSwrREFBK0Q7U0FDbEYsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcExELDBDQW9MQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSBcImF3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoXCI7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnNcIjtcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9uc1wiO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaF9hY3Rpb25zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zXCI7XG5pbXBvcnQgKiBhcyBzMyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXMzXCI7XG5cbmV4cG9ydCBjbGFzcyBNb25pdG9yaW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkFwcCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gU05TIFRvcGljIGZvciBhbGVydHNcbiAgICBjb25zdCBhbGVydFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCBcIlJlY2lwZUFyY2hpdmVBbGVydHNcIiwge1xuICAgICAgZGlzcGxheU5hbWU6IFwiUmVjaXBlQXJjaGl2ZSBQcm9kdWN0aW9uIEFsZXJ0c1wiLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGVtYWlsIHN1YnNjcmlwdGlvbiAocmVwbGFjZSB3aXRoIHlvdXIgZW1haWwpXG4gICAgYWxlcnRUb3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbihcInlvdXItZW1haWxAZXhhbXBsZS5jb21cIilcbiAgICApO1xuXG4gICAgLy8gQWxhcm06IEhpZ2ggcGFyc2luZyBmYWlsdXJlIHJhdGVcbiAgICBjb25zdCBwYXJzaW5nRmFpbHVyZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgXCJIaWdoUGFyc2luZ0ZhaWx1cmVzXCIsIHtcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiBcIlJlY2lwZUFyY2hpdmUvRGlhZ25vc3RpY3NcIixcbiAgICAgICAgbWV0cmljTmFtZTogXCJQYXJzaW5nRmFpbHVyZXNcIixcbiAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBkYXRhcG9pbnRzVG9BbGFybTogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJQYXJzZXIgaXMgZmFpbGluZyBmcmVxdWVudGx5IC0gY2hlY2sgZGlhZ25vc3RpY3MgUzMgYnVja2V0XCIsXG4gICAgfSk7XG4gICAgcGFyc2luZ0ZhaWx1cmVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGVydFRvcGljKSk7XG5cbiAgICAvLyBBbGFybTogR2FyYmFnZSByZWNpcGVzIGJlaW5nIHByb2R1Y2VkXG4gICAgY29uc3QgZ2FyYmFnZVJlY2lwZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgXCJHYXJiYWdlUmVjaXBlc1wiLCB7XG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogXCJSZWNpcGVBcmNoaXZlL05vcm1hbGl6ZXJcIixcbiAgICAgICAgbWV0cmljTmFtZTogXCJHYXJiYWdlUmVjaXBlc1wiLFxuICAgICAgICBzdGF0aXN0aWM6IFwiU3VtXCIsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJOb3JtYWxpemVyIHByb2R1Y2luZyByZWNpcGVzIHdpdGggMCBpbmdyZWRpZW50cyBBTkQgMCBpbnN0cnVjdGlvbnNcIixcbiAgICB9KTtcbiAgICBnYXJiYWdlUmVjaXBlQWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRUb3BpYykpO1xuXG4gICAgLy8gQWxhcm06IExhbWJkYSBlcnJvcnNcbiAgICBjb25zdCBsYW1iZGFFcnJvckFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgXCJMYW1iZGFFcnJvcnNcIiwge1xuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBtZXRyaWNOYW1lOiBcIkVycm9yc1wiLFxuICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0xhbWJkYVwiLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEZ1bmN0aW9uTmFtZTogXCJiYWNrZ3JvdW5kLW5vcm1hbGl6ZXJcIiB9LFxuICAgICAgICBzdGF0aXN0aWM6IFwiU3VtXCIsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMyxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJMYW1iZGEgZnVuY3Rpb24gZXJyb3JzIGRldGVjdGVkXCIsXG4gICAgfSk7XG4gICAgbGFtYmRhRXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGVydFRvcGljKSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIERhc2hib2FyZFxuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCBcIlJlY2lwZUFyY2hpdmVEYXNoYm9hcmRcIiwge1xuICAgICAgZGFzaGJvYXJkTmFtZTogXCJSZWNpcGVBcmNoaXZlLVByb2R1Y3Rpb25cIixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgLy8gUGFyc2luZyBGYWlsdXJlcyBieSBFcnJvciBUeXBlXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiBcIlBhcnNpbmcgRmFpbHVyZXMgYnkgRXJyb3IgVHlwZVwiLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJSZWNpcGVBcmNoaXZlL0RpYWdub3N0aWNzXCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIlBhcnNpbmdGYWlsdXJlc1wiLFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRXJyb3JUeXBlOiBcIkVNUFRZX1JFQ0lQRVwiIH0sXG4gICAgICAgICAgICBsYWJlbDogXCJFbXB0eSBSZWNpcGVcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIlJlY2lwZUFyY2hpdmUvRGlhZ25vc3RpY3NcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiUGFyc2luZ0ZhaWx1cmVzXCIsXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiU3VtXCIsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDogeyBFcnJvclR5cGU6IFwiUEFSU0VfRVJST1JcIiB9LFxuICAgICAgICAgICAgbGFiZWw6IFwiUGFyc2UgRXJyb3JcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuXG4gICAgICAvLyBSZWNpcGUgUXVhbGl0eSBEaXN0cmlidXRpb25cbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IFwiUmVjaXBlIFF1YWxpdHlcIixcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiUmVjaXBlQXJjaGl2ZS9Ob3JtYWxpemVyXCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIlJlY2lwZVF1YWxpdHlcIixcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJTdW1cIixcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDogeyBRdWFsaXR5OiBcIkdPT0RcIiB9LFxuICAgICAgICAgICAgbGFiZWw6IFwiR29vZCBRdWFsaXR5XCIsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJSZWNpcGVBcmNoaXZlL05vcm1hbGl6ZXJcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiUmVjaXBlUXVhbGl0eVwiLFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IFF1YWxpdHk6IFwiTE9XXCIgfSxcbiAgICAgICAgICAgIGxhYmVsOiBcIkxvdyBRdWFsaXR5XCIsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJSZWNpcGVBcmNoaXZlL05vcm1hbGl6ZXJcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiUmVjaXBlUXVhbGl0eVwiLFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IFF1YWxpdHk6IFwiUE9PUlwiIH0sXG4gICAgICAgICAgICBsYWJlbDogXCJQb29yICgwIGluZ3JlZGllbnRzIE9SIDAgaW5zdHJ1Y3Rpb25zKVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiUmVjaXBlQXJjaGl2ZS9Ob3JtYWxpemVyXCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIlJlY2lwZVF1YWxpdHlcIixcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJTdW1cIixcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDogeyBRdWFsaXR5OiBcIkdBUkJBR0VcIiB9LFxuICAgICAgICAgICAgbGFiZWw6IFwiR2FyYmFnZSAoMC8wKVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgfSksXG5cbiAgICAgIC8vIExhbWJkYSBQZXJmb3JtYW5jZVxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogXCJMYW1iZGEgRHVyYXRpb25cIixcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0xhbWJkYVwiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJEdXJhdGlvblwiLFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRnVuY3Rpb25OYW1lOiBcImJhY2tncm91bmQtbm9ybWFsaXplclwiIH0sXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIFMzIEV2ZW50IE1ldHJpY3NcbiAgICBjb25zdCBmYWlsZWRQYXJzaW5nQnVja2V0TmFtZSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsIFwiRmFpbGVkUGFyc2luZ0J1Y2tldE5hbWVcIiwge1xuICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgIGRlZmF1bHQ6IFwicmVjaXBlLWZhaWxlZC08UkFORE9NX0lEPi08QUNDT1VOVF9JRD5cIixcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICBcIk5hbWUgb2YgdGhlIFMzIGJ1Y2tldCB1c2VkIHRvIHN0b3JlIGZhaWxlZCBwYXJzaW5nIGRpYWdub3N0aWNzLiBSZXBsYWNlIHdpdGggeW91ciBhY3R1YWwgYnVja2V0IG5hbWUgd2hlbiBkZXBsb3lpbmcuXCIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBmYWlsZWRQYXJzaW5nQnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXROYW1lKFxuICAgICAgdGhpcyxcbiAgICAgIFwiRmFpbGVkUGFyc2luZ0J1Y2tldFwiLFxuICAgICAgZmFpbGVkUGFyc2luZ0J1Y2tldE5hbWUudmFsdWVBc1N0cmluZ1xuICAgICk7XG5cbiAgICAvLyBBZGQgbWV0cmljIGZpbHRlciBmb3IgZGlhZ25vc3RpY3MvIHByZWZpeFxuICAgIGNvbnN0IGRpYWdub3N0aWNzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogXCJBV1MvUzNcIixcbiAgICAgIG1ldHJpY05hbWU6IFwiTnVtYmVyT2ZPYmplY3RzXCIsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEJ1Y2tldE5hbWU6IGZhaWxlZFBhcnNpbmdCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgU3RvcmFnZVR5cGU6IFwiQWxsU3RvcmFnZVR5cGVzXCIsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgIH0pO1xuXG4gICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgXCJIaWdoRGlhZ25vc3RpY1ZvbHVtZVwiLCB7XG4gICAgICBtZXRyaWM6IGRpYWdub3N0aWNzTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAxMDAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246IFwiTGFyZ2UgbnVtYmVyIG9mIGRpYWdub3N0aWMgZmlsZXMgLSBwb3NzaWJsZSBwYXJzZXIgcmVncmVzc2lvblwiLFxuICAgIH0pO1xuICB9XG59XG4iXX0=