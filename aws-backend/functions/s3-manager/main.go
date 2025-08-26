package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

var s3Client *s3.Client

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}
	s3Client = s3.NewFromConfig(cfg)
}

func main() {
	var action = flag.String("action", "", "Action: cleanup-all, cleanup-user, list-objects, create-test-objects")
	var bucketName = flag.String("bucket", "", "S3 bucket name (required)")
	var userID = flag.String("user-id", "", "User ID for user-specific operations")
	var dryRun = flag.Bool("dry-run", false, "Show what would be done without actually doing it")
	flag.Parse()

	if *bucketName == "" {
		log.Fatal("Bucket name is required (-bucket flag)")
	}

	if *action == "" {
		flag.Usage()
		fmt.Println("\\nAvailable actions:")
		fmt.Println("  cleanup-all       - Remove ALL objects from bucket (DESTRUCTIVE)")
		fmt.Println("  cleanup-user      - Remove all objects for specific user")
		fmt.Println("  list-objects      - List all objects in bucket with details")
		fmt.Println("  create-test-objects - Create test photo/archive objects")
		fmt.Println("\\nFlags:")
		fmt.Println("  -bucket string    - S3 bucket name (required)")
		fmt.Println("  -user-id string   - User ID for user-specific operations")
		fmt.Println("  -dry-run          - Show what would be done without doing it")
		os.Exit(1)
	}

	ctx := context.Background()

	switch *action {
	case "cleanup-all":
		err := cleanupAllObjects(ctx, *bucketName, *dryRun)
		if err != nil {
			log.Fatalf("Failed to cleanup all objects: %v", err)
		}
		if *dryRun {
			fmt.Println("🔍 Dry run completed - no changes made")
		} else {
			fmt.Println("✅ All objects cleaned up successfully")
		}

	case "cleanup-user":
		if *userID == "" {
			log.Fatal("User ID is required for cleanup-user action (-user-id flag)")
		}
		err := cleanupUserObjects(ctx, *bucketName, *userID, *dryRun)
		if err != nil {
			log.Fatalf("Failed to cleanup user objects: %v", err)
		}
		if *dryRun {
			fmt.Printf("🔍 Dry run completed for user %s - no changes made\\n", *userID)
		} else {
			fmt.Printf("✅ User %s objects cleaned up successfully\\n", *userID)
		}

	case "list-objects":
		err := listAllObjects(ctx, *bucketName)
		if err != nil {
			log.Fatalf("Failed to list objects: %v", err)
		}

	case "create-test-objects":
		err := createTestObjects(ctx, *bucketName)
		if err != nil {
			log.Fatalf("Failed to create test objects: %v", err)
		}
		fmt.Println("✅ Test objects created successfully")

	default:
		fmt.Printf("Unknown action: %s\\n", *action)
		os.Exit(1)
	}
}

// cleanupAllObjects removes ALL objects from the bucket (DESTRUCTIVE!)
func cleanupAllObjects(ctx context.Context, bucketName string, dryRun bool) error {
	fmt.Printf("🧹 %s: Cleaning up ALL objects from bucket: %s\\n", getActionPrefix(dryRun), bucketName)
	
	if !dryRun {
		fmt.Print("⚠️ WARNING: This will DELETE ALL OBJECTS in the bucket. Continue? (y/N): ")
		var response string
		fmt.Scanln(&response)
		if response != "y" && response != "Y" {
			fmt.Println("Operation cancelled")
			return nil
		}
	}

	totalDeleted := 0
	continuationToken := ""

	for {
		listInput := &s3.ListObjectsV2Input{
			Bucket:  aws.String(bucketName),
			MaxKeys: aws.Int32(1000), // Max per request
		}
		if continuationToken != "" {
			listInput.ContinuationToken = aws.String(continuationToken)
		}

		result, err := s3Client.ListObjectsV2(ctx, listInput)
		if err != nil {
			return fmt.Errorf("failed to list objects: %w", err)
		}

		if len(result.Contents) == 0 {
			break
		}

		fmt.Printf("  🗑️ Found %d objects in this batch\\n", len(result.Contents))

		if !dryRun {
			// Delete objects in batches
			var objectsToDelete []types.ObjectIdentifier
			for _, obj := range result.Contents {
				objectsToDelete = append(objectsToDelete, types.ObjectIdentifier{
					Key: obj.Key,
				})
			}

			deleteInput := &s3.DeleteObjectsInput{
				Bucket: aws.String(bucketName),
				Delete: &types.Delete{
					Objects: objectsToDelete,
					Quiet:   aws.Bool(false),
				},
			}

			deleteResult, err := s3Client.DeleteObjects(ctx, deleteInput)
			if err != nil {
				return fmt.Errorf("failed to delete objects: %w", err)
			}

			totalDeleted += len(deleteResult.Deleted)
			if len(deleteResult.Errors) > 0 {
				fmt.Printf("  ⚠️ Failed to delete %d objects\\n", len(deleteResult.Errors))
				for _, deleteError := range deleteResult.Errors {
					fmt.Printf("    - %s: %s\\n", *deleteError.Key, *deleteError.Message)
				}
			}
		} else {
			// Dry run - just count what would be deleted
			for _, obj := range result.Contents {
				fmt.Printf("    Would delete: %s (%.2f KB)\\n", 
					*obj.Key, float64(*obj.Size)/1024.0)
				totalDeleted++
			}
		}

		// Check if there are more objects
		if !*result.IsTruncated {
			break
		}
		continuationToken = *result.NextContinuationToken
	}

	if dryRun {
		fmt.Printf("  📊 Would delete %d total objects\\n", totalDeleted)
	} else {
		fmt.Printf("  ✅ Successfully deleted %d total objects\\n", totalDeleted)
	}

	return nil
}

