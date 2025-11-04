package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
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

var (
	cwClient *cloudwatch.Client
	logger   *slog.Logger
)

func init() {
	// JSON handler for Lambda functions (CloudWatch Logs Insights compatible)
	logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     slog.LevelInfo,
		AddSource: true, // Include source file/line for errors
	}))
}

// handler processes SQS messages to normalize recipes in background.
// Each message contains a recipe ID and user ID for normalization.
func handler(ctx context.Context, event events.SQSEvent) error {
	logger.Info("background normalizer invoked", "messageCount", len(event.Records))

	// Initialize S3 and CloudWatch clients
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		logger.Error("failed to load AWS config", "error", err)
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)
	cwClient = cloudwatch.NewFromConfig(cfg)
	bucketName := os.Getenv("S3_STORAGE_BUCKET")

	if bucketName == "" {
		logger.Error("S3_STORAGE_BUCKET environment variable not set")
		return fmt.Errorf("S3_STORAGE_BUCKET environment variable not set")
	}
	logger.Info("AWS clients initialized", "bucket", bucketName)

	// Process each SQS message
	for _, record := range event.Records {
		logger.Info("processing SQS message", "messageId", record.MessageId)

		// Parse the message
		var message NormalizationMessage
		if err := json.Unmarshal([]byte(record.Body), &message); err != nil {
			logger.Error("failed to parse SQS message", "messageId", record.MessageId, "error", err)
			continue // Skip this message but don't fail the whole batch
		}

		requestID := "unknown"
		if val := ctx.Value("aws.lambda.RequestId"); val != nil {
			if str, ok := val.(string); ok {
				requestID = str
			}
		}
		logger.Info("normalizing recipe",
			"recipeID", message.RecipeID,
			"userID", message.UserID,
			"requestID", requestID)

		// Get the recipe from S3
		recipe, err := getRecipeFromS3(ctx, s3Client, bucketName, message.UserID, message.RecipeID)
		if err != nil {
			logger.Error("failed to get recipe from S3", "recipeID", message.RecipeID, "error", err)
			continue
		}

		// CRITICAL: Validate recipe quality before OpenAI normalization
		ingredientCount := len(recipe.Ingredients)
		instructionCount := len(recipe.Instructions)

		if ingredientCount == 0 && instructionCount == 0 {
			// This is GARBAGE - reject normalization and log ERROR
			logger.Error("refusing to normalize garbage recipe",
				"recipeID", message.RecipeID,
				"ingredients", 0,
				"instructions", 0,
				"sourceURL", recipe.SourceURL)
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
			logger.Warn("recipe has incomplete content", "recipeID", message.RecipeID, "ingredients", ingredientCount, "instructions", instructionCount)
			publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
				"Quality": "POOR",
				"Source":  extractDomain(recipe.SourceURL),
			})
		}

		// Always normalize the recipe with OpenAI, preserving cookingMethods structure
		logger.Info("normalizing recipe with OpenAI", "recipeID", message.RecipeID)
		normalizedRecipe, err := normalizeRecipeWithOpenAI(ctx, recipe)
		if err != nil {
			logger.Error("failed to normalize recipe with OpenAI", "recipeID", message.RecipeID, "error", err)
			// Fallback to simple title normalization
			originalTitle := recipe.Title
			recipe.Title = normalizeTitle(recipe.Title)
			if recipe.Title != originalTitle {
				if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
					logger.Error("failed to update recipe with fallback normalization", "recipeID", message.RecipeID, "error", err)
					continue
				}
				logger.Info("fallback normalized recipe title", "recipeID", message.RecipeID, "oldTitle", originalTitle, "newTitle", recipe.Title)
			} else {
				logger.Info("recipe title already normalized", "recipeID", message.RecipeID, "title", recipe.Title)
			}
			continue
		}

		// Update with normalized data
		*recipe = *normalizedRecipe

		// Always save the recipe (even if only metadata was added)
		if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
			logger.Error("failed to save normalized recipe to S3", "recipeID", message.RecipeID, "error", err)
			continue
		}

		logger.Info("successfully normalized recipe with enhanced metadata", "recipeID", message.RecipeID)

		// Publish quality metrics after normalization (reuse variables from above)
		publishMetric(ctx, "RecipeQuality", 1.0, map[string]string{
			"Quality": getQualityLevel(ingredientCount, instructionCount),
			"Source":  extractDomain(recipe.SourceURL),
		})

		if ingredientCount == 0 && instructionCount == 0 {
			// This is GARBAGE - log ERROR not INFO
			logger.Error("recipe has zero ingredients and instructions", "url", message.URL)
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
		logger.Warn("failed to publish CloudWatch metric", "metric", metricName, "error", err)
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
