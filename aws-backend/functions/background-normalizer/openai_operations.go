package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Simple in-memory cache for OpenAI responses
var (
	responseCache = make(map[string]*NormalizationResponse)
	cacheMutex    sync.RWMutex
)

// generateContentHash creates a hash of recipe content for caching
func generateContentHash(recipe *Recipe) string {
	content := fmt.Sprintf("%s|%d|%d", recipe.Title, len(recipe.Ingredients), len(recipe.Instructions))
	for _, ing := range recipe.Ingredients {
		content += "|" + ing.Text
	}
	for _, inst := range recipe.Instructions {
		content += "|" + inst.Text
	}

	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}

// normalizeRecipeWithOpenAI normalizes recipe using OpenAI API
func normalizeRecipeWithOpenAI(ctx context.Context, recipe *Recipe) (*Recipe, error) {
	openaiApiKey := os.Getenv("OPENAI_API_KEY")
	if openaiApiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// VALIDATION: Detect broken recipes with no content
	ingredientCount := len(recipe.Ingredients)
	instructionCount := len(recipe.Instructions)

	if ingredientCount == 0 && instructionCount == 0 {
		log.Printf("❌ BROKEN RECIPE DETECTED: Recipe %s has 0 ingredients and 0 instructions", recipe.ID)
		log.Printf("   Title: %s", recipe.Title)
		log.Printf("   Source: %s", recipe.SourceURL)
		return nil, fmt.Errorf("recipe has no content (0 ingredients, 0 instructions) - scraper likely failed")
	}

	if ingredientCount == 0 {
		log.Printf("⚠️ WARNING: Recipe %s has 0 ingredients (but has %d instructions)", recipe.ID, instructionCount)
	}

	if instructionCount == 0 {
		log.Printf("⚠️ WARNING: Recipe %s has 0 instructions (but has %d ingredients)", recipe.ID, ingredientCount)
	}

	// Check if this is a placeholder recipe that needs URL parsing first
	if isPlaceholderRecipe(recipe) {
		fmt.Printf("🔍 Detected placeholder recipe, parsing content\n")

		// Check if we have webArchiveHtml from mobile share or web extension
		var htmlPtr *string
		if recipe.WebArchiveHTML != nil && len(*recipe.WebArchiveHTML) > 0 {
			htmlPtr = recipe.WebArchiveHTML
			fmt.Printf("✅ Using provided HTML from client (%d characters)\n", len(*recipe.WebArchiveHTML))
		} else {
			fmt.Printf("📡 No HTML provided - will fetch from URL: %s\n", recipe.SourceURL)
		}

		parsedRecipe, err := parseRecipeFromURL(ctx, recipe.SourceURL, htmlPtr)
		if err != nil {
			fmt.Printf("⚠️ Failed to parse content, proceeding with placeholder values: %v\n", err)
		} else {
			// Use parsed content but preserve ID, UserID, and other metadata
			parsedRecipe.ID = recipe.ID
			parsedRecipe.UserID = recipe.UserID
			parsedRecipe.CreatedAt = recipe.CreatedAt
			parsedRecipe.UpdatedAt = recipe.UpdatedAt
			parsedRecipe.Version = recipe.Version
			recipe = parsedRecipe
			fmt.Printf("✅ Successfully parsed recipe: %s\n", recipe.Title)
		}
	}

	// CACHE DISABLED: Always call OpenAI to ensure fresh normalization
	// The cache was causing broken recipes to persist across re-ingestions
	fmt.Printf("📝 Cache disabled - calling OpenAI for fresh normalization\n")

	// Build normalization prompt
	prompt := buildNormalizationPrompt(recipe)
	fmt.Printf("🔍 RECIPE DATA BEING SENT TO OPENAI:\n  Title: %s\n  Ingredients Count: %d\n  Instructions Count: %d\n", recipe.Title, len(recipe.Ingredients), len(recipe.Instructions))

	// Prepare OpenAI API request
	openaiRequest := OpenAIRequest{
		Model: "gpt-4o-mini",
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: "You are a professional recipe editor for Food & Wine Magazine. Review and return only valid JSON with no additional text. Normalize recipe name capitalization using proper Title Case - NEVER capitalize letters after apostrophes (e.g., Kylie's not Kylie'S and General Tso's not General Tso'S). Remove redundant word Recipe in recipe titles. Normalize all nonstandard characters other than vulgar fractions to ensure we don't serialize escape sequences. CRITICAL REQUIREMENT: You MUST ALWAYS provide numeric values for inferredServings, inferredTotalTime, inferredPrepTime, and inferredCookTime - NEVER leave these fields null or omit them. Analyze ingredients and instructions to estimate realistic values even if the recipe doesn't specify them. For cocktails and drinks, typical serving is 1-2. For main dishes, analyze ingredient quantities to estimate servings. PRESERVE EXISTING COOKINGMETHODS: If the recipe already has a cookingMethods array with multiple methods (like Stovetop and Slow Cooker), you MUST preserve this exact structure. Do NOT flatten cookingMethods into the main instructions array. Keep the cookingMethods array intact with all method names, instructions, timeEstimates, and equipment arrays exactly as provided.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.0,
		MaxTokens:   2000,
	}

	// Make API call with timeout - increased to allow content-normalizer processing time
	ctx, cancel := context.WithTimeout(ctx, 40*time.Second)
	defer cancel()

	reqBody, err := json.Marshal(openaiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+openaiApiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API call failed: %w", err)
	}
	defer resp.Body.Close()

	var openaiResp OpenAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openaiResp); err != nil {
		return nil, fmt.Errorf("failed to decode OpenAI response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("OpenAI API error (%d): %s", resp.StatusCode, openaiResp.Error.Message)
	}

	if len(openaiResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in OpenAI response")
	}

	// Parse the JSON response from OpenAI
	var normResponse NormalizationResponse
	content := strings.TrimSpace(openaiResp.Choices[0].Message.Content)

	// DEBUG: Log the OpenAI response to see what we're getting
	fmt.Printf("🐛 OpenAI Response for debugging: %s\n", content)

	if err := json.Unmarshal([]byte(content), &normResponse); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI JSON response: %w", err)
	}

	// DEBUG: Log the parsed cookingMethods to see if they exist
	fmt.Printf("🐛 Parsed cookingMethods count: %d\n", len(normResponse.CookingMethods))

	// CACHE DISABLED - not storing response
	fmt.Printf("📝 OpenAI normalization complete (cache disabled)\n")

	return applyNormalization(recipe, &normResponse)
}

