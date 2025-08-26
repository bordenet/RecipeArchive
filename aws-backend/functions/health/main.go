package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
}

// APIResponse represents a standardized API response
type APIResponse struct {
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
}

// newAPIResponse creates a new API response with CORS headers
func newAPIResponse(statusCode int, body interface{}) (events.APIGatewayProxyResponse, error) {
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return events.APIGatewayProxyResponse{}, err
	}

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
		Body: string(bodyJSON),
	}, nil
}

// handleCORS handles CORS preflight requests
func handleCORS() (events.APIGatewayProxyResponse, error) {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Access-Control-Max-Age":       "86400",
		},
		Body: "",
	}, nil
}

// handler processes the Lambda request
func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Handle CORS preflight requests
	if request.HTTPMethod == "OPTIONS" {
		return handleCORS()
	}

	// Health check endpoint
	if request.HTTPMethod == "GET" && (request.Path == "/health" || request.Path == "/v1/diagnostics") {
		response := HealthResponse{
			Status:    "healthy",
			Timestamp: time.Now().UTC(),
			Version:   "1.0.0",
		}
		return newAPIResponse(http.StatusOK, response)
	}

	// Default 404 response
	errorResponse := map[string]interface{}{
		"error": map[string]interface{}{
			"code":      "NOT_FOUND",
			"message":   "Endpoint not found",
			"timestamp": time.Now().UTC(),
		},
	}
	return newAPIResponse(http.StatusNotFound, errorResponse)
}

func main() {
	lambda.Start(handler)
}
