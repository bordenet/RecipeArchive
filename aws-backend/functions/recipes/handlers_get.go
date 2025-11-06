package main

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"recipe-archive/models"
	"recipe-archive/utils"
)

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
	SortSearchResults(activeRecipes, sortBy, sortOrder, "")

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
