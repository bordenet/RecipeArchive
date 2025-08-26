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
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	dynamodbTypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3Types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/bordenet/recipe-archive/models"
)

var (
	dynamoClient *dynamodb.Client
	s3Client     *s3.Client
	tableName    string
	bucketName   string
)

type TestTool struct {
	action     string
	tableName  string
	bucketName string
}

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}
	
	dynamoClient = dynamodb.NewFromConfig(cfg)
	s3Client = s3.NewFromConfig(cfg)
	
	// Get configuration from environment variables or use defaults for testing
	tableName = os.Getenv("DYNAMODB_TABLE_NAME")
	if tableName == "" {
		tableName = "RecipeArchive-Recipes-Dev" // Default for testing
	}
	
	bucketName = os.Getenv("S3_BUCKET_NAME")
	if bucketName == "" {
		bucketName = "recipe-archive-dev" // Default for testing
	}
}

func main() {
	var action = flag.String("action", "", "Action to perform: load-test-data, cleanup-s3, cleanup-dynamodb, validate-crud, list-recipes, test-url-overwrite")
	var userID = flag.String("user-id", "test-user-001", "User ID for testing")
	_ = flag.String("recipe-id", "", "Recipe ID for single operations") // Currently unused
	var testDataFile = flag.String("test-data", "../testdata/test-recipes.json", "Path to test data file")
	flag.Parse()

	if *action == "" {
		flag.Usage()
		fmt.Println("\\nAvailable actions:")
		fmt.Println("  load-test-data     - Load test recipes into DynamoDB")
		fmt.Println("  cleanup-s3         - Clean all S3 objects from bucket")
		fmt.Println("  cleanup-dynamodb   - Clean all DynamoDB items from table")
		fmt.Println("  validate-crud      - Run full CRUD validation tests")
		fmt.Println("  list-recipes       - List all recipes for a user")
		fmt.Println("  test-url-overwrite - Test URL-based recipe overwrite behavior")
		os.Exit(1)
	}

	tool := &TestTool{
		action:     *action,
		tableName:  tableName,
		bucketName: bucketName,
	}

	ctx := context.Background()

	switch *action {
	case "load-test-data":
		err := tool.loadTestData(ctx, *testDataFile)
		if err != nil {
			log.Fatalf("Failed to load test data: %v", err)
		}
		fmt.Println("✅ Test data loaded successfully")

	case "cleanup-s3":
		err := tool.cleanupS3(ctx)
		if err != nil {
			log.Fatalf("Failed to cleanup S3: %v", err)
		}
		fmt.Println("✅ S3 bucket cleaned successfully")

	case "cleanup-dynamodb":
		err := tool.cleanupDynamoDB(ctx, *userID)
		if err != nil {
			log.Fatalf("Failed to cleanup DynamoDB: %v", err)
		}
		fmt.Println("✅ DynamoDB table cleaned successfully")

	case "validate-crud":
		err := tool.validateCRUD(ctx, *userID)
		if err != nil {
			log.Fatalf("CRUD validation failed: %v", err)
		}
		fmt.Println("✅ All CRUD operations validated successfully")

	case "list-recipes":
		err := tool.listRecipes(ctx, *userID)
		if err != nil {
			log.Fatalf("Failed to list recipes: %v", err)
		}

	case "test-url-overwrite":
		runURLOverwriteTest()

	default:
		fmt.Printf("Unknown action: %s\\n", *action)
		os.Exit(1)
	}
}

