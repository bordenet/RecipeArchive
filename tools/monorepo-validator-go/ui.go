package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/lipgloss"
)

// UI styles using lipgloss
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#7D56F4")).
			MarginLeft(2)

	sectionStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#04B575")).
			MarginLeft(2).
			MarginTop(1)

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#04B575"))

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF5555"))

	warningStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFB86C"))

	infoStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD"))
)

// SectionProgress tracks progress for a single validation section
type SectionProgress struct {
	Label     string
	Total     int
	Completed int
	Failed    int
	prog      progress.Model
}

// ProgressDashboard manages multiple progress bars for different validation categories
type ProgressDashboard struct {
	Sections  map[string]*SectionProgress
	Order     []string // Display order
	StartTime time.Time
}

// NewProgressDashboard creates a new multi-section progress dashboard
func NewProgressDashboard() *ProgressDashboard {
	return &ProgressDashboard{
		Sections:  make(map[string]*SectionProgress),
		Order:     []string{},
		StartTime: time.Now(),
	}
}

// AddSection adds a new progress section
func (pd *ProgressDashboard) AddSection(label string, total int) {
	prog := progress.New(
		progress.WithScaledGradient("#FF5555", "#04B575"), // Red to green
		progress.WithWidth(50),
		progress.WithoutPercentage(),
	)

	pd.Sections[label] = &SectionProgress{
		Label:     label,
		Total:     total,
		Completed: 0,
		Failed:    0,
		prog:      prog,
	}
	pd.Order = append(pd.Order, label)
}

// IncrementSection marks one task as complete in a specific section
func (pd *ProgressDashboard) IncrementSection(section string, success bool) {
	if s, ok := pd.Sections[section]; ok {
		s.Completed++
		if !success {
			s.Failed++
		}
	}
}

// Progress returns the current progress for a section (0.0 to 1.0)
func (s *SectionProgress) Progress() float64 {
	if s.Total == 0 {
		return 1.0
	}
	return float64(s.Completed) / float64(s.Total)
}

// Elapsed returns time since start
func (pd *ProgressDashboard) Elapsed() time.Duration {
	return time.Since(pd.StartTime)
}

// View renders all progress bars in a clean dashboard
func (pd *ProgressDashboard) View() string {
	var lines []string

	for _, label := range pd.Order {
		section := pd.Sections[label]

		// Build status indicator
		var statusIcon string
		if section.Completed == section.Total {
			if section.Failed > 0 {
				statusIcon = errorStyle.Render("✗")
			} else {
				statusIcon = successStyle.Render("✓")
			}
		} else {
			statusIcon = infoStyle.Render("⋯")
		}

		// Format label (left-aligned, fixed width)
		labelText := fmt.Sprintf("%-15s", section.Label+":")

		// Progress bar
		progressBar := section.prog.ViewAs(section.Progress())

		// Stats (compact)
		stats := fmt.Sprintf("%d/%d", section.Completed, section.Total)
		if section.Failed > 0 {
			stats = errorStyle.Render(fmt.Sprintf("%d/%d (%d failed)", section.Completed, section.Total, section.Failed))
		} else {
			stats = infoStyle.Render(stats)
		}

		// Combine into single line
		line := fmt.Sprintf("  %s %s %s  %s", statusIcon, labelText, progressBar, stats)
		lines = append(lines, line)
	}

	// Add elapsed time at bottom
	elapsed := pd.Elapsed().Round(time.Second)
	lines = append(lines, "")
	lines = append(lines, "  "+infoStyle.Render(fmt.Sprintf("Elapsed: %s", elapsed)))

	return strings.Join(lines, "\n")
}

// TotalProgress returns overall completion stats
func (pd *ProgressDashboard) TotalProgress() (completed, total, failed int) {
	for _, section := range pd.Sections {
		completed += section.Completed
		total += section.Total
		failed += section.Failed
	}
	return
}

// PrintTitle prints a styled section title
func PrintTitle(title string) {
	fmt.Println(titleStyle.Render("═══ " + title + " ═══"))
}

// PrintSection prints a styled section header
func PrintSection(section string) {
	fmt.Println(sectionStyle.Render("▸ " + section))
}

// PrintSuccess prints a success message
func PrintSuccess(msg string) {
	fmt.Println("  " + successStyle.Render("✓") + " " + msg)
}

// PrintError prints an error message
func PrintError(msg string) {
	fmt.Println("  " + errorStyle.Render("✗") + " " + msg)
}

// PrintWarning prints a warning message
func PrintWarning(msg string) {
	fmt.Println("  " + warningStyle.Render("⚠") + " " + msg)
}

// PrintInfo prints an info message
func PrintInfo(msg string) {
	fmt.Println("  " + infoStyle.Render("ℹ") + " " + msg)
}

// PrintSummaryBox prints a styled summary box
func PrintSummaryBox(title string, lines []string) {
	boxWidth := 70

	// Top border
	fmt.Println(titleStyle.Render("╔" + strings.Repeat("═", boxWidth-2) + "╗"))

	// Title
	titleLine := "║ " + title + strings.Repeat(" ", boxWidth-4-len(title)) + " ║"
	fmt.Println(titleStyle.Render(titleLine))

	// Separator
	fmt.Println(titleStyle.Render("╠" + strings.Repeat("═", boxWidth-2) + "╣"))

	// Content lines
	for _, line := range lines {
		// Pad line to fit box width
		padding := boxWidth - 4 - lipgloss.Width(line)
		if padding < 0 {
			padding = 0
		}
		contentLine := "║ " + line + strings.Repeat(" ", padding) + " ║"
		fmt.Println(titleStyle.Render(contentLine))
	}

	// Bottom border
	fmt.Println(titleStyle.Render("╚" + strings.Repeat("═", boxWidth-2) + "╝"))
}

// FormatDuration formats a duration nicely
func FormatDuration(d time.Duration) string {
	d = d.Round(time.Second)
	minutes := int(d.Minutes())
	seconds := int(d.Seconds()) % 60

	if minutes > 0 {
		return fmt.Sprintf("%dm %ds", minutes, seconds)
	}
	return fmt.Sprintf("%ds", seconds)
}
