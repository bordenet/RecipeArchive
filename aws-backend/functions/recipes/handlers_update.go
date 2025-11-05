package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"recipe-archive/models"
	"recipe-archive/utils"
)

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
