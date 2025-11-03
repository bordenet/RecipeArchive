package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
)

const (
	// AWS Cognito Configuration (matches content-ops tool)
	CognitoAWSRegion  = "us-west-2"
	CognitoUserPoolID = "us-west-2_rpBcEEhYK"
	CognitoClientID   = "7lm8mqr03s0m0fn17dnv373s4h"
)

// TokenRefresher handles Cognito authentication and token refresh
type TokenRefresher struct {
	cognitoClient *cognitoidentityprovider.Client
	ctx           context.Context
	projectRoot   string
}

// JWTClaims represents JWT token claims for expiration checking
type JWTClaims struct {
	Sub      string  `json:"sub"`
	Email    string  `json:"email"`
	Exp      float64 `json:"exp"`
	Iat      float64 `json:"iat"`
	Username string  `json:"cognito:username"`
}

// NewTokenRefresher creates a new token refresher instance
func NewTokenRefresher(projectRoot string) (*TokenRefresher, error) {
	ctx := context.Background()

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(CognitoAWSRegion))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &TokenRefresher{
		cognitoClient: cognitoidentityprovider.NewFromConfig(cfg),
		ctx:           ctx,
		projectRoot:   projectRoot,
	}, nil
}

// IsTokenExpired checks if the RECIPE_ADMIN_TOKEN is expired or missing
func (tr *TokenRefresher) IsTokenExpired() (bool, error) {
	token := os.Getenv("RECIPE_ADMIN_TOKEN")
	if token == "" {
		return true, fmt.Errorf("RECIPE_ADMIN_TOKEN not set")
	}

	// Parse JWT token to check expiration
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return true, fmt.Errorf("invalid JWT format")
	}

	// Decode payload (second part)
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return true, fmt.Errorf("failed to decode JWT payload: %w", err)
	}

	var claims JWTClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return true, fmt.Errorf("failed to parse JWT claims: %w", err)
	}

	// Check if token is expired (with 5 minute buffer)
	currentTime := time.Now().Unix()
	expTime := int64(claims.Exp)
	bufferTime := int64(300) // 5 minutes

	return expTime < (currentTime + bufferTime), nil
}

// RefreshToken gets a new access token from Cognito using username/password
func (tr *TokenRefresher) RefreshToken() (string, error) {
	// Get credentials from environment
	username := os.Getenv("TEST_USER_EMAIL")
	password := os.Getenv("TEST_USER_PASSWORD")

	if username == "" || password == "" {
		return "", fmt.Errorf("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in environment")
	}

	fmt.Printf("🔐 Refreshing RECIPE_ADMIN_TOKEN using Cognito authentication...\n")

	// Authenticate with Cognito
	input := &cognitoidentityprovider.InitiateAuthInput{
		ClientId: aws.String(CognitoClientID),
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: map[string]string{
			"USERNAME": username,
			"PASSWORD": password,
		},
	}

	result, err := tr.cognitoClient.InitiateAuth(tr.ctx, input)
	if err != nil {
		return "", fmt.Errorf("cognito authentication failed: %w", err)
	}

	if result.AuthenticationResult == nil {
		return "", fmt.Errorf("authentication failed - no tokens received")
	}

	// Extract AccessToken (this is the RECIPE_ADMIN_TOKEN)
	accessToken := result.AuthenticationResult.AccessToken
	if accessToken == nil {
		return "", fmt.Errorf("no access token received from authentication")
	}

	return *accessToken, nil
}

// UpdateEnvironmentFiles updates both .env file and current environment with new token
func (tr *TokenRefresher) UpdateEnvironmentFiles(newToken string) error {
	// Update current environment
	if err := os.Setenv("RECIPE_ADMIN_TOKEN", newToken); err != nil {
		return fmt.Errorf("failed to update current environment: %w", err)
	}

	// Update .env file
	envPath := filepath.Join(tr.projectRoot, ".env")
	if err := tr.updateEnvFile(envPath, newToken); err != nil {
		return fmt.Errorf("failed to update .env file: %w", err)
	}

	fmt.Printf("✅ Successfully updated RECIPE_ADMIN_TOKEN in environment and .env file\n")
	return nil
}

