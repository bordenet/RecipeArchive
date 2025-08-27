package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"recipe-archive/db"
	"recipe-archive/models"
	"recipe-archive/utils"
)

var (
	s3Client   *s3.Client
	recipeDB   db.RecipeDB
	bucketName string
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("Failed to load AWS config: %v", err))
	}

	s3Client = s3.NewFromConfig(cfg)

	// Get S3 bucket name from environment variable
	bucketName = os.Getenv("S3_STORAGE_BUCKET")
	if bucketName == "" {
		bucketName = "recipe-archive-dev" // fallback for testing
	}

	// Initialize S3-based recipe storage
	recipeDB = db.NewS3RecipeDB(s3Client, bucketName)
}

func main() {
	lambda.Start(handler)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Handle CORS preflight requests
	if request.HTTPMethod == "OPTIONS" {
		response, err := utils.NewAPIResponse(http.StatusOK, map[string]string{"message": "CORS preflight"})
		if err != nil {
			return events.APIGatewayProxyResponse{}, err
		}
		return response, nil
	}

	// Extract user ID from JWT claims
	userID := getUserIDFromRequest(request)
	if userID == "" {
		response, err := utils.NewAPIResponse(http.StatusUnauthorized, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "UNAUTHORIZED",
				"message":   "Invalid or missing authentication token",
				"timestamp": time.Now().UTC(),
			},
		})
		if err != nil {
			return events.APIGatewayProxyResponse{}, err
		}
		return response, nil
	}

	// Route based on HTTP method
	switch request.HTTPMethod {
	case "POST":
		return handleCreateBackup(ctx, request, userID)
	case "GET":
		return handleListBackups(ctx, request, userID)
	default:
		response, err := utils.NewAPIResponse(http.StatusMethodNotAllowed, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "METHOD_NOT_ALLOWED",
				"message":   fmt.Sprintf("Method %s not allowed", request.HTTPMethod),
				"timestamp": time.Now().UTC(),
			},
		})
		if err != nil {
			return events.APIGatewayProxyResponse{}, err
		}
		return response, nil
	}
}

// getUserIDFromRequest extracts user ID from JWT claims
func getUserIDFromRequest(request events.APIGatewayProxyRequest) string {
	claims, err := utils.ExtractUserFromJWT(request)
	if err != nil {
		fmt.Printf("JWT validation failed: %v\n", err)
		return ""
	}

	if claims.Sub == "" {
		fmt.Printf("JWT missing subject claim\n")
		return ""
	}

	return claims.Sub
}

// BackupManifest contains metadata about the backup
type BackupManifest struct {
	BackupID      string    `json:"backupId"`
	UserID        string    `json:"userId"`
	CreatedAt     time.Time `json:"createdAt"`
	RecipeCount   int       `json:"recipeCount"`
	BackupVersion string    `json:"backupVersion"`
	Description   string    `json:"description"`
}

// BackupResponse represents the API response for backup creation
type BackupResponse struct {
	BackupID    string `json:"backupId"`
	DownloadURL string `json:"downloadUrl"`
	ExpiresAt   string `json:"expiresAt"`
	RecipeCount int    `json:"recipeCount"`
	SizeBytes   int64  `json:"sizeBytes"`
}

