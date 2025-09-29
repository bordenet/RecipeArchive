package commands

import (
	"flag"
	"fmt"
	"os"
)

// CLIConfig holds all command line arguments and configuration
type CLIConfig struct {
	UserEmail       string
	Password        string
	BucketName      string
	ListTenants     bool
	TenantFilter    string
	IncludeRecipeID bool
	JSONOutput      bool
	FetchURL        string
	AnalyzeRecipe   string
	Help            bool
}

// ParseArgs parses command line arguments and returns configuration
func ParseArgs() *CLIConfig {
	// Get defaults from environment variables
	defaultEmail := os.Getenv("TEST_USER_EMAIL")
	defaultPassword := os.Getenv("TEST_USER_PASSWORD")
	defaultBucket := os.Getenv("S3_BUCKET")
	if defaultBucket == "" {
		defaultBucket = "recipe-archive-prod-bucket"
	}

	config := &CLIConfig{}

	// Command line flags with environment variable defaults
	flag.StringVar(&config.UserEmail, "user", defaultEmail, "Email address for authentication")
	flag.StringVar(&config.Password, "password", defaultPassword, "Password for authentication")
	flag.StringVar(&config.BucketName, "bucket", defaultBucket, "S3 bucket name")
	flag.BoolVar(&config.ListTenants, "list-tenants", false, "List all tenants in the system")
	flag.StringVar(&config.TenantFilter, "tenant", "", "Filter by tenant: 'all' for all tenants, specific UUID for one tenant")
	flag.BoolVar(&config.IncludeRecipeID, "include-recipe-id", false, "Include recipe ID column in the output table")
	flag.BoolVar(&config.JSONOutput, "json", false, "Output report as JSON")
	flag.StringVar(&config.FetchURL, "fetch", "", "Fetch recipe from URL and analyze normalization")
	flag.StringVar(&config.AnalyzeRecipe, "analyze", "", "Analyze normalization quality of existing recipe by ID")
	flag.BoolVar(&config.Help, "help", false, "Show help message")

	flag.Parse()

	return config
}

// ValidateConfig validates the configuration and returns error if invalid
func (c *CLIConfig) ValidateConfig() error {
	if c.Help {
		return nil // Help is always valid
	}

	if c.UserEmail == "" || c.Password == "" {
		return fmt.Errorf("email and password are required")
	}

	return nil
}

// PrintUsage prints the usage information
func PrintUsage() {
	defaultBucket := os.Getenv("S3_BUCKET")
	if defaultBucket == "" {
		defaultBucket = "recipe-archive-prod-bucket"
	}
	awsRegion := os.Getenv("AWS_REGION")
	if awsRegion == "" {
		awsRegion = "us-west-2"
	}

	fmt.Printf(`🍳 CONTENT OPERATIONS TOOL FOR RECIPEARCHIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 USAGE:
   go run *.go [options]
   ./content-ops [options]

🎛️  OPTIONS:
   -user string          Email for authentication (env: TEST_USER_EMAIL)
   -password string      Password for authentication (env: TEST_USER_PASSWORD)
   -bucket string        S3 bucket name (default: %s)
   -list-tenants         📋 List all system tenants (admin feature)
   -tenant string        🎯 Filter by tenant:
                           • (empty): Show your data only
                           • 'all': Show all tenants with recipe counts
                           • UUID: Show specific tenant's data
   -include-recipe-id    🆔 Include recipe ID column in output
   -json                 📄 Output report as JSON
   -fetch string         🌐 Fetch recipe from URL + analyze quality
   -analyze string       🔍 Analyze existing recipe by ID
   -help                 ❓ Show this help message

🌟 RECIPE FETCHING EXAMPLES:
   go run *.go -fetch "https://www.seriouseats.com/recipe-url"
   go run *.go -fetch "https://www.epicurious.com/recipe-url"

   Supported sites: Smitten Kitchen, Serious Eats, Epicurious, Food Network, Allrecipes,
                   Bon Appétit, Food.com, Taste.com.au

📊 REPORTING EXAMPLES:
   go run *.go                                    # Your recipes report
   go run *.go -include-recipe-id                 # Include recipe IDs
   go run *.go -json                              # JSON output
   go run *.go -list-tenants                      # All system users
   go run *.go -tenant all                        # All tenant recipes
   go run *.go -tenant uuid-here                  # Specific tenant

🔧 ANALYSIS EXAMPLES:
   go run *.go -analyze "recipe-id-here"          # Quality analysis
   go run *.go -fetch "url" -json                 # Fetch + JSON output

🌍 ENVIRONMENT VARIABLES (.env file):
   TEST_USER_EMAIL       Default authentication email
   TEST_USER_PASSWORD    Default authentication password
   AWS_REGION           AWS region (default: %s)
   AWS_PROFILE          AWS credentials profile
   API_BASE_URL         Recipe parsing API endpoint
   S3_BUCKET            S3 storage bucket (default: %s)

`, defaultBucket, awsRegion, defaultBucket)
}

// PrintValidationError prints validation error with helpful tips
func PrintValidationError(err error) {
	fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
	defaultEmail := os.Getenv("TEST_USER_EMAIL")
	defaultPassword := os.Getenv("TEST_USER_PASSWORD")
	if defaultEmail == "" || defaultPassword == "" {
		fmt.Fprintf(os.Stderr, "💡 Tip: Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env file, or use -user and -password flags\n")
	}
	fmt.Fprintf(os.Stderr, "Use -help for usage information\n")
}