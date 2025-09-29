package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

// RecipeData represents the input recipe structure
type RecipeData struct {
	Title          string            `json:"title"`
	Ingredients    []IngredientData  `json:"ingredients"`
	Instructions   []InstructionData `json:"instructions"`           // Shared/prep instructions
	CookingMethods []CookingMethod   `json:"cookingMethods,omitempty"` // Multiple method options
	Author         string            `json:"author,omitempty"`
	PrepTime       string            `json:"prepTime,omitempty"`
	CookTime       string            `json:"cookTime,omitempty"`
	TotalTime      string            `json:"totalTime,omitempty"`
	Servings       string            `json:"servings,omitempty"`
	Description    string            `json:"description,omitempty"`
	ImageUrl       string            `json:"imageUrl,omitempty"`
	SourceUrl      string            `json:"sourceUrl,omitempty"`
	Tags           []string          `json:"tags,omitempty"`
}

type IngredientData struct {
	Text string `json:"text"`
}

type InstructionData struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
}

type CookingMethod struct {
	Name         string            `json:"name"`                    // "Stovetop", "Slow Cooker", "Oven", etc.
	Instructions []InstructionData `json:"instructions"`            // Method-specific steps
	TimeEstimate string            `json:"timeEstimate,omitempty"`  // "30 minutes", "6-8 hours", etc.
	Equipment    []string          `json:"equipment,omitempty"`     // "Large pot", "Slow cooker", etc.
}

// NormalizationRequest represents the input to the normalizer
type NormalizationRequest struct {
	OriginalRecipe RecipeData `json:"originalRecipe"`
	UserId         string     `json:"userId"`
	SourceUrl      string     `json:"sourceUrl"`
	PageHtml       string     `json:"pageHtml,omitempty"` // Full page HTML for enhanced analysis
}

// NormalizationResponse represents the output from OpenAI
type NormalizationResponse struct {
	NormalizedTitle        string            `json:"normalizedTitle"`
	NormalizedIngredients  []IngredientData  `json:"normalizedIngredients"`
	NormalizedInstructions []InstructionData `json:"normalizedInstructions"`    // Shared/prep instructions
	CookingMethods         []CookingMethod   `json:"cookingMethods,omitempty"`  // Multiple method options
	InferredMetadata       InferredMetadata  `json:"inferredMetadata"`
	InferredServings       *int              `json:"inferredServings,omitempty"`
	InferredTotalTime      *int              `json:"inferredTotalTime,omitempty"`
	InferredPrepTime       *int              `json:"inferredPrepTime,omitempty"`
	InferredCookTime       *int              `json:"inferredCookTime,omitempty"`
	QualityScore           float64           `json:"qualityScore"`
	NormalizationNotes     string            `json:"normalizationNotes"`
}

type InferredMetadata struct {
	CuisineType        string   `json:"cuisineType,omitempty"`
	CookingMethods     []string `json:"cookingMethods,omitempty"`
	DietaryInfo        []string `json:"dietaryInfo,omitempty"`
	DifficultyLevel    string   `json:"difficultyLevel,omitempty"`
	HasMultipleMethods bool     `json:"hasMultipleMethods,omitempty"`
}

