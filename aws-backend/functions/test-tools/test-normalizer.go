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

	"recipe-archive/models"
)

// Test the background normalizer logic with a cocktail recipe
func testNormalizer() error {
	fmt.Println("🍹 Testing background normalizer with cocktail recipe...")

	// Sample cocktail recipe from the user
	recipe := models.Recipe{
		ID:     "test-margarita-001",
		UserID: "test-user-001",
		Title:  "Blood Orange Margarita",
		Ingredients: []models.Ingredient{
			{Text: "2 oz silver tequila"},
			{Text: "1 oz fresh blood orange juice"},
			{Text: "1/2 oz lime juice"},
			{Text: "1/2 oz triple sec"},
			{Text: "Salt for rim"},
		},
		Instructions: []models.Instruction{
			{StepNumber: 1, Text: "Rim glass with salt"},
			{StepNumber: 2, Text: "Shake all ingredients with ice"},
			{StepNumber: 3, Text: "Strain into glass over ice"},
		},
		SourceURL: "https://smittenkitchen.com/2013/02/blood-orange-margaritas/",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		IsDeleted: false,
		Version:   1,
	}

	fmt.Printf("📝 Original recipe: %s\n", recipe.Title)
	fmt.Printf("🥃 Ingredients: %d items\n", len(recipe.Ingredients))
	fmt.Printf("📋 Instructions: %d steps\n", len(recipe.Instructions))

	// Test the normalization function
	ctx := context.Background()
	normalizedRecipe, err := normalizeRecipeWithOpenAI(ctx, &recipe)
	if err != nil {
		return fmt.Errorf("normalization failed: %w", err)
	}

	fmt.Printf("\n🎉 Normalization successful!\n")
	fmt.Printf("📝 Normalized title: %s\n", normalizedRecipe.Title)

	// Check mealType specifically
	if normalizedRecipe.SearchMetadata != nil {
		fmt.Printf("🍽️ Meal Type: %s\n", normalizedRecipe.SearchMetadata.MealType)
		fmt.Printf("🏷️ Semantic Tags: %v\n", normalizedRecipe.SearchMetadata.SemanticTags)
		fmt.Printf("🥘 Primary Ingredients: %v\n", normalizedRecipe.SearchMetadata.PrimaryIngredients)
		fmt.Printf("👨‍🍳 Cooking Methods: %v\n", normalizedRecipe.SearchMetadata.CookingMethods)
		fmt.Printf("🥗 Dietary Tags: %v\n", normalizedRecipe.SearchMetadata.DietaryTags)
		fmt.Printf("🎯 Complexity: %s\n", normalizedRecipe.SearchMetadata.Complexity)
		fmt.Printf("⏱️ Time Category: %s\n", normalizedRecipe.SearchMetadata.TimeCategory)
	} else {
		fmt.Printf("❌ No SearchMetadata found!\n")
	}

	// Check inferred timing and servings
	if normalizedRecipe.Servings != nil {
		fmt.Printf("🍽️ Inferred Servings: %d\n", *normalizedRecipe.Servings)
	}
	if normalizedRecipe.PrepTimeMinutes != nil {
		fmt.Printf("⏱️ Prep Time: %d minutes\n", *normalizedRecipe.PrepTimeMinutes)
	}
	if normalizedRecipe.CookTimeMinutes != nil {
		fmt.Printf("🔥 Cook Time: %d minutes\n", *normalizedRecipe.CookTimeMinutes)
	}
	if normalizedRecipe.TotalTimeMinutes != nil {
		fmt.Printf("⏰ Total Time: %d minutes\n", *normalizedRecipe.TotalTimeMinutes)
	}

	// Output the full normalized recipe as JSON for analysis
	fmt.Printf("\n📄 Full normalized recipe JSON:\n")
	jsonData, err := json.MarshalIndent(normalizedRecipe, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal normalized recipe: %w", err)
	}
	fmt.Println(string(jsonData))

	// Verify drink categorization
	fmt.Printf("\n🧪 DRINK CATEGORIZATION ANALYSIS:\n")

	if normalizedRecipe.SearchMetadata == nil {
		fmt.Printf("❌ FAIL: SearchMetadata is missing\n")
		return fmt.Errorf("SearchMetadata missing from normalized recipe")
	}

	if normalizedRecipe.SearchMetadata.MealType != "drink" {
		fmt.Printf("❌ FAIL: MealType is '%s', expected 'drink'\n", normalizedRecipe.SearchMetadata.MealType)
	} else {
		fmt.Printf("✅ PASS: MealType correctly set to 'drink'\n")
	}

	// Check for drink/cocktail in semantic tags
	hasDrinkTag := false
	for _, tag := range normalizedRecipe.SearchMetadata.SemanticTags {
		if strings.Contains(strings.ToLower(tag), "drink") || strings.Contains(strings.ToLower(tag), "cocktail") {
			hasDrinkTag = true
			break
		}
	}

	if hasDrinkTag {
		fmt.Printf("✅ PASS: Found drink/cocktail in semantic tags\n")
	} else {
		fmt.Printf("⚠️  WARNING: No drink/cocktail found in semantic tags: %v\n", normalizedRecipe.SearchMetadata.SemanticTags)
	}

	fmt.Printf("\n✅ Normalizer test completed successfully!\n")
	return nil
}