// loadTestData loads test recipes from JSON file into DynamoDB
func (t *TestTool) loadTestData(ctx context.Context, filePath string) error {
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

	// Load each recipe
	for i, recipe := range recipes {
		// Parse timestamps properly
		if createdAt, err := time.Parse(time.RFC3339, recipe.CreatedAt.Format(time.RFC3339)); err == nil {
			recipe.CreatedAt = createdAt
		}
		if updatedAt, err := time.Parse(time.RFC3339, recipe.UpdatedAt.Format(time.RFC3339)); err == nil {
			recipe.UpdatedAt = updatedAt
		}

		// Convert to DynamoDB attribute values
		item, err := attributevalue.MarshalMap(recipe)
		if err != nil {
			return fmt.Errorf("failed to marshal recipe %d: %w", i+1, err)
		}

		// Insert into DynamoDB
		input := &dynamodb.PutItemInput{
			TableName: aws.String(t.tableName),
			Item:      item,
		}

		_, err = dynamoClient.PutItem(ctx, input)
		if err != nil {
			return fmt.Errorf("failed to insert recipe %d (%s): %w", i+1, recipe.Title, err)
		}

		fmt.Printf("  ✓ Loaded: %s (ID: %s)\\n", recipe.Title, recipe.ID)
	}

	return nil
}

// cleanupS3 removes all objects from the S3 bucket
func (t *TestTool) cleanupS3(ctx context.Context) error {
	fmt.Printf("🧹 Cleaning up S3 bucket: %s...\\n", t.bucketName)

	// List all objects in the bucket
	listInput := &s3.ListObjectsV2Input{
		Bucket: aws.String(t.bucketName),
	}

	result, err := s3Client.ListObjectsV2(ctx, listInput)
	if err != nil {
		return fmt.Errorf("failed to list S3 objects: %w", err)
	}

	if len(result.Contents) == 0 {
		fmt.Println("  📁 Bucket is already empty")
		return nil
	}

	fmt.Printf("  🗑️ Found %d objects to delete\\n", len(result.Contents))

	// Delete objects in batches (max 1000 per batch)
	var objectsToDelete []s3Types.ObjectIdentifier
	for _, obj := range result.Contents {
		objectsToDelete = append(objectsToDelete, s3Types.ObjectIdentifier{
			Key: obj.Key,
		})
	}

	if len(objectsToDelete) > 0 {
		deleteInput := &s3.DeleteObjectsInput{
			Bucket: aws.String(t.bucketName),
			Delete: &s3Types.Delete{
				Objects: objectsToDelete,
				Quiet:   aws.Bool(false),
			},
		}

		deleteResult, err := s3Client.DeleteObjects(ctx, deleteInput)
		if err != nil {
			return fmt.Errorf("failed to delete S3 objects: %w", err)
		}

		fmt.Printf("  ✓ Deleted %d objects\\n", len(deleteResult.Deleted))
		if len(deleteResult.Errors) > 0 {
			fmt.Printf("  ⚠️ Failed to delete %d objects\\n", len(deleteResult.Errors))
		}
	}

	return nil
}

// cleanupDynamoDB removes all items from DynamoDB table for a specific user (or all users if userID is "all")
func (t *TestTool) cleanupDynamoDB(ctx context.Context, userID string) error {
	fmt.Printf("🧹 Cleaning up DynamoDB table: %s...\\n", t.tableName)

	if userID != "all" {
		fmt.Printf("  👤 Targeting user: %s\\n", userID)
	}

	// Scan the table to find items to delete
	scanInput := &dynamodb.ScanInput{
		TableName: aws.String(t.tableName),
	}

	if userID != "all" {
		scanInput.FilterExpression = aws.String("userId = :userId")
		scanInput.ExpressionAttributeValues = map[string]dynamodbTypes.AttributeValue{
			":userId": &dynamodbTypes.AttributeValueMemberS{Value: userID},
		}
	}

	result, err := dynamoClient.Scan(ctx, scanInput)
	if err != nil {
		return fmt.Errorf("failed to scan DynamoDB table: %w", err)
	}

	if len(result.Items) == 0 {
		fmt.Println("  📁 Table is already empty (for this user)")
		return nil
	}

	fmt.Printf("  🗑️ Found %d items to delete\\n", len(result.Items))

	// Delete each item
	for i, item := range result.Items {
		// Extract key attributes
		recipeID := item["id"].(*dynamodbTypes.AttributeValueMemberS).Value
		itemUserID := item["userId"].(*dynamodbTypes.AttributeValueMemberS).Value

		deleteInput := &dynamodb.DeleteItemInput{
			TableName: aws.String(t.tableName),
			Key: map[string]dynamodbTypes.AttributeValue{
				"id":     &dynamodbTypes.AttributeValueMemberS{Value: recipeID},
				"userId": &dynamodbTypes.AttributeValueMemberS{Value: itemUserID},
			},
		}

		_, err := dynamoClient.DeleteItem(ctx, deleteInput)
		if err != nil {
			fmt.Printf("  ❌ Failed to delete item %d: %v\\n", i+1, err)
			continue
		}

		// Get title for logging
		title := "Unknown"
		if titleAttr, exists := item["title"]; exists {
			title = titleAttr.(*dynamodbTypes.AttributeValueMemberS).Value
		}

		fmt.Printf("  ✓ Deleted: %s (ID: %s)\\n", title, recipeID)
	}

	return nil
}