// deepCopyRecipe creates a deep copy of a Recipe to prevent pointer sharing between concurrent Lambda invocations
func deepCopyRecipe(original *Recipe) Recipe {
	result := Recipe{
		ID:       original.ID,
		UserID:   original.UserID,
		Title:    original.Title,
		SourceURL: original.SourceURL,
		MainPhotoURL: original.MainPhotoURL,
		CreatedAt: original.CreatedAt,
		UpdatedAt: original.UpdatedAt,
		IsDeleted: original.IsDeleted,
		Version:   original.Version,
	}

	// Deep copy slice fields
	result.Ingredients = make([]Ingredient, len(original.Ingredients))
	copy(result.Ingredients, original.Ingredients)

	result.Instructions = make([]Instruction, len(original.Instructions))
	copy(result.Instructions, original.Instructions)

	result.CookingMethodOptions = make([]CookingMethod, len(original.CookingMethodOptions))
	copy(result.CookingMethodOptions, original.CookingMethodOptions)

	result.Tags = make([]string, len(original.Tags))
	copy(result.Tags, original.Tags)

	// Deep copy FlexInt fields with new pointer allocations
	if original.Servings.Value != nil {
		val := *original.Servings.Value
		result.Servings.Value = &val
	}
	if original.TotalTime.Value != nil {
		val := *original.TotalTime.Value
		result.TotalTime.Value = &val
	}
	if original.PrepTimeMinutes.Value != nil {
		val := *original.PrepTimeMinutes.Value
		result.PrepTimeMinutes.Value = &val
	}
	if original.CookTimeMinutes.Value != nil {
		val := *original.CookTimeMinutes.Value
		result.CookTimeMinutes.Value = &val
	}

	// Deep copy SearchMetadata with new pointer allocation
	if original.SearchMetadata != nil {
		metadata := *original.SearchMetadata
		// Deep copy slice fields within SearchMetadata
		metadata.SemanticTags = make([]string, len(original.SearchMetadata.SemanticTags))
		copy(metadata.SemanticTags, original.SearchMetadata.SemanticTags)

		metadata.PrimaryIngredients = make([]string, len(original.SearchMetadata.PrimaryIngredients))
		copy(metadata.PrimaryIngredients, original.SearchMetadata.PrimaryIngredients)

		metadata.CookingMethods = make([]string, len(original.SearchMetadata.CookingMethods))
		copy(metadata.CookingMethods, original.SearchMetadata.CookingMethods)

		metadata.DietaryTags = make([]string, len(original.SearchMetadata.DietaryTags))
		copy(metadata.DietaryTags, original.SearchMetadata.DietaryTags)

		metadata.FlavorProfile = make([]string, len(original.SearchMetadata.FlavorProfile))
		copy(metadata.FlavorProfile, original.SearchMetadata.FlavorProfile)

		metadata.Equipment = make([]string, len(original.SearchMetadata.Equipment))
		copy(metadata.Equipment, original.SearchMetadata.Equipment)

		result.SearchMetadata = &metadata
	}

	return result
}

