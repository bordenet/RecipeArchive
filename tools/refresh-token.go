package main

import (
	"fmt"
	"os"
	"path/filepath"

	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
)

const (
	CognitoAWSRegion  = "us-west-2"
	CognitoUserPoolID = "us-west-2_rpBcEEhYK"
	CognitoClientID   = "7lm8mqr03s0m0fn17dnv373s4h"
)

type JWTClaims struct {
	Sub      string  `json:"sub"`
	Email    string  `json:"email"`
	Exp      float64 `json:"exp"`
	Iat      float64 `json:"iat"`
	Username string  `json:"cognito:username"`
}

func main() {
	fmt.Println("🔐 RecipeArchive Token Refresh Utility")
	fmt.Println("======================================")

	// Find project root
	projectRoot, err := findGitRoot()
	if err != nil {
		fmt.Printf("❌ Error finding project root: %v\n", err)
		os.Exit(1)
	}

	// Load environment from .env file
	loadEnvFile(projectRoot)

	// Check current token status
	fmt.Println("\n📊 Current Token Status:")
	checkCurrentToken()

	// Get credentials
	username := os.Getenv("TEST_USER_EMAIL")
	password := os.Getenv("TEST_USER_PASSWORD")

	if username == "" || password == "" {
		fmt.Println("\n❌ Error: TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env file")
		os.Exit(1)
	}

	fmt.Printf("\n🔄 Refreshing token for user: %s\n", username)

	// Initialize AWS Cognito client
	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(CognitoAWSRegion))
	if err != nil {
		fmt.Printf("❌ Failed to load AWS config: %v\n", err)
		os.Exit(1)
	}

	client := cognitoidentityprovider.NewFromConfig(cfg)

	// Authenticate and get new token
	input := &cognitoidentityprovider.InitiateAuthInput{
		ClientId: aws.String(CognitoClientID),
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: map[string]string{
			"USERNAME": username,
			"PASSWORD": password,
		},
	}

	result, err := client.InitiateAuth(ctx, input)
	if err != nil {
		fmt.Printf("❌ Authentication failed: %v\n", err)
		os.Exit(1)
	}

	if result.AuthenticationResult == nil || result.AuthenticationResult.AccessToken == nil {
		fmt.Println("❌ No access token received from authentication")
		os.Exit(1)
	}

	newToken := *result.AuthenticationResult.AccessToken
	fmt.Printf("✅ Successfully obtained new access token\n")

	// Update .env file
	envPath := filepath.Join(projectRoot, ".env")
	if err := updateEnvFile(envPath, newToken); err != nil {
		fmt.Printf("❌ Failed to update .env file: %v\n", err)
		os.Exit(1)
	}

	// Update current environment
	os.Setenv("RECIPE_ADMIN_TOKEN", newToken)

	fmt.Println("✅ Successfully updated RECIPE_ADMIN_TOKEN in .env file and current environment")

	// Show new token status
	fmt.Println("\n📊 New Token Status:")
	checkCurrentToken()

	fmt.Println("\n🎉 Token refresh completed successfully!")
	fmt.Println("💡 You can now run AWS infrastructure tests with the new token")
}

func checkCurrentToken() {
	token := os.Getenv("RECIPE_ADMIN_TOKEN")
	if token == "" {
		fmt.Println("   Status: ❌ No token set")
		return
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		fmt.Println("   Status: ❌ Invalid token format")
		return
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		fmt.Println("   Status: ❌ Failed to decode token")
		return
	}

	var claims JWTClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		fmt.Println("   Status: ❌ Failed to parse token claims")
		return
	}

	expTime := time.Unix(int64(claims.Exp), 0)
	now := time.Now()

	fmt.Printf("   Email: %s\n", claims.Email)
	fmt.Printf("   Issued: %s\n", time.Unix(int64(claims.Iat), 0).Format("2006-01-02 15:04:05 MST"))
	fmt.Printf("   Expires: %s\n", expTime.Format("2006-01-02 15:04:05 MST"))

	if expTime.Before(now) {
		fmt.Printf("   Status: ❌ Expired %s ago\n", now.Sub(expTime).Round(time.Minute))
	} else {
		fmt.Printf("   Status: ✅ Valid (expires in %s)\n", expTime.Sub(now).Round(time.Minute))
	}
}

func updateEnvFile(envPath, newToken string) error {
	file, err := os.Open(envPath)
	if err != nil {
		return fmt.Errorf("failed to open .env file: %w", err)
	}
	defer file.Close()

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

	if !tokenUpdated {
		lines = append(lines, "RECIPE_ADMIN_TOKEN="+newToken)
	}

	tempPath := envPath + ".tmp"
	tempFile, err := os.Create(tempPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	writer := bufio.NewWriter(tempFile)
	for _, line := range lines {
		if _, err := writer.WriteString(line + "\n"); err != nil {
			tempFile.Close()
			os.Remove(tempPath)
			return fmt.Errorf("failed to write to temp file: %w", err)
		}
	}

	if err := writer.Flush(); err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		return fmt.Errorf("failed to flush temp file: %w", err)
	}

	if err := tempFile.Close(); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to close temp file: %w", err)
	}

	if err := os.Rename(tempPath, envPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to replace .env file: %w", err)
	}

	return nil
}

func loadEnvFile(projectRoot string) {
	envPath := filepath.Join(projectRoot, ".env")
	file, err := os.Open(envPath)
	if err != nil {
		fmt.Printf("⚠️  Could not load .env file: %v\n", err)
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			if os.Getenv(key) == "" {
				os.Setenv(key, value)
			}
		}
	}
}

func findGitRoot() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	dir := cwd
	for {
		gitPath := filepath.Join(dir, ".git")
		if _, err := os.Stat(gitPath); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return cwd, nil
}