// API request/response structures for OpenAI
type OpenAIRequest struct {
	Model       string          `json:"model"`
	Messages    []OpenAIMessage `json:"messages"`
	Temperature float64         `json:"temperature"`
	MaxTokens   int             `json:"max_tokens"`
}

type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

type NormalizationResponse struct {
	NormalizedTitle        string                `json:"normalizedTitle"`
	NormalizedIngredients  []models.Ingredient   `json:"normalizedIngredients"`
	NormalizedInstructions []models.Instruction  `json:"normalizedInstructions"`
	InferredMetadata       InferredMetadata      `json:"inferredMetadata"`
	SearchMetadata         models.SearchMetadata `json:"searchMetadata"`
	InferredServings       *int                  `json:"inferredServings,omitempty"`
	InferredTotalTime      *int                  `json:"inferredTotalTime,omitempty"`
	InferredPrepTime       *int                  `json:"inferredPrepTime,omitempty"`
	InferredCookTime       *int                  `json:"inferredCookTime,omitempty"`
	QualityScore           float64               `json:"qualityScore"`
	NormalizationNotes     string                `json:"normalizationNotes"`
}

type InferredMetadata struct {
	CuisineType     string   `json:"cuisineType,omitempty"`
	CookingMethods  []string `json:"cookingMethods,omitempty"`
	DietaryInfo     []string `json:"dietaryInfo,omitempty"`
	DifficultyLevel string   `json:"difficultyLevel,omitempty"`
}

