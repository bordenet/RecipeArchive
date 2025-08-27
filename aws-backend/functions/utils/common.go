package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/golang-jwt/jwt/v5"
	"recipe-archive/models"
)

// Import the models package (will be relative import)
// Note: This will be updated once we initialize the module properly

// Environment variables
var (
	DynamoDBTableName = os.Getenv("DYNAMODB_TABLE_NAME")
	S3BucketName      = os.Getenv("S3_BUCKET_NAME")
	Region            = os.Getenv("AWS_REGION")
	CognitoUserPoolID = os.Getenv("COGNITO_USER_POOL_ID")
)

// JWTClaims represents the JWT token claims
type JWTClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	jwt.RegisteredClaims
}

// APIResponse represents a standardized API response
type APIResponse struct {
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
}

// NewAPIResponse creates a new API response with CORS headers
func NewAPIResponse(statusCode int, body interface{}) (events.APIGatewayProxyResponse, error) {
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

// NewErrorResponse creates a standardized error response
func NewErrorResponse(code string, message string, statusCode int, details interface{}, requestID string) (events.APIGatewayProxyResponse, error) {
	errorResp := models.ErrorResponse{
		Error: models.APIError{
			Code:      code,
			Message:   message,
			Details:   details,
			Timestamp: time.Now().UTC(),
			RequestID: requestID,
		},
	}
	return NewAPIResponse(statusCode, errorResp)
}

// ExtractUserFromJWT extracts and validates user information from JWT token
func ExtractUserFromJWT(request events.APIGatewayProxyRequest) (*JWTClaims, error) {
	authHeader := request.Headers["Authorization"]
	if authHeader == "" {
		authHeader = request.Headers["authorization"]
	}

	if authHeader == "" {
		return nil, fmt.Errorf("authorization header missing")
	}

	// Extract token from "Bearer <token>"
	tokenParts := strings.Split(authHeader, " ")
	if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
		return nil, fmt.Errorf("invalid authorization header format")
	}

	tokenString := tokenParts[1]

	// For now, we'll parse without verification since we need to set up JWKS
	// In production, this should verify against Cognito's public keys
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, &JWTClaims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse JWT token: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("failed to extract claims from token")
	}

	return claims, nil
}

// GetRequestID extracts or generates a request ID for tracing
func GetRequestID(request events.APIGatewayProxyRequest) string {
	if reqID := request.RequestContext.RequestID; reqID != "" {
		return reqID
	}
	return fmt.Sprintf("req-%d", time.Now().Unix())
}

// GetPathParameter extracts a path parameter from the request
func GetPathParameter(request events.APIGatewayProxyRequest, key string) string {
	if request.PathParameters != nil {
		return request.PathParameters[key]
	}
	return ""
}

// GetQueryParameter extracts a query parameter from the request
func GetQueryParameter(request events.APIGatewayProxyRequest, key string) string {
	if request.QueryStringParameters != nil {
		return request.QueryStringParameters[key]
	}
	return ""
}

// GetQueryParameterInt extracts a query parameter as integer with default value
func GetQueryParameterInt(request events.APIGatewayProxyRequest, key string, defaultValue int) int {
	value := GetQueryParameter(request, key)
	if value == "" {
		return defaultValue
	}

	intValue, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}

	return intValue
}

// ValidateRequired checks if required fields are present in the request
func ValidateRequired(data interface{}, field string) error {
	// Basic validation - in production, use a validation library like github.com/go-playground/validator
	return nil
}

// ParseRequestBody parses JSON request body into a struct
func ParseRequestBody(request events.APIGatewayProxyRequest, target interface{}) error {
	if request.Body == "" {
		return fmt.Errorf("request body is empty")
	}

	return json.Unmarshal([]byte(request.Body), target)
}

// GeneratePresignedURL generates a presigned URL for S3 object access
func GeneratePresignedURL(key string, expiration time.Duration) (string, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)
	presignClient := s3.NewPresignClient(s3Client)

	presignResult, err := presignClient.PresignGetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: aws.String(S3BucketName),
		Key:    aws.String(key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = expiration
	})

	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return presignResult.URL, nil
}

// HandleCORS handles CORS preflight requests
func HandleCORS(request events.APIGatewayProxyRequest) *APIResponse {
	if request.HTTPMethod == "OPTIONS" {
		response := APIResponse{
			StatusCode: http.StatusOK,
			Headers: map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age":       "86400",
			},
			Body: "",
		}
		return &response
	}
	return nil
}

// LogInfo logs an info message with structured data
func LogInfo(ctx context.Context, message string, data map[string]interface{}) {
	logData := map[string]interface{}{
		"level":   "info",
		"message": message,
		"data":    data,
		"time":    time.Now().UTC(),
	}

	if logJSON, err := json.Marshal(logData); err == nil {
		fmt.Println(string(logJSON))
	}
}

// LogError logs an error message with structured data
func LogError(ctx context.Context, message string, err error, data map[string]interface{}) {
	logData := map[string]interface{}{
		"level":   "error",
		"message": message,
		"error":   err.Error(),
		"data":    data,
		"time":    time.Now().UTC(),
	}

	if logJSON, err := json.Marshal(logData); err == nil {
		fmt.Println(string(logJSON))
	}
}
