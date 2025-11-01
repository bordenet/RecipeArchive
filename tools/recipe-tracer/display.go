package main

import (
	"fmt"
	"strings"
	"time"
)

// DisplayTrace formats and displays the complete trace
func DisplayTrace(trace *RecipeTrace) {
	displaySummary(trace.Summary, trace.CurrentData)
	displayTimeline(trace.Timeline)
	displayS3Events(trace.S3Events)
	displaySQSEvents(trace.SQSEvents)
	displayLogEvents(trace.LogEvents)
}

// displaySummary shows the trace summary
func displaySummary(summary TraceSummary, data *RecipeData) {
	fmt.Printf("📊 TRACE SUMMARY\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	statusIcon := getStatusIcon(summary.Status)
	fmt.Printf("🔹 Status: %s %s\n", statusIcon, summary.Status)
	fmt.Printf("🔹 Processing Steps: %d\n", summary.ProcessingSteps)
	fmt.Printf("🔹 Normalization Runs: %d\n", summary.NormalizationRuns)

	// Show cache performance
	if summary.CacheHits > 0 || summary.CacheStores > 0 {
		fmt.Printf("🔹 Cache Performance: 🚀 %d hits, 💾 %d stores\n", summary.CacheHits, summary.CacheStores)
	}

	if summary.Errors > 0 {
		fmt.Printf("🔹 Errors: ❌ %d\n", summary.Errors)
	} else {
		fmt.Printf("🔹 Errors: ✅ 0\n")
	}

	if !summary.CreatedAt.IsZero() {
		fmt.Printf("🔹 Created: %s\n", formatTimestamp(summary.CreatedAt))
		fmt.Printf("🔹 Last Updated: %s\n", formatTimestamp(summary.LastUpdated))
	}

	if data != nil {
		fmt.Printf("\n📋 CURRENT RECIPE STATE\n")
		fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
		fmt.Printf("🔹 Title: %s\n", data.Title)
		fmt.Printf("🔹 Source: %s\n", truncateURL(data.SourceURL))
		fmt.Printf("🔹 Version: %d\n", data.Version)
		fmt.Printf("🔹 Ingredients: %d\n", data.IngredientCount)
		fmt.Printf("🔹 Instructions: %d\n", data.InstructionCount)
		fmt.Printf("🔹 Cooking Methods: %d\n", data.CookingMethodCount)

		if data.QualityScore > 0 {
			fmt.Printf("🔹 Quality Score: %.1f/10\n", data.QualityScore)
		}
	}
	fmt.Printf("\n")
}

// displayTimeline shows chronological events
func displayTimeline(timeline []TraceEvent) {
	if len(timeline) == 0 {
		return
	}

	fmt.Printf("⏰ TIMELINE\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	for _, event := range timeline {
		icon := getEventIcon(event.Type)
		sourceIcon := getSourceIcon(event.Source)

		fmt.Printf("%s %s %s %s\n",
			formatTimestamp(event.Timestamp),
			sourceIcon,
			icon,
			event.Message,
		)

		if event.Details != "" {
			fmt.Printf("    └─ %s\n", event.Details)
		}
	}
	fmt.Printf("\n")
}

// displayS3Events shows S3 operations
func displayS3Events(events []S3Event) {
	if len(events) == 0 {
		return
	}

	fmt.Printf("📁 S3 OPERATIONS\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	for _, event := range events {
		opIcon := "📤"
		if event.Operation == "GET" {
			opIcon = "📥"
		}

		fmt.Printf("%s %s %s %s\n",
			formatTimestamp(event.Timestamp),
			opIcon,
			event.Operation,
			event.Key,
		)

		if event.Size > 0 {
			fmt.Printf("    └─ Size: %s\n", formatSize(event.Size))
		}
	}
	fmt.Printf("\n")
}

// displaySQSEvents shows SQS message flow
func displaySQSEvents(events []SQSEvent) {
	if len(events) == 0 {
		return
	}

	fmt.Printf("📨 SQS MESSAGES\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	for _, event := range events {
		actionIcon := getSQSActionIcon(event.Action)

		fmt.Printf("%s %s %s on %s\n",
			formatTimestamp(event.Timestamp),
			actionIcon,
			strings.Title(event.Action),
			event.QueueName,
		)

		if event.MessageID != "" && event.MessageID != "unknown" {
			fmt.Printf("    └─ Message ID: %s\n", event.MessageID)
		}
	}
	fmt.Printf("\n")
}

// displayLogEvents shows CloudWatch log entries
func displayLogEvents(events []LogEvent) {
	if len(events) == 0 {
		return
	}

	fmt.Printf("📋 CLOUDWATCH LOGS\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	for _, event := range events {
		levelIcon := getLogLevelIcon(event.Level)

		// Show detailed OpenAI responses without truncation
		if event.Level == "DEBUG" && strings.Contains(event.Message, "🐛 OpenAI Response:") {
			fmt.Printf("%s %s 🤖 DETAILED OPENAI NORMALIZATION RESPONSE:\n",
				formatTimestamp(event.Timestamp),
				levelIcon,
			)
			fmt.Printf("    └─ %s\n", extractLogGroup(event.LogGroup))

			// Split the message into lines and format nicely
			lines := strings.Split(event.Message, "\n")
			for i, line := range lines {
				if i == 0 {
					continue // Skip the header
				}
				if strings.TrimSpace(line) != "" {
					// Detect important sections
					if strings.Contains(line, "cookingMethods") {
						fmt.Printf("       🍳 %s\n", line)
					} else if strings.Contains(line, "normalizedInstructions") {
						fmt.Printf("       📝 %s\n", line)
					} else if strings.Contains(line, "normalizedIngredients") {
						fmt.Printf("       🥕 %s\n", line)
					} else {
						fmt.Printf("       %s\n", line)
					}
				}
			}
		} else {
			// Standard log entry display
			maxLength := 100
			if event.Level == "DEBUG" {
				maxLength = 150 // Show more for debug messages
			}

			fmt.Printf("%s %s %s\n",
				formatTimestamp(event.Timestamp),
				levelIcon,
				truncateString(event.Message, maxLength),
			)

			fmt.Printf("    └─ %s\n", extractLogGroup(event.LogGroup))
		}
	}
	fmt.Printf("\n")
}

// Helper functions for display formatting

func getStatusIcon(status string) string {
	switch status {
	case "created":
		return "🆕"
	case "processing":
		return "⚙️"
	case "normalized":
		return "✅"
	case "error":
		return "❌"
	default:
		return "❓"
	}
}

func getEventIcon(eventType string) string {
	switch eventType {
	case "object_operation":
		return "📦"
	case "message_sent", "message_received":
		return "📨"
	case "log_info":
		return "ℹ️"
	case "log_error":
		return "❌"
	case "log_warning":
		return "⚠️"
	default:
		return "🔹"
	}
}

func getSourceIcon(source string) string {
	switch source {
	case "s3":
		return "📁"
	case "sqs":
		return "📨"
	case "logs":
		return "📋"
	default:
		return "🔹"
	}
}

func getSQSActionIcon(action string) string {
	switch action {
	case "sent":
		return "📤"
	case "received":
		return "📥"
	case "processed":
		return "✅"
	case "pending":
		return "⏳"
	default:
		return "📨"
	}
}

func getLogLevelIcon(level string) string {
	switch level {
	case "ERROR":
		return "❌"
	case "WARN":
		return "⚠️"
	case "INFO":
		return "ℹ️"
	case "DEBUG":
		return "🔍"
	case "CACHE":
		return "🚀"
	default:
		return "📝"
	}
}

func formatTimestamp(t time.Time) string {
	if t.IsZero() {
		return "Unknown"
	}

	now := time.Now()
	diff := now.Sub(t)

	if diff < time.Minute {
		return "Just now"
	} else if diff < time.Hour {
		return fmt.Sprintf("%dm ago", int(diff.Minutes()))
	} else if diff < 24*time.Hour {
		return fmt.Sprintf("%dh ago", int(diff.Hours()))
	} else {
		return t.Format("Jan 02 15:04")
	}
}

func truncateURL(url string) string {
	if len(url) <= 50 {
		return url
	}
	return url[:47] + "..."
}
