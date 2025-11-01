package reporting

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	AWSRegion = "us-west-2"
)

// JWTPayload represents the JWT token payload
type JWTPayload struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Username      string `json:"cognito:username"`
}

// NewReporter creates a new recipe reporter
func NewReporter(bucketName string) (*Reporter, error) {
	ctx := context.Background()

	awsRegion := os.Getenv("AWS_REGION")
	if awsRegion == "" {
		awsRegion = AWSRegion
	}
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(awsRegion))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &Reporter{
		s3Client:      s3.NewFromConfig(cfg),
		cognitoClient: cognitoidentityprovider.NewFromConfig(cfg),
		bucketName:    bucketName,
		ctx:           ctx,
	}, nil
}

// Authenticate using Cognito username/password
func (r *Reporter) Authenticate(username, password string) error {
	fmt.Printf("🔐 Authenticating with AWS Cognito...\n")

	clientID := os.Getenv("COGNITO_APP_CLIENT_ID")
	if clientID == "" {
		clientID = os.Getenv("COGNITO_CLIENT_ID")
	}
	if clientID == "" {
		clientID = os.Getenv("CLIENT_ID")
	}
	input := &cognitoidentityprovider.InitiateAuthInput{
		ClientId: aws.String(clientID),
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: map[string]string{
			"USERNAME": username,
			"PASSWORD": password,
		},
	}

	result, err := r.cognitoClient.InitiateAuth(r.ctx, input)
	if err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	if result.AuthenticationResult == nil {
		return fmt.Errorf("no authentication result returned")
	}

	// Store the access token for API requests
	r.accessToken = *result.AuthenticationResult.AccessToken

	// Extract user info from ID token
	if result.AuthenticationResult.IdToken != nil {
		if err := r.extractUserInfo(*result.AuthenticationResult.IdToken); err != nil {
			return fmt.Errorf("failed to extract user info: %w", err)
		}
	}

	r.userEmail = username
	fmt.Printf("✅ Authentication successful for user: %s (ID: %s)\n", r.userEmail, r.userID)
	return nil
}

// extractUserInfo extracts user information from JWT ID token
func (r *Reporter) extractUserInfo(idToken string) error {
	// JWT tokens have 3 parts separated by dots
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return fmt.Errorf("invalid JWT token format")
	}

	// Decode the payload (second part)
	payload := parts[1]

	// Add padding if needed for base64 decoding
	if m := len(payload) % 4; m != 0 {
		payload += strings.Repeat("=", 4-m)
	}

	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return fmt.Errorf("failed to decode JWT payload: %w", err)
	}

	var jwtPayload JWTPayload
	if err := json.Unmarshal(decoded, &jwtPayload); err != nil {
		return fmt.Errorf("failed to parse JWT payload: %w", err)
	}

	r.userID = jwtPayload.Sub
	return nil
}

// GetAccessToken returns the current access token
func (r *Reporter) GetAccessToken() string {
	return r.accessToken
}
