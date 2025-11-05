package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/google/uuid"

	"recipe-archive/models"
	"recipe-archive/utils"
)

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
