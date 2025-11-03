package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

// RecipeTracer handles end-to-end recipe tracing
type RecipeTracer struct {
	clients    *AWSClients
	bucketName string
	queueURL   string
}

// NewRecipeTracer creates a new recipe tracer
func NewRecipeTracer(clients *AWSClients) *RecipeTracer {
	return &RecipeTracer{
		clients:    clients,
		bucketName: getEnv("S3_STORAGE_BUCKET", "recipe-archive-dev"),
		queueURL:   getEnv("NORMALIZATION_QUEUE_URL", ""),
	}
}

// TraceRecipe performs complete end-to-end tracing for a recipe ID
func (t *RecipeTracer) TraceRecipe(recipeID string) (*RecipeTrace, error) {
	ctx := context.Background()

	trace := &RecipeTrace{
		RecipeID:  recipeID,
		Timeline:  []TraceEvent{},
		S3Events:  []S3Event{},
		SQSEvents: []SQSEvent{},
		LogEvents: []LogEvent{},
	}

	// Step 1: Get current recipe data from S3
	fmt.Printf("📁 Checking S3 recipe data...\n")
	currentData, s3Events, err := t.traceS3Events(ctx, recipeID)
	if err != nil {
		return nil, fmt.Errorf("S3 trace failed: %w", err)
	}
	trace.CurrentData = currentData
	trace.S3Events = s3Events

	// Step 2: Search SQS messages
	fmt.Printf("📨 Checking SQS normalization messages...\n")
	sqsEvents, err := t.traceSQSEvents(ctx, recipeID)
	if err != nil {
		fmt.Printf("⚠️  SQS trace failed: %v\n", err)
		// Continue without SQS events
	} else {
		trace.SQSEvents = sqsEvents
	}

	// Step 3: Search CloudWatch logs
	fmt.Printf("📋 Searching CloudWatch logs...\n")
	logEvents, err := t.traceLogEvents(ctx, recipeID)
	if err != nil {
		fmt.Printf("⚠️  Log trace failed: %v\n", err)
		// Continue without log events
	} else {
		trace.LogEvents = logEvents
	}

	// Step 4: Build timeline and summary
	trace.Timeline = t.buildTimeline(trace)
	trace.Summary = t.buildSummary(trace)

	return trace, nil
}

// traceS3Events finds S3 operations for the recipe
func (t *RecipeTracer) traceS3Events(ctx context.Context, recipeID string) (*RecipeData, []S3Event, error) {
	// We need to find the user ID first by searching for the recipe
	// This is a simplified approach - in production you'd have the user ID
	var currentData *RecipeData
	var events []S3Event

	// List objects to find the recipe
	listOutput, err := t.clients.S3Client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: &t.bucketName,
		Prefix: &[]string{"recipes/"}[0],
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list S3 objects: %w", err)
	}

	var recipeKey string
	for _, obj := range listOutput.Contents {
		if strings.Contains(*obj.Key, recipeID) {
			recipeKey = *obj.Key
			events = append(events, S3Event{
				Timestamp:    *obj.LastModified,
				Operation:    "PUT",
				Key:          *obj.Key,
				Size:         *obj.Size,
				LastModified: *obj.LastModified,
			})
			break
		}
	}

	if recipeKey == "" {
		return nil, events, fmt.Errorf("recipe not found in S3")
	}

	// Get current recipe data
	getOutput, err := t.clients.S3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &t.bucketName,
		Key:    &recipeKey,
	})
	if err == nil {
		var recipe struct {
			Title          string    `json:"title"`
			SourceURL      string    `json:"sourceUrl"`
			CreatedAt      time.Time `json:"createdAt"`
			UpdatedAt      time.Time `json:"updatedAt"`
			Version        int       `json:"version"`
			Ingredients    []any     `json:"ingredients"`
			Instructions   []any     `json:"instructions"`
			CookingMethods []any     `json:"cookingMethods"`
			SearchMetadata *struct {
				QualityScore float64 `json:"qualityScore"`
			} `json:"searchMetadata"`
		}

		if err := json.NewDecoder(getOutput.Body).Decode(&recipe); err == nil {
			qualityScore := 0.0
			if recipe.SearchMetadata != nil {
				qualityScore = recipe.SearchMetadata.QualityScore
			}

			currentData = &RecipeData{
				Title:              recipe.Title,
				SourceURL:          recipe.SourceURL,
				CreatedAt:          recipe.CreatedAt,
				UpdatedAt:          recipe.UpdatedAt,
				Version:            recipe.Version,
				IngredientCount:    len(recipe.Ingredients),
				InstructionCount:   len(recipe.Instructions),
				CookingMethodCount: len(recipe.CookingMethods),
				QualityScore:       qualityScore,
			}
		}
		_ = getOutput.Body.Close()
	}

	return currentData, events, nil
}

// traceSQSEvents searches for SQS messages related to the recipe
func (t *RecipeTracer) traceSQSEvents(ctx context.Context, recipeID string) ([]SQSEvent, error) {
	var events []SQSEvent

	if t.queueURL == "" {
		return events, fmt.Errorf("no queue URL configured")
	}

	// Get queue attributes to check message count
	attrs, err := t.clients.SQSClient.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
		QueueUrl:       &t.queueURL,
		AttributeNames: []types.QueueAttributeName{types.QueueAttributeNameAll},
	})
	if err != nil {
		return events, fmt.Errorf("failed to get queue attributes: %w", err)
	}

	// Note: SQS doesn't provide message history, so we can only check current state
	// In a production system, you'd have message logging or DLQ inspection
	if msgCount, exists := attrs.Attributes["ApproximateNumberOfMessages"]; exists && msgCount != "0" {
		events = append(events, SQSEvent{
			Timestamp: time.Now(),
			Action:    "pending",
			QueueName: "normalization-queue",
			MessageID: "unknown",
		})
	}

	return events, nil
}

