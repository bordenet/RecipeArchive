package main

import (
	"sort"
	"strings"
)

// buildTimeline creates a chronological timeline from all events
func (t *RecipeTracer) buildTimeline(trace *RecipeTrace) []TraceEvent {
	var timeline []TraceEvent

	// Add S3 events to timeline
	for _, event := range trace.S3Events {
		timeline = append(timeline, TraceEvent{
			Timestamp: event.Timestamp,
			Source:    "s3",
			Type:      "object_operation",
			Message:   event.Operation + " " + event.Key,
			Details:   formatSize(event.Size),
		})
	}

	// Add SQS events to timeline
	for _, event := range trace.SQSEvents {
		timeline = append(timeline, TraceEvent{
			Timestamp: event.Timestamp,
			Source:    "sqs",
			Type:      "message_" + event.Action,
			Message:   "Normalization " + event.Action,
			Details:   event.QueueName,
		})
	}

	// Add log events to timeline
	for _, event := range trace.LogEvents {
		eventType := "log_info"
		if event.Level == "ERROR" {
			eventType = "log_error"
		} else if event.Level == "WARN" {
			eventType = "log_warning"
		}

		timeline = append(timeline, TraceEvent{
			Timestamp: event.Timestamp,
			Source:    "logs",
			Type:      eventType,
			Message:   truncateString(event.Message, 80),
			Details:   extractLogGroup(event.LogGroup),
		})
	}

	// Sort by timestamp
	sort.Slice(timeline, func(i, j int) bool {
		return timeline[i].Timestamp.Before(timeline[j].Timestamp)
	})

	return timeline
}

// buildSummary creates a summary of the trace
func (t *RecipeTracer) buildSummary(trace *RecipeTrace) TraceSummary {
	summary := TraceSummary{
		ProcessingSteps:   len(trace.Timeline),
		NormalizationRuns: 0,
		CacheHits:         0,
		CacheStores:       0,
		Errors:            0,
		Status:            "unknown",
	}

	// Count events and determine status
	for _, event := range trace.Timeline {
		if event.Type == "log_error" {
			summary.Errors++
		}
		if event.Source == "logs" && contains(event.Message, "normalized", "processing", "completed") {
			summary.NormalizationRuns++
		}
	}

	// Count cache events in log events (more accurate than timeline)
	for _, logEvent := range trace.LogEvents {
		if logEvent.Level == "CACHE" {
			if strings.Contains(logEvent.Message, "Cache hit") {
				summary.CacheHits++
			} else if strings.Contains(logEvent.Message, "Cached OpenAI response") {
				summary.CacheStores++
			}
		}
	}

	// Determine earliest and latest timestamps
	if len(trace.Timeline) > 0 {
		summary.CreatedAt = trace.Timeline[0].Timestamp
		summary.LastUpdated = trace.Timeline[len(trace.Timeline)-1].Timestamp
	}

	// Determine status based on current data
	if trace.CurrentData != nil {
		if trace.CurrentData.Title == "Temporary Title" {
			summary.Status = "created"
		} else if summary.NormalizationRuns > 0 {
			summary.Status = "normalized"
		} else {
			summary.Status = "processing"
		}

		if summary.Errors > 0 {
			summary.Status = "error"
		}
	}

	return summary
}

// Helper functions

func formatSize(size int64) string {
	if size < 1024 {
		return "< 1KB"
	} else if size < 1024*1024 {
		return "< 1MB"
	}
	return "> 1MB"
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func extractLogGroup(logGroup string) string {
	if parts := splitString(logGroup, "/"); len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return logGroup
}

func splitString(s, sep string) []string {
	if s == "" {
		return []string{}
	}

	var result []string
	parts := strings.Split(s, sep)
	for _, part := range parts {
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}

func contains(s, substr1, substr2, substr3 string) bool {
	return strings.Contains(s, substr1) || strings.Contains(s, substr2) || strings.Contains(s, substr3)
}