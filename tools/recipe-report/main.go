package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

const (
	// AWS Configuration
	AWSRegion    = "us-west-2"
	UserPoolID   = "us-west-2_qJ1i9RhxD"
	ClientID     = "5grdn7qhf1el0ioqb6hkelr29s"
	DefaultBucket = "recipearchive-storage-dev-990537043943" // From CLAUDE.md context
	
	// S3 Path Structure
	RecipePath   = "recipes/"
	FailurePath  = "parsing-failures/"
	ErrorPath    = "errors/"
)

// JWTPayload represents the JWT token payload
type JWTPayload struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Username      string `json:"cognito:username"`
}

// Recipe represents a stored recipe
type Recipe struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	AttributionURL string    `json:"attributionUrl"`
	URL            string    `json:"url"`
	CreatedAt      time.Time `json:"createdAt"`
	UserID         string    `json:"userId"`
}

// ParseFailure represents a failed recipe extraction
type ParseFailure struct {
	URL            string    `json:"url"`
	AttemptedTitle string    `json:"attemptedTitle"`
	Error          string    `json:"error"`
	Timestamp      time.Time `json:"timestamp"`
}

// ReportEntry represents an entry in our report
type ReportEntry struct {
	Name   string
	Domain string
	Date   time.Time
	Type   string
	Key    string
}

// RecipeReporter handles S3 scanning and reporting
type RecipeReporter struct {
	s3Client     *s3.Client
	cognitoClient *cognitoidentityprovider.Client
	bucketName   string
	ctx          context.Context
	userID       string // JWT-extracted user ID (UUID)
	userEmail    string // User email from JWT
}

// NewRecipeReporter creates a new recipe reporter
func NewRecipeReporter(bucketName string) (*RecipeReporter, error) {
	ctx := context.Background()
	
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(AWSRegion))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &RecipeReporter{
		s3Client:      s3.NewFromConfig(cfg),
		cognitoClient: cognitoidentityprovider.NewFromConfig(cfg),
		bucketName:    bucketName,
		ctx:           ctx,
	}, nil
}

// Authenticate using Cognito username/password
func (r *RecipeReporter) Authenticate(username, password string) error {
	fmt.Printf("🔐 Authenticating with AWS Cognito...\n")

	input := &cognitoidentityprovider.InitiateAuthInput{
		ClientId: aws.String(ClientID),
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: map[string]string{
			"USERNAME": username,
			"PASSWORD": password,
		},
	}

	result, err := r.cognitoClient.InitiateAuth(r.ctx, input)
	if err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	if result.AuthenticationResult == nil {
		return fmt.Errorf("authentication failed - no tokens received")
	}

	// Extract user ID from ID token (same as Chrome extension)
	idToken := result.AuthenticationResult.IdToken
	if idToken != nil {
		userID, email, err := r.extractUserFromJWT(*idToken)
		if err != nil {
			return fmt.Errorf("failed to extract user info from JWT: %w", err)
		}
		r.userID = userID
		r.userEmail = email
		fmt.Printf("✅ Authentication successful (User: %s, ID: %s)\n", email, userID)
	} else {
		return fmt.Errorf("no ID token received from authentication")
	}

	return nil
}

// extractUserFromJWT extracts user ID and email from JWT token (matches Chrome extension behavior)
func (r *RecipeReporter) extractUserFromJWT(token string) (string, string, error) {
	// JWT tokens have 3 parts: header.payload.signature
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", "", fmt.Errorf("invalid JWT format")
	}

	// Decode the payload (base64url)
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", "", fmt.Errorf("failed to decode JWT payload: %w", err)
	}

	var jwtPayload JWTPayload
	if err := json.Unmarshal(payload, &jwtPayload); err != nil {
		return "", "", fmt.Errorf("failed to parse JWT payload: %w", err)
	}

	if jwtPayload.Sub == "" {
		return "", "", fmt.Errorf("JWT token missing 'sub' claim")
	}

	return jwtPayload.Sub, jwtPayload.Email, nil
}

