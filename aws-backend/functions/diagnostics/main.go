package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
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

// DiagnosticData represents the structure of diagnostic data from extensions
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
	// Set up CORS headers
	headers := map[string]string{
		"Content-Type":                     "application/json",
		"Access-Control-Allow-Origin":      "https://d1jcaphz4458q7.cloudfront.net",
		"Access-Control-Allow-Methods":     "POST, OPTIONS",
		"Access-Control-Allow-Headers":     "Content-Type, Authorization",
		"Access-Control-Allow-Credentials": "true",
	}

	// Handle preflight OPTIONS request
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    headers,
		}, nil
	}

	// Only allow POST requests
	if request.HTTPMethod != "POST" {
		responseBody, _ := json.Marshal(map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "METHOD_NOT_ALLOWED",
				"message": "Only POST method is allowed",
			},
		})
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusMethodNotAllowed,
			Headers:    headers,
			Body:       string(responseBody),
		}, nil
	}

	// Parse the request body
	var diagnosticData DiagnosticData
	if err := json.Unmarshal([]byte(request.Body), &diagnosticData); err != nil {
		responseBody, _ := json.Marshal(map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INVALID_JSON",
				"message": "Invalid JSON in request body",
			},
		})
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Headers:    headers,
			Body:       string(responseBody),
		}, nil
	}

	// Log diagnostic information
	fmt.Printf("📊 Received diagnostic data for URL: %s\n", diagnosticData.URL)
	fmt.Printf("🔍 Error Type: %s, Error: %s\n", diagnosticData.ErrorType, diagnosticData.Error)
	fmt.Printf("🔍 Data size: %d bytes\n", len(request.Body))

	// Store HTML content in S3 if available for debugging
	var s3StorageResult string
	if s3Client != nil && diagnosticData.HTML != "" {
		bucketName := os.Getenv("S3_FAILED_PARSING_BUCKET")
		if bucketName == "" {
			fmt.Printf("⚠️ S3_FAILED_PARSING_BUCKET not configured, skipping HTML storage\n")
		} else {
			// Create filename from URL and timestamp
			timestamp := time.Now().Format("2006-01-02_15-04-05")
			url := strings.ReplaceAll(strings.ReplaceAll(diagnosticData.URL, "https://", ""), "http://", "")
			url = strings.ReplaceAll(strings.ReplaceAll(url, "/", "_"), "?", "_")
			url = strings.ReplaceAll(url, "&", "_")
			if len(url) > 50 {
				url = url[:50]
			}

			filename := fmt.Sprintf("failed-parsing/%s_%s_%s.html", timestamp, url, uuid.New().String()[:8])

			// Store in S3
			_, err := s3Client.PutObject(ctx, &s3.PutObjectInput{
				Bucket:      aws.String(bucketName),
				Key:         aws.String(filename),
				Body:        strings.NewReader(diagnosticData.HTML),
				ContentType: aws.String("text/html"),
				Metadata: map[string]string{
					"url":        diagnosticData.URL,
					"error-type": diagnosticData.ErrorType,
					"user-agent": diagnosticData.UserAgent,
					"timestamp":  diagnosticData.Timestamp,
				},
			})

			if err != nil {
				fmt.Printf("⚠️ Failed to store HTML in S3: %v\n", err)
				s3StorageResult = "failed"
			} else {
				fmt.Printf("✅ Stored HTML content in S3: %s\n", filename)
				s3StorageResult = filename
			}
		}
	}

	// Prepare response
	responseData := map[string]interface{}{
		"message":   "Diagnostic data received successfully",
		"url":       diagnosticData.URL,
		"errorType": diagnosticData.ErrorType,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	if s3StorageResult != "" {
		responseData["htmlStored"] = s3StorageResult
	}

	responseBody, err := json.Marshal(responseData)
	if err != nil {
		return events.APIGatewayProxyResponse{}, fmt.Errorf("failed to marshal response: %w", err)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    headers,
		Body:       string(responseBody),
	}, nil
}

func main() {
	lambda.Start(handler)
}
