package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load("../../.env"); err != nil {
		fmt.Fprintf(os.Stderr, "⚠️  Warning: Could not load .env file: %v\n", err)
	}

	bucketName := os.Getenv("S3_RECIPE_STORAGE_BUCKET")
	if bucketName == "" {
		log.Fatal("❌ S3_RECIPE_STORAGE_BUCKET environment variable not set")
	}

	var (
		dryRun = flag.Bool("dry-run", true, "Dry run mode (default: true)")
		help   = flag.Bool("help", false, "Show help message")
	)
	flag.Parse()

	if *help {
		printUsage()
		os.Exit(0)
	}

	if *dryRun {
		fmt.Println("🔍 DRY RUN MODE - No changes will be made")
	} else {
		fmt.Println("⚠️  LIVE MODE - Files will be moved")
	}

	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-west-2"))
	if err != nil {
		log.Fatalf("❌ Failed to load AWS config: %v", err)
	}

	s3Client := s3.NewFromConfig(cfg)

	fmt.Printf("🔍 Scanning bucket: %s\n", bucketName)

	// Find misplaced images in recipes/ directory
	var continuationToken *string
	misplacedCount := 0
	movedCount := 0

	for {
		input := &s3.ListObjectsV2Input{
			Bucket:            aws.String(bucketName),
			Prefix:            aws.String("recipes/"),
			ContinuationToken: continuationToken,
		}

		result, err := s3Client.ListObjectsV2(ctx, input)
		if err != nil {
			log.Fatalf("❌ Failed to list objects: %v", err)
		}

		for _, obj := range result.Contents {
			key := aws.ToString(obj.Key)

			// Check if this is an image file in the wrong location
			if isImageFile(key) && isInRecipesDir(key) {
				misplacedCount++

				// Extract userID and recipeID from path
				// Expected: recipes/{userID}/{recipeID}/main-photo.jpg
				// Should be: recipe-images/{recipeID}/recipes/main-photo.{ext}
				parts := strings.Split(key, "/")
				if len(parts) >= 4 {
					userID := parts[1]
					recipeID := parts[2]
					filename := parts[3]

					// Determine new location
					ext := filepath.Ext(filename)
					newKey := fmt.Sprintf("recipe-images/%s/recipes/main-photo%s", recipeID, ext)

					fmt.Printf("📦 Misplaced: %s\n", key)
					fmt.Printf("   → Target: %s\n", newKey)

					if !*dryRun {
						// Copy to new location
						copyInput := &s3.CopyObjectInput{
							Bucket:     aws.String(bucketName),
							CopySource: aws.String(bucketName + "/" + key),
							Key:        aws.String(newKey),
						}

						if _, err := s3Client.CopyObject(ctx, copyInput); err != nil {
							fmt.Printf("   ❌ Copy failed: %v\n", err)
							continue
						}

						// Delete from old location
						deleteInput := &s3.DeleteObjectInput{
							Bucket: aws.String(bucketName),
							Key:    aws.String(key),
						}

						if _, err := s3Client.DeleteObject(ctx, deleteInput); err != nil {
							fmt.Printf("   ⚠️  Delete failed: %v (file copied but not deleted)\n", err)
							continue
						}

						fmt.Printf("   ✅ Moved successfully\n")
						movedCount++
					} else {
						fmt.Printf("   🔍 Would move (user: %s, recipe: %s)\n", userID, recipeID)
					}
				}
			}
		}

		if !*result.IsTruncated {
			break
		}
		continuationToken = result.NextContinuationToken
	}

	fmt.Println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("📊 Summary:\n")
	fmt.Printf("   Misplaced images found: %d\n", misplacedCount)
	if !*dryRun {
		fmt.Printf("   Successfully moved: %d\n", movedCount)
		if movedCount < misplacedCount {
			fmt.Printf("   ⚠️  Failed to move: %d\n", misplacedCount-movedCount)
		}
	} else {
		fmt.Printf("   ℹ️  Run with --dry-run=false to move files\n")
	}
}

func isImageFile(key string) bool {
	lowerKey := strings.ToLower(key)
	return strings.HasSuffix(lowerKey, ".jpg") ||
		strings.HasSuffix(lowerKey, ".jpeg") ||
		strings.HasSuffix(lowerKey, ".png") ||
		strings.HasSuffix(lowerKey, ".gif") ||
		strings.HasSuffix(lowerKey, ".webp")
}

func isInRecipesDir(key string) bool {
	// Check if it's in recipes/{userID}/{recipeID}/ but NOT in recipe-images/
	return strings.HasPrefix(key, "recipes/") && !strings.HasPrefix(key, "recipe-images/")
}

func printUsage() {
	fmt.Print(`S3 Cleanup Tool - Move misplaced recipe images

USAGE:
  ./s3-cleanup [OPTIONS]

DESCRIPTION:
  Scans S3 for images incorrectly placed in recipes/{userID}/{recipeID}/
  and moves them to recipe-images/{recipeID}/recipes/main-photo.{ext}

OPTIONS:
  --dry-run       Dry run mode (default: true)
                  Set to false to actually move files
  --help          Show this help message

EXAMPLES:
  # Preview what would be moved
  ./s3-cleanup

  # Actually move the files
  ./s3-cleanup --dry-run=false

ENVIRONMENT:
  S3_RECIPE_STORAGE_BUCKET  S3 bucket name (loaded from ../../.env)
`)
}
