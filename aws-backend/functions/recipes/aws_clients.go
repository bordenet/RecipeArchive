package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"

	"recipe-archive/db"
)

var (
	recipeDB   db.RecipeDB
	sqsClient  *sqs.Client
	s3Client   *s3.Client
	bucketName string
	logger     *slog.Logger

	initOnce sync.Once
	initErr  error
)

func init() {
	// JSON handler for Lambda functions (CloudWatch Logs Insights compatible)
	logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     slog.LevelInfo,
		AddSource: true, // Include source file/line for errors
	}))
}

// initAWSClients performs lazy initialization of AWS clients using sync.Once.
// This reduces Lambda cold start time by ~100-200ms compared to init().
// Thread-safe and uses proper context propagation instead of context.TODO().
func initAWSClients(ctx context.Context) error {
	initOnce.Do(func() {
		// Use AWS_REGION environment variable (provided by Lambda runtime)
		// Falls back to us-west-2 if not set (local development)
		region := os.Getenv("AWS_REGION")
		if region == "" {
			region = "us-west-2"
		}

		cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
		if err != nil {
			initErr = fmt.Errorf("failed to load AWS config: %w", err)
			return
		}

		// Get S3 bucket name from environment variable (matches .env naming)
		bucketName = os.Getenv("S3_STORAGE_BUCKET")
		if bucketName == "" {
			bucketName = "recipe-storage-0ea7007d57f67ecb-990537043943" // fallback
		}

		// Initialize AWS clients
		s3Client = s3.NewFromConfig(cfg)
		sqsClient = sqs.NewFromConfig(cfg)
		recipeDB = db.NewS3RecipeDB(s3Client, bucketName)
	})
	return initErr
}
