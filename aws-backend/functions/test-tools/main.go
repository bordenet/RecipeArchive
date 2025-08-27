package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3Types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"recipe-archive/db"
	"recipe-archive/models"
)

var (
	s3Client   *s3.Client
	recipeDB   db.RecipeDB
	bucketName string
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}

	s3Client = s3.NewFromConfig(cfg)

	// Get configuration from environment variables or use defaults for testing
	bucketName = os.Getenv("S3_BUCKET_NAME")
	if bucketName == "" {
		bucketName = "recipe-archive-dev" // Default for testing
	}

	// Initialize S3-based recipe storage
	recipeDB = db.NewS3RecipeDB(s3Client, bucketName)
}

func main() {
	var action = flag.String("action", "", "Action to perform: load-test-data, cleanup-s3, validate-crud, list-recipes, test-url-overwrite, test-backup")
	var userID = flag.String("user-id", "test-user-001", "User ID for testing")
	_ = flag.String("recipe-id", "", "Recipe ID for single operations") // Currently unused
	var testDataFile = flag.String("test-data", "../testdata/test-recipes.json", "Path to test data file")
	flag.Parse()

	if *action == "" {
		flag.Usage()
		fmt.Println("\\nAvailable actions:")
		fmt.Println("  load-test-data     - Load test recipes into S3")
		fmt.Println("  cleanup-s3         - Clean all S3 objects from bucket")
		fmt.Println("  validate-crud      - Run full CRUD validation tests")
		fmt.Println("  list-recipes       - List all recipes for a user")
		fmt.Println("  test-url-overwrite - Test URL-based recipe overwrite behavior")
		fmt.Println("  test-backup        - Test backup functionality")
		os.Exit(1)
	}

	ctx := context.Background()

	switch *action {
	case "load-test-data":
		err := loadTestData(ctx, *testDataFile)
		if err != nil {
			log.Fatalf("Failed to load test data: %v", err)
		}
		fmt.Println("✅ Test data loaded successfully")

	case "cleanup-s3":
		err := cleanupS3(ctx)
		if err != nil {
			log.Fatalf("Failed to cleanup S3: %v", err)
		}
		fmt.Println("✅ S3 bucket cleaned successfully")

	case "validate-crud":
		err := validateCRUD(ctx, *userID)
		if err != nil {
			log.Fatalf("CRUD validation failed: %v", err)
		}
		fmt.Println("✅ All CRUD operations validated successfully")

	case "list-recipes":
		err := listRecipes(ctx, *userID)
		if err != nil {
			log.Fatalf("Failed to list recipes: %v", err)
		}

	case "test-url-overwrite":
		runURLOverwriteTest()

	case "test-backup":
		runBackupTest()

	default:
		fmt.Printf("Unknown action: %s\\n", *action)
		os.Exit(1)
	}
}

// loadTestData loads test recipes from JSON file into S3
func loadTestData(ctx context.Context, filePath string) error {
	fmt.Printf("📥 Loading test data from %s...\\n", filePath)

	// Read test data file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read test data file: %w", err)
	}

	var recipes []models.Recipe
	if err := json.Unmarshal(data, &recipes); err != nil {
		return fmt.Errorf("failed to parse test data: %w", err)
	}

	fmt.Printf("📝 Found %d test recipes to load\\n", len(recipes))

	// Load each recipe using S3 storage
	for i, recipe := range recipes {
		// Ensure timestamps are set properly (recipes from JSON may have them as strings)
		if recipe.CreatedAt.IsZero() {
			recipe.CreatedAt = time.Now().UTC()
		}
		if recipe.UpdatedAt.IsZero() {
			recipe.UpdatedAt = time.Now().UTC()
		}

		// Create recipe in S3
		err := recipeDB.CreateRecipe(&recipe)
		if err != nil {
			return fmt.Errorf("failed to insert recipe %d (%s): %w", i+1, recipe.Title, err)
		}

		fmt.Printf("  ✓ Loaded: %s (ID: %s)\\n", recipe.Title, recipe.ID)
	}

	return nil
}

// cleanupS3 removes all recipe objects from the S3 bucket
func cleanupS3(ctx context.Context) error {
	fmt.Printf("🧹 Cleaning up S3 bucket: %s...\\n", bucketName)

	// List all recipe objects in the bucket
	listInput := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String("recipes/"), // Only delete recipe files
	}

	result, err := s3Client.ListObjectsV2(ctx, listInput)
	if err != nil {
		return fmt.Errorf("failed to list S3 recipe objects: %w", err)
	}

	if len(result.Contents) == 0 {
		fmt.Println("  📁 No recipe files found in bucket")
		return nil
	}

	fmt.Printf("  🗑️ Found %d recipe files to delete\\n", len(result.Contents))

	// Delete recipe objects in batches
	var objectsToDelete []s3Types.ObjectIdentifier
	for _, obj := range result.Contents {
		objectsToDelete = append(objectsToDelete, s3Types.ObjectIdentifier{
			Key: obj.Key,
		})
	}

	if len(objectsToDelete) > 0 {
		deleteInput := &s3.DeleteObjectsInput{
			Bucket: aws.String(bucketName),
			Delete: &s3Types.Delete{
				Objects: objectsToDelete,
				Quiet:   aws.Bool(false),
			},
		}

		deleteResult, err := s3Client.DeleteObjects(ctx, deleteInput)
		if err != nil {
			return fmt.Errorf("failed to delete S3 objects: %w", err)
		}

		fmt.Printf("  ✓ Deleted %d recipe files\\n", len(deleteResult.Deleted))
		if len(deleteResult.Errors) > 0 {
			fmt.Printf("  ⚠️ Failed to delete %d objects\\n", len(deleteResult.Errors))
		}
	}

	return nil
}

