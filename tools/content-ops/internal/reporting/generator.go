package reporting

import (
	"fmt"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
)

const (
	RecipePath  = "recipes/"
	FailurePath = "failures/"
	ErrorPath   = "errors/"
)

// GenerateReport scans S3 and generates a comprehensive report
func (r *Reporter) GenerateReport(userEmail string) ([]ReportEntry, error) {
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
		// Skip non-JSON files (images, etc.)
		if !strings.HasSuffix(*obj.Key, ".json") {
			continue
		}

		var recipe Recipe
		if err := r.getS3Object(*obj.Key, &recipe); err != nil {
			fmt.Printf("⚠️  Could not read recipe %s: %v\n", *obj.Key, err)
			continue
		}

		entry := ReportEntry{
			Name:     recipe.Title,
			Domain:   extractDomain(recipe.SourceURL),
			Date:     recipe.CreatedAt,
			Type:     "success",
			Key:      *obj.Key,
			RecipeID: recipe.ID,
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
	failureObjects, err := r.listS3Objects(FailurePath)
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
				Name:     failure.AttemptedTitle,
				Domain:   extractDomain(failure.URL),
				Date:     failure.Timestamp,
				Type:     "failure",
				Key:      *obj.Key,
				RecipeID: "", // No recipe ID for failures
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
				Name:     fmt.Sprintf("Error: %s", extractFileBaseName(*obj.Key)),
				Domain:   "system",
				Date:     *obj.LastModified,
				Type:     "error",
				Key:      *obj.Key,
				RecipeID: "",
			}

			allEntries = append(allEntries, entry)
		}
	}

	fmt.Printf("📊 Found %d total entries (%d recipes, %d failures, %d errors)\n",
		len(allEntries),
		countEntriesByType(allEntries, "success"),
		countEntriesByType(allEntries, "failure"),
		countEntriesByType(allEntries, "error"))

	return allEntries, nil
}

// GenerateReportForTenant generates a report for a specific tenant
func (r *Reporter) GenerateReportForTenant(tenantID, tenantEmail string) ([]ReportEntry, error) {
	originalUserID := r.userID
	originalEmail := r.userEmail

	// Temporarily switch to target tenant
	r.userID = tenantID
	r.userEmail = tenantEmail

	// Generate report
	entries, err := r.GenerateReport(tenantEmail)

	// Restore original user
	r.userID = originalUserID
	r.userEmail = originalEmail

	// Tag all entries with the tenant ID
	for i := range entries {
		entries[i].UserID = tenantID
	}

	return entries, err
}

// GetRecipeDetails retrieves details for a specific recipe
func (r *Reporter) GetRecipeDetails(recipeID string) (*Recipe, error) {
	// Try to find the recipe in the user's recipes
	recipeObjects, err := r.listS3Objects(RecipePath + r.userID + "/")
	if err != nil {
		return nil, fmt.Errorf("failed to list recipes: %w", err)
	}

	for _, obj := range recipeObjects {
		var recipe Recipe
		if err := r.getS3Object(*obj.Key, &recipe); err != nil {
			continue
		}

		if recipe.ID == recipeID {
			return &recipe, nil
		}
	}

	return nil, fmt.Errorf("recipe with ID %s not found", recipeID)
}

// ListAllTenants retrieves all tenants from Cognito User Pool
func (r *Reporter) ListAllTenants() ([]Tenant, error) {
	userPoolID := getEnv("COGNITO_USER_POOL_ID", "us-west-2_example")

	var tenants []Tenant
	var paginationToken *string

	for {
		input := &cognitoidentityprovider.ListUsersInput{
			UserPoolId:      aws.String(userPoolID),
			PaginationToken: paginationToken,
		}

		result, err := r.cognitoClient.ListUsers(r.ctx, input)
		if err != nil {
			return nil, fmt.Errorf("failed to list users: %w", err)
		}

		for _, user := range result.Users {
			tenant := Tenant{
				UserID: aws.ToString(user.Username),
				Status: string(user.UserStatus),
			}

			// Extract email from attributes
			for _, attr := range user.Attributes {
				if aws.ToString(attr.Name) == "email" {
					tenant.Email = aws.ToString(attr.Value)
					break
				}
			}

			// Count recipes for this tenant
			recipeCount := r.countRecipesForTenant(tenant.UserID)
			tenant.RecipeCount = recipeCount

			if user.UserLastModifiedDate != nil {
				tenant.LastActivity = *user.UserLastModifiedDate
			}

			tenants = append(tenants, tenant)
		}

		if result.PaginationToken == nil {
			break
		}
		paginationToken = result.PaginationToken
	}

	return tenants, nil
}

// countRecipesForTenant counts recipes for a specific tenant
func (r *Reporter) countRecipesForTenant(tenantID string) int {
	objects, err := r.listS3Objects(RecipePath + tenantID + "/")
	if err != nil {
		return 0
	}
	return len(objects)
}

// Helper functions

func extractDomain(url string) string {
	if url == "" {
		return "unknown"
	}
	// Simple domain extraction
	parts := strings.Split(url, "/")
	if len(parts) >= 3 {
		domain := strings.TrimPrefix(parts[2], "www.")
		return domain
	}
	return "unknown"
}

func extractFileBaseName(key string) string {
	parts := strings.Split(key, "/")
	if len(parts) > 0 {
		filename := parts[len(parts)-1]
		// Remove .json extension if present
		return strings.TrimSuffix(filename, ".json")
	}
	return key
}

func countEntriesByType(entries []ReportEntry, entryType string) int {
	count := 0
	for _, entry := range entries {
		if entry.Type == entryType {
			count++
		}
	}
	return count
}

// getEnv returns environment variable value or default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