// OpenAI API structures
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

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	headers := map[string]string{
		"Content-Type":                     "application/json",
		"Access-Control-Allow-Origin":      "https://d1jcaphz4458q7.cloudfront.net",
		"Access-Control-Allow-Methods":     "POST, OPTIONS",
		"Access-Control-Allow-Headers":     "Content-Type, Authorization",
		"Access-Control-Allow-Credentials": "true",
	}

	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    headers,
		}, nil
	}

	if request.HTTPMethod != "POST" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusMethodNotAllowed,
			Headers:    headers,
			Body:       `{"error": "Only POST method is allowed"}`,
		}, nil
	}

	// Parse request body
	var normRequest NormalizationRequest
	if err := json.Unmarshal([]byte(request.Body), &normRequest); err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Invalid JSON: %s"}`, err.Error()),
		}, nil
	}

	// Validate required fields
	if normRequest.OriginalRecipe.Title == "" || len(normRequest.OriginalRecipe.Ingredients) == 0 {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Headers:    headers,
			Body:       `{"error": "Recipe must have title and ingredients"}`,
		}, nil
	}

	fmt.Printf("🧠 Normalizing recipe: %s from %s\n", normRequest.OriginalRecipe.Title, normRequest.SourceUrl)

	// Call OpenAI API for normalization
	normalizedResponse, err := normalizeWithOpenAI(ctx, normRequest.OriginalRecipe, normRequest.PageHtml)
	if err != nil {
		fmt.Printf("❌ OpenAI normalization failed: %v\n", err)
		// Fallback: return original recipe with basic cleanup
		fallbackRecipe := basicNormalization(normRequest.OriginalRecipe)
		responseBody, _ := json.Marshal(map[string]interface{}{
			"normalizedRecipe": fallbackRecipe,
			"fallbackUsed":     true,
			"error":            err.Error(),
		})
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers:    headers,
			Body:       string(responseBody),
		}, nil
	}

	// Apply normalized data to recipe
	enhancedRecipe := applyNormalization(normRequest.OriginalRecipe, normalizedResponse)

	responseBody, err := json.Marshal(map[string]interface{}{
		"normalizedRecipe":   enhancedRecipe,
		"qualityScore":       normalizedResponse.QualityScore,
		"normalizationNotes": normalizedResponse.NormalizationNotes,
		"inferredMetadata":   normalizedResponse.InferredMetadata,
		"fallbackUsed":       false,
	})
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Headers:    headers,
			Body:       `{"error": "Failed to marshal response"}`,
		}, nil
	}

	fmt.Printf("✅ Recipe normalization completed with quality score: %.1f\n", normalizedResponse.QualityScore)

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    headers,
		Body:       string(responseBody),
	}, nil
}

func normalizeWithOpenAI(ctx context.Context, recipe RecipeData, pageHtml string) (*NormalizationResponse, error) {
	openaiApiKey := os.Getenv("OPENAI_API_KEY")
	if openaiApiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Two-stage approach for better reliability and faster processing
	// Stage 1: Basic normalization (fast)
	stage1Response, err := performStage1Normalization(ctx, openaiApiKey, recipe, pageHtml)
	if err != nil {
		return nil, fmt.Errorf("stage 1 normalization failed: %w", err)
	}

	// Stage 2: Advanced instruction processing and multi-method detection (slower)
	stage2Response, err := performStage2Normalization(ctx, openaiApiKey, recipe, stage1Response)
	if err != nil {
		// If stage 2 fails, return stage 1 results (degraded but functional)
		fmt.Printf("⚠️ Stage 2 failed, using stage 1 results: %v\n", err)
		return stage1Response, nil
	}

	// Merge results from both stages
	return mergeStageResults(stage1Response, stage2Response), nil
}