// applyNormalization applies the normalized data to the recipe
func applyNormalization(recipe *Recipe, normResponse *NormalizationResponse) (*Recipe, error) {
	result := deepCopyRecipe(recipe) // Deep copy to prevent pointer sharing
	result.Title = normResponse.NormalizedTitle
	result.Ingredients = normResponse.NormalizedIngredients

	// CRITICAL: Handle multi-method vs single-method recipes correctly
	isMultiMethod := len(normResponse.CookingMethods) > 0 || detectCookingMethods(normResponse.NormalizedInstructions)

	if isMultiMethod {
		// If OpenAI didn't provide cooking methods, create them
		if len(normResponse.CookingMethods) == 0 {
			stovetopSteps, slowCookerSteps := splitInstructionsByMethod(normResponse.NormalizedInstructions)
			normResponse.CookingMethods = []CookingMethod{
				{
					Name:         "Stovetop",
					TimeEstimate: func() *string { s := "45 minutes"; return &s }(),
					Equipment:    []string{"Large pot"},
					Instructions: stovetopSteps,
				},
				{
					Name:         "Slow Cooker",
					TimeEstimate: func() *string { s := "6-8 hours on low"; return &s }(),
					Equipment:    []string{"Slow cooker", "Crockpot"},
					Instructions: slowCookerSteps,
				},
			}
		}

		result.CookingMethodOptions = normResponse.CookingMethods
		result.Instructions = extractSharedInstructions(normResponse.NormalizedInstructions)
		fmt.Printf("🎯 Multi-method recipe: %d cooking methods, %d shared prep steps\n",
			len(result.CookingMethodOptions), len(result.Instructions))
	} else {
		// Single-method recipe: use normalizedInstructions as the main instructions
		result.Instructions = normResponse.NormalizedInstructions
		result.CookingMethodOptions = []CookingMethod{} // Ensure empty array
		fmt.Printf("📋 Single-method recipe: %d instructions\n", len(normResponse.NormalizedInstructions))
	}

	result = applyTimeAndServings(result, normResponse)
	result = applyTags(result, normResponse)

	fmt.Printf("✨ Enhanced recipe %s with search metadata: %d semantic tags, %d primary ingredients, %s complexity\n",
		result.ID, len(normResponse.SearchMetadata.SemanticTags), len(normResponse.SearchMetadata.PrimaryIngredients), normResponse.SearchMetadata.Complexity)

	return &result, nil
}

