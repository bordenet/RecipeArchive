package reporting

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"text/tabwriter"
	"time"
)

// PrintReport prints a formatted tabular report
func PrintReport(entries []ReportEntry, includeRecipeID bool, jsonOutput bool) {
	// Sort by date (newest first)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date.After(entries[j].Date)
	})

	// Count by type
	successCount := 0
	failureCount := 0
	errorCount := 0

	for _, entry := range entries {
		switch entry.Type {
		case "success":
			successCount++
		case "failure":
			failureCount++
		case "error":
			errorCount++
		}
	}

	total := len(entries)

	if jsonOutput {
		report := Report{
			Summary: struct {
				Total     int `json:"total"`
				Successes int `json:"successes"`
				Failures  int `json:"failures"`
				Errors    int `json:"errors"`
			}{
				Total:     total,
				Successes: successCount,
				Failures:  failureCount,
				Errors:    errorCount,
			},
			Entries: entries,
		}

		jsonBytes, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			log.Fatalf("❌ Failed to marshal report to JSON: %v", err)
		}
		fmt.Println(string(jsonBytes))
		return
	}

	fmt.Printf("📈 RECIPE ARCHIVE REPORT\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	// Summary
	fmt.Printf("📊 SUMMARY:\n")
	fmt.Printf("   ✅ Successful recipes: %d\n", successCount)
	fmt.Printf("   ❌ Parsing failures:   %d\n", failureCount)
	fmt.Printf("   🚨 Other errors:       %d\n", errorCount)
	fmt.Printf("   📑 Total entries:      %d\n\n", total)

	if total == 0 {
		fmt.Printf("🎭 No recipes found. Time to start cooking!\n")
		return
	}

	// Detailed table
	fmt.Printf("📋 DETAILED BREAKDOWN:\n")

	// Create tabwriter for alignment
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)

	// Print header
	if includeRecipeID {
		fmt.Fprintln(w, "NAME\tDOMAIN\tDATE\tTYPE\tRECIPE ID")
		fmt.Fprintln(w, "────\t──────\t────\t────\t─────────")
	} else {
		fmt.Fprintln(w, "NAME\tDOMAIN\tDATE\tTYPE")
		fmt.Fprintln(w, "────\t──────\t────\t────")
	}

	// Print entries
	for _, entry := range entries {
		name := entry.Name
		if len(name) > 40 {
			name = name[:37] + "..."
		}

		domain := entry.Domain
		if len(domain) > 20 {
			domain = domain[:17] + "..."
		}

		date := entry.Date.Format("2006-01-02")
		entryType := getTypeIcon(entry.Type)

		if includeRecipeID {
			recipeID := entry.RecipeID
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", name, domain, date, entryType, recipeID)
		} else {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", name, domain, date, entryType)
		}
	}

	w.Flush()
	fmt.Printf("\n")
}

// PrintFailedParserReport prints a focused report on parsing failures
func PrintFailedParserReport(entries []ReportEntry) {
	// Filter for failures
	var failures []ReportEntry
	for _, entry := range entries {
		if entry.Type == "failure" {
			failures = append(failures, entry)
		}
	}

	if len(failures) == 0 {
		fmt.Printf("🎉 No parsing failures found! All recipes parsed successfully.\n")
		return
	}

	fmt.Printf("🔍 PARSING FAILURE ANALYSIS:\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	// Count failures by domain
	domainCounts := make(map[string]int)
	for _, failure := range failures {
		domainCounts[failure.Domain]++
	}

	fmt.Printf("📊 Failures by domain:\n")
	for domain, count := range domainCounts {
		fmt.Printf("   %s: %d failures\n", domain, count)
	}
	fmt.Printf("\n")

	// Show recent failures
	sort.Slice(failures, func(i, j int) bool {
		return failures[i].Date.After(failures[j].Date)
	})

	fmt.Printf("📅 Recent parsing failures (last 10):\n")
	maxToShow := 10
	if len(failures) < maxToShow {
		maxToShow = len(failures)
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "NAME\tDOMAIN\tDATE")
	fmt.Fprintln(w, "────\t──────\t────")

	for i := 0; i < maxToShow; i++ {
		failure := failures[i]
		name := failure.Name
		if len(name) > 50 {
			name = name[:47] + "..."
		}
		fmt.Fprintf(w, "%s\t%s\t%s\n", name, failure.Domain, failure.Date.Format("2006-01-02"))
	}

	w.Flush()
	fmt.Printf("\n")
}

// PrintTenantsTable prints a formatted table of tenants
func PrintTenantsTable(tenants []Tenant) {
	fmt.Printf("👥 TENANT LISTING:\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	if len(tenants) == 0 {
		fmt.Printf("🎭 No tenants found.\n")
		return
	}

	// Sort by recipe count (descending)
	sort.Slice(tenants, func(i, j int) bool {
		return tenants[i].RecipeCount > tenants[j].RecipeCount
	})

	fmt.Printf("📊 Total tenants: %d\n\n", len(tenants))

	// Summary stats
	totalRecipes := 0
	activeTenants := 0
	for _, tenant := range tenants {
		totalRecipes += tenant.RecipeCount
		if tenant.RecipeCount > 0 {
			activeTenants++
		}
	}

	fmt.Printf("📈 Summary:\n")
	fmt.Printf("   Total recipes across all tenants: %d\n", totalRecipes)
	fmt.Printf("   Tenants with recipes: %d\n", activeTenants)
	fmt.Printf("   Average recipes per active tenant: %.1f\n\n", float64(totalRecipes)/float64(max(activeTenants, 1)))

	// Detailed table
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "EMAIL\tUSER ID\tRECIPES\tSTATUS\tLAST ACTIVITY")
	fmt.Fprintln(w, "─────\t───────\t───────\t──────\t─────────────")

	for _, tenant := range tenants {
		email := tenant.Email
		if len(email) > 30 {
			email = email[:27] + "..."
		}

		userID := tenant.UserID
		if len(userID) > 12 {
			userID = userID[:9] + "..."
		}

		lastActivity := "Never"
		if !tenant.LastActivity.IsZero() {
			if time.Since(tenant.LastActivity) < 24*time.Hour {
				lastActivity = "Today"
			} else if time.Since(tenant.LastActivity) < 7*24*time.Hour {
				lastActivity = "This week"
			} else {
				lastActivity = tenant.LastActivity.Format("2006-01-02")
			}
		}

		fmt.Fprintf(w, "%s\t%s\t%d\t%s\t%s\n",
			email, userID, tenant.RecipeCount, tenant.Status, lastActivity)
	}

	w.Flush()
	fmt.Printf("\n")
}

// Helper functions

func getTypeIcon(entryType string) string {
	switch entryType {
	case "success":
		return "✅ success"
	case "failure":
		return "❌ failure"
	case "error":
		return "🚨 error"
	default:
		return "❓ unknown"
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}