func buildNormalizationPrompt(recipe RecipeData, pageHtml string) string {
	ingredientsJson, _ := json.Marshal(recipe.Ingredients)
	instructionsJson, _ := json.Marshal(recipe.Instructions)

	// Extract current servings info for context
	servingsInfo := "not specified"
	if recipe.Servings != "" {
		servingsInfo = recipe.Servings
	}

	// Extract current time info for context
	timeInfo := "not specified"
	if recipe.PrepTime != "" || recipe.CookTime != "" || recipe.TotalTime != "" {
		timeInfo = fmt.Sprintf("prep: %s, cook: %s, total: %s", recipe.PrepTime, recipe.CookTime, recipe.TotalTime)
	}

	htmlContext := ""
	if pageHtml != "" && len(pageHtml) > 100 {
		// Truncate HTML to avoid token limits but provide context
		truncatedHtml := pageHtml
		if len(pageHtml) > 8000 { // Leave room for the rest of the prompt
			truncatedHtml = pageHtml[:8000] + "... [HTML truncated]"
		}
		htmlContext = fmt.Sprintf(`

ADDITIONAL CONTEXT - Full Page HTML:
%s

Note: Use this HTML context to extract additional recipe details that might be missing from the structured data above, such as:
- More detailed ingredient descriptions
- Additional cooking notes or tips
- Missing time or serving information from JSON-LD or microdata
- Recipe variations or substitution suggestions
- Equipment requirements
- Storage or serving suggestions

`, truncatedHtml)
	}

	return fmt.Sprintf(`You are a professional recipe editor tasked with normalizing recipe data for consistent storage and presentation.

Input Recipe Data:
- Title: "%s"
- Ingredients: %s
- Instructions: %s
- Current Servings: %s
- Current Times: %s%s

Please normalize this recipe following these strict guidelines:

TITLE NORMALIZATION:
- Use Title Case (capitalize major words, lowercase articles/prepositions)
- IMPORTANT: Apostrophes should NOT capitalize the letter after them (e.g., Kylie's not Kylie'S and General Tso's not General Tso'S)
- Examples: "Bob's Burgers", "Mom's Apple Pie", "Baker's Dozen"
- Remove excessive punctuation or emoji
- Remove the trailing word "Recipe" from recipe titles if present
- Fix common misspellings
- Correct grammar issues
- Remove redundant words (e.g., "Delicious Recipe" → "Delicious")
- Standardize capitalization of brand names (e.g., Kylie's not Kylie'S)
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
- BREAK OUT COMPOUND STEPS: If a step contains multiple actions separated by periods or semicolons, split into separate numbered steps
- Example: "Heat oil. Add vegetables and cook 5 minutes. Add broth and simmer." → 3 separate steps
- Each step should have ONE primary action for clarity
- Use consistent temperature formats (375°F, 190°C)
- Standardize temperature formats (e.g., "375°F" not "375 degrees F")
- Standardize timing formats ("10 minutes", "1 hour")
- Use consistent time formats (e.g., "10 minutes" not "ten mins")
- CLARITY IS PARAMOUNT: If original instructions are confusing, unclear, or poorly structured, rewrite them for maximum clarity and logical flow
- LOGICAL SEQUENCING: Ensure instructions follow a logical order (prep → cook → combine → serve)
- ELIMINATE AMBIGUITY: Remove vague references like "as mentioned above" or "from the previous step" - be explicit
- SPECIAL HANDLING FOR DRINKS/COCKTAILS: If no instructions or minimal instructions are provided for drink recipes, synthesize appropriate basic instructions (e.g., "Mix all ingredients in a shaker with ice. Shake well and strain into glasses. Garnish as desired." or "Combine all ingredients in a mixing glass. Stir well and serve over ice.")
- CRITICAL MULTI-METHOD DETECTION: When recipes provide distinct cooking method alternatives (e.g., stovetop vs slow cooker), you MUST use the cookingMethods array format:
  * MANDATORY TRIGGERS: If you see ANY of these patterns ANYWHERE in the instructions, you MUST use cookingMethods array:
    - "For stovetop:" / "For slow cooker:" / "For oven:" / "For instant pot:" (case insensitive)
    - "Stovetop method:" / "Slow cooker method:" / "Oven method:" (case insensitive)
    - "Method 1:" / "Method 2:" / "Option A:" / "Option B:"
    - Instructions that mention multiple cooking appliances (stovetop AND slow cooker)
    - Instructions that give time alternatives (30 min stovetop OR 8 hours slow cooker)
    - SCAN ALL INSTRUCTION TEXT: Even if patterns appear in middle of long instruction lists
  * DETECTION ALGORITHM:
    1. Scan all instructions for method-specific keywords above
    2. If found, count distinct cooking methods mentioned
    3. If 2+ methods detected, ALWAYS use cookingMethods array format
    4. NEVER use single normalizedInstructions for multi-method recipes
  * COOKINGMETHODS ARRAY USAGE:
    - CRITICAL: Identify any instructions that come BEFORE method-specific sections
    - Put shared prep steps (ingredients prep, common setup) in normalizedInstructions
    - Only put method-specific cooking steps in cookingMethods array
    - Example: "Prep chicken. For stovetop: heat oil..." → "Prep chicken" goes in normalizedInstructions
    - Separate each cooking method into its own cookingMethods entry
    - Include method name (e.g., "Stovetop", "Slow Cooker")
    - List method-specific equipment
    - Provide realistic time estimates per method
  * STRICT EXAMPLES:
    - DETECT: "Prep ingredients. For stovetop: heat oil, cook 30 min. For slow cooker: add all ingredients, cook 8 hours" → "Prep ingredients" in normalizedInstructions, methods in cookingMethods array
    - DETECT: "Remove chicken meat and shred. For Stove Top: Heat oil... For Slow Cooker: Add all ingredients..." → "Remove chicken meat and shred" in normalizedInstructions
    - DETECT: "Stovetop method: sauté vegetables. Slow cooker method: combine all ingredients" → USE cookingMethods array
    - NO DETECT: "heat oil, add ingredients, simmer 30 minutes" → USE single normalizedInstructions
  * FAILURE MODE PREVENTION: If you detect multi-method patterns but use single normalizedInstructions, this creates terrible UX

SERVINGS AND TIME INFERENCE (CRITICAL):
- ALWAYS estimate servings if not provided: analyze ingredient quantities to determine realistic serving count
- For cocktails/drinks: typically 1-2 servings unless ingredients suggest more
- For main dishes: analyze protein amounts, starch portions to estimate 2-8 servings
- For baked goods: count individual items or estimate portions from pan size
- ALWAYS estimate times in minutes if missing: analyze instructions for realistic timing
- Prep time: time for chopping, mixing, assembling before cooking
- Cook time: actual cooking/baking/active heat time
- Total time: prep + cook + any waiting/resting time
- Add timing details inline in instructions when multiple phases exist (e.g., "Mix ingredients (5 minutes)", "Bake for 25 minutes", "Cool for 10 minutes")

METADATA ENHANCEMENT:
- Infer cuisine type when possible
- Identify cooking methods (baked, sautéed, grilled, etc.)
- Detect dietary information (vegetarian, gluten-free, dairy-free)
- ALWAYS estimate difficulty level based on: ingredient count (>12 = Complex), cooking techniques (multiple methods = Moderate+), time requirements (>90min = Complex), special equipment needs (Complex), number of steps (>8 = Moderate+). Use "Simple", "Moderate", or "Complex" only.

QUALITY CONTROL FOR UNUSABLE INSTRUCTIONS:
- If original instructions are so fragmented, confusing, or incomplete that they would require visiting the source website to understand, COMPLETELY REWRITE them
- Create logical, step-by-step instructions based on the ingredients and cooking context
- Use your knowledge of cooking techniques to fill in missing steps
- Example: If instructions say "Follow stovetop method above" but there's no clear stovetop method, create complete stovetop instructions from scratch
- GOAL: User should be able to cook the recipe successfully using ONLY the normalized instructions

Return ONLY valid JSON in this exact format:

FOR SINGLE-METHOD RECIPES (most common):
{
  "normalizedTitle": "Normalized Recipe Title",
  "normalizedIngredients": [
    {"text": "1 cup all-purpose flour"},
    {"text": "1/2 teaspoon kosher salt"}
  ],
  "normalizedInstructions": [
    {"stepNumber": 1, "text": "Preheat oven to 375°F (190°C)."},
    {"stepNumber": 2, "text": "Mix flour and salt in large bowl (5 minutes)."},
    {"stepNumber": 3, "text": "Bake for 30 minutes until golden."}
  ],
  "cookingMethods": [],
  "inferredServings": 6,
  "inferredTotalTime": 45,
  "inferredPrepTime": 15,
  "inferredCookTime": 30,
  "inferredMetadata": {
    "cuisineType": "American",
    "cookingMethods": ["baked"],
    "dietaryInfo": ["vegetarian"],
    "difficultyLevel": "Simple"
  },
  "qualityScore": 8.5,
  "normalizationNotes": "Standardized units, inferred 6 servings based on ingredient quantities, estimated 45 minutes total time"
}

FOR MULTI-METHOD RECIPES (when recipe explicitly provides multiple cooking methods):
{
  "normalizedTitle": "Easy Chicken Noodle Soup",
  "normalizedIngredients": [
    {"text": "1 rotisserie chicken"},
    {"text": "2 cups egg noodles"}
  ],
  "normalizedInstructions": [
    {"stepNumber": 1, "text": "Prep all ingredients. Remove breast meat from rotisserie chicken and shred it."}
  ],
  "cookingMethods": [
    {
      "name": "Stovetop",
      "timeEstimate": "45 minutes",
      "equipment": ["Large pot"],
      "instructions": [
        {"stepNumber": 1, "text": "Heat olive oil over medium high heat."},
        {"stepNumber": 2, "text": "Add vegetables and cook until tender."},
        {"stepNumber": 3, "text": "Add broth and simmer 30 minutes."}
      ]
    },
    {
      "name": "Slow Cooker",
      "timeEstimate": "6-8 hours on low",
      "equipment": ["Slow cooker"],
      "instructions": [
        {"stepNumber": 1, "text": "Add all ingredients except pasta to slow cooker."},
        {"stepNumber": 2, "text": "Cook on low 6-8 hours."}
      ]
    }
  ],
  "inferredServings": 6,
  "inferredMetadata": {
    "cuisineType": "American",
    "cookingMethods": ["stovetop", "slow cooker"],
    "difficultyLevel": "Simple"
  },
  "qualityScore": 8.5,
  "normalizationNotes": "Recipe provides multiple cooking methods - preserved both stovetop and slow cooker options"
}`, recipe.Title, string(ingredientsJson), string(instructionsJson), servingsInfo, timeInfo, htmlContext)
}