// validateCRUD runs comprehensive CRUD operation tests
func (t *TestTool) validateCRUD(ctx context.Context, userID string) error {
	fmt.Printf("🧪 Running CRUD validation tests for user: %s...\\n", userID)

	// Test CREATE
	fmt.Println("\\n1️⃣ Testing CREATE operation...")
	testRecipe := models.Recipe{
		ID:           "test-crud-recipe-001",
		UserID:       userID,
		Title:        "CRUD Test Recipe",
		Ingredients: []models.Ingredient{
			{Text: "1 cup test ingredient", Amount: aws.Float64(1), Unit: aws.String("cup"), Ingredient: aws.String("test ingredient")},
		},
		Instructions: []models.Instruction{
			{StepNumber: 1, Text: "Test instruction step 1"},
		},
		SourceURL:   "https://example.com/crud-test",
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		IsDeleted:   false,
		Version:     1,
	}

	// Create the recipe
	item, err := attributevalue.MarshalMap(testRecipe)
	if err != nil {
		return fmt.Errorf("failed to marshal test recipe: %w", err)
	}

	createInput := &dynamodb.PutItemInput{
		TableName:           aws.String(t.tableName),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(id)"),
	}

	_, err = dynamoClient.PutItem(ctx, createInput)
	if err != nil {
		return fmt.Errorf("CREATE test failed: %w", err)
	}
	fmt.Println("  ✓ CREATE: Recipe created successfully")

	// Test READ
	fmt.Println("\\n2️⃣ Testing READ operation...")
	getInput := &dynamodb.GetItemInput{
		TableName: aws.String(t.tableName),
		Key: map[string]dynamodbTypes.AttributeValue{
			"id":     &dynamodbTypes.AttributeValueMemberS{Value: testRecipe.ID},
			"userId": &dynamodbTypes.AttributeValueMemberS{Value: userID},
		},
	}

	getResult, err := dynamoClient.GetItem(ctx, getInput)
	if err != nil || getResult.Item == nil {
		return fmt.Errorf("READ test failed: %w", err)
	}

	var retrievedRecipe models.Recipe
	err = attributevalue.UnmarshalMap(getResult.Item, &retrievedRecipe)
	if err != nil {
		return fmt.Errorf("failed to unmarshal retrieved recipe: %w", err)
	}

	if retrievedRecipe.Title != testRecipe.Title {
		return fmt.Errorf("READ test failed: title mismatch")
	}
	fmt.Printf("  ✓ READ: Recipe retrieved successfully (Title: %s)\\n", retrievedRecipe.Title)

	// Test UPDATE
	fmt.Println("\\n3️⃣ Testing UPDATE operation...")
	updatedTitle := "CRUD Test Recipe - Updated"
	updateInput := &dynamodb.UpdateItemInput{
		TableName: aws.String(t.tableName),
		Key: map[string]dynamodbTypes.AttributeValue{
			"id":     &dynamodbTypes.AttributeValueMemberS{Value: testRecipe.ID},
			"userId": &dynamodbTypes.AttributeValueMemberS{Value: userID},
		},
		UpdateExpression: aws.String("SET title = :title, updatedAt = :updatedAt, version = version + :inc"),
		ExpressionAttributeValues: map[string]dynamodbTypes.AttributeValue{
			":title":     &dynamodbTypes.AttributeValueMemberS{Value: updatedTitle},
			":updatedAt": &dynamodbTypes.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
			":inc":       &dynamodbTypes.AttributeValueMemberN{Value: "1"},
		},
		ReturnValues: dynamodbTypes.ReturnValueAllNew,
	}

	updateResult, err := dynamoClient.UpdateItem(ctx, updateInput)
	if err != nil {
		return fmt.Errorf("UPDATE test failed: %w", err)
	}

	var updatedRecipe models.Recipe
	err = attributevalue.UnmarshalMap(updateResult.Attributes, &updatedRecipe)
	if err != nil {
		return fmt.Errorf("failed to unmarshal updated recipe: %w", err)
	}

	if updatedRecipe.Title != updatedTitle {
		return fmt.Errorf("UPDATE test failed: title not updated correctly")
	}
	fmt.Printf("  ✓ UPDATE: Recipe updated successfully (New Title: %s, Version: %d)\\n", updatedRecipe.Title, updatedRecipe.Version)

	// Test DELETE (soft delete)
	fmt.Println("\\n4️⃣ Testing DELETE operation...")
	deleteInput := &dynamodb.UpdateItemInput{
		TableName: aws.String(t.tableName),
		Key: map[string]dynamodbTypes.AttributeValue{
			"id":     &dynamodbTypes.AttributeValueMemberS{Value: testRecipe.ID},
			"userId": &dynamodbTypes.AttributeValueMemberS{Value: userID},
		},
		UpdateExpression: aws.String("SET isDeleted = :isDeleted, updatedAt = :updatedAt"),
		ExpressionAttributeValues: map[string]dynamodbTypes.AttributeValue{
			":isDeleted": &dynamodbTypes.AttributeValueMemberBOOL{Value: true},
			":updatedAt": &dynamodbTypes.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
		},
		ConditionExpression: aws.String("attribute_exists(id)"),
	}

	_, err = dynamoClient.UpdateItem(ctx, deleteInput)
	if err != nil {
		return fmt.Errorf("DELETE test failed: %w", err)
	}
	fmt.Println("  ✓ DELETE: Recipe soft deleted successfully")

	// Verify soft delete by trying to read again
	fmt.Println("\\n5️⃣ Verifying soft delete...")
	getResult2, err := dynamoClient.GetItem(ctx, getInput)
	if err != nil {
		return fmt.Errorf("failed to verify soft delete: %w", err)
	}

	var deletedRecipe models.Recipe
	err = attributevalue.UnmarshalMap(getResult2.Item, &deletedRecipe)
	if err != nil {
		return fmt.Errorf("failed to unmarshal deleted recipe: %w", err)
	}

	if !deletedRecipe.IsDeleted {
		return fmt.Errorf("soft delete verification failed: recipe still shows as not deleted")
	}
	fmt.Println("  ✓ VERIFY: Soft delete confirmed")

	return nil
}