// Copy the OpenAI normalization logic from background-normalizer
func normalizeRecipeWithOpenAI(ctx context.Context, recipe *models.Recipe) (*models.Recipe, error) {
	openaiApiKey := os.Getenv("OPENAI_API_KEY")
	if openaiApiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Build normalization prompt
	prompt := buildNormalizationPrompt(recipe)

	// Prepare OpenAI API request
	openaiRequest := OpenAIRequest{
		Model: "gpt-4o-mini",
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: "You are a professional recipe editor for Food & Wine Magazine. Review and return only valid JSON with no additional text. Normalize recipe name capitalization using proper Title Case - NEVER capitalize letters after apostrophes (e.g., Kylie's not Kylie'S and General Tso's not General Tso'S). Remove redundant word Recipe in recipe titles. Normalize all nonstandard characters other than vulgar fractions to ensure we don't serialize escape sequences. CRITICAL REQUIREMENT: You MUST ALWAYS provide numeric values for inferredServings, inferredTotalTime, inferredPrepTime, and inferredCookTime - NEVER leave these fields null or omit them. Analyze ingredients and instructions to estimate realistic values even if the recipe doesn't specify them. For cocktails and drinks, typical serving is 1-2. For main dishes, analyze ingredient quantities to estimate servings. Add recipe timing details inline within instructions when multiple timing phases exist.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.0,
		MaxTokens:   2000,
	}

	// Make API call with timeout
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
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
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			fmt.Printf("WARN: Failed to close response body: %v\n", closeErr)
		}
	}()

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
	if err := json.Unmarshal([]byte(content), &normResponse); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI JSON response: %w", err)
	}

	// Apply normalized data to recipe
	result := *recipe // Copy original data
	result.Title = normResponse.NormalizedTitle
	result.Ingredients = normResponse.NormalizedIngredients
	result.Instructions = normResponse.NormalizedInstructions

	// Apply inferred servings - ALWAYS use OpenAI values if available (override existing)
	if normResponse.InferredServings != nil {
		result.Servings = normResponse.InferredServings
	} else if result.Servings == nil {
		// Fallback only if no OpenAI value and no existing value
		defaultServings := 4
		result.Servings = &defaultServings
	}

	// Apply inferred times - ALWAYS use OpenAI values if available (override existing)
	if normResponse.InferredPrepTime != nil {
		result.PrepTimeMinutes = normResponse.InferredPrepTime
	} else if result.PrepTimeMinutes == nil {
		defaultPrep := 15
		result.PrepTimeMinutes = &defaultPrep
	}

	if normResponse.InferredCookTime != nil {
		result.CookTimeMinutes = normResponse.InferredCookTime
	} else if result.CookTimeMinutes == nil {
		defaultCook := 15
		result.CookTimeMinutes = &defaultCook
	}

	// ALWAYS calculate total time from prep + cook if both are available
	// This ensures consistency and fixes erroneous total times
	if result.PrepTimeMinutes != nil && result.CookTimeMinutes != nil {
		calculatedTotal := *result.PrepTimeMinutes + *result.CookTimeMinutes
		result.TotalTimeMinutes = &calculatedTotal
	} else if normResponse.InferredTotalTime != nil {
		// Use OpenAI total time if we don't have both prep and cook
		result.TotalTimeMinutes = normResponse.InferredTotalTime
	} else if result.TotalTimeMinutes == nil {
		// Fallback only if no calculated, no OpenAI, and no existing value
		defaultTotal := 30
		result.TotalTimeMinutes = &defaultTotal
	}

	// Add inferred metadata as tags if not already present
	if normResponse.InferredMetadata.CuisineType != "" {
		result.Tags = append(result.Tags, normResponse.InferredMetadata.CuisineType)
	}
	if normResponse.InferredMetadata.DifficultyLevel != "" {
		result.Tags = append(result.Tags, normResponse.InferredMetadata.DifficultyLevel)
	}
	result.Tags = append(result.Tags, normResponse.InferredMetadata.CookingMethods...)
	result.Tags = append(result.Tags, normResponse.InferredMetadata.DietaryInfo...)

	// Apply search metadata for intelligent recipe discovery
	result.SearchMetadata = &normResponse.SearchMetadata

	fmt.Printf("✨ Enhanced recipe %s with search metadata: %d semantic tags, %d primary ingredients, %s complexity\n",
		result.ID, len(normResponse.SearchMetadata.SemanticTags), len(normResponse.SearchMetadata.PrimaryIngredients), normResponse.SearchMetadata.Complexity)

	return &result, nil
}

