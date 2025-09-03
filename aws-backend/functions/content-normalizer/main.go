package main

import (
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
)

// RecipeData represents the input recipe structure
type RecipeData struct {
	Title        string            `json:"title"`
	Ingredients  []IngredientData  `json:"ingredients"`
	Instructions []InstructionData `json:"instructions"`
	Author       string            `json:"author,omitempty"`
	PrepTime     string            `json:"prepTime,omitempty"`
	CookTime     string            `json:"cookTime,omitempty"`
	TotalTime    string            `json:"totalTime,omitempty"`
	Servings     string            `json:"servings,omitempty"`
	Description  string            `json:"description,omitempty"`
	ImageUrl     string            `json:"imageUrl,omitempty"`
	SourceUrl    string            `json:"sourceUrl,omitempty"`
	Tags         []string          `json:"tags,omitempty"`
}

type IngredientData struct {
	Text string `json:"text"`
}

type InstructionData struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
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
	NormalizedInstructions []InstructionData `json:"normalizedInstructions"`
	InferredMetadata       InferredMetadata  `json:"inferredMetadata"`
	InferredServings       *int              `json:"inferredServings,omitempty"`
	InferredTotalTime      *int              `json:"inferredTotalTime,omitempty"`
	InferredPrepTime       *int              `json:"inferredPrepTime,omitempty"`
	InferredCookTime       *int              `json:"inferredCookTime,omitempty"`
	QualityScore           float64           `json:"qualityScore"`
	NormalizationNotes     string            `json:"normalizationNotes"`
}

type InferredMetadata struct {
	CuisineType     string   `json:"cuisineType,omitempty"`
	CookingMethods  []string `json:"cookingMethods,omitempty"`
	DietaryInfo     []string `json:"dietaryInfo,omitempty"`
	DifficultyLevel string   `json:"difficultyLevel,omitempty"`
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

	// Build normalization prompt with HTML context
	prompt := buildNormalizationPrompt(recipe, pageHtml)

	// Prepare OpenAI API request
	openaiRequest := OpenAIRequest{
		Model: "gpt-4o-mini", // Cost-effective while still powerful
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: "You are a professional recipe editor. Return only valid JSON with no additional text. Normalize recipe name capitalization using proper Title Case - NEVER capitalize letters after apostrophes (e.g., 'Kylie's' not 'Kylie'S'). Remove redundant word RECIPE in titles. Normalize all nonstandard characters other than vulgar fractions to ensure we don't serialize escape sequences. CRITICAL: Always infer missing servings count and time estimates (prep/cook/total in minutes) based on ingredients and instructions. For cocktails and drinks, typical serving is 1-2. For main dishes, analyze ingredient quantities to estimate servings. Add timing details inline within instructions when multiple timing phases exist.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.1, // Low creativity for consistency
		MaxTokens:   2000,
	}

	// Make API call with timeout - shorter timeout to allow fallback processing
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
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
	if err := json.Unmarshal([]byte(content), &normResponse); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI JSON response: %w", err)
	}

	return &normResponse, nil
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
- Estimate difficulty level (Simple, Moderate, Complex)

Return ONLY valid JSON in this exact format:
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
  "inferredMetadata": {
    "cuisineType": "American",
    "cookingMethods": ["baked"],
    "dietaryInfo": ["vegetarian"],
    "difficultyLevel": "Simple"
  },
  "qualityScore": 8.5,
  "normalizationNotes": "Standardized units, inferred 6 servings based on ingredient quantities, estimated 45 minutes total time"
}`, recipe.Title, string(ingredientsJson), string(instructionsJson), servingsInfo, timeInfo, htmlContext)
}

func applyNormalization(original RecipeData, normalized *NormalizationResponse) RecipeData {
	result := original // Copy original data

	// Apply normalized fields
	result.Title = normalized.NormalizedTitle
	result.Ingredients = normalized.NormalizedIngredients
	result.Instructions = normalized.NormalizedInstructions

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

func basicNormalization(recipe RecipeData) RecipeData {
	// Fallback normalization without AI
	result := recipe

	// Basic title cleanup
	result.Title = strings.TrimSpace(recipe.Title)
	result.Title = strings.Title(strings.ToLower(result.Title))

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

func main() {
	lambda.Start(handler)
}
