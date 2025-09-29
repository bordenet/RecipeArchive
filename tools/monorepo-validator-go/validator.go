package main

import (
	"fmt"
	"sync"
	"time"
)


// ValidationResult stores the outcome of a single validation step.
type ValidationResult struct {
	Name     string
	Success  bool
	Duration time.Duration
	Message  string
	StartTime time.Time
}

// Validator manages a collection of validation results and provides summary reporting.
// It's thread-safe for concurrent validations.
type Validator struct {
	Results []ValidationResult
	mutex   sync.Mutex
}

// NewValidator creates and returns a new Validator instance.
func NewValidator() *Validator {
	return &Validator{
		Results: make([]ValidationResult, 0),
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

	fmt.Printf("  %s... ", name)

	success := validationFunc(projectRoot)
	duration := time.Since(start)

	var statusIcon, statusColor, message string
	if success {
		statusIcon = "✅"
		statusColor = ColorGreen
		message = fmt.Sprintf("Completed successfully in %s", formatDuration(duration))
	} else {
		statusIcon = "❌"
		statusColor = ColorRed
		message = fmt.Sprintf("Failed after %s", formatDuration(duration))
	}

	fmt.Printf("%s%s %s%s%s %s(%s)%s\n",
		statusColor, statusIcon, ColorBold, name, ColorReset, ColorDim, formatDuration(duration), ColorReset)

	v.AddResult(ValidationResult{
		Name:      name,
		Success:   success,
		Duration:  duration,
		Message:   message,
		StartTime: start,
	})

	return success
}

// RunValidationSilent executes a validation function and returns the result without printing
func (v *Validator) RunValidationSilent(name string, validationFunc func(projectRoot string) bool, projectRoot string) ValidationResult {
	start := time.Now()
	success := validationFunc(projectRoot)
	duration := time.Since(start)

	var message string
	if success {
		message = fmt.Sprintf("(%s)", formatDuration(duration))
	} else {
		message = fmt.Sprintf("(failed after %s)", formatDuration(duration))
	}

	return ValidationResult{
		Name:      name,
		Success:   success,
		Duration:  duration,
		Message:   message,
		StartTime: start,
	}
}

// PrintValidationResult prints a single validation result
func (v *Validator) PrintValidationResult(result ValidationResult) {
	var statusIcon, statusColor string
	if result.Success {
		statusIcon = "✅"
		statusColor = ColorGreen
	} else {
		statusIcon = "❌"
		statusColor = ColorRed
	}

	fmt.Printf("%s%s %s%s%s %s(%s)%s\n",
		statusColor, statusIcon, ColorBold, result.Name, ColorReset,
		ColorDim, formatDuration(result.Duration), ColorReset)
}

// formatDuration formats a duration in a human-readable way
func formatDuration(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Nanoseconds()/1000000)
	} else if d < time.Minute {
		return fmt.Sprintf("%.1fs", d.Seconds())
	}
	return fmt.Sprintf("%.1fm", d.Minutes())
}

// PrintSummary prints a summary of all validation results with enhanced formatting.
func (v *Validator) PrintSummary() {
	v.mutex.Lock()
	defer v.mutex.Unlock()

	if len(v.Results) == 0 {
		fmt.Printf("\n%s📋 No validations were run%s\n", ColorYellow, ColorReset)
		return
	}

	fmt.Printf("\n%s%s═══ VALIDATION SUMMARY ═══%s\n", ColorBlue, ColorBold, ColorReset)

	totalSuccess := 0
	totalFailed := 0
	totalDuration := time.Duration(0)

	// Sort results by success status (failures first for visibility)
	successResults := []ValidationResult{}
	failureResults := []ValidationResult{}

	for _, result := range v.Results {
		totalDuration += result.Duration
		if result.Success {
			totalSuccess++
			successResults = append(successResults, result)
		} else {
			totalFailed++
			failureResults = append(failureResults, result)
		}
	}

	// Print failures first (more important)
	for _, result := range failureResults {
		fmt.Printf("%s❌ %-45s %s%s%s\n",
			ColorRed, result.Name, ColorDim, result.Message, ColorReset)
	}

	// Then print successes
	for _, result := range successResults {
		fmt.Printf("%s✅ %-45s %s%s%s\n",
			ColorGreen, result.Name, ColorDim, result.Message, ColorReset)
	}

	// Print summary statistics
	fmt.Printf("\n%s┌─ RESULTS ─────────────────────────────────────┐%s\n", ColorBlue, ColorReset)
	fmt.Printf("%s│%s %sTotal: %d%s  %sPassed: %d%s  %sFailed: %d%s  %sTime: %s%s %s│%s\n",
		ColorBlue, ColorReset,
		ColorBold, len(v.Results), ColorReset,
		ColorGreen, totalSuccess, ColorReset,
		ColorRed, totalFailed, ColorReset,
		ColorCyan, formatDuration(totalDuration), ColorReset,
		ColorBlue, ColorReset)
	fmt.Printf("%s└───────────────────────────────────────────────┘%s\n", ColorBlue, ColorReset)

	// Print final status with appropriate emoji and color
	if totalFailed > 0 {
		fmt.Printf("\n%s💥 VALIDATION FAILED! %s(%d/%d failed)%s\n",
			ColorRed, ColorBold, totalFailed, len(v.Results), ColorReset)
	} else {
		fmt.Printf("\n%s🎉 ALL VALIDATIONS PASSED! %s(%d/%d successful)%s\n",
			ColorGreen, ColorBold, totalSuccess, len(v.Results), ColorReset)
	}
}