func buildNormalizationPrompt(recipe *models.Recipe) string {
	ingredientsJson, _ := json.Marshal(recipe.Ingredients)
	instructionsJson, _ := json.Marshal(recipe.Instructions)

	// Extract current servings info for context
	servingsInfo := "not specified"
	if recipe.Servings != nil {
		servingsInfo = strconv.Itoa(*recipe.Servings)
	}

	// Extract current time info for context
	timeInfo := "not specified"
	if recipe.PrepTimeMinutes != nil || recipe.CookTimeMinutes != nil || recipe.TotalTimeMinutes != nil {
		prepStr := "not specified"
		cookStr := "not specified"
		totalStr := "not specified"
		if recipe.PrepTimeMinutes != nil {
			prepStr = strconv.Itoa(*recipe.PrepTimeMinutes)
		}
		if recipe.CookTimeMinutes != nil {
			cookStr = strconv.Itoa(*recipe.CookTimeMinutes)
		}
		if recipe.TotalTimeMinutes != nil {
			totalStr = strconv.Itoa(*recipe.TotalTimeMinutes)
		}
		timeInfo = fmt.Sprintf("prep: %s, cook: %s, total: %s", prepStr, cookStr, totalStr)
	}

	return fmt.Sprintf(`You are a professional recipe editor  for Food & Wine Magazine tasked with normalizing recipe data for consistent storage and presentation.

Input Recipe Data:
- Title: "%s"
- Ingredients: %s
- Instructions: %s
- Current Servings: %s
- Current Times: %s

Please normalize this recipe following these strict guidelines:

TITLE NORMALIZATION:
- Use Title Case (capitalize major words, lowercase articles/prepositions)
- IMPORTANT: Apostrophes should NOT capitalize the letter after them (e.g., 'Kylie's' not 'Kylie'S' and 'General Tso's' not 'General Tso'S')
- Examples: "Bob's Burgers", "Mom's Apple Pie", "Baker's Dozen"
- Remove excessive punctuation or emoji
- Remove the trailing word "Recipe" from recipe titles if present
- Fix common misspellings
- Correct grammar issues
- Remove redundant words (e.g., "Delicious Recipe" → "Delicious")
- Standardize capitalization of brand names (e.g., "Kylie's" not "Kylie'S")
- Normalize special characters (e.g., replace curly quotes with straight quotes)
- Ensure no escape sequences are present (e.g., replace \u2019 with apostrophe)
- Remove any leading or trailing whitespace
- Remove duplicate spaces
- Correct punctuation spacing (e.g., "Hello , world !" → "Hello, world!")
- Standardize capitalization of cooking terms (e.g., "Sauté" not "saute")
- Remove any HTML tags or markdown formatting
- Ensure proper use of hyphens and dashes (e.g., "well-known" not "well known")
- Remove any non-recipe related text (e.g., promotional phrases)
- Standardize recipe categories if mentioned (e.g., "dessert" not "sweet treat")
- Standardize formatting of compound words (e.g., "stir-fry" not "stir fry")
- Use consistent terminology for cooking vessels (e.g., "skillet" not "frying pan")
- Standardize descriptive adjectives (e.g., "crispy" not "crunchy")
- Standardize descriptive terms (e.g., "Easy" → "Simple", "Super Yummy" → "Delicious")
- Keep titles concise (max 60 characters)

INGREDIENT NORMALIZATION:
- Standardize units (cups, tablespoons, teaspoons, ounces, pounds, grams)
- Use consistent fraction formatting (1/2, 1/4, 3/4)
- Standardize ingredient names (e.g., "all-purpose flour" not "AP flour")
- Include preparation methods when relevant ("diced", "chopped", "minced")
- Use specific salt types when mentioned ("kosher salt", "sea salt")
- Normalize special characters (e.g., replace curly quotes with straight quotes)
- Ensure no escape sequences are present (e.g., replace \u2019 with apostrophe)
- Remove any leading or trailing whitespace
- Remove duplicate spaces
- Correct punctuation spacing (e.g., "Hello , world !" → "Hello, world!")
- Standardize measurement terms (e.g., "Tbsp" → "tablespoon", "tsp" → "teaspoon")
- Use consistent terminology (e.g., "bake" not "oven cook")
- Standardize formatting of numbers (e.g., "1 1/2" not "1 and 1/2")
- Use numerals for quantities (e.g., "2" not "two")
- Standardize capitalization of cooking terms (e.g., "Sauté" not "saute")
- Remove any HTML tags or markdown formatting
- Ensure proper use of hyphens and dashes (e.g., "well-known" not "well known")
- Standardize spice names (e.g., "cumin" not "ground cumin" unless specified)
- Use consistent naming for common ingredients (e.g., "bell pepper" not "capsicum")
- Ensure proper use of singular/plural forms (e.g., "1 egg" not "1 eggs")
- Remove any non-recipe related text (e.g., promotional phrases)
- Standardize recipe categories if mentioned (e.g., "dessert" not "sweet treat")
- Ensure no personal names or anecdotes are included
- Standardize formatting of compound words (e.g., "stir-fry" not "stir fry")
- Use consistent terminology for cooking vessels (e.g., "skillet" not "frying pan")
- Standardize descriptive adjectives (e.g., "crispy" not "crunchy")
- Standardize descriptive terms (e.g., "Easy" → "Simple", "Super Yummy" → "Delicious")


INSTRUCTION NORMALIZATION:
- Use imperative voice ("Mix flour" not "You should mix flour")
- Start each step with action verb when possible
- Keep steps concise but complete
- Use consistent temperature formats (375°F, 190°C)
- Standardize temperature formats (e.g., "375°F" not "375 degrees F")
- Standardize timing formats ("10 minutes", "1 hour")
- Use consistent time formats (e.g., "10 minutes" not "ten mins")

SERVINGS AND TIME INFERENCE (CRITICAL - REQUIRED):
- MANDATORY: You MUST provide numeric values for inferredServings, inferredTotalTime, inferredPrepTime, and inferredCookTime
- NEVER leave these fields null, undefined, or omitted - they are REQUIRED
- ALWAYS estimate servings if not provided: analyze ingredient quantities to determine realistic serving count
- For cocktails/drinks: typically 1-2 servings unless ingredients suggest more
- For main dishes: analyze protein amounts, starch portions to estimate 2-8 servings
- For baked goods: count individual items or estimate portions from pan size
- ALWAYS estimate times in minutes if missing: analyze instructions for realistic timing
- Prep time: time for chopping, mixing, assembling before cooking (minimum 5 minutes, typical range 10-30)
- Cook time: actual cooking/baking/active heat time (minimum 5 minutes for most recipes)
- Total time: prep + cook + any waiting/resting time (always >= prep time + cook time)
- Add timing details inline in instructions when multiple phases exist (e.g., "Mix ingredients (5 minutes)", "Bake for 25 minutes", "Cool for 10 minutes")

SEARCH METADATA GENERATION (CRITICAL FOR SEARCH FUNCTIONALITY):
Generate comprehensive search metadata to enable intelligent recipe discovery:

SEMANTIC TAGS (3-5 tags):
- Cuisine types: "italian", "mexican", "asian", "american", "mediterranean", "indian", "french", "greek", "thai", "chinese", "japanese"
- Meal types: "breakfast", "lunch", "dinner", "snack", "appetizer", "dessert", "drink", "cocktail"
- Occasion tags: "weeknight", "weekend", "holiday", "party", "comfort-food", "date-night", "family-friendly"
- Style tags: "quick", "easy", "healthy", "indulgent", "rustic", "elegant", "casual", "fancy"
- Season tags: "summer", "winter", "spring", "fall" (when seasonal ingredients are prominent)

PRIMARY INGREDIENTS (3-5 main ingredients):
- Extract the most prominent ingredients that define the dish
- Use simple, searchable names: "chicken", "beef", "pasta", "rice", "tomatoes", "cheese", "eggs"
- Focus on proteins, main starches, and key vegetables/fruits
- Avoid minor seasonings, oils, or garnishes

COOKING METHODS (1-3 methods):
- Primary cooking techniques: "baked", "roasted", "grilled", "fried", "sautéed", "boiled", "steamed", "braised", "slow-cooked", "no-cook", "pressure-cooked", "air-fried"
- Use the most prominent cooking method first

DIETARY TAGS (identify applicable restrictions):
- "vegetarian" (no meat/poultry/fish), "vegan" (no animal products), "gluten-free", "dairy-free", "nut-free", "egg-free", "low-carb", "keto", "paleo", "whole30"
- Only include tags that are clearly applicable based on ingredients

FLAVOR PROFILE (2-4 flavor descriptors):
- Primary tastes: "sweet", "savory", "spicy", "tangy", "bitter", "umami", "rich", "light", "fresh", "creamy", "crispy", "cheesy", "herbed", "garlicky", "citrusy"
- Focus on the most prominent flavor characteristics

EQUIPMENT (1-3 key pieces):
- Essential equipment needed: "oven", "stovetop", "grill", "slow-cooker", "pressure-cooker", "air-fryer", "blender", "food-processor", "mixer", "large-pot", "skillet", "baking-sheet", "dutch-oven"
- Include specialized equipment if critical to the recipe

TIME CATEGORY (single category):
- "quick-15min" (≤15 min total), "medium-30min" (16-45 min), "long-60min" (46-90 min), "extended-2hr+" (>90 min)
- Base on total time including prep and cooking

COMPLEXITY LEVEL (single level):
- "beginner" (basic techniques, few steps, common ingredients)
- "intermediate" (some skill required, multiple techniques, longer process)  
- "advanced" (complex techniques, timing-critical, specialty ingredients or equipment)
MEAL TYPE (single primary category as string):
- "breakfast" (morning meals, coffee accompaniments)
- "lunch" (midday meals, light dishes)  
- "brunch" (late morning/early afternoon combination meals)
- "dinner" (main evening meals, substantial dishes)
- "snack" (small portions, between-meal foods)
- "dessert" (sweet treats, post-meal sweets)
- "appetizer" (starters, party foods, small plates)
- "drink" (beverages, cocktails, smoothies, juices)
- Choose the PRIMARY meal type: "breakfast" for pancakes, "dinner" for substantial salads, "snack" for party foods

Return ONLY valid JSON in this exact format (ALL FIELDS REQUIRED):
{
  "normalizedTitle": "Normalized Recipe Title (e.g., 'Mom's Apple Pie' not 'Mom'S Apple Pie')",
  "normalizedIngredients": [
    {"text": "1 cup all-purpose flour"},
    {"text": "1/2 teaspoon kosher salt"}
  ],
  "normalizedInstructions": [
    {"stepNumber": 1, "text": "Preheat oven to 375°F (190°C)."},
    {"stepNumber": 2, "text": "Mix flour and salt in large bowl (5 minutes)."}
  ],
  "inferredServings": 6,
  "inferredTotalTime": 45,
  "inferredPrepTime": 15,
  "inferredCookTime": 30,
  "searchMetadata": {
    "semanticTags": ["american", "dessert", "comfort-food", "weekend"],
    "primaryIngredients": ["apples", "flour", "butter"],
    "cookingMethods": ["baked"],
    "dietaryTags": ["vegetarian"],
    "flavorProfile": ["sweet", "cinnamon", "buttery"],
    "equipment": ["oven", "pie-pan", "rolling-pin"],
    "timeCategory": "medium-30min",
    "complexity": "intermediate",
    "mealType": "dessert"
  },
  "inferredMetadata": {
    "cuisineType": "American",
    "cookingMethods": ["baked"],
    "dietaryInfo": ["vegetarian"],
    "difficultyLevel": "Simple"
  },
  "qualityScore": 8.5,
  "normalizationNotes": "Standardized units, inferred 6 servings based on ingredient quantities, estimated 45 minutes total time, generated comprehensive search metadata for intelligent recipe discovery"
}

CRITICAL: inferredServings, inferredTotalTime, inferredPrepTime, and inferredCookTime MUST be numeric values, never null.`, recipe.Title, string(ingredientsJson), string(instructionsJson), servingsInfo, timeInfo)
}