// getUserID converts email to S3-safe user ID
func getUserID(email string) string {
	return strings.ReplaceAll(strings.ReplaceAll(email, "@", "_at_"), ".", "_dot_")
}

// extractDomain extracts domain from URL
func extractDomain(rawURL string) string {
	if rawURL == "" {
		return "unknown-domain"
	}
	
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "unknown-domain"
	}
	
	return parsed.Hostname()
}

// listS3Objects lists all objects with given prefix
func (r *RecipeReporter) listS3Objects(prefix string) ([]types.Object, error) {
	var objects []types.Object
	
	paginator := s3.NewListObjectsV2Paginator(r.s3Client, &s3.ListObjectsV2Input{
		Bucket: aws.String(r.bucketName),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(r.ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", err)
		}
		
		objects = append(objects, page.Contents...)
	}

	return objects, nil
}

// getS3Object retrieves and unmarshals an object from S3
func (r *RecipeReporter) getS3Object(key string, v interface{}) error {
	result, err := r.s3Client.GetObject(r.ctx, &s3.GetObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to get object %s: %w", key, err)
	}
	defer result.Body.Close()

	data, err := io.ReadAll(result.Body)
	if err != nil {
		return fmt.Errorf("failed to read object data: %w", err)
	}

	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("failed to unmarshal object: %w", err)
	}

	return nil
}

// GenerateReport scans S3 and generates a comprehensive report
func (r *RecipeReporter) GenerateReport(userEmail string) ([]ReportEntry, error) {
	fmt.Printf("\n📊 Generating recipe report for %s (ID: %s)...\n", r.userEmail, r.userID)
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	var allEntries []ReportEntry

	// Scan successful recipes using JWT-extracted user ID
	fmt.Printf("🔍 Scanning successful recipes...\n")
	recipeObjects, err := r.listS3Objects(RecipePath + r.userID + "/")
	if err != nil {
		return nil, fmt.Errorf("failed to list recipes: %w", err)
	}

	for _, obj := range recipeObjects {
		var recipe Recipe
		if err := r.getS3Object(*obj.Key, &recipe); err != nil {
			fmt.Printf("⚠️  Could not read recipe %s: %v\n", *obj.Key, err)
			continue
		}

		entry := ReportEntry{
			Name:   recipe.Title,
			Domain: extractDomain(recipe.AttributionURL),
			Date:   recipe.CreatedAt,
			Type:   "success",
			Key:    *obj.Key,
		}

		if entry.Name == "" {
			entry.Name = "Untitled Recipe"
		}
		if entry.Date.IsZero() {
			entry.Date = *obj.LastModified
		}

		allEntries = append(allEntries, entry)
	}

	// Scan parsing failures
	fmt.Printf("🔍 Scanning parsing failures...\n")
	failureObjects, err := r.listS3Objects(FailurePath + r.userID + "/")
	if err != nil {
		fmt.Printf("⚠️  Could not scan failures: %v\n", err)
	} else {
		for _, obj := range failureObjects {
			var failure ParseFailure
			if err := r.getS3Object(*obj.Key, &failure); err != nil {
				fmt.Printf("⚠️  Could not read failure %s: %v\n", *obj.Key, err)
				continue
			}

			entry := ReportEntry{
				Name:   failure.AttemptedTitle,
				Domain: extractDomain(failure.URL),
				Date:   failure.Timestamp,
				Type:   "failure",
				Key:    *obj.Key,
			}

			if entry.Name == "" {
				entry.Name = "Parse Failure"
			}
			if entry.Date.IsZero() {
				entry.Date = *obj.LastModified
			}

			allEntries = append(allEntries, entry)
		}
	}

	// Scan other errors
	fmt.Printf("🔍 Scanning other errors...\n")
	errorObjects, err := r.listS3Objects(ErrorPath + r.userID + "/")
	if err != nil {
		fmt.Printf("⚠️  Could not scan errors: %v\n", err)
	} else {
		for _, obj := range errorObjects {
			// Generic error structure
			var errorData map[string]interface{}
			if err := r.getS3Object(*obj.Key, &errorData); err != nil {
				fmt.Printf("⚠️  Could not read error %s: %v\n", *obj.Key, err)
				continue
			}

			entry := ReportEntry{
				Name:   "Unknown Error",
				Domain: extractDomain(""),
				Date:   *obj.LastModified,
				Type:   "error",
				Key:    *obj.Key,
			}

			// Try to extract meaningful info from error data
			if errorType, ok := errorData["type"].(string); ok {
				entry.Name = errorType
			}
			if errorURL, ok := errorData["url"].(string); ok {
				entry.Domain = extractDomain(errorURL)
			}

			allEntries = append(allEntries, entry)
		}
	}

	return allEntries, nil
}

