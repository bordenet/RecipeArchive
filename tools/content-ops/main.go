package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/bordenet/recipe-archive/tools/content-ops/internal/reporting"
)

func main() {
	// Load environment variables from .env file
	loadEnvFile()

	// Get defaults from environment variables
	defaultEmail := os.Getenv("TEST_USER_EMAIL")
	defaultPassword := os.Getenv("TEST_USER_PASSWORD")

	// Command line flags with environment variable defaults
	var (
		userEmail       = flag.String("user", defaultEmail, "Email address for authentication")
		password        = flag.String("password", defaultPassword, "Password for authentication")
		bucketName      = flag.String("bucket", DefaultBucket, "S3 bucket name")
		listTenants     = flag.Bool("list-tenants", false, "List all tenants in the system")
		tenantFilter    = flag.String("tenant", "", "Filter by tenant: 'all' for all tenants, specific UUID for one tenant")
		includeRecipeID = flag.Bool("include-recipe-id", false, "Include recipe ID column in the output table")
		jsonOutput      = flag.Bool("json", false, "Output report as JSON")
		fetchURL        = flag.String("fetch", "", "Fetch recipe from URL and analyze normalization")
		analyzeRecipe   = flag.String("analyze", "", "Analyze normalization quality of existing recipe by ID")
		help            = flag.Bool("help", false, "Show help message")
	)
	flag.Parse()

	if *help {
		printUsage()
		os.Exit(0)
	}

	if *userEmail == "" || *password == "" {
		fmt.Fprintf(os.Stderr, "❌ Error: Email and password are required\n")
		if defaultEmail == "" || defaultPassword == "" {
			fmt.Fprintf(os.Stderr, "💡 Tip: Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env file, or use -user and -password flags\n")
		}
		fmt.Fprintf(os.Stderr, "Use -help for usage information\n")
		os.Exit(1)
	}

	// Create reporter
	reporter, err := NewRecipeReporter(*bucketName)
	if err != nil {
		log.Fatalf("❌ Failed to create reporter: %v", err)
	}

	// Authenticate (for validation - actual S3 access uses AWS credentials)
	if err := reporter.Authenticate(*userEmail, *password); err != nil {
		log.Fatalf("❌ Authentication failed: %v", err)
	}

	// Handle recipe fetching command
	if *fetchURL != "" {
		fmt.Printf("🎯 Fetching and analyzing recipe from URL...\n")
		recipe, err := reporter.FetchRecipe(*fetchURL)
		if err != nil {
			log.Fatalf("❌ Failed to fetch recipe: %v", err)
		}
		reporter.AnalyzeNormalization(recipe)
		fmt.Printf("\n✅ Recipe fetch and analysis completed successfully\n")
		return
	}

	// Handle recipe analysis command
	if *analyzeRecipe != "" {
		fmt.Printf("🔍 Analyzing existing recipe: %s\n", *analyzeRecipe)
		recipe, err := reporter.GetRecipeDetails(*analyzeRecipe)
		if err != nil {
			log.Fatalf("❌ Failed to get recipe details: %v", err)
		}
		reporter.AnalyzeNormalization(recipe)
		fmt.Printf("\n✅ Recipe analysis completed successfully\n")
		return
	}

	// Handle tenant listing command
	if *listTenants {
		fmt.Printf("🔍 Fetching all tenants from Cognito User Pool...\n")
		tenants, err := reporter.ListAllTenants()
		if err != nil {
			log.Fatalf("❌ Failed to list tenants: %v", err)
		}
		reporting.PrintTenantsTable(tenants)
		fmt.Printf("\n✅ Tenant listing completed successfully\n")
		return
	}

	// Handle multi-tenant report generation
	if *tenantFilter == "all" {
		fmt.Printf("🔍 Generating reports for all tenants...\n")
		tenants, err := reporter.ListAllTenants()
		if err != nil {
			log.Fatalf("❌ Failed to list tenants: %v", err)
		}

		var allEntries []ReportEntry
		for _, tenant := range tenants {
			if tenant.RecipeCount == 0 {
				continue
			}

			entries, err := reporter.GenerateReportForTenant(tenant.UserID, tenant.Email)
			if err != nil {
				fmt.Printf("❌ Failed to generate report for tenant %s: %v\n", tenant.Email, err)
				continue
			}
			allEntries = append(allEntries, entries...)
		}

		if *jsonOutput {
			jsonBytes, err := json.MarshalIndent(allEntries, "", "  ")
			if err != nil {
				log.Fatalf("❌ Failed to marshal report to JSON: %v", err)
			}
			fmt.Println(string(jsonBytes))
		} else {
			reporting.PrintReport(allEntries, *includeRecipeID, *jsonOutput)
			reporting.PrintFailedParserReport(allEntries)
		}
		return
	}

	// Handle specific tenant filter
	if *tenantFilter != "" {
		fmt.Printf("🔍 Generating report for tenant: %s\n", *tenantFilter)
		entries, err := reporter.GenerateReportForTenant(*tenantFilter, "")
		if err != nil {
			log.Fatalf("❌ Failed to generate report for tenant: %v", err)
		}

		if *jsonOutput {
			jsonBytes, err := json.MarshalIndent(entries, "", "  ")
			if err != nil {
				log.Fatalf("❌ Failed to marshal report to JSON: %v", err)
			}
			fmt.Println(string(jsonBytes))
		} else {
			reporting.PrintReport(entries, *includeRecipeID, *jsonOutput)
			reporting.PrintFailedParserReport(entries)
		}
		fmt.Printf("\n✅ Tenant-specific report completed successfully\n")
		return
	}

	// Default: Generate report for authenticated user only
	entries, err := reporter.GenerateReport(*userEmail)
	if err != nil {
		log.Fatalf("❌ Report generation failed: %v", err)
	}

	// Print results
	if *jsonOutput {
		jsonBytes, err := json.MarshalIndent(entries, "", "  ")
		if err != nil {
			log.Fatalf("❌ Failed to marshal report to JSON: %v", err)
		}
		fmt.Println(string(jsonBytes))
	} else {
		reporting.PrintReport(entries, *includeRecipeID, *jsonOutput)
		reporting.PrintFailedParserReport(entries)
	}

	fmt.Printf("\n✅ Report generation completed successfully\n")
}

