package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
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
	Instructions   []InstructionData `json:"instructions"`             // Shared/prep instructions
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
	Name         string            `json:"name"`                   // "Stovetop", "Slow Cooker", "Oven", etc.
	Instructions []InstructionData `json:"instructions"`           // Method-specific steps
	TimeEstimate string            `json:"timeEstimate,omitempty"` // "30 minutes", "6-8 hours", etc.
	Equipment    []string          `json:"equipment,omitempty"`    // "Large pot", "Slow cooker", etc.
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
	NormalizedInstructions []InstructionData `json:"normalizedInstructions"`   // Shared/prep instructions
	CookingMethods         []CookingMethod   `json:"cookingMethods,omitempty"` // Multiple method options
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
		log.Printf("ERROR: OpenAI normalization failed: %v\n", err)
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

	log.Printf("INFO: Recipe normalization completed with quality score: %.1f\n", normalizedResponse.QualityScore)

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
		log.Printf("WARN: Stage 2 failed, using stage 1 results: %v\n", err)
		return stage1Response, nil
	}

	// Merge results from both stages
	return mergeStageResults(stage1Response, stage2Response), nil
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
	result.Tags = append(result.Tags, normalized.InferredMetadata.CookingMethods...)
	result.Tags = append(result.Tags, normalized.InferredMetadata.DietaryInfo...)

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

	return makeOpenAICall(ctx, apiKey, prompt, 20*time.Second)
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

	return makeOpenAICall(ctx, apiKey, prompt, 40*time.Second)
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
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			fmt.Printf("WARN: Failed to close response body: %v\n", closeErr)
		}
	}()

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
