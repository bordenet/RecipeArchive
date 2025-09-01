package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type ImageUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	ImageData   string `json:"imageData"`
}

type ImageUploadResponse struct {
	Success  bool   `json:"success"`
	ImageURL string `json:"imageUrl,omitempty"`
	Message  string `json:"message,omitempty"`
	Error    string `json:"error,omitempty"`
}

var s3Client *s3.Client

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Unable to load SDK config: %v", err)
	}
	s3Client = s3.NewFromConfig(cfg)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	log.Printf("Image upload request received: %s %s", request.HTTPMethod, request.Path)

	// CORS headers
	headers := map[string]string{
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
		"Access-Control-Allow-Methods": "OPTIONS,POST",
		"Content-Type":                 "application/json",
	}

	// Handle preflight OPTIONS request
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    headers,
			Body:       "",
		}, nil
	}

	// Only allow POST for image upload
	if request.HTTPMethod != "POST" {
		return events.APIGatewayProxyResponse{
			StatusCode: 405,
			Headers:    headers,
			Body:       `{"error": "Method not allowed"}`,
		}, nil
	}

	// Parse request body
	var uploadReq ImageUploadRequest
	if err := json.Unmarshal([]byte(request.Body), &uploadReq); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       `{"error": "Invalid request body"}`,
		}, nil
	}

	// Validate required fields
	if uploadReq.ImageData == "" || uploadReq.Filename == "" {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       `{"error": "Missing required fields: filename and imageData"}`,
		}, nil
	}

	// Get user ID from JWT token (set by API Gateway authorizer)
	userID := request.RequestContext.Authorizer["sub"]
	if userIDStr, ok := userID.(string); ok && userIDStr != "" {
		log.Printf("Upload request for user: %s", userIDStr)
	} else {
		log.Printf("No user ID found in token, using anonymous")
	}

	// Decode base64 image data
	imageBytes, err := base64.StdEncoding.DecodeString(uploadReq.ImageData)
	if err != nil {
		log.Printf("Error decoding base64 image: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       `{"error": "Invalid base64 image data"}`,
		}, nil
	}

	// Generate unique key for S3
	imageID := uuid.New().String()
	s3Key := fmt.Sprintf("recipe-images/%s/%s", imageID, uploadReq.Filename)

	// Get S3 bucket name from environment
	bucketName := os.Getenv("S3_STORAGE_BUCKET")
	if bucketName == "" {
		log.Printf("S3_STORAGE_BUCKET environment variable not set")
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Storage configuration error"}`,
		}, nil
	}

	// Set content type
	contentType := uploadReq.ContentType
	if contentType == "" {
		// Try to determine content type from filename
		if strings.HasSuffix(strings.ToLower(uploadReq.Filename), ".jpg") || strings.HasSuffix(strings.ToLower(uploadReq.Filename), ".jpeg") {
			contentType = "image/jpeg"
		} else if strings.HasSuffix(strings.ToLower(uploadReq.Filename), ".png") {
			contentType = "image/png"
		} else if strings.HasSuffix(strings.ToLower(uploadReq.Filename), ".gif") {
			contentType = "image/gif"
		} else if strings.HasSuffix(strings.ToLower(uploadReq.Filename), ".webp") {
			contentType = "image/webp"
		} else {
			contentType = "image/jpeg" // Default
		}
	}

	// Upload to S3
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(s3Key),
		Body:        strings.NewReader(string(imageBytes)),
		ContentType: aws.String(contentType),
		ACL:         "public-read", // Make images publicly accessible
	})

	if err != nil {
		log.Printf("Error uploading to S3: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Failed to upload image"}`,
		}, nil
	}

	// Generate public URL
	imageURL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucketName, s3Key)

	log.Printf("Image uploaded successfully: %s", imageURL)

	response := ImageUploadResponse{
		Success:  true,
		ImageURL: imageURL,
		Message:  "Image uploaded successfully",
	}

	responseBody, _ := json.Marshal(response)

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    headers,
		Body:       string(responseBody),
	}, nil
}

func main() {
	lambda.Start(handler)
}