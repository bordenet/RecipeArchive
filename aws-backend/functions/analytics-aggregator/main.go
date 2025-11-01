package main

import (
	"log"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"

	"github.com/bordenet/recipe-archive/utils"
)

var (
	s3Client *s3.Client
)

// S3-based analytics system for unified cross-device insights
// Cost: ~$0.10-0.50/month for all users combined

// CustomTime handles timestamps without timezone
type CustomTime struct {
	time.Time
}

func (ct *CustomTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), "\"")

	// Try parsing with timezone first
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		ct.Time = t
		return nil
	}

	// If that fails, try without timezone and assume UTC
	if t, err := time.Parse("2006-01-02T15:04:05.000", s); err == nil {
		ct.Time = t.UTC()
		return nil
	}

	// Try without milliseconds
	if t, err := time.Parse("2006-01-02T15:04:05", s); err == nil {
		ct.Time = t.UTC()
		return nil
	}

	return fmt.Errorf("unable to parse time: %s", s)
}

// Analytics Event Structure - matches Flutter client
type AnalyticsEvent struct {
	EventID         string                 `json:"eventId"`
	UserID          string                 `json:"userId"`
	EventType       string                 `json:"eventType"` // search, resultClick, filterApplied, searchCleared
	Timestamp       CustomTime             `json:"timestamp"`
	DeviceType      string                 `json:"deviceType"` // ios, android, web
	Query           *string                `json:"query,omitempty"`
	ResultCount     *int                   `json:"resultCount,omitempty"`
	ResponseTimeMs  *int                   `json:"responseTimeMs,omitempty"`
	Filters         map[string]interface{} `json:"filters,omitempty"`
	ClickedRecipeID *string                `json:"clickedRecipeId,omitempty"`
	ClickPosition   *int                   `json:"clickPosition,omitempty"`
}

// Monthly Analytics Summary - aggregated view
type MonthlyAnalyticsSummary struct {
	UserID              string         `json:"userId"`
	Month               string         `json:"month"` // YYYY-MM format
	TotalSearches       int            `json:"totalSearches"`
	TotalClicks         int            `json:"totalClicks"`
	AverageResponseTime int            `json:"averageResponseTimeMs"`
	AverageResultCount  float64        `json:"averageResultCount"`
	PopularQueries      map[string]int `json:"popularQueries"`
	PopularFilters      map[string]int `json:"popularFilters"`
	DeviceBreakdown     map[string]int `json:"deviceBreakdown"`
	TopClickedRecipes   map[string]int `json:"topClickedRecipes"`
	LastUpdated         time.Time      `json:"lastUpdated"`
}

// Batch Analytics Request - from Flutter client
type BatchAnalyticsRequest struct {
	Events []AnalyticsEvent `json:"events"`
}

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("us-west-2"))
	if err != nil {
		panic(fmt.Sprintf("Failed to load AWS config: %v", err))
	}

	s3Client = s3.NewFromConfig(cfg)

	fmt.Printf("🚀 S3-Based Analytics Aggregator initialized - COST OPTIMIZED!\n")
	fmt.Printf("📦 Bucket: %s\n", utils.GetS3BucketName())
	fmt.Printf("💰 Cost: ~$0.10-0.50/month for all users\n")
}

func main() {
	lambda.Start(handler)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 Analytics Aggregator - Method: %s, Path: %s\n", request.HTTPMethod, request.Path)

	// Handle CORS preflight requests
	if request.HTTPMethod == "OPTIONS" {
		return utils.NewAPIResponse(http.StatusOK, map[string]string{"message": "CORS preflight"})
	}

	// Validate user access
	validation, err := utils.ValidateTenantAccessSimple(request)
	if err != nil {
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "Failed to validate request",
				"timestamp": time.Now().UTC(),
			},
		})
	}

	if !validation.Valid {
		return utils.NewAPIResponse(http.StatusUnauthorized, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "UNAUTHORIZED",
				"message":   "Invalid or expired token",
				"timestamp": time.Now().UTC(),
			},
		})
	}

	userID := validation.UserID
	fmt.Printf("🔧 User ID: %s\n", userID)

	// Route requests
	switch request.HTTPMethod {
	case "POST":
		if strings.HasSuffix(request.Path, "/analytics/events") {
			return submitAnalyticsEvents(ctx, request, userID)
		}
		return utils.NewAPIResponse(http.StatusNotFound, map[string]string{"error": "Endpoint not found"})

	case "GET":
		if strings.HasSuffix(request.Path, "/analytics/summary") {
			month := request.QueryStringParameters["month"] // Optional: YYYY-MM format
			return getAnalyticsSummary(ctx, userID, month)
		}
		return utils.NewAPIResponse(http.StatusNotFound, map[string]string{"error": "Endpoint not found"})

	default:
		return utils.NewAPIResponse(http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
	}
}