// cleanupUserObjects removes all objects for a specific user
func cleanupUserObjects(ctx context.Context, bucketName, userID string, dryRun bool) error {
	fmt.Printf("🧹 %s: Cleaning up objects for user: %s\\n", getActionPrefix(dryRun), userID)

	userPrefix := fmt.Sprintf("users/%s/", userID)
	
	listInput := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String(userPrefix),
	}

	result, err := s3Client.ListObjectsV2(ctx, listInput)
	if err != nil {
		return fmt.Errorf("failed to list user objects: %w", err)
	}

	if len(result.Contents) == 0 {
		fmt.Printf("  📁 No objects found for user %s\\n", userID)
		return nil
	}

	fmt.Printf("  🗑️ Found %d objects for user %s\\n", len(result.Contents), userID)

	if !dryRun {
		var objectsToDelete []types.ObjectIdentifier
		for _, obj := range result.Contents {
			objectsToDelete = append(objectsToDelete, types.ObjectIdentifier{
				Key: obj.Key,
			})
			fmt.Printf("    - %s (%.2f KB)\\n", *obj.Key, float64(*obj.Size)/1024.0)
		}

		deleteInput := &s3.DeleteObjectsInput{
			Bucket: aws.String(bucketName),
			Delete: &types.Delete{
				Objects: objectsToDelete,
				Quiet:   aws.Bool(false),
			},
		}

		deleteResult, err := s3Client.DeleteObjects(ctx, deleteInput)
		if err != nil {
			return fmt.Errorf("failed to delete user objects: %w", err)
		}

		fmt.Printf("  ✅ Deleted %d objects for user %s\\n", len(deleteResult.Deleted), userID)
		if len(deleteResult.Errors) > 0 {
			fmt.Printf("  ⚠️ Failed to delete %d objects\\n", len(deleteResult.Errors))
		}
	} else {
		for _, obj := range result.Contents {
			fmt.Printf("    Would delete: %s (%.2f KB)\\n", *obj.Key, float64(*obj.Size)/1024.0)
		}
	}

	return nil
}

// listAllObjects lists all objects in the bucket with details
func listAllObjects(ctx context.Context, bucketName string) error {
	fmt.Printf("📋 Listing all objects in bucket: %s\\n", bucketName)

	listInput := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
	}

	result, err := s3Client.ListObjectsV2(ctx, listInput)
	if err != nil {
		return fmt.Errorf("failed to list objects: %w", err)
	}

	if len(result.Contents) == 0 {
		fmt.Println("  📁 Bucket is empty")
		return nil
	}

	fmt.Printf("\\n📊 Found %d objects:\\n", len(result.Contents))
	fmt.Println("  Key                                                    | Size (KB) | Modified")
	fmt.Println("  -------------------------------------------------------|-----------|----------")

	var totalSize int64
	for _, obj := range result.Contents {
		sizeKB := float64(*obj.Size) / 1024.0
		totalSize += *obj.Size
		
		key := *obj.Key
		if len(key) > 54 {
			key = key[:51] + "..."
		}
		
		fmt.Printf("  %-54s | %9.2f | %s\\n",
			key, sizeKB, obj.LastModified.Format("2006-01-02"))
	}

	fmt.Printf("\\n📈 Total: %d objects, %.2f KB\\n", 
		len(result.Contents), float64(totalSize)/1024.0)

	return nil
}

// createTestObjects creates sample photo and archive objects for testing
func createTestObjects(ctx context.Context, bucketName string) error {
	fmt.Printf("🧪 Creating test objects in bucket: %s\\n", bucketName)

	testObjects := []struct {
		key     string
		content string
		contentType string
	}{
		{
			key:         "users/test-user-001/photos/recipe-001/main.jpg",
			content:     "fake-jpeg-data-for-main-photo",
			contentType: "image/jpeg",
		},
		{
			key:         "users/test-user-001/photos/recipe-002/main.jpg", 
			content:     "another-fake-jpeg-data-for-main-photo",
			contentType: "image/jpeg",
		},
		{
			key:         "users/test-user-001/archives/recipe-001/page.html",
			content:     "<html><head><title>Recipe Archive</title></head><body><h1>Test Recipe</h1><p>This is archived HTML content.</p></body></html>",
			contentType: "text/html",
		},
		{
			key:         "users/test-user-001/archives/recipe-002/page.html",
			content:     "<html><head><title>Another Recipe</title></head><body><h1>Another Test Recipe</h1><p>More archived content.</p></body></html>",
			contentType: "text/html",
		},
		{
			key:         "users/test-user-002/photos/recipe-003/main.jpg",
			content:     "different-user-fake-jpeg-data",
			contentType: "image/jpeg",
		},
	}

	for i, obj := range testObjects {
		fmt.Printf("  📤 Creating object %d/%d: %s\\n", i+1, len(testObjects), obj.key)
		
		putInput := &s3.PutObjectInput{
			Bucket:      aws.String(bucketName),
			Key:         aws.String(obj.key),
			Body:        strings.NewReader(obj.content),
			ContentType: aws.String(obj.contentType),
		}

		_, err := s3Client.PutObject(ctx, putInput)
		if err != nil {
			return fmt.Errorf("failed to create test object %s: %w", obj.key, err)
		}
	}

	fmt.Printf("  ✅ Created %d test objects\\n", len(testObjects))
	return nil
}

func getActionPrefix(dryRun bool) string {
	if dryRun {
		return "[DRY RUN]"
	}
	return "[LIVE]"
}