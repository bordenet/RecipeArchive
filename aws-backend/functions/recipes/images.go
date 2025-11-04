package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"recipe-archive/models"
)

// validateImageURL ensures that image URLs are only from our S3 bucket
func validateImageURL(imageURL *string) error {
	if imageURL == nil || *imageURL == "" {
		return nil // Empty URLs are allowed
	}

	parsedURL, err := url.Parse(*imageURL)
	if err != nil {
		return fmt.Errorf("invalid URL format")
	}

	// Only allow HTTPS
	if parsedURL.Scheme != "https" {
		return fmt.Errorf("only HTTPS URLs are allowed")
	}

	// Check if it's an S3 URL from our bucket
	isValidS3URL := false

	// Get our S3 bucket name
	if bucketName != "" {
		// Pattern 1: https://BUCKET.s3.amazonaws.com/...
		expectedS3Domain1 := bucketName + ".s3.amazonaws.com"

		// Pattern 2: https://s3.amazonaws.com/BUCKET/...
		expectedS3Domain2 := "s3.amazonaws.com"

		// Pattern 3: Regional S3: https://BUCKET.s3.us-west-2.amazonaws.com/...
		expectedS3Domain3 := bucketName + ".s3.us-west-2.amazonaws.com"

		if parsedURL.Host == expectedS3Domain1 ||
			(parsedURL.Host == expectedS3Domain2 && strings.HasPrefix(parsedURL.Path, "/"+bucketName+"/")) ||
			parsedURL.Host == expectedS3Domain3 {
			isValidS3URL = true
		}
	}

	if !isValidS3URL {
		return fmt.Errorf("image URLs must be from our S3 bucket (%s). External image URLs are not allowed for security reasons", bucketName)
	}

	return nil
}

// downloadAndUploadImage downloads an external image and uploads it to S3
func downloadAndUploadImage(ctx context.Context, imageURL string, userID string, recipeID string) (string, error) {
	// Download image with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(imageURL)
	if err != nil {
		return "", fmt.Errorf("failed to download image: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			logger.Warn("failed to close response body", "error", closeErr)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("image download failed with status: %d", resp.StatusCode)
	}

	// Read image data with size limit (10MB)
	maxSize := int64(10 * 1024 * 1024)
	imageData, err := io.ReadAll(io.LimitReader(resp.Body, maxSize))
	if err != nil {
		return "", fmt.Errorf("failed to read image data: %w", err)
	}

	// Detect content type
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(imageData)
	}

	// Validate it's an image
	if !strings.HasPrefix(contentType, "image/") {
		return "", fmt.Errorf("URL does not point to an image (content-type: %s)", contentType)
	}

	// Generate S3 key: recipes/USER_ID/RECIPE_ID/main-photo.EXT
	ext := ".jpg" // default
	if strings.Contains(contentType, "png") {
		ext = ".png"
	} else if strings.Contains(contentType, "webp") {
		ext = ".webp"
	} else if strings.Contains(contentType, "gif") {
		ext = ".gif"
	}

	// Use same path structure as image-upload Lambda: recipe-images/{recipeID}/recipes/{filename}
	s3Key := fmt.Sprintf("recipe-images/%s/recipes/main-photo%s", recipeID, ext)

	// Upload to S3
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(s3Key),
		Body:        bytes.NewReader(imageData),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload image to S3: %w", err)
	}

	// Return S3 URL
	s3URL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucketName, s3Key)
	return s3URL, nil
}

// uploadWebArchiveImage uploads an image from Web Archive base64 data to S3
func uploadWebArchiveImage(ctx context.Context, webArchiveImage *models.WebArchiveImage, userID string, recipeID string) (string, error) {
	// Decode base64 image data
	imageData, err := base64.StdEncoding.DecodeString(webArchiveImage.Data)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 image data: %w", err)
	}

	// Validate size (10MB limit)
	maxSize := 10 * 1024 * 1024
	if len(imageData) > maxSize {
		return "", fmt.Errorf("image too large: %d bytes (max: %d)", len(imageData), maxSize)
	}

	// Determine file extension from MIME type
	ext := ".jpg" // default
	contentType := webArchiveImage.MimeType
	if strings.Contains(contentType, "png") {
		ext = ".png"
	} else if strings.Contains(contentType, "webp") {
		ext = ".webp"
	} else if strings.Contains(contentType, "gif") {
		ext = ".gif"
	} else if strings.Contains(contentType, "jpeg") || strings.Contains(contentType, "jpg") {
		ext = ".jpg"
	}

	// Use same path structure as image-upload Lambda: recipe-images/{recipeID}/recipes/{filename}
	s3Key := fmt.Sprintf("recipe-images/%s/recipes/main-photo%s", recipeID, ext)

	// Upload to S3
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(s3Key),
		Body:        bytes.NewReader(imageData),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload Web Archive image to S3: %w", err)
	}

	// Return S3 URL
	s3URL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucketName, s3Key)
	return s3URL, nil
}
