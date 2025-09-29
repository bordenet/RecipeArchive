package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Background normalizer processes SQS messages to normalize recipes
func handler(ctx context.Context, event events.SQSEvent) error {
	fmt.Println("background-normalizer invoked")
	fmt.Printf("🔧 Background normalizer received %d messages\n", len(event.Records))

	// Initialize S3 client
	fmt.Println("Initializing S3 client")
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Printf("❌ Failed to load AWS config: %v", err)
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)
	bucketName := os.Getenv("S3_STORAGE_BUCKET")

	if bucketName == "" {
		log.Printf("❌ S3_STORAGE_BUCKET environment variable not set")
		return fmt.Errorf("S3_STORAGE_BUCKET environment variable not set")
	}
	fmt.Println("S3 client initialized")

	// Process each SQS message
	for _, record := range event.Records {
		fmt.Printf("Processing message: %s\n", record.MessageId)

		// Parse the message
		fmt.Println("Parsing message")
		var message NormalizationMessage
		if err := json.Unmarshal([]byte(record.Body), &message); err != nil {
			log.Printf("❌ Failed to parse message %s: %v", record.MessageId, err)
			continue // Skip this message but don't fail the whole batch
		}
		fmt.Println("Message parsed")

		fmt.Printf("📝 Normalizing recipe %s for user %s [Lambda Request ID: %s]\n", message.RecipeID, message.UserID, ctx.Value("aws.lambda.RequestId"))

		// Get the recipe from S3
		fmt.Println("Getting recipe from S3")
		recipe, err := getRecipeFromS3(ctx, s3Client, bucketName, message.UserID, message.RecipeID)
		if err != nil {
			log.Printf("❌ Failed to get recipe %s: %v", message.RecipeID, err)
			continue
		}
		fmt.Println("Recipe retrieved from S3")

		// Always normalize the recipe with OpenAI, preserving cookingMethods structure
		fmt.Println("Normalizing recipe with OpenAI (preserving cookingMethods)")
		normalizedRecipe, err := normalizeRecipeWithOpenAI(ctx, recipe)
		if err != nil {
			log.Printf("❌ Failed to normalize recipe %s with OpenAI: %v", message.RecipeID, err)
			// Fallback to simple title normalization
			fmt.Println("Falling back to simple title normalization")
			originalTitle := recipe.Title
			recipe.Title = normalizeTitle(recipe.Title)
			if recipe.Title != originalTitle {
				fmt.Println("Title changed, saving recipe")
				if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
					log.Printf("❌ Failed to update recipe %s: %v", message.RecipeID, err)
					continue
				}
				fmt.Printf("✅ Fallback normalized recipe %s: \"%s\" → \"%s\"\n", message.RecipeID, originalTitle, recipe.Title)
			} else {
				fmt.Println("Title not changed")
				fmt.Printf("✅ Recipe %s title already normalized (OpenAI failed): %s\n", message.RecipeID, recipe.Title)
			}
			continue
		}
		fmt.Println("Recipe normalized with OpenAI")

		// Update with normalized data
		fmt.Println("Updating recipe with normalized data")
		*recipe = *normalizedRecipe

		// Always save the recipe (even if only metadata was added)
		fmt.Println("Saving recipe to S3")
		if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
			log.Printf("❌ Failed to update normalized recipe %s: %v", message.RecipeID, err)
			continue
		}
		fmt.Println("Recipe saved to S3")

		fmt.Printf("✅ Content-normalizer processed recipe %s with enhanced metadata\n", message.RecipeID)
	}

	return nil
}














func main() {
	lambda.Start(handler)
}
