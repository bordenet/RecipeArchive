package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/google/uuid"

	"recipe-archive/models"
	"recipe-archive/utils"
)



func main() {
	lambda.Start(handler)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Initialize AWS clients lazily (only on first invocation, cached afterwards)
	if err := initAWSClients(ctx); err != nil {
		logger.Error("failed to initialize AWS clients", "error", err)
		response, _ := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INITIALIZATION_ERROR",
				"message": "Failed to initialize AWS services",
			},
		})
		return response, nil
	}

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
		// Check if this is a search request
		if strings.Contains(request.Path, "/search") {
			return handleSearchRecipes(ctx, request, userID)
		}
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

// getUserIDFromRequest extracts user ID from the request with enhanced tenant validation
func getUserIDFromRequest(request events.APIGatewayProxyRequest) string {
	// Use enhanced tenant validation for better security
	validation, err := utils.ValidateTenantAccessSimple(request)
	if err != nil {
		logger.Error("tenant validation error", "error", err)
		return ""
	}

	if !validation.Valid {
		logger.Error("tenant validation failed", "error", validation.Error)
		return ""
	}

	return validation.UserID
}

// validateImageURL ensures that image URLs are only from our S3 bucket

// handleGetRecipes handles GET requests for recipes (list or single)
func handleGetRecipes(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	// Check if this is a request for a specific recipe
	if recipeID, exists := request.PathParameters["recipeId"]; exists {
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
	limit := 50 // default limit per API specification (was 20, causing Flutter app to show only 20 recipes)
	if limitStr, exists := queryParams["limit"]; exists {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	// Get all recipes for user from S3
	allRecipes, err := recipeDB.ListRecipes(userID)
	if err != nil {
		logger.Error("failed to list recipes", "userID", userID, "error", err)
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

	// Sort results (same logic as search endpoint)
	sortBy := queryParams["sortBy"]
	sortOrder := queryParams["sortOrder"]
	SortSearchResults(activeRecipes, sortBy, sortOrder)

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

// handleSearchRecipes handles GET requests to search recipes with cost-efficient in-Lambda filtering
func handleSearchRecipes(ctx context.Context, request events.APIGatewayProxyRequest, userID string) (events.APIGatewayProxyResponse, error) {
	// Get all recipes for user from S3 (cost-efficient: no external search service needed)
	allRecipes, err := recipeDB.ListRecipes(userID)
	if err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "INTERNAL_ERROR",
				"message":   "Failed to retrieve recipes for search",
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

	// Parse search parameters
	queryParams := request.QueryStringParameters
	searchQuery := strings.ToLower(strings.TrimSpace(queryParams["q"]))

	// Time-based filtering
	var maxPrepTime, maxCookTime *int
	if val := queryParams["maxPrepTime"]; val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed >= 0 {
			maxPrepTime = &parsed
		}
	}
	if val := queryParams["maxCookTime"]; val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed >= 0 {
			maxCookTime = &parsed
		}
	}

	// Advanced search filters using SearchMetadata (cost-optimized)
	semanticTags := parseSearchArray(queryParams["semanticTags"])
	primaryIngredients := parseSearchArray(queryParams["primaryIngredients"])
	cookingMethods := parseSearchArray(queryParams["cookingMethods"])
	dietaryTags := parseSearchArray(queryParams["dietaryTags"])
	flavorProfile := parseSearchArray(queryParams["flavorProfile"])
	equipment := parseSearchArray(queryParams["equipment"])
	timeCategory := strings.ToLower(strings.TrimSpace(queryParams["timeCategory"]))
	complexity := strings.ToLower(strings.TrimSpace(queryParams["complexity"]))
	mealTypes := parseSearchArray(queryParams["mealType"])

	// Source URL filtering
	sourceFilter := strings.ToLower(strings.TrimSpace(queryParams["source"]))

	// Apply cost-efficient in-memory filtering
	var matchingRecipes []models.Recipe
	for _, recipe := range activeRecipes {
		if matchesSearchCriteria(recipe, searchQuery, maxPrepTime, maxCookTime,
			semanticTags, primaryIngredients, cookingMethods, dietaryTags,
			flavorProfile, equipment, mealTypes, timeCategory, complexity, sourceFilter) {
			matchingRecipes = append(matchingRecipes, recipe)
		}
	}

	// Sort results (cost-efficient: in-memory sorting)
	sortBy := queryParams["sortBy"]
	sortOrder := queryParams["sortOrder"]
	SortSearchResults(matchingRecipes, sortBy, sortOrder)

	// Apply pagination
	limit := 50 // Default limit
	if limitStr, exists := queryParams["limit"]; exists {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	total := len(matchingRecipes)
	start := 0
	if cursor, exists := queryParams["cursor"]; exists {
		if startIdx, err := strconv.Atoi(cursor); err == nil && startIdx >= 0 {
			start = startIdx
		}
	}

	end := start + limit
	if end > total {
		end = total
	}

	var paginatedRecipes []models.Recipe
	var nextCursor *string
	hasMore := false

	if start < total {
		paginatedRecipes = matchingRecipes[start:end]
		if end < total {
			hasMore = true
			cursorStr := strconv.Itoa(end)
			nextCursor = &cursorStr
		}
	} else {
		paginatedRecipes = []models.Recipe{}
	}

	// Build search response
	response := models.RecipesListResponse{
		Recipes: paginatedRecipes,
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

	// CRITICAL: Reject garbage recipes with no content
	// Check if BOTH ingredients and instructions are empty - this indicates parsing failure
	// EXCEPTION 1: Allow empty content if HTML is provided (backend will parse it)
	// EXCEPTION 2: Allow empty content if sourceURL is valid (backend will fetch and parse HTML)
	hasHTML := recipeData.WebArchiveHTML != nil && *recipeData.WebArchiveHTML != ""
	hasValidURL := recipeData.SourceURL != "" && (strings.HasPrefix(recipeData.SourceURL, "http://") || strings.HasPrefix(recipeData.SourceURL, "https://"))

	if len(recipeData.Ingredients) == 0 && len(recipeData.Instructions) == 0 && !hasHTML && !hasValidURL {
		logger.Error("rejected recipe submission with no content", "sourceURL", recipeData.SourceURL)
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "Recipe must have at least one ingredient or one instruction, OR provide HTML for parsing, OR provide a valid source URL.",
				"details":   "This usually indicates a parsing failure. Please ensure the recipe content is properly formatted.",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	if hasHTML && len(recipeData.Ingredients) == 0 && len(recipeData.Instructions) == 0 {
		logger.Info("empty recipe with HTML provided", "sourceURL", recipeData.SourceURL)
	}

	if !hasHTML && hasValidURL && len(recipeData.Ingredients) == 0 && len(recipeData.Instructions) == 0 {
		logger.Info("empty recipe with valid URL", "sourceURL", recipeData.SourceURL)
	}

	// Warn about incomplete recipes but allow them (bookmarks or partial data)
	if len(recipeData.Ingredients) == 0 {
		logger.Warn("recipe has zero ingredients", "sourceURL", recipeData.SourceURL)
	}
	if len(recipeData.Instructions) == 0 {
		logger.Warn("recipe has zero instructions", "sourceURL", recipeData.SourceURL)
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

	// BEST-EFFORT HTML FETCHING & PARSING
	// If HTML is not provided (Chrome/Firefox via Share Extension), attempt to fetch it
	var htmlContent string
	if recipeData.WebArchiveHTML == nil || *recipeData.WebArchiveHTML == "" {
		logger.Info("attempting best-effort HTML fetch", "sourceURL", sourceURL)

		html, err := fetchHTMLFromURL(ctx, sourceURL)
		if err != nil {
			// Fetch failed - this is expected for paywalled sites
			logger.Warn("best-effort HTML fetch failed", "error", err)
			logger.Info("saving as bookmark")

			// Update title to indicate bookmark status
			domain := getDomainFromURL(sourceURL)
			recipeData.Title = fmt.Sprintf("🔖 Bookmarked: %s", domain)
			// Don't parse HTML - just save as bookmark
		} else {
			// Successfully fetched HTML
			logger.Info("HTML fetched successfully", "bytes", len(html))
			htmlContent = html
			recipeData.WebArchiveHTML = &html
		}
	} else {
		// HTML was provided (Safari Web Extension premium path)
		logger.Info("HTML provided by client", "bytes", len(*recipeData.WebArchiveHTML), "source", "web_extension")
		htmlContent = *recipeData.WebArchiveHTML
	}

	// PARSE HTML TO EXTRACT RECIPE DATA
	// If we have HTML content and recipe is missing ingredients/instructions, parse it
	if htmlContent != "" && (len(recipeData.Ingredients) == 0 || len(recipeData.Instructions) == 0) {
		logger.Info("attempting to parse HTML")
		parsedRecipe, err := parseHTMLToRecipe(htmlContent, sourceURL)
		if err != nil {
			logger.Warn("HTML parsing failed", "error", err)
			logger.Info("continuing with existing recipe data")
		} else {
			// Merge parsed data with existing data (existing data takes precedence if present)
			// Update title if it's empty, a bookmark, or a placeholder from iOS
			isPlaceholder := strings.HasPrefix(recipeData.Title, "Recipe from ") || strings.HasPrefix(recipeData.Title, "🔖")
			if recipeData.Title == "" || isPlaceholder {
				recipeData.Title = parsedRecipe.Title
			}
			if len(recipeData.Ingredients) == 0 {
				recipeData.Ingredients = parsedRecipe.Ingredients
			}
			if len(recipeData.Instructions) == 0 {
				recipeData.Instructions = parsedRecipe.Instructions
			}
			if recipeData.Description == nil && parsedRecipe.Description != nil {
				recipeData.Description = parsedRecipe.Description
			}
			if recipeData.MainPhotoURL == nil && parsedRecipe.MainPhotoURL != nil {
				recipeData.MainPhotoURL = parsedRecipe.MainPhotoURL
			}
			if recipeData.PrepTimeMinutes == nil && parsedRecipe.PrepTimeMinutes != nil {
				recipeData.PrepTimeMinutes = parsedRecipe.PrepTimeMinutes
			}
			if recipeData.CookTimeMinutes == nil && parsedRecipe.CookTimeMinutes != nil {
				recipeData.CookTimeMinutes = parsedRecipe.CookTimeMinutes
			}
			if recipeData.TotalTimeMinutes == nil && parsedRecipe.TotalTimeMinutes != nil {
				recipeData.TotalTimeMinutes = parsedRecipe.TotalTimeMinutes
			}
			if recipeData.Servings == nil && parsedRecipe.Servings != nil {
				recipeData.Servings = parsedRecipe.Servings
			}

			logger.Info("HTML parsing successful")
			logger.Info("recipe data merged",
				"ingredients", len(recipeData.Ingredients),
				"instructions", len(recipeData.Instructions))
		}
	}

	// Handle image URL - upload from Web Archive or download external images
	// This must happen AFTER HTML parsing so recipeData.MainPhotoURL is populated from parsed data
	var tempRecipeID string

	// FIRST: Check if we have Web Archive images (from iOS Share Extension)
	// If MainPhotoURL is null but we have Web Archive images, use the first one
	if (recipeData.MainPhotoURL == nil || *recipeData.MainPhotoURL == "") &&
		recipeData.WebArchiveImages != nil && len(*recipeData.WebArchiveImages) > 0 {
		logger.Info("using first Web Archive image", "count", len(*recipeData.WebArchiveImages))
		firstImage := (*recipeData.WebArchiveImages)[0]
		imageURL := firstImage.URL
		recipeData.MainPhotoURL = &imageURL
		logger.Info("set MainPhotoURL from Web Archive", "imageURL", imageURL)
	}

	if recipeData.MainPhotoURL != nil && *recipeData.MainPhotoURL != "" {
		imageURL := *recipeData.MainPhotoURL
		logger.Info("processing image URL", "imageURL", imageURL)

		// Check if it's already an S3 URL
		if err := validateImageURL(recipeData.MainPhotoURL); err != nil {
			// External URL - check if we have it in Web Archive images first
			var webArchiveImageData *models.WebArchiveImage
			if recipeData.WebArchiveImages != nil && len(*recipeData.WebArchiveImages) > 0 {
				logger.Info("checking Web Archive images", "count", len(*recipeData.WebArchiveImages))

				// Try exact URL match first
				for _, img := range *recipeData.WebArchiveImages {
					if img.URL == imageURL {
						webArchiveImageData = &img
						logger.Info("found exact URL match in Web Archive", "imageURL", imageURL)
						break
					}
				}

				// If no exact match, select BEST image (largest, skip icons/logos)
				if webArchiveImageData == nil {
					logger.Info("selecting best Web Archive image")

					var largestImage *models.WebArchiveImage
					var largestSize int

					for i, img := range *recipeData.WebArchiveImages {
						// Skip tiny images (likely icons/logos)
						dataSize := len(img.Data)
						if dataSize < 5000 { // Skip images < 5KB (too small for recipe photos)
							logger.Debug("skipping small image", "index", i+1, "bytes", dataSize)
							continue
						}

						// Prefer JPG/WEBP over PNG (recipe photos are usually JPG)
						mimeType := strings.ToLower(img.MimeType)
						isPNG := strings.Contains(mimeType, "png")

						// Track largest image
						if largestImage == nil || dataSize > largestSize {
							// If both are same type or current is JPG/WEBP, use larger
							if !isPNG || largestImage == nil {
								largestImage = &(*recipeData.WebArchiveImages)[i]
								largestSize = dataSize
								logger.Debug("candidate image", "index", i+1, "mimeType", img.MimeType, "bytes", dataSize)
							}
						}
					}

					if largestImage != nil {
						webArchiveImageData = largestImage
						logger.Info("selected largest image", "bytes", largestSize, "mimeType", webArchiveImageData.MimeType)
						logger.Debug("parsed URL", "url", imageURL)
						logger.Debug("archive URL", "url", webArchiveImageData.URL)
					} else {
						logger.Warn("no suitable images found")
					}
				}
			}

			// Generate temporary ID for image path (will be used as actual recipe ID later)
			tempRecipeID = uuid.New().String()

			if webArchiveImageData != nil {
				// Upload from Web Archive data (avoids CDN restrictions)
				logger.Info("uploading image from Web Archive", "mimeType", webArchiveImageData.MimeType)
				s3URL, uploadErr := uploadWebArchiveImage(ctx, webArchiveImageData, userID, tempRecipeID)
				if uploadErr != nil {
					logger.Warn("Web Archive image upload failed", "error", uploadErr.Error())
					recipeData.MainPhotoURL = nil
				} else {
					logger.Info("image uploaded from Web Archive", "s3URL", s3URL)
					recipeData.MainPhotoURL = &s3URL
				}
			} else {
				// Fallback: Download from external URL (only if no Web Archive images available)
				logger.Info("downloading external image", "imageURL", imageURL)
				s3URL, downloadErr := downloadAndUploadImage(ctx, imageURL, userID, tempRecipeID)
				if downloadErr != nil {
					logger.Warn("image download failed", "error", downloadErr.Error())
					recipeData.MainPhotoURL = nil
				} else {
					logger.Info("image uploaded to S3", "s3URL", s3URL)
					recipeData.MainPhotoURL = &s3URL
				}
			}
		} else {
			logger.Info("image already in S3")
		}
	}

	if existingRecipe != nil {
		// Recipe with same URL exists - overwrite it with new data
		logger.Info("recipe with URL already exists, overwriting", "sourceURL", sourceURL)

		// Store recipe immediately with raw data - normalization will happen asynchronously
		now := time.Now().UTC()
		updatedRecipe := models.Recipe{
			ID:               existingRecipe.ID,                   // Keep same ID
			UserID:           userID,                              // Current user
			Title:            strings.TrimSpace(recipeData.Title), // Raw title (will be normalized async)
			Ingredients:      recipeData.Ingredients,              // Raw ingredients
			Instructions:     recipeData.Instructions,             // Raw instructions
			SourceURL:        sourceURL,                           // Same URL
			PrepTimeMinutes:  recipeData.PrepTimeMinutes,
			CookTimeMinutes:  recipeData.CookTimeMinutes,
			TotalTimeMinutes: recipeData.TotalTimeMinutes,
			Servings:         recipeData.Servings,
			Yield:            recipeData.Yield,
			Categories:       recipeData.Categories,
			MainPhotoURL:     recipeData.MainPhotoURL,
			Description:      recipeData.Description,
			CreatedAt:        existingRecipe.CreatedAt,   // Preserve original creation
			UpdatedAt:        now,                        // Current timestamp
			IsDeleted:        false,                      // Ensure not deleted
			Version:          existingRecipe.Version + 1, // Increment version
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

		// Queue async normalization job for updated recipe (don't fail if queueing fails)
		// Skip normalization for bookmarks (0 ingredients AND 0 instructions)
		hasContent := len(updatedRecipe.Ingredients) > 0 || len(updatedRecipe.Instructions) > 0
		if hasContent {
			if err := queueRecipeNormalization(ctx, userID, updatedRecipe.ID); err != nil {
				logger.Warn("failed to queue normalization for updated recipe", "recipeID", updatedRecipe.ID, "error", err)
				// Fallback: Apply basic normalization immediately
				if normalizedRecipe, err := applyBasicNormalization(updatedRecipe); err == nil {
					if err := recipeDB.CreateRecipe(&normalizedRecipe); err == nil {
						logger.Info("applied fallback normalization for updated recipe", "recipeID", updatedRecipe.ID)
						updatedRecipe = normalizedRecipe
					} else {
						logger.Warn("failed to save normalized updated recipe", "error", err)
					}
				} else {
					logger.Warn("fallback normalization failed for update", "error", err)
				}
			}
		} else {
			logger.Info("skipping normalization for bookmark")
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

	// Create the recipe object with raw data - normalization will happen asynchronously
	now := time.Now().UTC()
	// Use tempRecipeID if we generated one for image upload, otherwise generate new UUID
	recipeID := tempRecipeID
	if recipeID == "" {
		recipeID = uuid.New().String()
	}
	recipe := models.Recipe{
		ID:               recipeID,
		UserID:           userID,
		Title:            strings.TrimSpace(recipeData.Title), // Raw title (will be normalized async)
		Ingredients:      recipeData.Ingredients,              // Raw ingredients
		Instructions:     recipeData.Instructions,             // Raw instructions
		SourceURL:        strings.TrimSpace(recipeData.SourceURL),
		MainPhotoURL:     recipeData.MainPhotoURL,
		PrepTimeMinutes:  recipeData.PrepTimeMinutes,
		CookTimeMinutes:  recipeData.CookTimeMinutes,
		TotalTimeMinutes: recipeData.TotalTimeMinutes,
		Servings:         recipeData.Servings,
		Yield:            recipeData.Yield,
		Categories:       recipeData.Categories,
		Description:      recipeData.Description,
		Reviews:          recipeData.Reviews,
		Nutrition:        recipeData.Nutrition,
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

	// Queue async normalization job (don't fail if queueing fails)
	// Skip normalization for bookmarks (0 ingredients AND 0 instructions)
	hasContent := len(recipe.Ingredients) > 0 || len(recipe.Instructions) > 0
	if hasContent {
		if err := queueRecipeNormalization(ctx, userID, recipe.ID); err != nil {
			logger.Warn("failed to queue normalization for recipe", "recipeID", recipe.ID, "error", err)
			// Fallback: Apply basic normalization immediately
			if normalizedRecipe, err := applyBasicNormalization(recipe); err == nil {
				if err := recipeDB.CreateRecipe(&normalizedRecipe); err == nil {
					logger.Info("applied fallback normalization for recipe", "recipeID", recipe.ID)
					recipe = normalizedRecipe
				} else {
					logger.Warn("failed to save normalized recipe", "error", err)
				}
			} else {
				logger.Warn("fallback normalization failed", "error", err)
			}
		}
	} else {
		logger.Info("skipping normalization for bookmark")
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
	recipeID, exists := request.PathParameters["recipeId"]
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

	var updateRequest models.UpdateRecipeRequest
	if err := json.Unmarshal([]byte(request.Body), &updateRequest); err != nil {
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

	// Validate image URL if provided (must be from our S3 bucket)
	if err := validateImageURL(updateRequest.MainPhotoURL); err != nil {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   fmt.Sprintf("Invalid image URL: %s", err.Error()),
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

	// For partial updates, validate only provided fields
	if updateRequest.Title != nil && strings.TrimSpace(*updateRequest.Title) == "" {
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "Title cannot be empty",
				"timestamp": time.Now().UTC(),
			},
		})
		if responseErr != nil {
			return events.APIGatewayProxyResponse{}, responseErr
		}
		return response, nil
	}

	// Start with existing recipe and apply partial updates
	now := time.Now().UTC()
	updatedRecipe := *existingRecipe // Copy existing recipe

	// Apply provided updates
	if updateRequest.Title != nil {
		updatedRecipe.Title = strings.TrimSpace(*updateRequest.Title)
	}
	if updateRequest.Ingredients != nil {
		updatedRecipe.Ingredients = *updateRequest.Ingredients
	}
	if updateRequest.Instructions != nil {
		updatedRecipe.Instructions = *updateRequest.Instructions
	}
	if updateRequest.SourceURL != nil {
		updatedRecipe.SourceURL = strings.TrimSpace(*updateRequest.SourceURL)
	}
	if updateRequest.MainPhotoURL != nil {
		updatedRecipe.MainPhotoURL = updateRequest.MainPhotoURL
	}
	if updateRequest.PrepTimeMinutes != nil {
		updatedRecipe.PrepTimeMinutes = updateRequest.PrepTimeMinutes
	}
	if updateRequest.CookTimeMinutes != nil {
		updatedRecipe.CookTimeMinutes = updateRequest.CookTimeMinutes
	}
	if updateRequest.TotalTimeMinutes != nil {
		updatedRecipe.TotalTimeMinutes = updateRequest.TotalTimeMinutes
	}
	if updateRequest.Servings != nil {
		updatedRecipe.Servings = updateRequest.Servings
	}
	if updateRequest.Yield != nil {
		updatedRecipe.Yield = updateRequest.Yield
	}
	if updateRequest.Categories != nil {
		updatedRecipe.Categories = *updateRequest.Categories
	}
	if updateRequest.Description != nil {
		updatedRecipe.Description = updateRequest.Description
	}
	if updateRequest.Reviews != nil {
		updatedRecipe.Reviews = updateRequest.Reviews
	}
	if updateRequest.Nutrition != nil {
		updatedRecipe.Nutrition = updateRequest.Nutrition
	}
	if updateRequest.PersonalRating != nil {
		updatedRecipe.PersonalRating = updateRequest.PersonalRating
	}
	if updateRequest.PersonalNotes != nil {
		updatedRecipe.PersonalNotes = updateRequest.PersonalNotes
	}
	if updateRequest.CookingNotes != nil {
		updatedRecipe.CookingNotes = updateRequest.CookingNotes
	}
	if updateRequest.IsFavorite != nil {
		updatedRecipe.IsFavorite = updateRequest.IsFavorite
	}
	if updateRequest.Cuisine != nil {
		updatedRecipe.Cuisine = updateRequest.Cuisine
	}
	if updateRequest.PersonalYield != nil {
		updatedRecipe.PersonalYield = updateRequest.PersonalYield
	}
	if updateRequest.Tags != nil {
		updatedRecipe.Tags = *updateRequest.Tags
	}
	if updateRequest.SearchMetadata != nil {
		updatedRecipe.SearchMetadata = updateRequest.SearchMetadata
	}

	// Always update system fields
	updatedRecipe.UpdatedAt = now
	updatedRecipe.Version = existingRecipe.Version + 1

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
	recipeID, exists := request.PathParameters["recipeId"]
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

