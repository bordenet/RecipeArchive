package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/google/uuid"

	"recipe-archive/db"
	"recipe-archive/models"
	"recipe-archive/utils"
)

var recipeDB db.RecipeDB
var sqsClient *sqs.Client
var s3Client *s3.Client

// NormalizationMessage represents an SQS message for async recipe normalization
type NormalizationMessage struct {
	RecipeID string `json:"recipeId"`
	UserID   string `json:"userId"`
	Action   string `json:"action"`
}

var bucketName string

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("us-west-2"))
	if err != nil {
		panic(fmt.Sprintf("Failed to load AWS config: %v", err))
	}

	// Get S3 bucket name from environment variable (matches CDK variable name)
	bucketName = os.Getenv("S3_STORAGE_BUCKET")
	if bucketName == "" {
		bucketName = "recipe-archive-dev" // fallback for local testing
	}

	// Initialize S3-based storage (following architecture decision)
	s3Client = s3.NewFromConfig(cfg)
	sqsClient = sqs.NewFromConfig(cfg)
	recipeDB = db.NewS3RecipeDB(s3Client, bucketName)
}

// fetchHTMLFromURL attempts to fetch HTML content from a URL
// This is used for best-effort recipe extraction when HTML is not provided by the client
// (e.g., Chrome/Firefox browsers that can't extract HTML via Share Extension)
func fetchHTMLFromURL(ctx context.Context, urlStr string) (string, error) {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 15 * time.Second, // Longer timeout for slow sites
	}

	// Create request with context for cancellation
	req, err := http.NewRequestWithContext(ctx, "GET", urlStr, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Set user agent to identify ourselves
	req.Header.Set("User-Agent", "RecipeArchive/1.0 (+https://github.com/yourusername/recip)")

	// Make the request
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	// Check for paywalls / auth required
	if resp.StatusCode == 403 {
		return "", fmt.Errorf("paywall detected (403 Forbidden) - requires authentication")
	}
	if resp.StatusCode == 401 {
		return "", fmt.Errorf("authentication required (401 Unauthorized)")
	}

	// Check for other errors
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if we got actual content
	if len(body) == 0 {
		return "", fmt.Errorf("empty response body")
	}

	fmt.Printf("✅ [BEST-EFFORT] Successfully fetched HTML (%d bytes) from %s\n", len(body), urlStr)
	return string(body), nil
}

// getDomainFromURL extracts the domain from a URL for display purposes
func getDomainFromURL(urlStr string) string {
	u, err := url.Parse(urlStr)
	if err != nil {
		return urlStr
	}
	// Remove www. prefix
	domain := strings.TrimPrefix(u.Host, "www.")
	return domain
}

// queueRecipeNormalization sends a message to SQS to normalize a recipe in the background
func queueRecipeNormalization(ctx context.Context, userID, recipeID string) error {
	queueURL := os.Getenv("NORMALIZATION_QUEUE_URL")
	if queueURL == "" {
		fmt.Printf("⚠️ NORMALIZATION_QUEUE_URL not set, skipping background normalization\n")
		return nil // Don't fail recipe creation if queue isn't configured
	}

	message := NormalizationMessage{
		RecipeID: recipeID,
		UserID:   userID,
		Action:   "normalize",
	}

	messageBody, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal normalization message: %w", err)
	}

	_, err = sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(queueURL),
		MessageBody: aws.String(string(messageBody)),
	})

	if err != nil {
		return fmt.Errorf("failed to send normalization message: %w", err)
	}

	fmt.Printf("📤 Queued normalization job for recipe %s\n", recipeID)
	return nil
}

// applyBasicNormalization provides fallback normalization when the async queue is unavailable
func applyBasicNormalization(recipe models.Recipe) (models.Recipe, error) {
	normalized := recipe
	changed := false

	// Infer missing prep/cook times from instructions if not present
	if recipe.PrepTimeMinutes == nil || recipe.CookTimeMinutes == nil {
		prepTime, cookTime := inferTimesFromInstructions(recipe.Instructions)
		if recipe.PrepTimeMinutes == nil && prepTime > 0 {
			normalized.PrepTimeMinutes = &prepTime
			changed = true
		}
		if recipe.CookTimeMinutes == nil && cookTime > 0 {
			normalized.CookTimeMinutes = &cookTime
			changed = true
		}
		// Calculate total time if both are available
		if normalized.PrepTimeMinutes != nil && normalized.CookTimeMinutes != nil {
			totalTime := *normalized.PrepTimeMinutes + *normalized.CookTimeMinutes
			normalized.TotalTimeMinutes = &totalTime
			changed = true
		}
	}

	// Infer missing servings from ingredients if not present
	if recipe.Servings == nil {
		if servings := inferServingsFromIngredients(recipe.Ingredients); servings > 0 {
			normalized.Servings = &servings
			changed = true
		}
	}

	// Add basic tags based on ingredients and instructions if no tags present
	if len(recipe.Tags) == 0 {
		if tags := inferBasicTags(recipe.Title, recipe.Ingredients, recipe.Instructions); len(tags) > 0 {
			normalized.Tags = tags
			changed = true
		}
	}

	if !changed {
		return recipe, fmt.Errorf("no normalization changes needed")
	}

	return normalized, nil
}

