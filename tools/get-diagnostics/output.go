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

// outputReport generates a summary report with counts by type and source
func outputReport(diagnostics []DiagnosticEntry) {
	if len(diagnostics) == 0 {
		fmt.Printf("\n✨ No diagnostics found in the specified time window\n")
		return
	}

	// Color helpers
	cyan := color.New(color.FgCyan).SprintFunc()
	yellow := color.New(color.FgYellow).SprintFunc()
	green := color.New(color.FgGreen).SprintFunc()
	bold := color.New(color.Bold).SprintFunc()

	fmt.Printf("\n%s\n", bold("📊 DIAGNOSTIC SUMMARY REPORT"))
	fmt.Printf("%s\n\n", strings.Repeat("━", 80))

	// Overall counts
	fmt.Printf("%s\n", bold("📈 OVERALL STATISTICS"))
	fmt.Printf("  Total Diagnostics: %s\n", cyan(len(diagnostics)))

	// Find time range
	if len(diagnostics) > 0 {
		oldest := diagnostics[len(diagnostics)-1].Timestamp
		newest := diagnostics[0].Timestamp
		fmt.Printf("  Time Range: %s to %s\n",
			yellow(oldest.Format("2006-01-02 15:04:05")),
			yellow(newest.Format("2006-01-02 15:04:05")))
		duration := newest.Sub(oldest)
		fmt.Printf("  Duration: %s\n", cyan(duration.Round(1*60*1000000000))) // Round to minutes
	}
	fmt.Printf("\n")

	// Count by source
	bySource := make(map[string]int)
	for _, diag := range diagnostics {
		bySource[diag.Source]++
	}

	fmt.Printf("%s\n", bold("📦 BY SOURCE"))
	for source, count := range bySource {
		percentage := float64(count) / float64(len(diagnostics)) * 100
		fmt.Printf("  %-25s %s (%s)\n",
			green(source),
			cyan(count),
			yellow(fmt.Sprintf("%.1f%%", percentage)))
	}
	fmt.Printf("\n")

	// Count by error type
	byErrorType := make(map[string]int)
	for _, diag := range diagnostics {
		if diag.ErrorType != "" {
			byErrorType[diag.ErrorType]++
		} else {
			byErrorType["(no error type)"]++
		}
	}

	fmt.Printf("%s\n", bold("🏷️  BY ERROR TYPE"))
	for errorType, count := range byErrorType {
		percentage := float64(count) / float64(len(diagnostics)) * 100
		fmt.Printf("  %-25s %s (%s)\n",
			green(errorType),
			cyan(count),
			yellow(fmt.Sprintf("%.1f%%", percentage)))
	}
	fmt.Printf("\n")

	// Count by source AND error type (cross-tabulation)
	bySourceAndType := make(map[string]map[string]int)
	for _, diag := range diagnostics {
		if bySourceAndType[diag.Source] == nil {
			bySourceAndType[diag.Source] = make(map[string]int)
		}
		errorType := diag.ErrorType
		if errorType == "" {
			errorType = "(no type)"
		}
		bySourceAndType[diag.Source][errorType]++
	}

	fmt.Printf("%s\n", bold("🔍 BY SOURCE AND ERROR TYPE"))
	for source, types := range bySourceAndType {
		fmt.Printf("  %s:\n", green(source))
		for errorType, count := range types {
			fmt.Printf("    %-23s %s\n", errorType, cyan(count))
		}
	}
	fmt.Printf("\n")

	// Top URLs (if available)
	urlCounts := make(map[string]int)
	for _, diag := range diagnostics {
		if diag.URL != "" {
			urlCounts[diag.URL]++
		}
	}

	if len(urlCounts) > 0 {
		fmt.Printf("%s\n", bold("🌐 TOP URLS (Top 10)"))

		// Sort by count
		type urlCount struct {
			url   string
			count int
		}
		var urlList []urlCount
		for url, count := range urlCounts {
			urlList = append(urlList, urlCount{url, count})
		}

		// Simple bubble sort for top 10
		for i := 0; i < len(urlList); i++ {
			for j := i + 1; j < len(urlList); j++ {
				if urlList[j].count > urlList[i].count {
					urlList[i], urlList[j] = urlList[j], urlList[i]
				}
			}
		}

		// Show top 10
		displayCount := 10
		if len(urlList) < displayCount {
			displayCount = len(urlList)
		}
		for i := 0; i < displayCount; i++ {
			fmt.Printf("  %2d. %s %s\n",
				i+1,
				cyan(urlList[i].count),
				truncateURL(urlList[i].url, 70))
		}
		fmt.Printf("\n")
	}

	// Footer
	fmt.Printf("%s\n", strings.Repeat("━", 80))
	fmt.Printf("✅ Summary report complete. Total entries: %s\n\n", bold(len(diagnostics)))
}

// truncateURL truncates a URL to a maximum length
func truncateURL(url string, maxLen int) string {
	if len(url) <= maxLen {
		return url
	}
	return url[:maxLen-3] + "..."
}
