package main

import (
	"fmt"
	"sync"
	"time"
)

// ValidationResult stores the outcome of a single validation step.
type ValidationResult struct {
	Name      string
	Success   bool
	Duration  time.Duration
	Message   string
	StartTime time.Time
	LogPath   string // Path to detailed log file
}

// Validator manages a collection of validation results and provides summary reporting.
// It's thread-safe for concurrent validations.
type Validator struct {
	Results   []ValidationResult
	mutex     sync.Mutex
	StartTime time.Time // Wall clock start time for accurate total duration
}

// NewValidator creates and returns a new Validator instance.
func NewValidator() *Validator {
	return &Validator{
		Results:   make([]ValidationResult, 0),
		StartTime: time.Now(),
	}
}

// AddResult adds a new ValidationResult to the Validator's collection (thread-safe).
func (v *Validator) AddResult(result ValidationResult) {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.Results = append(v.Results, result)
}

// RunValidation executes a validation function, records its outcome, and prints status messages.
// This function is thread-safe and can be called concurrently.
func (v *Validator) RunValidation(name string, validationFunc func(projectRoot string) bool, projectRoot string) bool {
	start := time.Now()

	PrintSection(name)

	success := validationFunc(projectRoot)
	duration := time.Since(start)

	var message string
	if success {
		message = fmt.Sprintf("(%s)", FormatDuration(duration))
		PrintSuccess(fmt.Sprintf("%s %s", name, message))
	} else {
		message = fmt.Sprintf("(failed after %s)", FormatDuration(duration))
		PrintError(fmt.Sprintf("%s %s", name, message))
	}

	v.AddResult(ValidationResult{
		Name:      name,
		Success:   success,
		Duration:  duration,
		Message:   message,
		StartTime: start,
	})

	return success
}

// sanitizeFilename removes characters that aren't safe for filenames
func sanitizeFilename(name string) string {
	// Replace spaces and special characters with underscores
	result := ""
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			result += string(r)
		} else if r == ' ' {
			result += "_"
		}
	}
	return result
}

// PrintValidationResult prints a single validation result
func (v *Validator) PrintValidationResult(result ValidationResult) {
	if result.Success {
		PrintSuccess(fmt.Sprintf("%s %s", result.Name, result.Message))
	} else {
		PrintError(fmt.Sprintf("%s %s", result.Name, result.Message))
	}
}

// PrintSummary prints a summary of all validation results with enhanced formatting.
func (v *Validator) PrintSummary() {
	v.mutex.Lock()
	defer v.mutex.Unlock()

	if len(v.Results) == 0 {
		PrintWarning("No validations were run")
		return
	}

	fmt.Println() // Spacing

	totalSuccess := 0
	totalFailed := 0

	// Use wall clock time, not sum of durations (which overcounts when serialized)
	wallClockDuration := time.Since(v.StartTime)

	// Collect failures for visibility
	failureResults := []ValidationResult{}

	for _, result := range v.Results {
		if result.Success {
			totalSuccess++
		} else {
			totalFailed++
			failureResults = append(failureResults, result)
		}
	}

	// Build summary lines for the box
	summaryLines := []string{}

	// Add failures first (more important)
	if len(failureResults) > 0 {
		summaryLines = append(summaryLines, "")
		summaryLines = append(summaryLines, errorStyle.Render("FAILURES:"))
		for _, result := range failureResults {
			line := fmt.Sprintf("  ✗ %s %s", result.Name, result.Message)
			summaryLines = append(summaryLines, errorStyle.Render(line))
			if result.LogPath != "" {
				logLine := fmt.Sprintf("    📄 %s", result.LogPath)
				summaryLines = append(summaryLines, infoStyle.Render(logLine))
			}
		}
		summaryLines = append(summaryLines, "")
	}

	// Statistics
	summaryLines = append(summaryLines, "RESULTS:")
	summaryLines = append(summaryLines, fmt.Sprintf("  Total:  %d validations", len(v.Results)))
	summaryLines = append(summaryLines, successStyle.Render(fmt.Sprintf("  Passed: %d", totalSuccess)))
	if totalFailed > 0 {
		summaryLines = append(summaryLines, errorStyle.Render(fmt.Sprintf("  Failed: %d", totalFailed)))
	}

	// Add wall clock time and log directory link
	timeAndLogs := fmt.Sprintf("  Time:   %s  📄 Logs: .validation-logs/", FormatDuration(wallClockDuration))
	summaryLines = append(summaryLines, infoStyle.Render(timeAndLogs))

	// Print the styled summary box
	PrintSummaryBox("VALIDATION SUMMARY", summaryLines)

	// Print final status
	fmt.Println()
	if totalFailed > 0 {
		PrintError(fmt.Sprintf("VALIDATION FAILED! (%d/%d failed)", totalFailed, len(v.Results)))
	} else {
		PrintSuccess(fmt.Sprintf("ALL VALIDATIONS PASSED! (%d/%d successful)", totalSuccess, len(v.Results)))
	}
	fmt.Println()
}
