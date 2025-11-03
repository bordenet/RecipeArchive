package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// harvestFlutterDiagnostics retrieves diagnostic data from Flutter apps
func harvestFlutterDiagnostics(cfg *HarvesterConfig, since time.Duration) ([]DiagnosticEntry, error) {
	ctx := context.Background()
	var diagnostics []DiagnosticEntry

	cutoffTime := time.Now().Add(-since)

	// List objects in flutter-console-errors prefix
	paginator := s3.NewListObjectsV2Paginator(cfg.S3Client, &s3.ListObjectsV2Input{
		Bucket: aws.String(cfg.BucketName),
		Prefix: aws.String("flutter-console-errors/"),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list S3 objects: %w", err)
		}

		for _, obj := range page.Contents {
			if obj.Key == nil || strings.HasSuffix(*obj.Key, "/") {
				continue
			}

			// Check if object is within time window
			if obj.LastModified != nil && obj.LastModified.Before(cutoffTime) {
				continue
			}

			// Download and parse the diagnostic file
			result, err := cfg.S3Client.GetObject(ctx, &s3.GetObjectInput{
				Bucket: aws.String(cfg.BucketName),
				Key:    obj.Key,
			})
			if err != nil {
				fmt.Fprintf(os.Stderr, "⚠️  Failed to get object %s: %v\n", *obj.Key, err)
				continue
			}

			var rawData map[string]interface{}
			decoder := json.NewDecoder(result.Body)
			if err := decoder.Decode(&rawData); err != nil {
				_ = result.Body.Close()
				fmt.Fprintf(os.Stderr, "⚠️  Failed to parse JSON from %s: %v\n", *obj.Key, err)
				continue
			}
			_ = result.Body.Close()

			// Extract diagnostic information
			entry := DiagnosticEntry{
				Timestamp: *obj.LastModified,
				Source:    "Flutter App",
				RawData:   rawData,
				S3Key:     *obj.Key,
			}

			if errorType, ok := rawData["errorType"].(string); ok {
				entry.ErrorType = errorType
			}
			if errorMsg, ok := rawData["error"].(string); ok {
				entry.Message = errorMsg
			} else if msg, ok := rawData["message"].(string); ok {
				entry.Message = msg
			}
			if platform, ok := rawData["platform"].(string); ok {
				entry.Source = fmt.Sprintf("Flutter (%s)", platform)
			}

			diagnostics = append(diagnostics, entry)
		}
	}

	return diagnostics, nil
}
