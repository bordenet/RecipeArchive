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

// harvestExtensionDiagnostics retrieves diagnostic data from web extensions
func harvestExtensionDiagnostics(cfg *HarvesterConfig, since time.Duration) ([]DiagnosticEntry, error) {
	ctx := context.Background()
	var diagnostics []DiagnosticEntry

	cutoffTime := time.Now().Add(-since)

	// List objects in web-extension-errors prefix
	paginator := s3.NewListObjectsV2Paginator(cfg.S3Client, &s3.ListObjectsV2Input{
		Bucket: aws.String(cfg.BucketName),
		Prefix: aws.String("web-extension-errors/"),
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
				result.Body.Close()
				fmt.Fprintf(os.Stderr, "⚠️  Failed to parse JSON from %s: %v\n", *obj.Key, err)
				continue
			}
			result.Body.Close()

			// Extract diagnostic information
			entry := DiagnosticEntry{
				Timestamp: *obj.LastModified,
				Source:    "Web Extension",
				RawData:   rawData,
				S3Key:     *obj.Key,
			}

			if errorType, ok := rawData["errorType"].(string); ok {
				entry.ErrorType = errorType
			}
			if errorMsg, ok := rawData["errorMessage"].(string); ok {
				entry.Message = errorMsg
			} else if msg, ok := rawData["message"].(string); ok {
				entry.Message = msg
			}
			if url, ok := rawData["url"].(string); ok {
				entry.URL = url
			}
			if ctx, ok := rawData["context"].(map[string]interface{}); ok {
				entry.Context = ctx
			}

			diagnostics = append(diagnostics, entry)
		}
	}

	return diagnostics, nil
}
