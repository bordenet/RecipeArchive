package utils

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

func TestGetAWSRegion(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		expected string
	}{
		{
			name:     "region from environment",
			envValue: "us-east-1",
			expected: "us-east-1",
		},
		{
			name:     "fallback to default",
			envValue: "",
			expected: "us-west-2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save original value
			originalRegion := Region
			defer func() { Region = originalRegion }()

			// Set test value
			Region = tt.envValue

			result := GetAWSRegion()
			if result != tt.expected {
				t.Errorf("GetAWSRegion() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetS3BucketName(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		expected string
	}{
		{
			name:     "bucket from environment",
			envValue: "my-recipe-bucket",
			expected: "my-recipe-bucket",
		},
		{
			name:     "empty when not set",
			envValue: "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save original value
			originalBucket := S3RecipeStorageBucket
			defer func() { S3RecipeStorageBucket = originalBucket }()

			// Set test value
			S3RecipeStorageBucket = tt.envValue

			result := GetS3BucketName()
			if result != tt.expected {
				t.Errorf("GetS3BucketName() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetCognitoConfig(t *testing.T) {
	// Save original values
	originalUserPoolID := os.Getenv("COGNITO_USER_POOL_ID")
	originalClientID := os.Getenv("COGNITO_APP_CLIENT_ID")
	defer func() {
		os.Setenv("COGNITO_USER_POOL_ID", originalUserPoolID)
		os.Setenv("COGNITO_APP_CLIENT_ID", originalClientID)
	}()

	// Set test values
	os.Setenv("COGNITO_USER_POOL_ID", "us-west-2_TEST123")
	os.Setenv("COGNITO_APP_CLIENT_ID", "testclient123")

	userPoolID, clientID := GetCognitoConfig()

	if userPoolID != "us-west-2_TEST123" {
		t.Errorf("GetCognitoConfig() userPoolID = %v, want us-west-2_TEST123", userPoolID)
	}
	if clientID != "testclient123" {
		t.Errorf("GetCognitoConfig() clientID = %v, want testclient123", clientID)
	}
}

func TestGetAPIBaseURL(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		expected string
	}{
		{
			name:     "URL from environment",
			envValue: "https://api.example.com",
			expected: "https://api.example.com",
		},
		{
			name:     "fallback to default",
			envValue: "",
			expected: "https://your-api-gateway-url.example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save original value
			originalURL := os.Getenv("API_BASE_URL")
			defer os.Setenv("API_BASE_URL", originalURL)

			// Set test value
			os.Setenv("API_BASE_URL", tt.envValue)

			result := GetAPIBaseURL()
			if result != tt.expected {
				t.Errorf("GetAPIBaseURL() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetWebAppURL(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		expected string
	}{
		{
			name:     "URL from environment",
			envValue: "https://app.example.com",
			expected: "https://app.example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save original value
			originalURL := os.Getenv("WEB_APP_URL")
			defer os.Setenv("WEB_APP_URL", originalURL)

			// Set test value
			os.Setenv("WEB_APP_URL", tt.envValue)

			result := GetWebAppURL()
			if result != tt.expected {
				t.Errorf("GetWebAppURL() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestNewAPIResponse(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       interface{}
		wantErr    bool
	}{
		{
			name:       "successful response with map",
			statusCode: 200,
			body:       map[string]string{"message": "success"},
			wantErr:    false,
		},
		{
			name:       "error response",
			statusCode: 400,
			body:       map[string]string{"error": "bad request"},
			wantErr:    false,
		},
		{
			name:       "response with struct",
			statusCode: 201,
			body:       struct{ ID string }{ID: "test-123"},
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := NewAPIResponse(tt.statusCode, tt.body)

			if (err != nil) != tt.wantErr {
				t.Errorf("NewAPIResponse() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if resp.StatusCode != tt.statusCode {
				t.Errorf("NewAPIResponse() StatusCode = %v, want %v", resp.StatusCode, tt.statusCode)
			}

			// Verify CORS headers
			if resp.Headers["Access-Control-Allow-Origin"] != "*" {
				t.Errorf("Missing or incorrect CORS header")
			}

			// Verify body is valid JSON
			var bodyMap map[string]interface{}
			if err := json.Unmarshal([]byte(resp.Body), &bodyMap); err != nil {
				t.Errorf("Response body is not valid JSON: %v", err)
			}
		})
	}
}

func TestNewErrorResponse(t *testing.T) {
	resp, err := NewErrorResponse("VALIDATION_ERROR", "Invalid input", 400, nil, "req-123")

	if err != nil {
		t.Errorf("NewErrorResponse() error = %v", err)
		return
	}

	if resp.StatusCode != 400 {
		t.Errorf("NewErrorResponse() StatusCode = %v, want 400", resp.StatusCode)
	}

	// Parse the error response
	var errorResp ErrorResponse
	if err := json.Unmarshal([]byte(resp.Body), &errorResp); err != nil {
		t.Errorf("Failed to parse error response: %v", err)
		return
	}

	if errorResp.Error.Code != "VALIDATION_ERROR" {
		t.Errorf("Error code = %v, want VALIDATION_ERROR", errorResp.Error.Code)
	}
	if errorResp.Error.Message != "Invalid input" {
		t.Errorf("Error message = %v, want Invalid input", errorResp.Error.Message)
	}
	if errorResp.Error.RequestID != "req-123" {
		t.Errorf("Request ID = %v, want req-123", errorResp.Error.RequestID)
	}
}

func TestGetRequestID(t *testing.T) {
	tests := []struct {
		name    string
		request events.APIGatewayProxyRequest
		wantID  string
	}{
		{
			name: "request ID from context",
			request: events.APIGatewayProxyRequest{
				RequestContext: events.APIGatewayProxyRequestContext{
					RequestID: "test-request-123",
				},
			},
			wantID: "test-request-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetRequestID(tt.request)
			if result != tt.wantID {
				t.Errorf("GetRequestID() = %v, want %v", result, tt.wantID)
			}
		})
	}

	// Test generated request ID
	t.Run("generated request ID", func(t *testing.T) {
		request := events.APIGatewayProxyRequest{}
		result := GetRequestID(request)
		if result == "" {
			t.Errorf("GetRequestID() should generate an ID when none exists")
		}
		if len(result) < 5 {
			t.Errorf("Generated request ID seems too short: %v", result)
		}
	})
}

func TestGetPathParameter(t *testing.T) {
	tests := []struct {
		name     string
		request  events.APIGatewayProxyRequest
		key      string
		expected string
	}{
		{
			name: "existing path parameter",
			request: events.APIGatewayProxyRequest{
				PathParameters: map[string]string{
					"id": "recipe-123",
				},
			},
			key:      "id",
			expected: "recipe-123",
		},
		{
			name: "missing path parameter",
			request: events.APIGatewayProxyRequest{
				PathParameters: map[string]string{},
			},
			key:      "id",
			expected: "",
		},
		{
			name:     "nil path parameters",
			request:  events.APIGatewayProxyRequest{},
			key:      "id",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetPathParameter(tt.request, tt.key)
			if result != tt.expected {
				t.Errorf("GetPathParameter() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetQueryParameter(t *testing.T) {
	tests := []struct {
		name     string
		request  events.APIGatewayProxyRequest
		key      string
		expected string
	}{
		{
			name: "existing query parameter",
			request: events.APIGatewayProxyRequest{
				QueryStringParameters: map[string]string{
					"limit": "10",
				},
			},
			key:      "limit",
			expected: "10",
		},
		{
			name: "missing query parameter",
			request: events.APIGatewayProxyRequest{
				QueryStringParameters: map[string]string{},
			},
			key:      "limit",
			expected: "",
		},
		{
			name:     "nil query parameters",
			request:  events.APIGatewayProxyRequest{},
			key:      "limit",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetQueryParameter(tt.request, tt.key)
			if result != tt.expected {
				t.Errorf("GetQueryParameter() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetQueryParameterInt(t *testing.T) {
	tests := []struct {
		name         string
		request      events.APIGatewayProxyRequest
		key          string
		defaultValue int
		expected     int
	}{
		{
			name: "valid integer parameter",
			request: events.APIGatewayProxyRequest{
				QueryStringParameters: map[string]string{
					"limit": "25",
				},
			},
			key:          "limit",
			defaultValue: 10,
			expected:     25,
		},
		{
			name: "missing parameter uses default",
			request: events.APIGatewayProxyRequest{
				QueryStringParameters: map[string]string{},
			},
			key:          "limit",
			defaultValue: 10,
			expected:     10,
		},
		{
			name: "invalid integer uses default",
			request: events.APIGatewayProxyRequest{
				QueryStringParameters: map[string]string{
					"limit": "not-a-number",
				},
			},
			key:          "limit",
			defaultValue: 10,
			expected:     10,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetQueryParameterInt(tt.request, tt.key, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("GetQueryParameterInt() = %v, want %v", result, tt.expected)
			}
		})
	}
}
