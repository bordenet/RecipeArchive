package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

var (
	AWSRegion     = getEnv("AWS_REGION", "us-west-2")
	UserPoolID    = getEnv("COGNITO_USER_POOL_ID", "")
	ClientID      = getEnv("COGNITO_APP_CLIENT_ID", "")
	DefaultBucket = getEnv("S3_RECIPE_STORAGE_BUCKET", "your-s3-recipe-storage-bucket")
	RecipePath    = "recipes/"
	FailurePath   = "failed-parsing/"
	ErrorPath     = "errors/"
)

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// loadEnvFile loads environment variables from .env file
func loadEnvFile() {
	// Look for .env file in current directory and parent directories
	paths := []string{".env", "../.env", "../../.env"}

	for _, path := range paths {
		if file, err := os.Open(path); err == nil {
			defer func() { _ = file.Close() }()
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
					// Only set if not already in environment
					if os.Getenv(key) == "" {
						_ = os.Setenv(key, value)
					}
				}
			}
			fmt.Printf("📁 Loaded environment variables from: %s\n", path)
			return
		}
	}
}