// PrintReport prints a formatted tabular report
func PrintReport(entries []ReportEntry) {
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

	// Main table
	fmt.Printf("📋 DETAILED REPORT:\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
	
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	fmt.Fprintf(w, "Recipe Name\tDomain\tDate Submitted\tStatus\n")
	fmt.Fprintf(w, "━━━━━━━━━━━━━━━━━━━━━━━━\t━━━━━━━━━━━━━━━━━━━━\t━━━━━━━━━━━━━━━━━━\t━━━━━━━━━━\n")
	
	for _, entry := range entries {
		name := entry.Name
		if len(name) > 25 {
			name = name[:22] + "..."
		}
		
		domain := entry.Domain
		if len(domain) > 20 {
			domain = domain[:17] + "..."
		}
		
		dateStr := entry.Date.Format("2006-01-02 15:04")
		
		status := "✅"
		if entry.Type == "failure" {
			status = "❌"
		} else if entry.Type == "error" {
			status = "🚨"
		}
		
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", name, domain, dateStr, status)
	}
	w.Flush()
	
	// Domain breakdown
	domainStats := make(map[string]int)
	for _, entry := range entries {
		domainStats[entry.Domain]++
	}

	if len(domainStats) > 0 {
		fmt.Printf("\n🌐 DOMAIN BREAKDOWN:\n")
		fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
		
		// Sort domains by count
		type domainCount struct {
			domain string
			count  int
		}
		var domains []domainCount
		for domain, count := range domainStats {
			domains = append(domains, domainCount{domain, count})
		}
		sort.Slice(domains, func(i, j int) bool {
			return domains[i].count > domains[j].count
		})

		w2 := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
		fmt.Fprintf(w2, "Domain\tRecipe Count\n")
		fmt.Fprintf(w2, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\t━━━━━━━━━━━━\n")
		
		for _, dc := range domains {
			fmt.Fprintf(w2, "%s\t%d\n", dc.domain, dc.count)
		}
		w2.Flush()
	}
}

func main() {
	// Command line flags
	var (
		userEmail  = flag.String("user", "", "Email address for authentication (required)")
		password   = flag.String("password", "", "Password for authentication (required)")
		bucketName = flag.String("bucket", DefaultBucket, "S3 bucket name")
		help       = flag.Bool("help", false, "Show help message")
	)
	flag.Parse()

	if *help {
		fmt.Printf(`Recipe Archive S3 Reporting Tool

Usage:
  go run main.go -user email@example.com -password mypassword

Options:
  -user string      Email address for authentication (required)
  -password string  Password for authentication (required)
  -bucket string    S3 bucket name (default: %s)
  -help            Show this help message

Examples:
  go run main.go -user matt@example.com -password mypassword
  go run main.go -user test@example.com -password testpass -bucket my-recipe-bucket

Environment Variables:
  AWS_REGION       AWS region (default: %s)
  AWS_PROFILE      AWS profile to use for credentials

`, DefaultBucket, AWSRegion)
		os.Exit(0)
	}

	if *userEmail == "" || *password == "" {
		fmt.Fprintf(os.Stderr, "❌ Error: -user and -password are required\n")
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

	// Generate report
	entries, err := reporter.GenerateReport(*userEmail)
	if err != nil {
		log.Fatalf("❌ Report generation failed: %v", err)
	}

	// Print results
	PrintReport(entries)

	fmt.Printf("\n✅ Report generation completed successfully\n")
}