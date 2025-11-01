package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	var recipeID string
	var help bool

	flag.StringVar(&recipeID, "recipe", "", "Recipe ID to trace")
	flag.BoolVar(&help, "help", false, "Show help")
	flag.Parse()

	if help || recipeID == "" {
		printUsage()
		return
	}

	// Load environment variables
	if err := loadEnv(); err != nil {
		fmt.Printf("❌ Failed to load environment: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("🔍 END-TO-END RECIPE TRACE\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")
	fmt.Printf("📋 Recipe ID: %s\n\n", recipeID)

	// Initialize AWS clients
	awsClients, err := initAWSClients()
	if err != nil {
		fmt.Printf("❌ Failed to initialize AWS clients: %v\n", err)
		os.Exit(1)
	}

	// Create tracer
	tracer := NewRecipeTracer(awsClients)

	// Perform end-to-end trace
	trace, err := tracer.TraceRecipe(recipeID)
	if err != nil {
		fmt.Printf("❌ Trace failed: %v\n", err)
		os.Exit(1)
	}

	// Display results
	DisplayTrace(trace)
}

func printUsage() {
	fmt.Printf(`🔍 RECIPE TRACER - End-to-End Recipe Journey Analyzer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 USAGE:
   go run *.go -recipe RECIPE_ID
   ./recipe-tracer -recipe RECIPE_ID

🎛️  OPTIONS:
   -recipe string    Recipe ID to trace (required)
   -help            Show this help message

📊 EXAMPLE:
   go run *.go -recipe 0281c140-8708-4bbb-ac6d-d33797e34104

🔧 ENVIRONMENT VARIABLES (.env file):
   AWS_REGION           AWS region (default: us-west-2)
   AWS_PROFILE          AWS credentials profile
   S3_STORAGE_BUCKET    S3 bucket for recipe storage
   NORMALIZATION_QUEUE_URL    SQS queue for normalization jobs

🔍 WHAT IT TRACES:
   • S3 recipe object creation/updates
   • SQS normalization message flow
   • CloudWatch logs from Lambda functions
   • Timeline of recipe processing steps
   • Error detection and diagnostics

`)
}