func applyNormalization(original RecipeData, normalized *NormalizationResponse) RecipeData {
	result := original // Copy original data

	// Apply normalized fields
	result.Title = normalized.NormalizedTitle
	result.Ingredients = normalized.NormalizedIngredients
	result.Instructions = normalized.NormalizedInstructions
	result.CookingMethods = normalized.CookingMethods

	// Apply inferred servings if not already present
	if result.Servings == "" && normalized.InferredServings != nil {
		result.Servings = fmt.Sprintf("%d", *normalized.InferredServings)
	}

	// Apply inferred times if not already present
	if result.TotalTime == "" && normalized.InferredTotalTime != nil {
		result.TotalTime = fmt.Sprintf("%d minutes", *normalized.InferredTotalTime)
	}
	if result.PrepTime == "" && normalized.InferredPrepTime != nil {
		result.PrepTime = fmt.Sprintf("%d minutes", *normalized.InferredPrepTime)
	}
	if result.CookTime == "" && normalized.InferredCookTime != nil {
		result.CookTime = fmt.Sprintf("%d minutes", *normalized.InferredCookTime)
	}

	// Add inferred metadata as tags if not already present
	if normalized.InferredMetadata.CuisineType != "" {
		result.Tags = append(result.Tags, normalized.InferredMetadata.CuisineType)
	}
	if normalized.InferredMetadata.DifficultyLevel != "" {
		result.Tags = append(result.Tags, normalized.InferredMetadata.DifficultyLevel)
	}
	for _, method := range normalized.InferredMetadata.CookingMethods {
		result.Tags = append(result.Tags, method)
	}
	for _, diet := range normalized.InferredMetadata.DietaryInfo {
		result.Tags = append(result.Tags, diet)
	}

	return result
}