// updateEnvFile updates the RECIPE_ADMIN_TOKEN in the .env file
func (tr *TokenRefresher) updateEnvFile(envPath, newToken string) error {
	// Read existing .env file
	file, err := os.Open(envPath)
	if err != nil {
		return fmt.Errorf("failed to open .env file: %w", err)
	}
	defer func() { _ = file.Close() }()

	var lines []string
	tokenUpdated := false
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "RECIPE_ADMIN_TOKEN=") {
			lines = append(lines, "RECIPE_ADMIN_TOKEN="+newToken)
			tokenUpdated = true
		} else {
			lines = append(lines, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading .env file: %w", err)
	}

	// If token line wasn't found, add it
	if !tokenUpdated {
		lines = append(lines, "RECIPE_ADMIN_TOKEN="+newToken)
	}

	// Write updated content back to file
	tempPath := envPath + ".tmp"
	tempFile, err := os.Create(tempPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	writer := bufio.NewWriter(tempFile)
	for _, line := range lines {
		if _, err := writer.WriteString(line + "\n"); err != nil {
			_ = tempFile.Close()
			_ = os.Remove(tempPath)
			return fmt.Errorf("failed to write to temp file: %w", err)
		}
	}

	if err := writer.Flush(); err != nil {
		_ = tempFile.Close()
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to flush temp file: %w", err)
	}

	if err := tempFile.Close(); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to close temp file: %w", err)
	}

	// Replace original file with temp file
	if err := os.Rename(tempPath, envPath); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to replace .env file: %w", err)
	}

	return nil
}

// RefreshTokenIfNeeded checks if token is expired and refreshes it if necessary
func (tr *TokenRefresher) RefreshTokenIfNeeded() error {
	expired, err := tr.IsTokenExpired()
	if err != nil {
		fmt.Printf("⚠️  Token validation failed: %v\n", err)
		fmt.Printf("🔄 Attempting to refresh token...\n")
	} else if !expired {
		fmt.Printf("✅ RECIPE_ADMIN_TOKEN is valid and not expired\n")
		return nil
	} else {
		fmt.Printf("ℹ️  RECIPE_ADMIN_TOKEN is expired or expires soon\n")
		fmt.Printf("🔄 Refreshing token...\n")
	}

	// Get new token
	newToken, err := tr.RefreshToken()
	if err != nil {
		return fmt.Errorf("failed to refresh token: %w", err)
	}

	// Update environment and .env file
	if err := tr.UpdateEnvironmentFiles(newToken); err != nil {
		return fmt.Errorf("failed to update environment files: %w", err)
	}

	// Verify the new token
	expired, err = tr.IsTokenExpired()
	if err != nil {
		return fmt.Errorf("failed to verify new token: %w", err)
	}
	if expired {
		return fmt.Errorf("new token is still expired - there may be a system clock issue")
	}

	fmt.Printf("🎉 Token refresh completed successfully!\n")
	return nil
}

// GetTokenExpirationInfo returns human-readable token expiration information
func (tr *TokenRefresher) GetTokenExpirationInfo() (string, error) {
	token := os.Getenv("RECIPE_ADMIN_TOKEN")
	if token == "" {
		return "Token not set", nil
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "Invalid token format", nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "Failed to decode token", nil
	}

	var claims JWTClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "Failed to parse token", nil
	}

	expTime := time.Unix(int64(claims.Exp), 0)
	now := time.Now()

	if expTime.Before(now) {
		return fmt.Sprintf("Expired %s ago", now.Sub(expTime).Round(time.Minute)), nil
	}

	return fmt.Sprintf("Expires in %s", expTime.Sub(now).Round(time.Minute)), nil
}

// EnsureValidToken ensures that a valid token is available, refreshing if necessary
func EnsureValidToken(projectRoot string) error {
	refresher, err := NewTokenRefresher(projectRoot)
	if err != nil {
		return fmt.Errorf("failed to create token refresher: %w", err)
	}

	return refresher.RefreshTokenIfNeeded()
}
