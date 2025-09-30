package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"
)

// loadEnvFile loads environment variables from .env file
func loadEnvFile() {
	// Look for .env file in current directory and parent directories
	paths := []string{".env", "../.env", "../../.env"}

	for _, path := range paths {
		if file, err := os.Open(path); err == nil {
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
					// Only set if not already in environment
					if os.Getenv(key) == "" {
						os.Setenv(key, value)
					}
				}
			}
			fmt.Printf("📁 Loaded environment variables from: %s\n", path)
			return
		}
	}
}

// parseDuration parses duration strings like "1h", "24h", "7d"
func parseDuration(s string) (time.Duration, error) {
	// Support formats like "1h", "24h", "7d"
	if strings.HasSuffix(s, "d") {
		days := strings.TrimSuffix(s, "d")
		var d int
		_, err := fmt.Sscanf(days, "%d", &d)
		if err != nil {
			return 0, err
		}
		return time.Duration(d) * 24 * time.Hour, nil
	}
	return time.ParseDuration(s)
}

// printUsage displays the help message
func printUsage() {
	fmt.Printf(`🔧 GET-DIAGNOSTICS - Collect and Analyze System Diagnostics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 USAGE:
   ./get-diagnostics [OPTIONS]

   With no options, generates a full global report of all diagnostics from last 24 hours.

🎛️  OPTIONS:
   -extensions         Harvest/delete web extension diagnostic data only
   -flutter            Harvest/delete Flutter app diagnostic data only
   -lambdas            Harvest Lambda function diagnostic data (CloudWatch) only
   -all                Harvest/delete all diagnostic data
   -since duration     Time window (e.g., 1h, 24h, 7d) [default: 24h]
   -json               Output as JSON instead of formatted table
   -report             Generate summary report (counts by type and source)
   -delete             Delete diagnostic data (requires confirmation)
   -bucket string      S3 bucket name [default: from .env]
   -help               Show this help message

📊 HARVEST EXAMPLES:
   # Global report (all diagnostics, summary format)
   ./get-diagnostics

   # All diagnostics from last 24 hours (detailed view)
   ./get-diagnostics -all

   # Only extension errors from last hour
   ./get-diagnostics -extensions -since 1h

   # Flutter and Lambda diagnostics from last week
   ./get-diagnostics -flutter -lambdas -since 7d

   # Output as JSON for further processing
   ./get-diagnostics -all -json > diagnostics.json

   # Generate summary report with counts by type and source
   ./get-diagnostics -report -since 7d

🗑️  DELETE EXAMPLES:
   # Delete all extension diagnostics from last 7 days (with confirmation)
   ./get-diagnostics -extensions -delete -since 7d

   # Delete all S3 diagnostics older than 30 days
   ./get-diagnostics -all -delete -since 30d

   # Delete Flutter diagnostics from last 24 hours
   ./get-diagnostics -flutter -delete -since 24h

⚠️  DELETE NOTES:
   • Deletion requires typing "DELETE" to confirm
   • Only S3 data can be deleted (extensions, flutter)
   • Lambda logs in CloudWatch cannot be deleted via this tool
   • Deletion is PERMANENT and cannot be undone

🔧 ENVIRONMENT VARIABLES:
   Automatically loaded from .env file at repository root:
   S3_BUCKET_NAME      S3 bucket name
   AWS_REGION          AWS region (default: us-west-2)
   AWS_ACCESS_KEY_ID   AWS credentials
   AWS_SECRET_ACCESS_KEY

📁 DATA SOURCES:
   • Extensions:  S3 web-extension-errors/ prefix
   • Flutter:     S3 flutter-console-errors/ prefix
   • Lambdas:     CloudWatch logs from diagnostic Lambda functions

`)
}