func printUsage() {
	fmt.Printf(`Content Operations Tool for RecipeArchive

Usage:
  go run *.go [-user email@example.com] [-password mypassword] [options]

Options:
  -user string          Email address for authentication (defaults to TEST_USER_EMAIL from .env)
  -password string      Password for authentication (defaults to TEST_USER_PASSWORD from .env)
  -bucket string        S3 bucket name (default: %s)
  -list-tenants         List all tenants in the system (admin feature)
  -tenant string        Filter by tenant:
                          - Leave empty: Show authenticated user's data only
                          - 'all': Show all tenants with their recipe counts
                          - specific UUID: Show specific tenant's data
  -include-recipe-id    Include recipe ID column in the output table
  -json                 Output report as JSON
  -fetch string         Fetch recipe from URL and analyze normalization quality
  -analyze string       Analyze normalization quality of existing recipe by ID
  -help                Show this help message

Examples:
  go run *.go                                                   # Uses .env file credentials
  go run *.go -user matt@example.com -password mypass          # Override with command line
  go run *.go -include-recipe-id                               # Include recipe ID column in output
  go run *.go -json                                            # Output report as JSON
  go run *.go -list-tenants                                    # List all tenants with email/ID
  go run *.go -tenant all                                      # Show recipes for all tenants
  go run *.go -tenant d80153c0-90b1-7090-85be-28e9c4e458f7    # Show specific tenant
  go run *.go -fetch "https://www.seriouseats.com/recipe-url" # Fetch and analyze recipe
  go run *.go -analyze "recipe-id-here"                       # Analyze existing recipe

Environment Variables (.env file support):
  TEST_USER_EMAIL     Default email for authentication
  TEST_USER_PASSWORD  Default password for authentication
  AWS_REGION          AWS region (default: %s)
  AWS_PROFILE         AWS profile to use for credentials
  API_BASE_URL        API endpoint for recipe fetching

`, DefaultBucket, AWSRegion)
}