// normalizeTitle applies proper title capitalization without capitalizing after apostrophes
func normalizeTitle(title string) string {
	if len(title) == 0 {
		return title
	}

	// Convert to lowercase first, then runes for proper Unicode handling
	title = strings.ToLower(title)
	runes := []rune(title)

	// Capitalize first letter
	if runes[0] >= 'a' && runes[0] <= 'z' {
		runes[0] = runes[0] - 'a' + 'A'
	}

	// Capitalize letters after spaces and hyphens, but NOT after apostrophes
	for i := 1; i < len(runes); i++ {
		if (runes[i-1] == ' ' || runes[i-1] == '-') &&
			runes[i] >= 'a' && runes[i] <= 'z' {
			runes[i] = runes[i] - 'a' + 'A'
		}
	}

	return string(runes)
}

func basicNormalization(recipe RecipeData) RecipeData {
	// Fallback normalization without AI
	result := recipe

	// Basic title cleanup
	result.Title = strings.TrimSpace(recipe.Title)
	result.Title = normalizeTitle(result.Title)

	// Basic ingredient cleanup
	for i, ingredient := range result.Ingredients {
		result.Ingredients[i].Text = strings.TrimSpace(ingredient.Text)
	}

	// Basic instruction cleanup
	for i, instruction := range result.Instructions {
		result.Instructions[i].Text = strings.TrimSpace(instruction.Text)
	}

	return result
}