// applyTimeAndServings applies time and serving estimates to the recipe
func applyTimeAndServings(recipe Recipe, normResponse *NormalizationResponse) Recipe {
	// Apply inferred servings - ALWAYS use OpenAI values if available (override existing)
	if normResponse.InferredServings != nil {
		recipe.Servings.Value = normResponse.InferredServings
	} else if recipe.Servings.Value == nil {
		// Fallback only if no OpenAI value and no existing value
		defaultServings := 4
		recipe.Servings.Value = &defaultServings
	}

	// Apply inferred times - ALWAYS use OpenAI values if available (override existing)
	if normResponse.InferredPrepTime != nil {
		recipe.PrepTimeMinutes.Value = normResponse.InferredPrepTime
	} else if recipe.PrepTimeMinutes.Value == nil {
		defaultPrep := 15
		recipe.PrepTimeMinutes.Value = &defaultPrep
	}

	if normResponse.InferredCookTime != nil {
		recipe.CookTimeMinutes.Value = normResponse.InferredCookTime
	} else if recipe.CookTimeMinutes.Value == nil {
		defaultCook := 15
		recipe.CookTimeMinutes.Value = &defaultCook
	}

	// ALWAYS calculate total time from prep + cook if both are available
	// This ensures consistency and fixes erroneous total times
	if recipe.PrepTimeMinutes.Value != nil && recipe.CookTimeMinutes.Value != nil {
		calculatedTotal := *recipe.PrepTimeMinutes.Value + *recipe.CookTimeMinutes.Value
		recipe.TotalTime.Value = &calculatedTotal
	} else if normResponse.InferredTotalTime != nil {
		// Use OpenAI total time if we don't have both prep and cook
		recipe.TotalTime.Value = normResponse.InferredTotalTime
	} else if recipe.TotalTime.Value == nil {
		// Fallback only if no calculated, no OpenAI, and no existing value
		defaultTotal := 30
		recipe.TotalTime.Value = &defaultTotal
	}

	return recipe
}

// applyTags applies normalized tags and metadata to the recipe
func applyTags(recipe Recipe, normResponse *NormalizationResponse) Recipe {
	// Add inferred metadata as tags if not already present
	if normResponse.InferredMetadata.CuisineType != "" {
		recipe.Tags = append(recipe.Tags, normResponse.InferredMetadata.CuisineType)
	}
	if normResponse.InferredMetadata.DifficultyLevel != "" {
		recipe.Tags = append(recipe.Tags, normResponse.InferredMetadata.DifficultyLevel)
	}
	for _, method := range normResponse.InferredMetadata.CookingMethods {
		recipe.Tags = append(recipe.Tags, method)
	}
	for _, diet := range normResponse.InferredMetadata.DietaryInfo {
		recipe.Tags = append(recipe.Tags, diet)
	}

	// Add key search metadata tags to main tags for UI display
	// Add top 2-3 semantic tags
	for i, tag := range normResponse.SearchMetadata.SemanticTags {
		if i < 3 { // Limit to first 3 semantic tags
			recipe.Tags = append(recipe.Tags, tag)
		}
	}
	// Add primary ingredients as tags (limit to 2)
	for i, ingredient := range normResponse.SearchMetadata.PrimaryIngredients {
		if i < 2 { // Limit to first 2 primary ingredients
			recipe.Tags = append(recipe.Tags, ingredient)
		}
	}
	// Add meal type if available
	if normResponse.SearchMetadata.MealType != "" {
		recipe.Tags = append(recipe.Tags, normResponse.SearchMetadata.MealType)
	}

	// Apply search metadata for intelligent recipe discovery
	recipe.SearchMetadata = &normResponse.SearchMetadata

	return recipe
}

// extractSharedInstructions identifies prep steps common to all cooking methods
func extractSharedInstructions(instructions []Instruction) []Instruction {
	sharedSteps := []Instruction{}

	// Consider the first few steps as prep unless they contain method-specific keywords
	for i, inst := range instructions {
		if i < 3 && !containsMethodKeywords(inst.Text) {
			sharedSteps = append(sharedSteps, inst)
		} else {
			break // Stop when we hit a method-specific step
		}
	}

	return sharedSteps
}