// listRecipes lists all recipes for a user
func (t *TestTool) listRecipes(ctx context.Context, userID string) error {
	fmt.Printf("📋 Listing recipes for user: %s...\\n", userID)

	scanInput := &dynamodb.ScanInput{
		TableName:        aws.String(t.tableName),
		FilterExpression: aws.String("userId = :userId"),
		ExpressionAttributeValues: map[string]dynamodbTypes.AttributeValue{
			":userId": &dynamodbTypes.AttributeValueMemberS{Value: userID},
		},
	}

	result, err := dynamoClient.Scan(ctx, scanInput)
	if err != nil {
		return fmt.Errorf("failed to scan recipes: %w", err)
	}

	if len(result.Items) == 0 {
		fmt.Println("  📁 No recipes found for this user")
		return nil
	}

	fmt.Printf("\\n📊 Found %d recipes:\\n", len(result.Items))
	fmt.Println("  ID                                   | Title                           | Created    | Version | Deleted")
	fmt.Println("  -------------------------------------|--------------------------------|------------|---------|--------")

	for _, item := range result.Items {
		var recipe models.Recipe
		err := attributevalue.UnmarshalMap(item, &recipe)
		if err != nil {
			fmt.Printf("  ❌ Error parsing recipe: %v\\n", err)
			continue
		}

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