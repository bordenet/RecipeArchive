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

const (
	DefaultBucket = "recipe-storage-0ea7007d57f67ecb-990537043943"
)

func main() {
	// Command line flags
	var (
		extensions = flag.Bool("extensions", false, "Harvest web extension diagnostic data")
		flutter    = flag.Bool("flutter", false, "Harvest Flutter app diagnostic data")
		lambdas    = flag.Bool("lambdas", false, "Harvest Lambda function diagnostic data")
		all        = flag.Bool("all", false, "Harvest all diagnostic data")
		since      = flag.String("since", "24h", "Time window to harvest (e.g., 1h, 24h, 7d)")
		jsonOutput = flag.Bool("json", false, "Output as JSON instead of formatted table")
		bucket     = flag.String("bucket", DefaultBucket, "S3 bucket name")
		help       = flag.Bool("help", false, "Show help message")
	)
	flag.Parse()

	if *help {
		printUsage()
		os.Exit(0)
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

	// Determine what to harvest
	harvestExtensions := *extensions || *all
	harvestFlutter := *flutter || *all
	harvestLambdas := *lambdas || *all

	if !harvestExtensions && !harvestFlutter && !harvestLambdas {
		fmt.Fprintf(os.Stderr, "❌ Please specify at least one data source: -extensions, -flutter, -lambdas, or -all\n")
		printUsage()
		os.Exit(1)
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
	if *jsonOutput {
		outputJSON(allDiagnostics)
	} else {
		outputFormatted(allDiagnostics)
	}

	if len(allDiagnostics) == 0 {
		fmt.Fprintf(os.Stderr, "✨ No diagnostics found in the specified time window\n")
	}
}