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

// handler processes SQS messages to normalize recipes in background.
// Each message contains a recipe ID and user ID for normalization.
func handler(ctx context.Context, event events.SQSEvent) error {
	log.Printf("INFO: Background normalizer invoked [messageCount=%d]", len(event.Records))

	// Initialize S3 and CloudWatch clients
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Printf("ERROR: Failed to load AWS config: %v", err)
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)
	cwClient = cloudwatch.NewFromConfig(cfg)
	bucketName := os.Getenv("S3_STORAGE_BUCKET")

	if bucketName == "" {
		log.Printf("ERROR: S3_STORAGE_BUCKET environment variable not set")
		return fmt.Errorf("S3_STORAGE_BUCKET environment variable not set")
	}
	log.Printf("INFO: AWS clients initialized [bucket=%s]", bucketName)

	// Process each SQS message
	for _, record := range event.Records {
		log.Printf("INFO: Processing SQS message [messageId=%s]", record.MessageId)

		// Parse the message
		var message NormalizationMessage
		if err := json.Unmarshal([]byte(record.Body), &message); err != nil {
			log.Printf("ERROR: Failed to parse SQS message [messageId=%s]: %v", record.MessageId, err)
			continue // Skip this message but don't fail the whole batch
		}

		requestID := "unknown"
		if val := ctx.Value("aws.lambda.RequestId"); val != nil {
			if str, ok := val.(string); ok {
				requestID = str
			}
		}
		log.Printf("INFO: Normalizing recipe [recipeID=%s, userID=%s, requestID=%s]",
			message.RecipeID, message.UserID, requestID)

		// Get the recipe from S3
		recipe, err := getRecipeFromS3(ctx, s3Client, bucketName, message.UserID, message.RecipeID)
		if err != nil {
			log.Printf("ERROR: Failed to get recipe from S3 [recipeID=%s]: %v", message.RecipeID, err)
			continue
		}

		// CRITICAL: Validate recipe quality before OpenAI normalization
		ingredientCount := len(recipe.Ingredients)
		instructionCount := len(recipe.Instructions)

		if ingredientCount == 0 && instructionCount == 0 {
			// This is GARBAGE - reject normalization and log ERROR
			log.Printf("ERROR: Refusing to normalize garbage recipe [recipeID=%s, ingredients=0, instructions=0, sourceURL=%s]",
				message.RecipeID, recipe.SourceURL)
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
			log.Printf("WARN: Recipe has incomplete content [recipeID=%s, ingredients=%d, instructions=%d]",
				message.RecipeID, ingredientCount, instructionCount)
			publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
				"Quality": "POOR",
				"Source":  extractDomain(recipe.SourceURL),
			})
		}

		// Always normalize the recipe with OpenAI, preserving cookingMethods structure
		log.Printf("INFO: Normalizing recipe with OpenAI [recipeID=%s]", message.RecipeID)
		normalizedRecipe, err := normalizeRecipeWithOpenAI(ctx, recipe)
		if err != nil {
			log.Printf("ERROR: Failed to normalize recipe with OpenAI [recipeID=%s]: %v", message.RecipeID, err)
			// Fallback to simple title normalization
			originalTitle := recipe.Title
			recipe.Title = normalizeTitle(recipe.Title)
			if recipe.Title != originalTitle {
				if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
					log.Printf("ERROR: Failed to update recipe with fallback normalization [recipeID=%s]: %v",
						message.RecipeID, err)
					continue
				}
				log.Printf("INFO: Fallback normalized recipe title [recipeID=%s, oldTitle=%q, newTitle=%q]",
					message.RecipeID, originalTitle, recipe.Title)
			} else {
				log.Printf("INFO: Recipe title already normalized [recipeID=%s, title=%q]",
					message.RecipeID, recipe.Title)
			}
			continue
		}

		// Update with normalized data
		*recipe = *normalizedRecipe

		// Always save the recipe (even if only metadata was added)
		if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
			log.Printf("ERROR: Failed to save normalized recipe to S3 [recipeID=%s]: %v", message.RecipeID, err)
			continue
		}

		log.Printf("INFO: Successfully normalized recipe with enhanced metadata [recipeID=%s]", message.RecipeID)

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
		log.Printf("WARN: Failed to publish CloudWatch metric [metric=%s]: %v", metricName, err)
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
