package main

import (
	"fmt"
	"strings"
	"time"
)

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
	fmt.Printf(`🔧 DIAGNOSTIC HARVESTER - Collect and Analyze System Diagnostics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 USAGE:
   ./diagnostic-harvester [OPTIONS]

🎛️  OPTIONS:
   -extensions         Harvest web extension diagnostic data
   -flutter            Harvest Flutter app diagnostic data
   -lambdas            Harvest Lambda function diagnostic data
   -all                Harvest all diagnostic data (default behavior)
   -since duration     Time window (e.g., 1h, 24h, 7d) [default: 24h]
   -json               Output as JSON instead of formatted table
   -bucket string      S3 bucket name [default: recipe-storage-*]
   -help               Show this help message

📊 EXAMPLES:
   # Harvest all diagnostics from last 24 hours
   ./diagnostic-harvester -all

   # Harvest only extension errors from last hour
   ./diagnostic-harvester -extensions -since 1h

   # Harvest Flutter and Lambda diagnostics from last week
   ./diagnostic-harvester -flutter -lambdas -since 7d

   # Output as JSON for further processing
   ./diagnostic-harvester -all -json > diagnostics.json

🔧 ENVIRONMENT VARIABLES:
   AWS_REGION          AWS region (default: us-west-2)
   AWS_PROFILE         AWS credentials profile

📁 DATA SOURCES:
   • Extensions:  S3 web-extension-errors/ prefix
   • Flutter:     S3 flutter-console-errors/ prefix
   • Lambdas:     CloudWatch logs from diagnostic Lambda functions

`)
}