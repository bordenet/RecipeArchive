package main

import (
	"log"
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
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

var s3Client *s3.Client
var cwClient *cloudwatch.Client

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		fmt.Printf("Error loading AWS config: %v\n", err)
		return
	}
	s3Client = s3.NewFromConfig(cfg)
	cwClient = cloudwatch.NewFromConfig(cfg)
}

// DiagnosticError represents a single error from extensions
type DiagnosticError struct {
	URL            string                 `json:"url"`
	UserAgent      string                 `json:"userAgent"`
	ErrorType      string                 `json:"errorType"`
	Error          string                 `json:"error,omitempty"`
	Message        string                 `json:"message,omitempty"`
	Platform       string                 `json:"platform,omitempty"`
	Context        string                 `json:"context,omitempty"`
	HTML           string                 `json:"html,omitempty"`
	RecipeData     map[string]interface{} `json:"recipeData,omitempty"`
	DiagnosticData map[string]interface{} `json:"diagnosticData,omitempty"`
	Timestamp      string                 `json:"timestamp"`
	FailureReason  string                 `json:"failureReason,omitempty"`
}

// DiagnosticRequest represents the expected request format
type DiagnosticRequest struct {
	Errors []DiagnosticError `json:"errors"`
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
	var diagnosticRequest DiagnosticRequest
	if err := json.Unmarshal([]byte(request.Body), &diagnosticRequest); err != nil {
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
	fmt.Printf("📊 Received %d diagnostic errors\n", len(diagnosticRequest.Errors))
	fmt.Printf("🔍 Data size: %d bytes\n", len(request.Body))

	var s3StorageResults []string
	processedCount := 0

	// Process each error
	for i, diagnosticData := range diagnosticRequest.Errors {
		fmt.Printf("📊 Processing error %d: URL: %s\n", i+1, diagnosticData.URL)
		errorMessage := diagnosticData.Error
		if errorMessage == "" {
			errorMessage = diagnosticData.Message
		}
		fmt.Printf("🔍 Error Type: %s, Error: %s\n", diagnosticData.ErrorType, errorMessage)

		// Store ALL diagnostic data in S3 for analysis
		if s3Client != nil {
			bucketName := os.Getenv("S3_FAILED_PARSING_BUCKET")
			if bucketName == "" {
				log.Printf("WARN: S3_FAILED_PARSING_BUCKET not configured, skipping S3 storage\n")
			} else {
				// Create filename from URL and timestamp
				timestamp := time.Now().Format("2006-01-02_15-04-05")
				url := strings.ReplaceAll(strings.ReplaceAll(diagnosticData.URL, "https://", ""), "http://", "")
				url = strings.ReplaceAll(strings.ReplaceAll(url, "/", "_"), "?", "_")
				url = strings.ReplaceAll(url, "&", "_")
				if len(url) > 50 {
					url = url[:50]
				}

				// Store diagnostic JSON data
				diagnosticJSON, _ := json.MarshalIndent(diagnosticData, "", "  ")
				jsonFilename := fmt.Sprintf("diagnostics/%s_%s_%s.json", timestamp, url, uuid.New().String()[:8])

				_, err := s3Client.PutObject(ctx, &s3.PutObjectInput{
					Bucket:      aws.String(bucketName),
					Key:         aws.String(jsonFilename),
					Body:        strings.NewReader(string(diagnosticJSON)),
					ContentType: aws.String("application/json"),
					Metadata: map[string]string{
						"url":        diagnosticData.URL,
						"error-type": diagnosticData.ErrorType,
						"user-agent": diagnosticData.UserAgent,
						"timestamp":  diagnosticData.Timestamp,
					},
				})

				if err != nil {
					log.Printf("WARN: Failed to store diagnostic data in S3: %v\n", err)
					s3StorageResults = append(s3StorageResults, "failed")
				} else {
					log.Printf("INFO: Stored diagnostic data in S3: %s\n", jsonFilename)
					s3StorageResults = append(s3StorageResults, jsonFilename)
				}

				// Also store HTML content if available
				if diagnosticData.HTML != "" {
					htmlFilename := fmt.Sprintf("failed-parsing/%s_%s_%s.html", timestamp, url, uuid.New().String()[:8])

					_, err := s3Client.PutObject(ctx, &s3.PutObjectInput{
						Bucket:      aws.String(bucketName),
						Key:         aws.String(htmlFilename),
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
						log.Printf("WARN: Failed to store HTML in S3: %v\n", err)
					} else {
						log.Printf("INFO: Stored HTML content in S3: %s\n", htmlFilename)
					}
				}
			}
		}
		processedCount++
		publishMetric(ctx, "ParsingFailures", 1.0, diagnosticData.ErrorType, diagnosticData.URL)
	}

	// Prepare response
	responseData := map[string]interface{}{
		"message":         "Diagnostic data received successfully",
		"errorsProcessed": processedCount,
		"timestamp":       time.Now().UTC().Format(time.RFC3339),
	}

	if len(s3StorageResults) > 0 {
		responseData["htmlStored"] = s3StorageResults
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

func publishMetric(ctx context.Context, metricName string, value float64, errorType string, url string) {
	domain := extractDomain(url)

	_, err := cwClient.PutMetricData(ctx, &cloudwatch.PutMetricDataInput{
		Namespace: aws.String("RecipeArchive/Diagnostics"),
		MetricData: []types.MetricDatum{
			{
				MetricName: aws.String(metricName),
				Value:      aws.Float64(value),
				Unit:       types.StandardUnitCount,
				Timestamp:  aws.Time(time.Now()),
				Dimensions: []types.Dimension{
					{Name: aws.String("ErrorType"), Value: aws.String(errorType)},
					{Name: aws.String("Domain"), Value: aws.String(domain)},
				},
			},
		},
	})
	if err != nil {
		log.Printf("WARN: Failed to publish metric: %v\n", err)
	}
}

func extractDomain(url string) string {
	url = strings.ReplaceAll(url, "https://", "")
	url = strings.ReplaceAll(url, "http://", "")
	parts := strings.Split(url, "/")
	domain := strings.ReplaceAll(parts[0], "www.", "")
	return domain
}

func main() {
	lambda.Start(handler)
}