// Stage 1: Fast basic normalization and classification
func performStage1Normalization(ctx context.Context, apiKey string, recipe RecipeData, pageHtml string) (*NormalizationResponse, error) {
	prompt := `You are a recipe classifier. Quickly normalize basic recipe data.

TASK: Normalize title, classify meal type, estimate servings/times, and detect if this recipe has multiple cooking methods.

Recipe: ` + recipe.Title + `
Instructions: ` + fmt.Sprintf("%v", recipe.Instructions) + `

Return ONLY valid JSON:
{
  "normalizedTitle": "Proper Title Case",
  "inferredServings": 4,
  "inferredTotalTime": 45,
  "inferredPrepTime": 15,
  "inferredCookTime": 30,
  "inferredMetadata": {
    "cuisineType": "American",
    "difficultyLevel": "Simple",
    "hasMultipleMethods": false
  },
  "qualityScore": 8.0
}`

	return makeOpenAICall(ctx, apiKey, prompt, 10*time.Second)
}

// Stage 2: Advanced instruction processing and multi-method detection
func performStage2Normalization(ctx context.Context, apiKey string, recipe RecipeData, stage1 *NormalizationResponse) (*NormalizationResponse, error) {
	hasMultipleMethods := stage1.InferredMetadata.HasMultipleMethods

	var prompt string
	if hasMultipleMethods {
		prompt = buildMultiMethodPrompt(recipe)
	} else {
		prompt = buildSingleMethodPrompt(recipe)
	}

	return makeOpenAICall(ctx, apiKey, prompt, 25*time.Second)
}

// Merge results from both stages
func mergeStageResults(stage1, stage2 *NormalizationResponse) *NormalizationResponse {
	// Start with stage1 base data
	result := *stage1

	// Override with stage2 detailed results
	if stage2 != nil {
		result.NormalizedIngredients = stage2.NormalizedIngredients
		result.NormalizedInstructions = stage2.NormalizedInstructions
		result.CookingMethods = stage2.CookingMethods
		result.NormalizationNotes = stage2.NormalizationNotes
		if stage2.QualityScore > 0 {
			result.QualityScore = stage2.QualityScore
		}
	}

	return &result
}

// Helper to make OpenAI API calls with timeout
func makeOpenAICall(ctx context.Context, apiKey, prompt string, timeout time.Duration) (*NormalizationResponse, error) {
	openaiRequest := OpenAIRequest{
		Model: "gpt-4o-mini",
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: "You are a professional recipe normalizer. Return only valid JSON.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.0,
		MaxTokens:   2000,
	}

	// Make API call with specified timeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	reqBody, err := json.Marshal(openaiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAI request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API call failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read OpenAI response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	var openaiResponse OpenAIResponse
	if err := json.Unmarshal(body, &openaiResponse); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI response: %w", err)
	}

	if len(openaiResponse.Choices) == 0 {
		return nil, fmt.Errorf("no choices in OpenAI response")
	}

	content := openaiResponse.Choices[0].Message.Content
	var normalizedResponse NormalizationResponse
	if err := json.Unmarshal([]byte(content), &normalizedResponse); err != nil {
		return nil, fmt.Errorf("failed to parse normalized recipe JSON: %w", err)
	}

	return &normalizedResponse, nil
}

func buildMultiMethodPrompt(recipe RecipeData) string {
	return `MULTI-METHOD RECIPE DETECTED. Extract cooking methods:

Recipe: ` + recipe.Title + `
Instructions: ` + fmt.Sprintf("%v", recipe.Instructions) + `

Return cookingMethods array with separated method-specific instructions.`
}

func buildSingleMethodPrompt(recipe RecipeData) string {
	return `SINGLE-METHOD RECIPE. Normalize instructions:

Recipe: ` + recipe.Title + `
Instructions: ` + fmt.Sprintf("%v", recipe.Instructions) + `

Return normalizedInstructions array with improved step-by-step instructions.`
}

func main() {
	lambda.Start(handler)
}
