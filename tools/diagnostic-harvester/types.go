package main

import (
	"time"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// DiagnosticEntry represents a single diagnostic telemetry entry
type DiagnosticEntry struct {
	Timestamp time.Time
	Source    string
	ErrorType string
	Message   string
	URL       string
	Context   map[string]interface{}
	RawData   map[string]interface{}
	S3Key     string
}

// HarvesterConfig holds configuration and AWS clients for harvesting
type HarvesterConfig struct {
	BucketName string
	S3Client   *s3.Client
	CWClient   *cloudwatchlogs.Client
}