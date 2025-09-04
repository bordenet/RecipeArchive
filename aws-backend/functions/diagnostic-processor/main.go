package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var s3Client *s3.Client

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		fmt.Printf("Error loading AWS config: %v\n", err)
		return
	}
	s3Client = s3.NewFromConfig(cfg)
}

// DiagnosticSummary represents processed diagnostic data
type DiagnosticSummary struct {
	TotalFailures     int                `json:"totalFailures"`
	FailuresByDomain  map[string]int     `json:"failuresByDomain"`
	FailuresByType    map[string]int     `json:"failuresByType"`
	CommonPatterns    []PatternAnalysis  `json:"commonPatterns"`
	RecentFailures    []FailureDetails   `json:"recentFailures"`
	ParserSuggestions []ParserSuggestion `json:"parserSuggestions"`
	LastAnalyzed      string             `json:"lastAnalyzed"`
}

// PatternAnalysis represents common failure patterns
type PatternAnalysis struct {
	Pattern     string `json:"pattern"`
	Count       int    `json:"count"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
}

// FailureDetails represents individual failure information
type FailureDetails struct {
	URL          string    `json:"url"`
	Domain       string    `json:"domain"`
	ErrorType    string    `json:"errorType"`
	ErrorMessage string    `json:"errorMessage"`
	Timestamp    time.Time `json:"timestamp"`
	UserAgent    string    `json:"userAgent"`
	S3Path       string    `json:"s3Path,omitempty"`
}

// ParserSuggestion represents improvements for parsers
type ParserSuggestion struct {
	Domain     string   `json:"domain"`
	Priority   string   `json:"priority"`
	Issue      string   `json:"issue"`
	Suggestion string   `json:"suggestion"`
	Examples   []string `json:"examples"`
	Confidence float64  `json:"confidence"`
}

// DiagnosticData represents raw diagnostic data structure
type DiagnosticData struct {
	URL            string                 `json:"url"`
	UserAgent      string                 `json:"userAgent"`
	ErrorType      string                 `json:"errorType"`
	Error          string                 `json:"error"`
	HTML           string                 `json:"html,omitempty"`
	RecipeData     map[string]interface{} `json:"recipeData,omitempty"`
	DiagnosticData map[string]interface{} `json:"diagnosticData,omitempty"`
	Timestamp      string                 `json:"timestamp"`
	FailureReason  string                 `json:"failureReason,omitempty"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	headers := map[string]string{
		"Content-Type":                     "application/json",
		"Access-Control-Allow-Origin":      "https://d1jcaphz4458q7.cloudfront.net",
		"Access-Control-Allow-Methods":     "GET, OPTIONS",
		"Access-Control-Allow-Headers":     "Content-Type, Authorization",
		"Access-Control-Allow-Credentials": "true",
	}

	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    headers,
		}, nil
	}

	if request.HTTPMethod != "GET" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusMethodNotAllowed,
			Headers:    headers,
			Body:       `{"error": "Only GET method is allowed"}`,
		}, nil
	}

	// Analyze diagnostic data from S3
	summary, err := analyzeDiagnosticData(ctx)
	if err != nil {
		fmt.Printf("Error analyzing diagnostic data: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Analysis failed: %s"}`, err.Error()),
		}, nil
	}

	responseBody, err := json.Marshal(summary)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Headers:    headers,
			Body:       `{"error": "Failed to marshal response"}`,
		}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    headers,
		Body:       string(responseBody),
	}, nil
}

func analyzeDiagnosticData(ctx context.Context) (*DiagnosticSummary, error) {
	bucketName := "recipearchive-failed-parsing-dev-990537043943"

	// List all diagnostic files
	result, err := s3Client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String("failed-parsing/"),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list S3 objects: %w", err)
	}

	var failures []FailureDetails
	domainMap := make(map[string]int)
	typeMap := make(map[string]int)
	errorPatterns := make(map[string]int)

	// Process each diagnostic file
	for _, obj := range result.Contents {
		if obj.Key == nil {
			continue
		}

		// Extract metadata from object metadata and key
		failure := parseFailureFromS3Key(*obj.Key, obj.LastModified)

		// Get additional metadata if available
		headResult, err := s3Client.HeadObject(ctx, &s3.HeadObjectInput{
			Bucket: aws.String(bucketName),
			Key:    obj.Key,
		})
		if err == nil && headResult.Metadata != nil {
			if url, exists := headResult.Metadata["url"]; exists {
				failure.URL = url
			}
			if errorType, exists := headResult.Metadata["error-type"]; exists {
				failure.ErrorType = errorType
			}
			if userAgent, exists := headResult.Metadata["user-agent"]; exists {
				failure.UserAgent = userAgent
			}
		}

		if failure.URL != "" {
			if domain := extractDomain(failure.URL); domain != "" {
				failure.Domain = domain
				domainMap[domain]++
			}
		}

		if failure.ErrorType != "" {
			typeMap[failure.ErrorType]++
		}

		// Extract error patterns
		if pattern := extractErrorPattern(failure.ErrorMessage); pattern != "" {
			errorPatterns[pattern]++
		}

		failure.S3Path = *obj.Key
		failures = append(failures, failure)
	}

	// Sort failures by timestamp (most recent first)
	sort.Slice(failures, func(i, j int) bool {
		return failures[i].Timestamp.After(failures[j].Timestamp)
	})

	// Limit recent failures to last 50
	recentFailures := failures
	if len(recentFailures) > 50 {
		recentFailures = recentFailures[:50]
	}

	// Analyze patterns
	patterns := analyzePatterns(errorPatterns, domainMap, typeMap)

	// Generate parser suggestions
	suggestions := generateParserSuggestions(domainMap, typeMap, failures)

	return &DiagnosticSummary{
		TotalFailures:     len(failures),
		FailuresByDomain:  domainMap,
		FailuresByType:    typeMap,
		CommonPatterns:    patterns,
		RecentFailures:    recentFailures,
		ParserSuggestions: suggestions,
		LastAnalyzed:      time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func parseFailureFromS3Key(key string, lastModified *time.Time) FailureDetails {
	// Parse timestamp from filename: failed-parsing/2025-09-02_11-04-05_domain.com_uuid.html
	parts := strings.Split(key, "/")
	if len(parts) < 2 {
		return FailureDetails{Timestamp: *lastModified}
	}

	filename := parts[len(parts)-1]
	fileParts := strings.Split(filename, "_")

	failure := FailureDetails{
		Timestamp: *lastModified,
	}

	if len(fileParts) >= 3 {
		// Try to parse timestamp from filename
		timestampStr := fileParts[0] + "_" + fileParts[1]
		if t, err := time.Parse("2006-01-02_15-04-05", timestampStr); err == nil {
			failure.Timestamp = t
		}

		// Extract domain if available
		if len(fileParts) >= 4 {
			domain := fileParts[2]
			domain = strings.ReplaceAll(domain, "_", ".")
			failure.Domain = domain
		}
	}

	return failure
}

func extractDomain(urlStr string) string {
	if urlStr == "" {
		return ""
	}

	u, err := url.Parse(urlStr)
	if err != nil {
		return ""
	}

	domain := u.Hostname()
	domain = strings.TrimPrefix(domain, "www.")
	return domain
}

func extractErrorPattern(errorMsg string) string {
	if errorMsg == "" {
		return ""
	}

	// Common error patterns to identify
	patterns := map[string]*regexp.Regexp{
		"JSON parsing error":     regexp.MustCompile(`JSON|parse|syntax`),
		"Network timeout":        regexp.MustCompile(`timeout|network|connection`),
		"Missing selector":       regexp.MustCompile(`selector|element not found|querySelector`),
		"Invalid data structure": regexp.MustCompile(`undefined|null|invalid|structure`),
		"CORS error":             regexp.MustCompile(`CORS|cross-origin|blocked`),
		"Authentication error":   regexp.MustCompile(`auth|unauthorized|forbidden|401|403`),
	}

	for pattern, regex := range patterns {
		if regex.MatchString(strings.ToLower(errorMsg)) {
			return pattern
		}
	}

	return "Other"
}

func analyzePatterns(errorPatterns, domainMap, typeMap map[string]int) []PatternAnalysis {
	var patterns []PatternAnalysis

	// Analyze error patterns
	for pattern, count := range errorPatterns {
		severity := "low"
		if count > 10 {
			severity = "high"
		} else if count > 5 {
			severity = "medium"
		}

		description := getPatternDescription(pattern)
		patterns = append(patterns, PatternAnalysis{
			Pattern:     pattern,
			Count:       count,
			Description: description,
			Severity:    severity,
		})
	}

	// Sort by count (most common first)
	sort.Slice(patterns, func(i, j int) bool {
		return patterns[i].Count > patterns[j].Count
	})

	return patterns
}

func getPatternDescription(pattern string) string {
	descriptions := map[string]string{
		"JSON parsing error":     "Recipe data contains malformed JSON or unexpected characters",
		"Network timeout":        "Requests are timing out, possibly due to slow site response",
		"Missing selector":       "Parser selectors not finding expected HTML elements",
		"Invalid data structure": "Recipe data structure doesn't match expected format",
		"CORS error":             "Cross-origin request blocked by browser security policy",
		"Authentication error":   "Site requires authentication or blocks automated access",
	}

	if desc, exists := descriptions[pattern]; exists {
		return desc
	}
	return "Unclassified error pattern requiring investigation"
}

func generateParserSuggestions(domainMap, typeMap map[string]int, failures []FailureDetails) []ParserSuggestion {
	var suggestions []ParserSuggestion

	// Analyze each domain with failures
	for domain, count := range domainMap {
		if count < 3 { // Only suggest for domains with multiple failures
			continue
		}

		priority := "low"
		confidence := 0.5

		if count > 20 {
			priority = "high"
			confidence = 0.9
		} else if count > 10 {
			priority = "medium"
			confidence = 0.7
		}

		// Find common issues for this domain
		domainFailures := make([]FailureDetails, 0)
		for _, failure := range failures {
			if failure.Domain == domain {
				domainFailures = append(domainFailures, failure)
				if len(domainFailures) >= 5 { // Limit examples
					break
				}
			}
		}

		issue, suggestion := analyzeDomainFailures(domain, domainFailures)

		examples := make([]string, 0)
		for _, failure := range domainFailures {
			if len(examples) < 3 {
				examples = append(examples, failure.URL)
			}
		}

		suggestions = append(suggestions, ParserSuggestion{
			Domain:     domain,
			Priority:   priority,
			Issue:      issue,
			Suggestion: suggestion,
			Examples:   examples,
			Confidence: confidence,
		})
	}

	// Sort by priority and count
	sort.Slice(suggestions, func(i, j int) bool {
		if suggestions[i].Priority != suggestions[j].Priority {
			priorityOrder := map[string]int{"high": 3, "medium": 2, "low": 1}
			return priorityOrder[suggestions[i].Priority] > priorityOrder[suggestions[j].Priority]
		}
		return domainMap[suggestions[i].Domain] > domainMap[suggestions[j].Domain]
	})

	return suggestions
}

func analyzeDomainFailures(domain string, failures []FailureDetails) (string, string) {
	// Analyze common patterns in domain failures
	commonErrors := make(map[string]int)
	for _, failure := range failures {
		if failure.ErrorType != "" {
			commonErrors[failure.ErrorType]++
		}
	}

	// Find most common error type
	maxCount := 0
	mostCommonError := ""
	for errorType, count := range commonErrors {
		if count > maxCount {
			maxCount = count
			mostCommonError = errorType
		}
	}

	// Generate issue and suggestion based on common error patterns
	switch mostCommonError {
	case "recipe_capture_failed":
		return "Recipe extraction failing consistently",
			fmt.Sprintf("Review and update selectors for %s parser. Check if site structure has changed.", domain)
	case "recipe_transformation_failed":
		return "Recipe data transformation errors",
			fmt.Sprintf("Update data transformation logic for %s to handle new data formats.", domain)
	case "JSON parsing error":
		return "JSON-LD parsing issues",
			fmt.Sprintf("Enhance JSON-LD sanitization for %s to handle malformed structured data.", domain)
	default:
		return "Multiple parsing failures detected",
			fmt.Sprintf("Investigate %s parser - %d failures in recent period suggest structural changes.", domain, len(failures))
	}
}

func main() {
	lambda.Start(handler)
}