func submitAnalyticsEvents(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 Submitting analytics events for user: %s\n", userID)
	fmt.Printf("🔧 Request body length: %d\n", len(request.Body))

	var req BatchAnalyticsRequest
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		log.Printf("ERROR: JSON unmarshaling error: %v\n", err)
		log.Printf("ERROR: Request body: %s\n", request.Body)
		return utils.NewAPIResponse(http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
	}

	if len(req.Events) == 0 {
		return utils.NewAPIResponse(http.StatusBadRequest, map[string]string{"error": "No events provided"})
	}

	// Validate and enrich events
	enrichedEvents := make([]AnalyticsEvent, 0, len(req.Events))
	for _, event := range req.Events {
		// Ensure user ID matches authenticated user
		event.UserID = userID

		// Generate event ID if missing
		if event.EventID == "" {
			event.EventID = uuid.New().String()
		}

		// Set timestamp if missing
		if event.Timestamp.IsZero() {
			event.Timestamp = CustomTime{time.Now()}
		}

		enrichedEvents = append(enrichedEvents, event)
	}

	fmt.Printf("🔧 Processing %d events for user %s\n", len(enrichedEvents), userID)

	// Store raw events for current month
	currentMonth := time.Now().Format("2006-01")
	if err := storeRawEvents(ctx, userID, currentMonth, enrichedEvents); err != nil {
		log.Printf("ERROR: Failed to store raw events: %v\n", err)
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]string{"error": "Failed to store events"})
	}

	// Update monthly summary
	if err := updateMonthlySummary(ctx, userID, currentMonth, enrichedEvents); err != nil {
		log.Printf("WARN: Failed to update summary (non-critical): %v\n", err)
		// Don't fail the request - raw events are stored
	}

	log.Printf("INFO: Successfully processed %d analytics events\n", len(enrichedEvents))

	return utils.NewAPIResponse(http.StatusOK, map[string]interface{}{
		"message":    "Analytics events processed successfully",
		"eventCount": len(enrichedEvents),
		"userID":     userID,
		"month":      currentMonth,
	})
}

func getAnalyticsSummary(ctx context.Context, userID, month string) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 Getting analytics summary for user: %s, month: %s\n", userID, month)

	// Default to current month if not specified
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	// Get monthly summary
	summary, err := getMonthlySummary(ctx, userID, month)
	if err != nil {
		log.Printf("ERROR: Failed to get monthly summary: %v\n", err)
		// Return empty summary instead of error
		emptySummary := MonthlyAnalyticsSummary{
			UserID:              userID,
			Month:               month,
			TotalSearches:       0,
			TotalClicks:         0,
			AverageResponseTime: 0,
			AverageResultCount:  0.0,
			PopularQueries:      make(map[string]int),
			PopularFilters:      make(map[string]int),
			DeviceBreakdown:     make(map[string]int),
			TopClickedRecipes:   make(map[string]int),
			LastUpdated:         time.Now(),
		}
		return utils.NewAPIResponse(http.StatusOK, emptySummary)
	}

	log.Printf("INFO: Retrieved analytics summary: %d searches, %d clicks\n", summary.TotalSearches, summary.TotalClicks)
	return utils.NewAPIResponse(http.StatusOK, summary)
}

// S3 Storage Functions

func storeRawEvents(ctx context.Context, userID, month string, events []AnalyticsEvent) error {
	// Store raw events in S3: analytics/{userID}/{YYYY-MM}/events/{timestamp}.json
	timestamp := time.Now().Format("20060102-150405")
	key := fmt.Sprintf("analytics/%s/%s/events/%s.json", userID, month, timestamp)

	eventData := map[string]interface{}{
		"userID":     userID,
		"month":      month,
		"timestamp":  time.Now(),
		"eventCount": len(events),
		"events":     events,
	}

	return putJSONToS3(ctx, key, eventData)
}

