package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var cwClient *cloudwatch.Client

// Background normalizer processes SQS messages to normalize recipes
func handler(ctx context.Context, event events.SQSEvent) error {
	fmt.Println("background-normalizer invoked")
	fmt.Printf("🔧 Background normalizer received %d messages\n", len(event.Records))

	// Initialize S3 and CloudWatch clients
	fmt.Println("Initializing clients")
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Printf("❌ Failed to load AWS config: %v", err)
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)
	cwClient = cloudwatch.NewFromConfig(cfg)
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

		// CRITICAL: Validate recipe quality before OpenAI normalization
		ingredientCount := len(recipe.Ingredients)
		instructionCount := len(recipe.Instructions)

		if ingredientCount == 0 && instructionCount == 0 {
			// This is GARBAGE - reject normalization and log ERROR
			log.Printf("❌ ERROR: Refusing to normalize garbage recipe with 0 ingredients AND 0 instructions: %s (URL: %s)", message.RecipeID, recipe.SourceURL)
			publishMetric(ctx, "GarbageRecipes", 1.0, map[string]string{
				"Source": extractDomain(recipe.SourceURL),
				"Stage":  "PreNormalization",
			})
			publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
				"Quality": "GARBAGE",
				"Source":  extractDomain(recipe.SourceURL),
			})
			continue // Skip this recipe entirely
		}

		// Warn about low-quality recipes but proceed with normalization
		if ingredientCount == 0 || instructionCount == 0 {
			log.Printf("⚠️ WARN: Recipe has incomplete content (%d ingredients, %d instructions): %s",
				ingredientCount, instructionCount, message.RecipeID)
			publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
				"Quality": "POOR",
				"Source":  extractDomain(recipe.SourceURL),
			})
		}

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

		// Publish quality metrics after normalization (reuse variables from above)
		publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
			"Quality": getQualityLevel(ingredientCount, instructionCount),
			"Source":  extractDomain(recipe.SourceURL),
		})

		if ingredientCount == 0 && instructionCount == 0 {
			// This is GARBAGE - log ERROR not INFO
			log.Printf("ERROR: Recipe has 0 ingredients and 0 instructions: %s", message.URL)
			publishMetric(ctx, "GarbageRecipes", 1.0, map[string]string{
				"Source": extractDomain(message.URL),
			})
		}
	}

	return nil
}

func publishMetric(ctx context.Context, metricName string, value float64, dimensions map[string]string) {
	var dims []types.Dimension
	for name, val := range dimensions {
		dims = append(dims, types.Dimension{Name: aws.String(name), Value: aws.String(val)})
	}

	_, err := cwClient.PutMetricData(ctx, &cloudwatch.PutMetricDataInput{
		Namespace: aws.String("RecipeArchive/Normalizer"),
		MetricData: []types.MetricDatum{
			{
				MetricName: aws.String(metricName),
				Value:      aws.Float64(value),
				Unit:       types.StandardUnitCount,
				Timestamp:  aws.Time(time.Now()),
				Dimensions: dims,
			},
		},
	})
	if err != nil {
		fmt.Printf("⚠️ Failed to publish metric: %v\n", err)
	}
}

func extractDomain(url string) string {
	url = strings.ReplaceAll(url, "https://", "")
	url = strings.ReplaceAll(url, "http://", "")
	parts := strings.Split(url, "/")
	domain := strings.ReplaceAll(parts[0], "www.", "")
	return domain
}

func getQualityLevel(ingredients, instructions int) string {
	if ingredients == 0 && instructions == 0 {
		return "GARBAGE"
	}
	if ingredients == 0 || instructions == 0 {
		return "POOR"
	}
	if ingredients < 3 || instructions < 3 {
		return "LOW"
	}
	return "GOOD"
}










func main() {
	lambda.Start(handler)
}
