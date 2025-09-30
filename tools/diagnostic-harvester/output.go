package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/fatih/color"
)

// outputJSON outputs diagnostics in JSON format
func outputJSON(diagnostics []DiagnosticEntry) {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	encoder.Encode(diagnostics)
}

// outputFormatted outputs diagnostics in a human-readable formatted table
func outputFormatted(diagnostics []DiagnosticEntry) {
	if len(diagnostics) == 0 {
		return
	}

	// Color helpers
	cyan := color.New(color.FgCyan).SprintFunc()
	yellow := color.New(color.FgYellow).SprintFunc()
	red := color.New(color.FgRed).SprintFunc()
	green := color.New(color.FgGreen).SprintFunc()
	bold := color.New(color.Bold).SprintFunc()

	fmt.Printf("\n%s\n", bold("🔧 DIAGNOSTIC TELEMETRY REPORT"))
	fmt.Printf("%s\n\n", strings.Repeat("━", 80))

	// Group by source
	bySource := make(map[string][]DiagnosticEntry)
	for _, diag := range diagnostics {
		bySource[diag.Source] = append(bySource[diag.Source], diag)
	}

	// Display summary
	fmt.Printf("%s\n", bold("📊 SUMMARY"))
	fmt.Printf("  Total Diagnostics: %s\n", cyan(len(diagnostics)))
	for source, entries := range bySource {
		fmt.Printf("  %s: %s\n", source, cyan(len(entries)))
	}
	fmt.Printf("\n")

	// Display detailed entries
	fmt.Printf("%s\n", bold("📋 DETAILED ENTRIES"))
	fmt.Printf("%s\n\n", strings.Repeat("─", 80))

	for i, diag := range diagnostics {
		// Timestamp and source
		timestamp := diag.Timestamp.Format("2006-01-02 15:04:05")
		fmt.Printf("%s. %s | %s\n",
			cyan(i+1),
			yellow(timestamp),
			green(diag.Source))

		// Error type
		if diag.ErrorType != "" {
			errorColor := red
			if diag.ErrorType == "WARNING" {
				errorColor = yellow
			}
			fmt.Printf("   Type: %s\n", errorColor(diag.ErrorType))
		}

		// URL if available
		if diag.URL != "" {
			fmt.Printf("   URL:  %s\n", diag.URL)
		}

		// Message
		if diag.Message != "" {
			// Truncate long messages
			msg := diag.Message
			if len(msg) > 150 {
				msg = msg[:150] + "..."
			}
			fmt.Printf("   Msg:  %s\n", msg)
		}

		// Context if available
		if len(diag.Context) > 0 {
			fmt.Printf("   Context:\n")
			for key, value := range diag.Context {
				fmt.Printf("     - %s: %v\n", key, value)
			}
		}

		// S3 Key for reference
		if diag.S3Key != "" {
			fmt.Printf("   S3:   %s\n", cyan(diag.S3Key))
		}

		fmt.Printf("\n")
	}

	// Footer
	fmt.Printf("%s\n", strings.Repeat("━", 80))
	fmt.Printf("✅ Report complete. Found %s diagnostic entries.\n\n", bold(len(diagnostics)))
}