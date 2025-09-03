package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"

	"recipe-archive/db"
	"recipe-archive/models"
	"recipe-archive/utils"
)

var recipeDB db.RecipeDB
var bucketName string

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("Failed to load AWS config: %v", err))
	}

	// Get S3 bucket name from environment variable (matches CDK variable name)
	bucketName = os.Getenv("S3_STORAGE_BUCKET")
	if bucketName == "" {
		bucketName = "recipe-archive-dev" // fallback for local testing
	}

	// Initialize S3-based storage (following architecture decision)
	s3Client := s3.NewFromConfig(cfg)
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

	// Route based on HTTP method and path
	switch request.HTTPMethod {
	case "GET":
		return handleGetRecipes(ctx, request, userID)
	case "POST":
		return handleCreateRecipe(ctx, request, userID)
	case "PUT":
		return handleUpdateRecipe(ctx, request, userID)
	case "DELETE":
		return handleDeleteRecipe(ctx, request, userID)
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

// getUserIDFromRequest extracts user ID from the request with proper JWT validation
func getUserIDFromRequest(request events.APIGatewayProxyRequest) string {
	// Use the JWT validation from utils
	claims, err := utils.ExtractUserFromJWT(request)
	if err != nil {
		// Log the error but don't expose details to client
		fmt.Printf("JWT validation failed: %v\n", err)
		return ""
	}

	if claims.Sub == "" {
		fmt.Printf("JWT missing subject claim\n")
		return ""
	}

	return claims.Sub
}

// handleGetRecipes handles GET requests for recipes (list or single)
func handleGetRecipes(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	// Check if this is a request for a specific recipe
	if recipeID, exists := request.PathParameters["id"]; exists {
		return handleGetRecipeByID(ctx, userID, recipeID)
	}

	// Otherwise, list recipes
	return handleListRecipes(ctx, userID, request.QueryStringParameters)
}

// handleGetRecipeByID handles GET requests for a specific recipe
func handleGetRecipeByID(ctx context.Context, userID, recipeID string) (events.APIGatewayProxyResponse, error) {
	// Get the recipe from S3
	recipe, err := recipeDB.GetRecipe(userID, recipeID)
	if err != nil {
		// Check if it's a "not found" error (common S3 error patterns)
		if strings.Contains(err.Error(), "NoSuchKey") || strings.Contains(err.Error(), "not found") {
			response, responseErr := utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
				"error": map[string]interface{}{
					"code":      "RECIPE_NOT_FOUND",
					"message":   "Recipe not found",
					"timestamp": time.Now().UTC(),
				},
			})
			if responseErr != nil {
				return events.APIGatewayProxyResponse{}, responseErr
			}
			return response, nil
		}

		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to retrieve recipe",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Check if recipe is soft deleted
	if recipe.IsDeleted {
		response, responseErr := utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "RECIPE_NOT_FOUND",
				"message":   "Recipe not found",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	response, responseErr := utils.NewAPIResponse(http.StatusOK, map[string]interface{}{
		"recipe": recipe,
	})
	if responseErr != nil {
		return events.APIGatewayProxyResponse{}, responseErr
	}
	return response, nil
}

// handleListRecipes handles GET requests to list recipes with pagination
func handleListRecipes(ctx context.Context, userID string, queryParams map[string]string) (events.APIGatewayProxyResponse, error) {
	// Parse pagination parameters
	limit := 20 // default limit
	if limitStr, exists := queryParams["limit"]; exists {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	// Get all recipes for user from S3
	allRecipes, err := recipeDB.ListRecipes(userID)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to retrieve recipes",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Filter out soft-deleted recipes
	var activeRecipes []models.Recipe
	for _, recipe := range allRecipes {
		if !recipe.IsDeleted {
			activeRecipes = append(activeRecipes, recipe)
		}
	}

	// Apply pagination
	total := len(activeRecipes)
	start := 0
	if cursor, exists := queryParams["cursor"]; exists {
		// Simple cursor-based pagination using recipe index
		if startIdx, err := strconv.Atoi(cursor); err == nil && startIdx >= 0 {
			start = startIdx
		}
	}

	end := start + limit
	if end > total {
		end = total
	}

	var recipes []models.Recipe
	var nextCursor *string
	hasMore := false

	if start < total {
		recipes = activeRecipes[start:end]
		if end < total {
			hasMore = true
			cursorStr := strconv.Itoa(end)
			nextCursor = &cursorStr
		}
	} else {
		recipes = []models.Recipe{}
	}

	response := models.RecipesListResponse{
		Recipes: recipes,
		Pagination: models.Pagination{
			NextCursor: nextCursor,
			HasMore:    hasMore,
			Total:      &total,
		},
	}

	apiResponse, responseErr := utils.NewAPIResponse(http.StatusOK, response)
	if responseErr != nil {
		return events.APIGatewayProxyResponse{}, responseErr
	}
	return apiResponse, nil
}

// handleCreateRecipe handles POST requests to create a new recipe
func handleCreateRecipe(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	var recipeData models.CreateRecipeRequest
	if err := json.Unmarshal([]byte(request.Body), &recipeData); err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INVALID_REQUEST",
				"message":   "Invalid request body",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Validate required fields
	if strings.TrimSpace(recipeData.Title) == "" {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "Title is required",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	if len(recipeData.Ingredients) == 0 {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "At least one ingredient is required",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	if len(recipeData.Instructions) == 0 {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "At least one instruction is required",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Check for existing recipe with same source URL (de-duplication)
	existingRecipes, err := recipeDB.ListRecipes(userID)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to check existing recipes",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Check if recipe with same source URL already exists (implement overwrite behavior)
	sourceURL := strings.TrimSpace(recipeData.SourceURL)
	var existingRecipe *models.Recipe
	for _, existing := range existingRecipes {
		if existing.SourceURL == sourceURL {
			existingRecipe = &existing
			break
		}
	}

	if existingRecipe != nil {
		// Recipe with same URL exists - overwrite it with new data
		fmt.Printf("Recipe with URL %s already exists, overwriting with new data", sourceURL)

		// Apply OpenAI content normalization for updates too
		normalizedData, err := normalizeRecipeContent(ctx, recipeData)
		if err != nil {
			fmt.Printf("⚠️ OpenAI normalization failed for update, using original data: %v\n", err)
			// Continue with original data if normalization fails
			normalizedData = &recipeData
		}

		// Preserve original creation time and ID, but update everything else with normalized data
		now := time.Now().UTC()
		updatedRecipe := models.Recipe{
			ID:               existingRecipe.ID,              // Keep same ID
			UserID:           userID,                         // Current user
			Title:            strings.TrimSpace(normalizedData.Title),     // Normalized title
			Ingredients:      normalizedData.Ingredients,     // Normalized ingredients
			Instructions:     normalizedData.Instructions,    // Normalized instructions
			SourceURL:        sourceURL,                      // Same URL
			PrepTimeMinutes:  normalizedData.PrepTimeMinutes, // Normalized prep time
			CookTimeMinutes:  normalizedData.CookTimeMinutes, // Normalized cook time
			TotalTimeMinutes: normalizedData.TotalTimeMinutes,// Normalized total time
			Servings:         normalizedData.Servings,        // Normalized servings
			Yield:            normalizedData.Yield,           // Normalized yield
			Categories:       normalizedData.Categories,      // Normalized categories
			MainPhotoURL:     recipeData.MainPhotoURL,        // Keep original photo URL
			Description:      normalizedData.Description,     // Normalized description
			CreatedAt:        existingRecipe.CreatedAt,       // Preserve original creation
			UpdatedAt:        now,                            // Current timestamp
			IsDeleted:        false,                          // Ensure not deleted
			Version:          existingRecipe.Version + 1,     // Increment version
		}

		// Update the recipe in storage
		err = recipeDB.UpdateRecipe(&updatedRecipe)
		if err != nil {
			response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
				"error": map[string]interface{}{
					"code":      "UPDATE_FAILED",
					"message":   "Failed to update existing recipe",
					"timestamp": time.Now().UTC(),
				},
			})
			if responseErr != nil {
				return events.APIGatewayProxyResponse{}, responseErr
			}
			return response, nil
		}

		// Return the updated recipe
		response, responseErr := utils.NewAPIResponse(http.StatusOK, map[string]interface{}{
			"recipe":  updatedRecipe,
			"message": "Recipe updated successfully (overwrite existing)",
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Apply OpenAI content normalization before saving
	normalizedData, err := normalizeRecipeContent(ctx, recipeData)
	if err != nil {
		fmt.Printf("⚠️ OpenAI normalization failed, using original data: %v\n", err)
		// Continue with original data if normalization fails
		normalizedData = &recipeData
	}

	// Create the recipe object with normalized data
	now := time.Now().UTC()
	recipe := models.Recipe{
		ID:               uuid.New().String(),
		UserID:           userID,
		Title:            strings.TrimSpace(normalizedData.Title),
		Ingredients:      normalizedData.Ingredients,
		Instructions:     normalizedData.Instructions,
		SourceURL:        strings.TrimSpace(recipeData.SourceURL), // Keep original source URL
		MainPhotoURL:     recipeData.MainPhotoURL, // Keep original photo URL
		PrepTimeMinutes:  normalizedData.PrepTimeMinutes,
		CookTimeMinutes:  normalizedData.CookTimeMinutes,
		TotalTimeMinutes: normalizedData.TotalTimeMinutes,
		Servings:         normalizedData.Servings,
		Yield:            normalizedData.Yield,
		Categories:       normalizedData.Categories,
		Description:      normalizedData.Description,
		Reviews:          normalizedData.Reviews,
		Nutrition:        normalizedData.Nutrition,
		CreatedAt:        now,
		UpdatedAt:        now,
		IsDeleted:        false,
		Version:          1,
	}

	// Save to S3
	err = recipeDB.CreateRecipe(&recipe)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to create recipe",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	response, responseErr := utils.NewAPIResponse(http.StatusCreated, map[string]interface{}{
		"recipe": recipe,
	})
	if responseErr != nil {
		return events.APIGatewayProxyResponse{}, responseErr
	}
	return response, nil
}

// handleUpdateRecipe handles PUT requests to update an existing recipe
func handleUpdateRecipe(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	recipeID, exists := request.PathParameters["id"]
	if !exists || recipeID == "" {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INVALID_REQUEST",
				"message":   "Recipe ID is required",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	var updateRecipe models.CreateRecipeRequest
	if err := json.Unmarshal([]byte(request.Body), &updateRecipe); err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INVALID_REQUEST",
				"message":   "Invalid request body",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Get existing recipe first to check if it exists
	existingRecipe, err := recipeDB.GetRecipe(userID, recipeID)
	if err != nil {
		if strings.Contains(err.Error(), "NoSuchKey") || strings.Contains(err.Error(), "not found") {
			response, responseErr := utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
				"error": map[string]interface{}{
					"code":      "RECIPE_NOT_FOUND",
					"message":   "Recipe not found",
					"timestamp": time.Now().UTC(),
				},
			})
			if responseErr != nil {
				return events.APIGatewayProxyResponse{}, responseErr
			}
			return response, nil
		}

		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to retrieve existing recipe",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Check if recipe is soft deleted
	if existingRecipe.IsDeleted {
		response, responseErr := utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "RECIPE_NOT_FOUND",
				"message":   "Recipe not found",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Validate required fields for update
	if strings.TrimSpace(updateRecipe.Title) == "" {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "Title is required",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Per requirement: "if a recipe exists and a user re-loads it from the web extension,
	// the API behavior will be to simply overwrite the existing record"
	// So we do a complete replacement of the recipe data
	now := time.Now().UTC()
	updatedRecipe := models.Recipe{
		ID:               recipeID, // Keep existing ID
		UserID:           userID,
		Title:            strings.TrimSpace(updateRecipe.Title),
		Ingredients:      updateRecipe.Ingredients,
		Instructions:     updateRecipe.Instructions,
		SourceURL:        strings.TrimSpace(updateRecipe.SourceURL),
		MainPhotoURL:     updateRecipe.MainPhotoURL,
		PrepTimeMinutes:  updateRecipe.PrepTimeMinutes,
		CookTimeMinutes:  updateRecipe.CookTimeMinutes,
		TotalTimeMinutes: updateRecipe.TotalTimeMinutes,
		Servings:         updateRecipe.Servings,
		Yield:            updateRecipe.Yield,
		Categories:       updateRecipe.Categories,
		Description:      updateRecipe.Description,
		Reviews:          updateRecipe.Reviews,
		Nutrition:        updateRecipe.Nutrition,
		CreatedAt:        existingRecipe.CreatedAt,   // Preserve original creation time
		UpdatedAt:        now,                        // Update timestamp
		IsDeleted:        false,                      // Ensure not deleted
		Version:          existingRecipe.Version + 1, // Increment version
	}

	// Update the recipe in S3 (S3 overwrites by default, perfect for our use case)
	err = recipeDB.UpdateRecipe(&updatedRecipe)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to update recipe",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	response, responseErr := utils.NewAPIResponse(http.StatusOK, map[string]interface{}{
		"recipe": updatedRecipe,
	})
	if responseErr != nil {
		return events.APIGatewayProxyResponse{}, responseErr
	}
	return response, nil
}

// handleDeleteRecipe handles DELETE requests to delete a recipe (soft delete)
func handleDeleteRecipe(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	recipeID, exists := request.PathParameters["id"]
	if !exists || recipeID == "" {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INVALID_REQUEST",
				"message":   "Recipe ID is required",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Check if recipe exists first
	existingRecipe, err := recipeDB.GetRecipe(userID, recipeID)
	if err != nil {
		if strings.Contains(err.Error(), "NoSuchKey") || strings.Contains(err.Error(), "not found") {
			response, responseErr := utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
				"error": map[string]interface{}{
					"code":      "RECIPE_NOT_FOUND",
					"message":   "Recipe not found",
					"timestamp": time.Now().UTC(),
				},
			})
			if responseErr != nil {
				return events.APIGatewayProxyResponse{}, responseErr
			}
			return response, nil
		}

		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to retrieve recipe",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Check if already deleted
	if existingRecipe.IsDeleted {
		response, responseErr := utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "RECIPE_NOT_FOUND",
				"message":   "Recipe not found",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Hard delete by removing from S3 storage entirely
	err = recipeDB.DeleteRecipe(userID, recipeID)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to permanently delete recipe",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	response, responseErr := utils.NewAPIResponse(http.StatusOK, map[string]interface{}{
		"message": "Recipe permanently deleted from storage",
	})
	if responseErr != nil {
		return events.APIGatewayProxyResponse{}, responseErr
	}
	return response, nil
}

// normalizeRecipeContent calls the OpenAI content normalizer Lambda function
func normalizeRecipeContent(ctx context.Context, recipeData models.CreateRecipeRequest) (*models.CreateRecipeRequest, error) {
	// Get API Gateway base URL from environment
	baseURL := os.Getenv("API_GATEWAY_URL")
	if baseURL == "" {
		return nil, fmt.Errorf("API_GATEWAY_URL environment variable not set")
	}

	// Prepare normalization request
	normalizeRequest := map[string]interface{}{
		"originalRecipe": map[string]interface{}{
			"title":        recipeData.Title,
			"ingredients":  convertIngredientsToNormalizerFormat(recipeData.Ingredients),
			"instructions": convertInstructionsToNormalizerFormat(recipeData.Instructions),
			"author":       "", // Not available in CreateRecipeRequest
			"prepTime":     formatTimeForNormalizer(recipeData.PrepTimeMinutes),
			"cookTime":     formatTimeForNormalizer(recipeData.CookTimeMinutes),
			"totalTime":    formatTimeForNormalizer(recipeData.TotalTimeMinutes),
			"servings":     formatServingsForNormalizer(recipeData.Servings),
			"description":  recipeData.Description,
			"imageUrl":     recipeData.MainPhotoURL,
			"sourceUrl":    recipeData.SourceURL,
			"tags":         recipeData.Categories,
		},
		"userId":    "system", // Mark as system-initiated normalization
		"sourceUrl": recipeData.SourceURL,
	}

	// Marshal request body
	requestBody, err := json.Marshal(normalizeRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal normalization request: %w", err)
	}

	// Create HTTP request to content normalizer endpoint
	normalizeURL := fmt.Sprintf("%s/v1/normalize", strings.TrimSuffix(baseURL, "/"))
	req, err := http.NewRequestWithContext(ctx, "POST", normalizeURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create normalization request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Make HTTP request with timeout
	client := &http.Client{
		Timeout: 30 * time.Second, // Allow enough time for OpenAI processing
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("content normalizer request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("content normalizer returned status %d", resp.StatusCode)
	}

	// Parse response
	var normalizeResponse struct {
		NormalizedRecipe struct {
			Title        string `json:"title"`
			Ingredients  []struct {
				Text string `json:"text"`
			} `json:"ingredients"`
			Instructions []struct {
				StepNumber int    `json:"stepNumber"`
				Text       string `json:"text"`
			} `json:"instructions"`
			Author       string   `json:"author,omitempty"`
			PrepTime     string   `json:"prepTime,omitempty"`
			CookTime     string   `json:"cookTime,omitempty"`
			TotalTime    string   `json:"totalTime,omitempty"`
			Servings     string   `json:"servings,omitempty"`
			Description  string   `json:"description,omitempty"`
			ImageUrl     string   `json:"imageUrl,omitempty"`
			SourceUrl    string   `json:"sourceUrl,omitempty"`
			Tags         []string `json:"tags,omitempty"`
		} `json:"normalizedRecipe"`
		QualityScore       float64 `json:"qualityScore"`
		NormalizationNotes string  `json:"normalizationNotes"`
		FallbackUsed       bool    `json:"fallbackUsed"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&normalizeResponse); err != nil {
		return nil, fmt.Errorf("failed to decode normalization response: %w", err)
	}

	fmt.Printf("✅ OpenAI normalization completed with quality score: %.1f (fallback: %v)\n", 
		normalizeResponse.QualityScore, normalizeResponse.FallbackUsed)
	if normalizeResponse.NormalizationNotes != "" {
		fmt.Printf("📝 Normalization notes: %s\n", normalizeResponse.NormalizationNotes)
	}

	// Convert normalized response back to CreateRecipeRequest format
	var description *string
	if normalizeResponse.NormalizedRecipe.Description != "" {
		description = &normalizeResponse.NormalizedRecipe.Description
	} else {
		description = recipeData.Description
	}

	normalized := &models.CreateRecipeRequest{
		Title:            normalizeResponse.NormalizedRecipe.Title,
		Ingredients:      convertNormalizerIngredientsToModel(normalizeResponse.NormalizedRecipe.Ingredients),
		Instructions:     convertNormalizerInstructionsToModel(normalizeResponse.NormalizedRecipe.Instructions),
		SourceURL:        recipeData.SourceURL, // Keep original source URL
		MainPhotoURL:     recipeData.MainPhotoURL, // Keep original photo URL
		Description:      description,
		PrepTimeMinutes:  parseTimeFromNormalizer(normalizeResponse.NormalizedRecipe.PrepTime, recipeData.PrepTimeMinutes),
		CookTimeMinutes:  parseTimeFromNormalizer(normalizeResponse.NormalizedRecipe.CookTime, recipeData.CookTimeMinutes),
		TotalTimeMinutes: parseTimeFromNormalizer(normalizeResponse.NormalizedRecipe.TotalTime, recipeData.TotalTimeMinutes),
		Servings:         parseServingsFromNormalizer(normalizeResponse.NormalizedRecipe.Servings, recipeData.Servings),
		Yield:            recipeData.Yield, // Keep original yield
		Categories:       normalizeResponse.NormalizedRecipe.Tags,
		Reviews:          recipeData.Reviews, // Keep original reviews
		Nutrition:        recipeData.Nutrition, // Keep original nutrition
	}

	return normalized, nil
}

// Helper functions for format conversion

func convertIngredientsToNormalizerFormat(ingredients []models.Ingredient) []map[string]string {
	var result []map[string]string
	for _, ing := range ingredients {
		result = append(result, map[string]string{"text": ing.Text})
	}
	return result
}

func convertInstructionsToNormalizerFormat(instructions []models.Instruction) []map[string]interface{} {
	var result []map[string]interface{}
	for _, inst := range instructions {
		result = append(result, map[string]interface{}{
			"stepNumber": inst.StepNumber,
			"text":       inst.Text,
		})
	}
	return result
}

func convertNormalizerIngredientsToModel(ingredients []struct {
	Text string `json:"text"`
}) []models.Ingredient {
	var result []models.Ingredient
	for _, ing := range ingredients {
		result = append(result, models.Ingredient{Text: ing.Text})
	}
	return result
}

func convertNormalizerInstructionsToModel(instructions []struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
}) []models.Instruction {
	var result []models.Instruction
	for _, inst := range instructions {
		result = append(result, models.Instruction{
			StepNumber: inst.StepNumber,
			Text:       inst.Text,
		})
	}
	return result
}

func formatTimeForNormalizer(minutes *int) string {
	if minutes == nil || *minutes == 0 {
		return ""
	}
	if *minutes < 60 {
		return fmt.Sprintf("%d minutes", *minutes)
	}
	hours := *minutes / 60
	remainingMinutes := *minutes % 60
	if remainingMinutes == 0 {
		return fmt.Sprintf("%d hours", hours)
	}
	return fmt.Sprintf("%d hours %d minutes", hours, remainingMinutes)
}

func formatServingsForNormalizer(servings *int) string {
	if servings == nil || *servings == 0 {
		return ""
	}
	if *servings == 1 {
		return "1 serving"
	}
	return fmt.Sprintf("%d servings", *servings)
}

func parseTimeFromNormalizer(timeStr string, fallback *int) *int {
	if timeStr == "" {
		return fallback
	}
	
	// Simple parsing for common formats like "30 minutes", "1 hour", "1 hour 30 minutes"
	timeStr = strings.ToLower(strings.TrimSpace(timeStr))
	
	var totalMinutes int
	
	// Extract hours
	if strings.Contains(timeStr, "hour") {
		parts := strings.Fields(timeStr)
		for i, part := range parts {
			if strings.Contains(part, "hour") && i > 0 {
				if hours, err := strconv.Atoi(parts[i-1]); err == nil {
					totalMinutes += hours * 60
				}
				break
			}
		}
	}
	
	// Extract minutes
	if strings.Contains(timeStr, "minute") {
		parts := strings.Fields(timeStr)
		for i, part := range parts {
			if strings.Contains(part, "minute") && i > 0 {
				if minutes, err := strconv.Atoi(parts[i-1]); err == nil {
					totalMinutes += minutes
				}
				break
			}
		}
	}
	
	if totalMinutes > 0 {
		return &totalMinutes
	}
	
	return fallback
}

func parseServingsFromNormalizer(servingsStr string, fallback *int) *int {
	if servingsStr == "" {
		return fallback
	}
	
	// Extract number from strings like "4 servings", "1 serving"
	servingsStr = strings.ToLower(strings.TrimSpace(servingsStr))
	parts := strings.Fields(servingsStr)
	
	if len(parts) > 0 {
		if servings, err := strconv.Atoi(parts[0]); err == nil {
			return &servings
		}
	}
	
	return fallback
}
