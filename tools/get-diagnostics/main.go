package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"sort"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func main() {
	// Load environment variables from .env file
	loadEnvFile()

	// Get defaults from environment variables
	defaultBucket := os.Getenv("S3_RECIPE_STORAGE_BUCKET")
	if defaultBucket == "" {
		defaultBucket = "recipe-storage-0ea7007d57f67ecb-990537043943"
	}

	// Command line flags
	var (
		extensions = flag.Bool("extensions", false, "Harvest web extension diagnostic data")
		flutter    = flag.Bool("flutter", false, "Harvest Flutter app diagnostic data")
		lambdas    = flag.Bool("lambdas", false, "Harvest Lambda function diagnostic data")
		all        = flag.Bool("all", false, "Harvest all diagnostic data")
		since      = flag.String("since", "24h", "Time window to harvest (e.g., 1h, 24h, 7d)")
		jsonOutput = flag.Bool("json", false, "Output as JSON instead of formatted table")
		bucket     = flag.String("bucket", defaultBucket, "S3 bucket name")
		deleteData = flag.Bool("delete", false, "Delete diagnostic data (requires confirmation)")
		report     = flag.Bool("report", false, "Generate summary report (counts by type and source)")
		help       = flag.Bool("help", false, "Show help message")
	)
	flag.Parse()

	if *help {
		printUsage()
		os.Exit(0)
	}

	// Handle delete operation separately
	if *deleteData {
		handleDelete(*extensions, *flutter, *all, *since, *bucket)
		return
	}

	// Parse time window
	duration, err := parseDuration(*since)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Invalid time window: %v\n", err)
		os.Exit(1)
	}

	// Initialize AWS clients
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to load AWS config: %v\n", err)
		os.Exit(1)
	}

	harvesterConfig := &HarvesterConfig{
		BucketName: *bucket,
		S3Client:   s3.NewFromConfig(cfg),
		CWClient:   cloudwatchlogs.NewFromConfig(cfg),
	}

	// Determine what to harvest - default to ALL if no flags specified
	harvestExtensions := *extensions || *all
	harvestFlutter := *flutter || *all
	harvestLambdas := *lambdas || *all

	// If no specific flags were set, default to harvesting everything
	if !*extensions && !*flutter && !*lambdas && !*all {
		harvestExtensions = true
		harvestFlutter = true
		harvestLambdas = true
		*report = true // Default to report view for global report
	}

	var allDiagnostics []DiagnosticEntry

	// Harvest data from requested sources
	if harvestExtensions {
		fmt.Fprintf(os.Stderr, "🔍 Harvesting web extension diagnostics...\n")
		entries, err := harvestExtensionDiagnostics(harvesterConfig, duration)
		if err != nil {
			fmt.Fprintf(os.Stderr, "⚠️  Extension harvest error: %v\n", err)
		} else {
			allDiagnostics = append(allDiagnostics, entries...)
			fmt.Fprintf(os.Stderr, "✅ Found %d extension diagnostics\n", len(entries))
		}
	}

	if harvestFlutter {
		fmt.Fprintf(os.Stderr, "🔍 Harvesting Flutter app diagnostics...\n")
		entries, err := harvestFlutterDiagnostics(harvesterConfig, duration)
		if err != nil {
			fmt.Fprintf(os.Stderr, "⚠️  Flutter harvest error: %v\n", err)
		} else {
			allDiagnostics = append(allDiagnostics, entries...)
			fmt.Fprintf(os.Stderr, "✅ Found %d Flutter diagnostics\n", len(entries))
		}
	}

	if harvestLambdas {
		fmt.Fprintf(os.Stderr, "🔍 Harvesting Lambda diagnostics...\n")
		entries, err := harvestLambdaDiagnostics(harvesterConfig, duration)
		if err != nil {
			fmt.Fprintf(os.Stderr, "⚠️  Lambda harvest error: %v\n", err)
		} else {
			allDiagnostics = append(allDiagnostics, entries...)
			fmt.Fprintf(os.Stderr, "✅ Found %d Lambda diagnostics\n", len(entries))
		}
	}

	// Sort by timestamp (newest first)
	sort.Slice(allDiagnostics, func(i, j int) bool {
		return allDiagnostics[i].Timestamp.After(allDiagnostics[j].Timestamp)
	})

	fmt.Fprintf(os.Stderr, "\n")

	// Output results
	if *report {
		outputReport(allDiagnostics)
	} else if *jsonOutput {
		outputJSON(allDiagnostics)
	} else {
		outputFormatted(allDiagnostics)
	}

	// Only show "no diagnostics" message if not using report mode (which handles it internally)
	if len(allDiagnostics) == 0 && !*report {
		fmt.Fprintf(os.Stderr, "✨ No diagnostics found in the specified time window\n")
	}
}