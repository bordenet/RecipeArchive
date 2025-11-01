package main

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
)

// harvestLambdaDiagnostics retrieves diagnostic data from Lambda functions via CloudWatch Logs
func harvestLambdaDiagnostics(cfg *HarvesterConfig, since time.Duration) ([]DiagnosticEntry, error) {
	ctx := context.Background()
	var diagnostics []DiagnosticEntry

	cutoffTime := time.Now().Add(-since)

	// Query CloudWatch Logs for diagnostic entries
	// Look for log groups matching Lambda function patterns
	logGroups := []string{
		"/aws/lambda/RecipeArchive-diagnostics",
		"/aws/lambda/RecipeArchive-diagnostic-processor",
		"/aws/lambda/RecipeArchive-health",
		"/aws/lambda/RecipeArchive-recipes",
		"/aws/lambda/RecipeArchive-content-normalizer",
		"/aws/lambda/RecipeArchive-background-normalizer",
	}

	for _, logGroup := range logGroups {
		// Query logs from this group
		queryInput := &cloudwatchlogs.FilterLogEventsInput{
			LogGroupName:  aws.String(logGroup),
			StartTime:     aws.Int64(cutoffTime.Unix() * 1000),
			FilterPattern: aws.String(`"ERROR" OR "WARN" OR "diagnostic" OR "⚠️" OR "❌"`),
		}

		paginator := cloudwatchlogs.NewFilterLogEventsPaginator(cfg.CWClient, queryInput)

		for paginator.HasMorePages() {
			page, err := paginator.NextPage(ctx)
			if err != nil {
				// Log group might not exist, skip silently
				break
			}

			for _, event := range page.Events {
				if event.Message == nil || event.Timestamp == nil {
					continue
				}

				entry := DiagnosticEntry{
					Timestamp: time.Unix(*event.Timestamp/1000, 0),
					Source:    fmt.Sprintf("Lambda: %s", filepath.Base(logGroup)),
					Message:   *event.Message,
					RawData: map[string]interface{}{
						"logGroup":  logGroup,
						"logStream": aws.ToString(event.LogStreamName),
						"eventId":   aws.ToString(event.EventId),
					},
				}

				// Try to extract error type from message
				if strings.Contains(*event.Message, "ERROR") {
					entry.ErrorType = "ERROR"
				} else if strings.Contains(*event.Message, "WARN") {
					entry.ErrorType = "WARNING"
				} else {
					entry.ErrorType = "INFO"
				}

				diagnostics = append(diagnostics, entry)
			}
		}
	}

	return diagnostics, nil
}
