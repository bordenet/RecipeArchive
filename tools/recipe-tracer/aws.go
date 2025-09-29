package main

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

// AWSClients holds all AWS service clients
type AWSClients struct {
	S3Client   *s3.Client
	SQSClient  *sqs.Client
	LogsClient *cloudwatchlogs.Client
	Region     string
}

// initAWSClients initializes all AWS service clients
func initAWSClients() (*AWSClients, error) {
	region := getEnv("AWS_REGION", "us-west-2")

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
	)
	if err != nil {
		return nil, err
	}

	return &AWSClients{
		S3Client:   s3.NewFromConfig(cfg),
		SQSClient:  sqs.NewFromConfig(cfg),
		LogsClient: cloudwatchlogs.NewFromConfig(cfg),
		Region:     region,
	}, nil
}