// inferTimesFromInstructions attempts to extract cooking times from instruction text
func inferTimesFromInstructions(instructions []models.Instruction) (prepTime, cookTime int) {
	prepTime = 15 // Default prep time
	cookTime = 0

	for _, instruction := range instructions {
		text := strings.ToLower(instruction.Text)

		// Look for baking/cooking time patterns
		if strings.Contains(text, "bake") || strings.Contains(text, "cook") || strings.Contains(text, "roast") {
			if strings.Contains(text, "30 minutes") || strings.Contains(text, "30 mins") {
				cookTime = 30
			} else if strings.Contains(text, "25 minutes") || strings.Contains(text, "25 mins") {
				cookTime = 25
			} else if strings.Contains(text, "20 minutes") || strings.Contains(text, "20 mins") {
				cookTime = 20
			} else if strings.Contains(text, "15 minutes") || strings.Contains(text, "15 mins") {
				cookTime = 15
			} else if strings.Contains(text, "45 minutes") || strings.Contains(text, "45 mins") {
				cookTime = 45
			} else if strings.Contains(text, "1 hour") || strings.Contains(text, "60 minutes") {
				cookTime = 60
			} else if cookTime == 0 {
				cookTime = 25 // Default cooking time if cooking mentioned but no time found
			}
		}

		// Look for prep activities that might indicate longer prep time
		if strings.Contains(text, "chop") || strings.Contains(text, "dice") ||
			strings.Contains(text, "mince") || strings.Contains(text, "slice") {
			if prepTime < 20 {
				prepTime = 20
			}
		}
	}

	return prepTime, cookTime
}

// inferServingsFromIngredients estimates servings based on ingredient quantities
func inferServingsFromIngredients(ingredients []models.Ingredient) int {
	// Look for serving indicators in ingredient text
	for _, ingredient := range ingredients {
		text := strings.ToLower(ingredient.Text)

		// Look for protein quantities that indicate serving size
		if strings.Contains(text, "chicken breast") || strings.Contains(text, "chicken thigh") {
			if strings.Contains(text, "4") || strings.Contains(text, "four") {
				return 4
			} else if strings.Contains(text, "2") || strings.Contains(text, "two") {
				return 2
			} else if strings.Contains(text, "6") || strings.Contains(text, "six") {
				return 6
			}
		}

		// Look for pasta quantities
		if strings.Contains(text, "pasta") || strings.Contains(text, "spaghetti") {
			if strings.Contains(text, "1 pound") || strings.Contains(text, "16 oz") {
				return 6
			} else if strings.Contains(text, "8 oz") || strings.Contains(text, "1/2 pound") {
				return 3
			}
		}
	}

	// Default serving size based on number of ingredients
	if len(ingredients) > 8 {
		return 4 // Complex recipes likely serve more people
	}
	return 2 // Simple recipes default to 2 servings
}