// handleCreateBackup creates a complete backup of user's recipes as a zip file
func handleCreateBackup(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("Creating backup for user: %s\n", userID)

	// Get all recipes for the user
	recipes, err := recipeDB.ListRecipes(userID)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "BACKUP_FAILED",
				"message":   "Failed to retrieve recipes for backup",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Filter out soft-deleted recipes (backup only active recipes)
	var activeRecipes []models.Recipe
	for _, recipe := range recipes {
		if !recipe.IsDeleted {
			activeRecipes = append(activeRecipes, recipe)
		}
	}

	if len(activeRecipes) == 0 {
		response, responseErr := utils.NewAPIResponse(http.StatusOK, map[string]interface{}{
			"message":     "No active recipes to backup",
			"recipeCount": 0,
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Create backup manifest
	backupID := fmt.Sprintf("backup_%s_%d", userID, time.Now().Unix())
	manifest := BackupManifest{
		BackupID:      backupID,
		UserID:        userID,
		CreatedAt:     time.Now().UTC(),
		RecipeCount:   len(activeRecipes),
		BackupVersion: "1.0",
		Description:   fmt.Sprintf("Recipe backup created on %s", time.Now().UTC().Format("2006-01-02 15:04:05")),
	}

	// Create zip file in memory
	zipBuffer := &bytes.Buffer{}
	zipWriter := zip.NewWriter(zipBuffer)

	// Add manifest to zip
	manifestData, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "BACKUP_FAILED",
				"message":   "Failed to create backup manifest",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	manifestFile, err := zipWriter.Create("backup-manifest.json")
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "BACKUP_FAILED",
				"message":   "Failed to create manifest file in zip",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}
	manifestFile.Write(manifestData)

	// Add each recipe to zip
	for i, recipe := range activeRecipes {
		// Create filename: recipes/recipe-001-chocolate-chip-cookies.json
		safeTitle := strings.ReplaceAll(strings.ToLower(recipe.Title), " ", "-")
		safeTitle = strings.ReplaceAll(safeTitle, "'", "")
		safeTitle = strings.ReplaceAll(safeTitle, "\"", "")
		if len(safeTitle) > 50 {
			safeTitle = safeTitle[:50]
		}

		filename := fmt.Sprintf("recipes/recipe-%03d-%s.json", i+1, safeTitle)

		// Marshal recipe to JSON
		recipeData, err := json.MarshalIndent(recipe, "", "  ")
		if err != nil {
			fmt.Printf("Failed to marshal recipe %s: %v\n", recipe.Title, err)
			continue
		}

		// Add recipe file to zip
		recipeFile, err := zipWriter.Create(filename)
		if err != nil {
			fmt.Printf("Failed to create file in zip for recipe %s: %v\n", recipe.Title, err)
			continue
		}
		recipeFile.Write(recipeData)

		fmt.Printf("Added recipe to backup: %s\n", recipe.Title)
	}

	// Add README to zip with backup information
	readmeContent := fmt.Sprintf(`# RecipeArchive Backup

**Backup ID**: %s
**Created**: %s
**Recipe Count**: %d
**User ID**: %s

## Contents

- backup-manifest.json - Backup metadata and information
- recipes/ - Individual recipe files in JSON format

## Restoration

This backup contains all your active recipes in standard JSON format.
Each recipe file contains complete recipe data including:
- Title, ingredients, and instructions
- Timing information (prep, cook, total)
- Source URL and metadata
- Creation and modification timestamps

To restore recipes, use the RecipeArchive import feature or
upload individual JSON files back to the system.

## File Format

Each recipe follows the standard RecipeArchive JSON schema:
- Ingredients with structured amounts and units
- Step-by-step instructions
- User-scoped data isolation
- Version tracking for updates

Generated by RecipeArchive Backup API v1.0
`, manifest.BackupID, manifest.CreatedAt.Format("2006-01-02 15:04:05 UTC"),
		manifest.RecipeCount, manifest.UserID)

	readmeFile, err := zipWriter.Create("README.md")
	if err == nil {
		readmeFile.Write([]byte(readmeContent))
	}

	// Close zip writer
	err = zipWriter.Close()
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "BACKUP_FAILED",
				"message":   "Failed to finalize backup zip",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Upload zip file to S3
	backupKey := fmt.Sprintf("backups/%s/%s.zip", userID, backupID)
	zipData := zipBuffer.Bytes()

	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(backupKey),
		Body:        bytes.NewReader(zipData),
		ContentType: aws.String("application/zip"),
		Metadata: map[string]string{
			"backup-id":      backupID,
			"user-id":        userID,
			"recipe-count":   fmt.Sprintf("%d", len(activeRecipes)),
			"backup-version": "1.0",
		},
	})
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "BACKUP_FAILED",
				"message":   "Failed to store backup file",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Generate pre-signed URL for download (valid for 24 hours)
	presignClient := s3.NewPresignClient(s3Client)
	presignRequest := &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(backupKey),
	}

	presignResult, err := presignClient.PresignGetObject(ctx, presignRequest, func(opts *s3.PresignOptions) {
		opts.Expires = 24 * time.Hour // 24 hour expiration
	})
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "BACKUP_FAILED",
				"message":   "Failed to generate download URL",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Create response
	backupResponse := BackupResponse{
		BackupID:    backupID,
		DownloadURL: presignResult.URL,
		ExpiresAt:   time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339),
		RecipeCount: len(activeRecipes),
		SizeBytes:   int64(len(zipData)),
	}

	fmt.Printf("Backup created successfully: %s (%d recipes, %d bytes)\n",
		backupID, len(activeRecipes), len(zipData))

	response, responseErr := utils.NewAPIResponse(http.StatusCreated, backupResponse)
	if responseErr != nil {
		return events.APIGatewayProxyResponse{}, responseErr
	}
	return response, nil
}

// handleListBackups lists available backups for a user
func handleListBackups(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	// List backup files in S3 for the user
	prefix := fmt.Sprintf("backups/%s/", userID)

	listInput := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String(prefix),
	}

	result, err := s3Client.ListObjectsV2(ctx, listInput)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "LIST_FAILED",
				"message":   "Failed to list backups",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	type BackupInfo struct {
		BackupID  string    `json:"backupId"`
		CreatedAt time.Time `json:"createdAt"`
		SizeBytes int64     `json:"sizeBytes"`
		Available bool      `json:"available"`
	}

	var backups []BackupInfo
	for _, obj := range result.Contents {
		if strings.HasSuffix(*obj.Key, ".zip") {
			// Extract backup ID from key: backups/user-123/backup_user-123_1234567890.zip
			keyParts := strings.Split(*obj.Key, "/")
			if len(keyParts) >= 3 {
				filename := keyParts[len(keyParts)-1]
				backupID := strings.TrimSuffix(filename, ".zip")

				backups = append(backups, BackupInfo{
					BackupID:  backupID,
					CreatedAt: *obj.LastModified,
					SizeBytes: *obj.Size,
					Available: true,
				})
			}
		}
	}

	response, responseErr := utils.NewAPIResponse(http.StatusOK, map[string]interface{}{
		"backups": backups,
		"total":   len(backups),
	})
	if responseErr != nil {
		return events.APIGatewayProxyResponse{}, responseErr
	}
	return response, nil
}