// traceLogEvents searches CloudWatch logs for recipe-related entries
func (t *RecipeTracer) traceLogEvents(ctx context.Context, recipeID string) ([]LogEvent, error) {
	var events []LogEvent

	// Common log groups to search
	logGroups := []string{
		"/aws/lambda/RecipeArchive-dev-BackgroundNormalizerFunction40DC-6N25oFUdp4Tt",
		"/aws/lambda/RecipeArchive-dev-BackgroundNormalizerFunction40DC-M0YYgo9x8GDU",
		"/aws/lambda/RecipeArchive-dev-ContentNormalizerFunction7256CD8-H9PZ1QlG31vV",
		"/aws/lambda/RecipeArchive-dev-ContentNormalizerFunction7256CD8-YAtnTbwUa2Kh",
	}

	// Search recent logs (last 48 hours for more comprehensive analysis)
	startTime := time.Now().Add(-48*time.Hour).Unix() * 1000

	for _, logGroup := range logGroups {
		// Get more log streams for comprehensive analysis
		streams, err := t.clients.LogsClient.DescribeLogStreams(ctx, &cloudwatchlogs.DescribeLogStreamsInput{
			LogGroupName: &logGroup,
			OrderBy:      "LastEventTime",
			Descending:   &[]bool{true}[0],
			Limit:        &[]int32{20}[0], // Check more streams
		})
		if err != nil {
			continue // Skip unavailable log groups
		}

		for _, stream := range streams.LogStreams {
			if stream.LastEventTimestamp == nil || *stream.LastEventTimestamp < startTime {
				continue
			}

			// Search for recipe ID in log events with enhanced filtering
			logEvents, err := t.clients.LogsClient.GetLogEvents(ctx, &cloudwatchlogs.GetLogEventsInput{
				LogGroupName:  &logGroup,
				LogStreamName: stream.LogStreamName,
				StartTime:     &startTime,
			})
			if err != nil {
				continue
			}

			// Track multi-line OpenAI responses
			var collectingOpenAI bool
			var openAIBuffer strings.Builder
			var openAIStartTime int64

			for _, event := range logEvents.Events {
				message := *event.Message
				timestamp := *event.Timestamp

				// Check if this event is related to our recipe
				isRecipeRelated := strings.Contains(message, recipeID)

				// Detect caching behavior
				isCacheHit := strings.Contains(message, "🚀 Cache hit! Skipping OpenAI API call")
				isCacheStore := strings.Contains(message, "💾 Cached OpenAI response for content hash:")

				// Add cache events to timeline
				if isCacheHit {
					events = append(events, LogEvent{
						Timestamp: time.Unix(timestamp/1000, 0),
						LogGroup:  logGroup,
						LogStream: *stream.LogStreamName,
						Message:   "🚀 Cache hit! OpenAI API call skipped for similar content",
						Level:     "CACHE",
					})
				}

				if isCacheStore {
					events = append(events, LogEvent{
						Timestamp: time.Unix(timestamp/1000, 0),
						LogGroup:  logGroup,
						LogStream: *stream.LogStreamName,
						Message:   message,
						Level:     "CACHE",
					})
				}

				// Only collect OpenAI debugging info for our specific recipe
				if isRecipeRelated && strings.Contains(message, "🐛 OpenAI Response for debugging:") {
					collectingOpenAI = true
					openAIStartTime = timestamp
					openAIBuffer.Reset()
					openAIBuffer.WriteString("🐛 OpenAI Response:\n")
					continue
				}

				// If we're collecting OpenAI response and this looks like continuation
				if collectingOpenAI {
					// Check if this is the end of the OpenAI response
					if strings.Contains(message, "🐛 Parsed cookingMethods count:") ||
						strings.Contains(message, "Recipe normalized with OpenAI") ||
						strings.Contains(message, "END RequestId:") {

						// Save the collected OpenAI response
						if openAIBuffer.Len() > 0 {
							events = append(events, LogEvent{
								Timestamp: time.Unix(openAIStartTime/1000, 0),
								LogGroup:  logGroup,
								LogStream: *stream.LogStreamName,
								Message:   openAIBuffer.String(),
								Level:     "DEBUG",
							})
						}
						collectingOpenAI = false
						openAIBuffer.Reset()
					} else {
						// Continue collecting OpenAI response
						openAIBuffer.WriteString(message)
						openAIBuffer.WriteString("\n")
						continue
					}
				}

				// Standard recipe-related event collection
				if isRecipeRelated {
					level := "INFO"
					if strings.Contains(message, "❌") || strings.Contains(message, "ERROR") {
						level = "ERROR"
					} else if strings.Contains(message, "⚠️") {
						level = "WARN"
					} else if strings.Contains(message, "🐛") {
						level = "DEBUG"
					}

					events = append(events, LogEvent{
						Timestamp: time.Unix(timestamp/1000, 0),
						LogGroup:  logGroup,
						LogStream: *stream.LogStreamName,
						Message:   message,
						Level:     level,
					})
				}

				// Only collect normalization events that are actually related to our recipe
				// This prevents contamination from other recipes processed at the same time
			}
		}
	}

	return events, nil
}