// inferBasicTags generates basic tags from recipe content
func inferBasicTags(title string, ingredients []models.Ingredient, instructions []models.Instruction) []string {
	tags := []string{}
	titleLower := strings.ToLower(title)

	// Cuisine/dish type tags
	if strings.Contains(titleLower, "pasta") || strings.Contains(titleLower, "italian") {
		tags = append(tags, "Italian")
	}
	if strings.Contains(titleLower, "mexican") || strings.Contains(titleLower, "taco") || strings.Contains(titleLower, "burrito") {
		tags = append(tags, "Mexican")
	}
	if strings.Contains(titleLower, "salad") {
		tags = append(tags, "Salad")
	}
	if strings.Contains(titleLower, "soup") {
		tags = append(tags, "Soup")
	}
	if strings.Contains(titleLower, "chicken") {
		tags = append(tags, "Chicken")
	}
	if strings.Contains(titleLower, "beef") {
		tags = append(tags, "Beef")
	}

	// Cooking method tags from instructions
	hasVegetables := false
	for _, instruction := range instructions {
		text := strings.ToLower(instruction.Text)
		if strings.Contains(text, "bake") || strings.Contains(text, "oven") {
			tags = append(tags, "Baked")
			break
		}
		if strings.Contains(text, "grill") {
			tags = append(tags, "Grilled")
			break
		}
		if strings.Contains(text, "sauté") || strings.Contains(text, "pan") {
			tags = append(tags, "Pan-cooked")
			break
		}
	}

	// Dietary tags from ingredients
	for _, ingredient := range ingredients {
		text := strings.ToLower(ingredient.Text)
		if strings.Contains(text, "vegetables") || strings.Contains(text, "lettuce") ||
			strings.Contains(text, "tomato") || strings.Contains(text, "carrot") {
			hasVegetables = true
		}
	}

	if hasVegetables {
		tags = append(tags, "Vegetables")
	}

	// Difficulty tag based on number of instructions
	if len(instructions) <= 3 {
		tags = append(tags, "Simple")
	} else if len(instructions) <= 6 {
		tags = append(tags, "Moderate")
	} else {
		tags = append(tags, "Complex")
	}

	return tags
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
		fmt.Printf("Tenant validation error: %v\n", err)
		return ""
	}

	if !validation.Valid {
		fmt.Printf("Tenant validation failed: %s\n", validation.Error)
		return ""
	}

	return validation.UserID
}

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
	// Validate resource access (additional tenant isolation check)
	resourcePath := fmt.Sprintf("recipes/%s/%s.json", userID, recipeID)
	if validator, err := utils.NewTenantValidation(); err == nil {
		if validateErr := validator.ValidateResourceAccess(ctx, userID, resourcePath); validateErr != nil {
			fmt.Printf("Resource access validation failed: %v\n", validateErr)
			response, responseErr := utils.NewAPIResponse(http.StatusForbidden, map[string]interface{}{
				"error": map[string]interface{}{
					"code":      "ACCESS_DENIED",
					"message":   "Access to this resource is not allowed",
					"timestamp": time.Now().UTC(),
				},
			})
			if responseErr != nil {
				return events.APIGatewayProxyResponse{}, responseErr
			}
			return response, nil
		}
	}

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
		fmt.Printf("❌ Failed to list recipes for user %s: %v\n", userID, err)
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
	// EXCEPTION: Allow empty content if HTML is provided (backend will parse it)
	hasHTML := recipeData.WebArchiveHTML != nil && *recipeData.WebArchiveHTML != ""
	if len(recipeData.Ingredients) == 0 && len(recipeData.Instructions) == 0 && !hasHTML {
		fmt.Printf("❌ ERROR: Rejected recipe submission with 0 ingredients AND 0 instructions from %s\n", recipeData.SourceURL)
		response, responseErr := utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "Recipe must have at least one ingredient or one instruction, OR provide HTML for parsing.",
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
		fmt.Printf("📄 INFO: Empty recipe with HTML provided - will attempt backend parsing from %s\n", recipeData.SourceURL)
	}

	// Warn about incomplete recipes but allow them (bookmarks or partial data)
	if len(recipeData.Ingredients) == 0 {
		fmt.Printf("⚠️ WARN: Recipe has 0 ingredients (may be bookmark): %s\n", recipeData.SourceURL)
	}
	if len(recipeData.Instructions) == 0 {
		fmt.Printf("⚠️ WARN: Recipe has 0 instructions (may be bookmark): %s\n", recipeData.SourceURL)
	}

	// Validate image URL if provided (must be from our S3 bucket)
	if err := validateImageURL(recipeData.MainPhotoURL); err != nil {
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
		fmt.Printf("📡 [BEST-EFFORT] No HTML provided, attempting to fetch from %s\n", sourceURL)

		html, err := fetchHTMLFromURL(ctx, sourceURL)
		if err != nil {
			// Fetch failed - this is expected for paywalled sites
			fmt.Printf("⚠️ [BEST-EFFORT] Failed to fetch HTML: %v\n", err)
			fmt.Printf("📝 [BEST-EFFORT] Saving as bookmark - use Safari Web Extension for full parsing\n")

			// Update title to indicate bookmark status
			domain := getDomainFromURL(sourceURL)
			recipeData.Title = fmt.Sprintf("🔖 Bookmarked: %s", domain)
			// Don't parse HTML - just save as bookmark
		} else {
			// Successfully fetched HTML
			fmt.Printf("✅ [BEST-EFFORT] HTML fetched successfully (%d bytes)\n", len(html))
			htmlContent = html
			recipeData.WebArchiveHTML = &html
		}
	} else {
		// HTML was provided (Safari Web Extension premium path)
		fmt.Printf("🌟 [PREMIUM] HTML provided by client (%d bytes) - Safari Web Extension path\n", len(*recipeData.WebArchiveHTML))
		htmlContent = *recipeData.WebArchiveHTML
	}

	// PARSE HTML TO EXTRACT RECIPE DATA
	// If we have HTML content and recipe is missing ingredients/instructions, parse it
	if htmlContent != "" && (len(recipeData.Ingredients) == 0 || len(recipeData.Instructions) == 0) {
		fmt.Printf("🔍 Attempting to parse HTML for recipe data...\n")
		parsedRecipe, err := parseHTMLToRecipe(htmlContent, sourceURL)
		if err != nil {
			fmt.Printf("⚠️ HTML parsing failed: %v\n", err)
			fmt.Printf("📝 Continuing with existing recipe data (may be incomplete)\n")
		} else {
			// Merge parsed data with existing data (existing data takes precedence if present)
			if recipeData.Title == "" || strings.HasPrefix(recipeData.Title, "🔖") {
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

			fmt.Printf("✅ HTML parsing successful - merged data into recipe\n")
			fmt.Printf("📊 Recipe data: %d ingredients, %d instructions\n",
				len(recipeData.Ingredients), len(recipeData.Instructions))
		}
	}

	if existingRecipe != nil {
		// Recipe with same URL exists - overwrite it with new data
		fmt.Printf("Recipe with URL %s already exists, overwriting with new data", sourceURL)

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
		if err := queueRecipeNormalization(ctx, userID, updatedRecipe.ID); err != nil {
			fmt.Printf("⚠️ Failed to queue normalization for updated recipe %s: %v\n", updatedRecipe.ID, err)
			// Fallback: Apply basic normalization immediately
			if normalizedRecipe, err := applyBasicNormalization(updatedRecipe); err == nil {
				if err := recipeDB.CreateRecipe(&normalizedRecipe); err == nil {
					fmt.Printf("✅ Applied fallback normalization for updated recipe %s\n", updatedRecipe.ID)
					updatedRecipe = normalizedRecipe
				} else {
					fmt.Printf("⚠️ Failed to save normalized updated recipe: %v\n", err)
				}
			} else {
				fmt.Printf("⚠️ Fallback normalization failed for update: %v\n", err)
			}
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
	recipe := models.Recipe{
		ID:               uuid.New().String(),
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
	if err := queueRecipeNormalization(ctx, userID, recipe.ID); err != nil {
		fmt.Printf("⚠️ Failed to queue normalization for recipe %s: %v\n", recipe.ID, err)
		// Fallback: Apply basic normalization immediately
		if normalizedRecipe, err := applyBasicNormalization(recipe); err == nil {
			if err := recipeDB.CreateRecipe(&normalizedRecipe); err == nil {
				fmt.Printf("✅ Applied fallback normalization for recipe %s\n", recipe.ID)
				recipe = normalizedRecipe
			} else {
				fmt.Printf("⚠️ Failed to save normalized recipe: %v\n", err)
			}
		} else {
			fmt.Printf("⚠️ Fallback normalization failed: %v\n", err)
		}
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

	// Add full page HTML context for enhanced OpenAI analysis
	if recipeData.WebArchiveHTML != nil && len(*recipeData.WebArchiveHTML) > 0 {
		normalizeRequest["pageHtml"] = *recipeData.WebArchiveHTML
		fmt.Printf("📄 Adding HTML context for OpenAI analysis: %d characters\n", len(*recipeData.WebArchiveHTML))
	}

	// Marshal request body
	requestBody, err := json.Marshal(normalizeRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal normalization request: %w", err)
	}

	// Create HTTP request to content normalizer endpoint
	normalizeURL := fmt.Sprintf("%s/normalize", strings.TrimSuffix(baseURL, "/"))
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
			Title       string `json:"title"`
			Ingredients []struct {
				Text string `json:"text"`
			} `json:"ingredients"`
			Instructions []struct {
				StepNumber int    `json:"stepNumber"`
				Text       string `json:"text"`
			} `json:"instructions"`
			Author      string   `json:"author,omitempty"`
			PrepTime    string   `json:"prepTime,omitempty"`
			CookTime    string   `json:"cookTime,omitempty"`
			TotalTime   string   `json:"totalTime,omitempty"`
			Servings    string   `json:"servings,omitempty"`
			Description string   `json:"description,omitempty"`
			ImageUrl    string   `json:"imageUrl,omitempty"`
			SourceUrl   string   `json:"sourceUrl,omitempty"`
			Tags        []string `json:"tags,omitempty"`
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
		SourceURL:        recipeData.SourceURL,    // Keep original source URL
		MainPhotoURL:     recipeData.MainPhotoURL, // Keep original photo URL
		Description:      description,
		PrepTimeMinutes:  parseTimeFromNormalizer(normalizeResponse.NormalizedRecipe.PrepTime, recipeData.PrepTimeMinutes),
		CookTimeMinutes:  parseTimeFromNormalizer(normalizeResponse.NormalizedRecipe.CookTime, recipeData.CookTimeMinutes),
		TotalTimeMinutes: parseTimeFromNormalizer(normalizeResponse.NormalizedRecipe.TotalTime, recipeData.TotalTimeMinutes),
		Servings:         parseServingsFromNormalizer(normalizeResponse.NormalizedRecipe.Servings, recipeData.Servings),
		Yield:            recipeData.Yield, // Keep original yield
		Categories:       normalizeResponse.NormalizedRecipe.Tags,
		Reviews:          recipeData.Reviews,   // Keep original reviews
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

// Cost-efficient search helper functions for in-Lambda filtering

// parseSearchArray parses comma-separated search values into an array
func parseSearchArray(value string) []string {
	if value == "" {
		return nil
	}

	// Split on commas, "and", and "or" (case-insensitive)
	// First replace logical delimiters with commas for uniform processing
	normalizedValue := strings.ToLower(value)
	normalizedValue = strings.ReplaceAll(normalizedValue, " and ", ",")
	normalizedValue = strings.ReplaceAll(normalizedValue, " or ", ",")
	parts := strings.Split(normalizedValue, ",")

	var result []string
	for _, part := range parts {
		if trimmed := strings.ToLower(strings.TrimSpace(part)); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// matchesSearchCriteria performs cost-efficient in-memory recipe filtering
func matchesSearchCriteria(recipe models.Recipe, searchQuery string,
	maxPrepTime, maxCookTime *int,
	semanticTags, primaryIngredients, cookingMethods, dietaryTags, flavorProfile, equipment, mealTypes []string,
	timeCategory, complexity, sourceFilter string) bool {

	// Basic text search across title, ingredients, instructions, and user tags
	if searchQuery != "" {
		recipeText := strings.ToLower(recipe.Title)

		// Search in ingredients
		for _, ingredient := range recipe.Ingredients {
			recipeText += " " + strings.ToLower(ingredient.Text)
		}

		// Search in instructions
		for _, instruction := range recipe.Instructions {
			recipeText += " " + strings.ToLower(instruction.Text)
		}

		// Search in user-added tags (critical for manual tag search)
		for _, tag := range recipe.Tags {
			recipeText += " " + strings.ToLower(tag)
		}

		// Check if search query matches any part of the recipe text
		// Support comma-separated OR queries (e.g., "drink, cocktail")
		searchTerms := parseSearchArray(searchQuery)
		if len(searchTerms) > 1 {
			// Multiple terms - use OR logic
			found := false
			for _, term := range searchTerms {
				if strings.Contains(recipeText, strings.TrimSpace(strings.ToLower(term))) {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		} else {
			// Single term - use exact match
			if !strings.Contains(recipeText, searchQuery) {
				return false
			}
		}
	}

	// Time-based filtering (max times only)
	if maxPrepTime != nil && (recipe.PrepTimeMinutes != nil && *recipe.PrepTimeMinutes > *maxPrepTime) {
		return false
	}
	if maxCookTime != nil && (recipe.CookTimeMinutes != nil && *recipe.CookTimeMinutes > *maxCookTime) {
		return false
	}

	// Source URL filtering - support multiple sources with OR logic
	if sourceFilter != "" {
		sourcesToMatch := parseSearchArray(sourceFilter)
		recipeSourceLower := strings.ToLower(recipe.SourceURL)
		matched := false

		for _, source := range sourcesToMatch {
			if strings.Contains(recipeSourceLower, source) {
				matched = true
				break
			}
		}

		if !matched {
			return false
		}
	}

	// Advanced SearchMetadata filtering (cost-optimized)
	if recipe.SearchMetadata != nil {
		// Semantic tags matching
		if len(semanticTags) > 0 && !containsAnyMatch(semanticTags, recipe.SearchMetadata.SemanticTags) {
			return false
		}

		// Primary ingredients matching
		if len(primaryIngredients) > 0 && !containsAnyMatch(primaryIngredients, recipe.SearchMetadata.PrimaryIngredients) {
			return false
		}

		// Cooking methods matching
		if len(cookingMethods) > 0 && !containsAnyMatch(cookingMethods, recipe.SearchMetadata.CookingMethods) {
			return false
		}

		// Dietary tags matching
		if len(dietaryTags) > 0 && !containsAnyMatch(dietaryTags, recipe.SearchMetadata.DietaryTags) {
			return false
		}

		// Flavor profile matching
		if len(flavorProfile) > 0 && !containsAnyMatch(flavorProfile, recipe.SearchMetadata.FlavorProfile) {
			return false
		}

		// Equipment matching
		if len(equipment) > 0 && !containsAnyMatch(equipment, recipe.SearchMetadata.Equipment) {
			return false
		}

		// Time category matching - cumulative (long includes medium and quick)
		if timeCategory != "" && !matchesTimeCategory(strings.ToLower(recipe.SearchMetadata.TimeCategory), timeCategory) {
			return false
		}

		// Complexity matching
		if complexity != "" && strings.ToLower(recipe.SearchMetadata.Complexity) != complexity {
			return false
		}

		// Meal type matching - use OR logic for multiple meal types
		if len(mealTypes) > 0 {
			// Convert single MealType to slice for matching
			recipeMealTypes := []string{recipe.SearchMetadata.MealType}
			if !containsAnyMatch(mealTypes, recipeMealTypes) {
				return false
			}
		}
	} else {
		// If SearchMetadata is not available, only fail if advanced filters are being used
		// This ensures backward compatibility with recipes that haven't been normalized yet
		if len(semanticTags) > 0 || len(primaryIngredients) > 0 || len(cookingMethods) > 0 ||
			len(dietaryTags) > 0 || len(flavorProfile) > 0 || len(equipment) > 0 ||
			timeCategory != "" || complexity != "" || len(mealTypes) > 0 {
			return false // Skip recipes without SearchMetadata when advanced filters are used
		}
	}

	return true
}

// matchesTimeCategory implements cumulative time category matching
func matchesTimeCategory(recipeTimeCategory, searchTimeCategory string) bool {
	// Define time category hierarchy for cumulative matching
	timeCategoryRank := map[string]int{
		"quick-15min":     1,
		"medium-30min":    2,
		"long-60min":      3,
		"extended-120min": 4,
	}

	recipeRank, recipeExists := timeCategoryRank[recipeTimeCategory]
	searchRank, searchExists := timeCategoryRank[searchTimeCategory]

	if !recipeExists || !searchExists {
		return recipeTimeCategory == searchTimeCategory // Fallback to exact match
	}

	// Cumulative matching: recipe matches if it's at or below the search category
	// (e.g., searching for "long" includes "quick", "medium", and "long")
	return recipeRank <= searchRank
}

// containsAnyMatch checks if any search term matches any value in the target list (case-insensitive)
func containsAnyMatch(searchTerms, targetValues []string) bool {
	for _, searchTerm := range searchTerms {
		searchLower := strings.ToLower(searchTerm)
		for _, targetValue := range targetValues {
			if strings.ToLower(targetValue) == searchLower || strings.Contains(strings.ToLower(targetValue), searchLower) {
				return true
			}
		}
	}
	return false
}

// SortSearchResults sorts recipes by the specified field and order
func SortSearchResults(recipes []models.Recipe, sortBy, sortOrder string) {
	if sortBy == "" {
		sortBy = "createdAt"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	sort.Slice(recipes, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "title":
			less = recipes[i].Title < recipes[j].Title
		case "updatedAt":
			less = recipes[i].UpdatedAt.Before(recipes[j].UpdatedAt)
		case "createdAt":
			fallthrough
		default:
			less = recipes[i].CreatedAt.Before(recipes[j].CreatedAt)
		}

		if sortOrder == "desc" {
			return !less
		}
		return less
	})
}