func updateMonthlySummary(ctx context.Context, userID, month string, newEvents []AnalyticsEvent) error {
	// Get existing summary
	existingSummary, _ := getMonthlySummary(ctx, userID, month)
	if existingSummary == nil {
		existingSummary = &MonthlyAnalyticsSummary{
			UserID:              userID,
			Month:               month,
			TotalSearches:       0,
			TotalClicks:         0,
			AverageResponseTime: 0,
			AverageResultCount:  0.0,
			PopularQueries:      make(map[string]int),
			PopularFilters:      make(map[string]int),
			DeviceBreakdown:     make(map[string]int),
			TopClickedRecipes:   make(map[string]int),
			LastUpdated:         time.Now(),
		}
	}

	// Aggregate new events
	searchEvents := 0
	clickEvents := 0
	totalResponseTime := existingSummary.AverageResponseTime * existingSummary.TotalSearches
	totalResultCount := existingSummary.AverageResultCount * float64(existingSummary.TotalSearches)

	for _, event := range newEvents {
		// Update device breakdown
		if event.DeviceType != "" {
			existingSummary.DeviceBreakdown[event.DeviceType]++
		}

		switch event.EventType {
		case "search":
			searchEvents++
			if event.Query != nil && *event.Query != "" {
				query := strings.ToLower(strings.TrimSpace(*event.Query))
				existingSummary.PopularQueries[query]++
			}
			if event.ResponseTimeMs != nil {
				totalResponseTime += *event.ResponseTimeMs
			}
			if event.ResultCount != nil {
				totalResultCount += float64(*event.ResultCount)
			}
			// Track filter usage
			for filterKey, filterValue := range event.Filters {
				if filterValue != nil {
					key := fmt.Sprintf("%s:%v", filterKey, filterValue)
					existingSummary.PopularFilters[key]++
				}
			}

		case "resultClick":
			clickEvents++
			if event.ClickedRecipeID != nil {
				existingSummary.TopClickedRecipes[*event.ClickedRecipeID]++
			}
		}
	}

	// Update totals and averages
	existingSummary.TotalSearches += searchEvents
	existingSummary.TotalClicks += clickEvents

	if existingSummary.TotalSearches > 0 {
		existingSummary.AverageResponseTime = totalResponseTime / existingSummary.TotalSearches
		existingSummary.AverageResultCount = totalResultCount / float64(existingSummary.TotalSearches)
	}

	existingSummary.LastUpdated = time.Now()

	// Limit map sizes to prevent unbounded growth
	existingSummary.PopularQueries = limitMapSize(existingSummary.PopularQueries, 50)
	existingSummary.PopularFilters = limitMapSize(existingSummary.PopularFilters, 100)
	existingSummary.TopClickedRecipes = limitMapSize(existingSummary.TopClickedRecipes, 50)

	// Store updated summary
	key := fmt.Sprintf("analytics/%s/%s/summary.json", userID, month)
	return putJSONToS3(ctx, key, existingSummary)
}

func getMonthlySummary(ctx context.Context, userID, month string) (*MonthlyAnalyticsSummary, error) {
	key := fmt.Sprintf("analytics/%s/%s/summary.json", userID, month)

	var summary MonthlyAnalyticsSummary
	if err := getJSONFromS3(ctx, key, &summary); err != nil {
		return nil, err
	}

	return &summary, nil
}

// Helper Functions

func limitMapSize(m map[string]int, maxSize int) map[string]int {
	if len(m) <= maxSize {
		return m
	}

	// Convert to slice and sort by count
	type entry struct {
		key   string
		count int
	}

	entries := make([]entry, 0, len(m))
	for k, v := range m {
		entries = append(entries, entry{key: k, count: v})
	}

	// Sort by count (descending)
	for i := 0; i < len(entries)-1; i++ {
		for j := i + 1; j < len(entries); j++ {
			if entries[j].count > entries[i].count {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}
	}

	// Keep only top entries
	result := make(map[string]int, maxSize)
	for i := 0; i < maxSize && i < len(entries); i++ {
		result[entries[i].key] = entries[i].count
	}

	return result
}

func putJSONToS3(ctx context.Context, key string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(utils.GetS3BucketName()),
		Key:         aws.String(key),
		Body:        strings.NewReader(string(jsonData)),
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return fmt.Errorf("failed to put object to S3: %w", err)
	}

	fmt.Printf("📦 Stored analytics to S3: %s\n", key)
	return nil
}

func getJSONFromS3(ctx context.Context, key string, target interface{}) error {
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(utils.GetS3BucketName()),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to get object from S3: %w", err)
	}
	defer result.Body.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return nil
}
