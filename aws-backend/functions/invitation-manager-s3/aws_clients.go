package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/ses"

	"recipe-archive/utils"
)

var (
	s3Client  *s3.Client
	sesClient *ses.Client
	baseURL   string
	initOnce  sync.Once
	initErr   error
	logger    *slog.Logger
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
		region := os.Getenv("AWS_REGION")
		if region == "" {
			region = utils.GetAWSRegion()
		}

		cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
		if err != nil {
			initErr = fmt.Errorf("failed to load AWS config: %w", err)
			return
		}

		s3Client = s3.NewFromConfig(cfg)
		sesClient = ses.NewFromConfig(cfg)

		baseURL = os.Getenv("FRONTEND_BASE_URL")
		if baseURL == "" {
			baseURL = "https://localhost:3000"
		}

		logger.Info("S3-Based Invitation Manager initialized", "bucket", utils.GetS3BucketName(), "baseURL", baseURL)
	})
	return initErr
}