// validateCRUD runs comprehensive CRUD operation tests using S3 storage
func validateCRUD(ctx context.Context, userID string) error {
	fmt.Printf("🧪 Running S3-based CRUD validation tests for user: %s...\\n", userID)

	// Test CREATE
	fmt.Println("\\n1️⃣ Testing CREATE operation...")
	testRecipe := models.Recipe{
		ID:     "test-crud-recipe-001",
		UserID: userID,
		Title:  "CRUD Test Recipe",
		Ingredients: []models.Ingredient{
			{Text: "1 cup test ingredient", Amount: aws.Float64(1), Unit: aws.String("cup"), Ingredient: aws.String("test ingredient")},
		},
		Instructions: []models.Instruction{
			{StepNumber: 1, Text: "Test instruction step 1"},
		},
		SourceURL: "https://example.com/crud-test",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		IsDeleted: false,
		Version:   1,
	}

	// Create the recipe using S3 storage
	err := recipeDB.CreateRecipe(&testRecipe)
	if err != nil {
		return fmt.Errorf("CREATE test failed: %w", err)
	}
	fmt.Println("  ✓ CREATE: Recipe created successfully in S3")

	// Test READ
	fmt.Println("\\n2️⃣ Testing READ operation...")
	retrievedRecipe, err := recipeDB.GetRecipe(userID, testRecipe.ID)
	if err != nil {
		return fmt.Errorf("READ test failed: %w", err)
	}

	if retrievedRecipe.Title != testRecipe.Title {
		return fmt.Errorf("READ test failed: title mismatch")
	}
	fmt.Printf("  ✓ READ: Recipe retrieved successfully from S3 (Title: %s)\\n", retrievedRecipe.Title)

	// Test UPDATE
	fmt.Println("\\n3️⃣ Testing UPDATE operation...")
	updatedTitle := "CRUD Test Recipe - Updated"
	retrievedRecipe.Title = updatedTitle
	retrievedRecipe.UpdatedAt = time.Now().UTC()
	retrievedRecipe.Version = retrievedRecipe.Version + 1

	err = recipeDB.UpdateRecipe(retrievedRecipe)
	if err != nil {
		return fmt.Errorf("UPDATE test failed: %w", err)
	}

	// Verify update
	verifyRecipe, err := recipeDB.GetRecipe(userID, testRecipe.ID)
	if err != nil {
		return fmt.Errorf("UPDATE verification failed: %w", err)
	}

	if verifyRecipe.Title != updatedTitle {
		return fmt.Errorf("UPDATE test failed: title not updated correctly")
	}
	fmt.Printf("  ✓ UPDATE: Recipe updated successfully in S3 (New Title: %s, Version: %d)\\n", verifyRecipe.Title, verifyRecipe.Version)

	// Test DELETE (soft delete)
	fmt.Println("\\n4️⃣ Testing DELETE operation...")
	verifyRecipe.IsDeleted = true
	verifyRecipe.UpdatedAt = time.Now().UTC()

	err = recipeDB.UpdateRecipe(verifyRecipe)
	if err != nil {
		return fmt.Errorf("DELETE test failed: %w", err)
	}
	fmt.Println("  ✓ DELETE: Recipe soft deleted successfully in S3")

	// Verify soft delete by trying to read again
	fmt.Println("\\n5️⃣ Verifying soft delete...")
	deletedRecipe, err := recipeDB.GetRecipe(userID, testRecipe.ID)
	if err != nil {
		return fmt.Errorf("failed to verify soft delete: %w", err)
	}

	if !deletedRecipe.IsDeleted {
		return fmt.Errorf("soft delete verification failed: recipe still shows as not deleted")
	}
	fmt.Println("  ✓ VERIFY: Soft delete confirmed in S3")

	return nil
}

// listRecipes lists all recipes for a user using S3 storage
func listRecipes(ctx context.Context, userID string) error {
	fmt.Printf("📋 Listing recipes for user: %s...\\n", userID)

	recipes, err := recipeDB.ListRecipes(userID)
	if err != nil {
		return fmt.Errorf("failed to list recipes: %w", err)
	}

	if len(recipes) == 0 {
		fmt.Println("  📁 No recipes found for this user")
		return nil
	}

	fmt.Printf("\\n📊 Found %d recipes:\\n", len(recipes))
	fmt.Println("  ID                                   | Title                           | Created    | Version | Deleted")
	fmt.Println("  -------------------------------------|--------------------------------|------------|---------|--------")

	for _, recipe := range recipes {
		createdAt := recipe.CreatedAt.Format("2006-01-02")
		deletedStatus := "No"
		if recipe.IsDeleted {
			deletedStatus = "Yes"
		}

		title := recipe.Title
		if len(title) > 30 {
			title = title[:27] + "..."
		}

		fmt.Printf("  %-36s | %-30s | %-10s | %-7d | %s\\n",
			recipe.ID, title, createdAt, recipe.Version, deletedStatus)
	}

	return nil
}
