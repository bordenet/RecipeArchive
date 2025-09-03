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
	Title        string             `json:"title"`
	Ingredients  []IngredientData   `json:"ingredients"`
	Instructions []InstructionData  `json:"instructions"`
	Author       string             `json:"author,omitempty"`
	PrepTime     string             `json:"prepTime,omitempty"`
	CookTime     string             `json:"cookTime,omitempty"`
	TotalTime    string             `json:"totalTime,omitempty"`
	Servings     string             `json:"servings,omitempty"`
	Description  string             `json:"description,omitempty"`
	ImageUrl     string             `json:"imageUrl,omitempty"`
	SourceUrl    string             `json:"sourceUrl,omitempty"`
	Tags         []string           `json:"tags,omitempty"`
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
}

// NormalizationResponse represents the output from OpenAI
type NormalizationResponse struct {
	NormalizedTitle        string             `json:"normalizedTitle"`
	NormalizedIngredients  []IngredientData   `json:"normalizedIngredients"`
	NormalizedInstructions []InstructionData  `json:"normalizedInstructions"`
	InferredMetadata       InferredMetadata   `json:"inferredMetadata"`
	QualityScore          float64            `json:"qualityScore"`
	NormalizationNotes    string             `json:"normalizationNotes"`
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
	normalizedResponse, err := normalizeWithOpenAI(ctx, normRequest.OriginalRecipe)
	if err != nil {
		fmt.Printf("❌ OpenAI normalization failed: %v\n", err)
		// Fallback: return original recipe with basic cleanup
		fallbackRecipe := basicNormalization(normRequest.OriginalRecipe)
		responseBody, _ := json.Marshal(map[string]interface{}{
			"normalizedRecipe": fallbackRecipe,
			"fallbackUsed":     true,
			"error":           err.Error(),
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
		"normalizedRecipe":    enhancedRecipe,
		"qualityScore":        normalizedResponse.QualityScore,
		"normalizationNotes":  normalizedResponse.NormalizationNotes,
		"inferredMetadata":    normalizedResponse.InferredMetadata,
		"fallbackUsed":        false,
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

func normalizeWithOpenAI(ctx context.Context, recipe RecipeData) (*NormalizationResponse, error) {
	openaiApiKey := os.Getenv("OPENAI_API_KEY")
	if openaiApiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Build normalization prompt
	prompt := buildNormalizationPrompt(recipe)

	// Prepare OpenAI API request
	openaiRequest := OpenAIRequest{
		Model: "gpt-4o-mini", // Cost-effective while still powerful
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: "You are a professional recipe editor. Return only valid JSON with no additional text.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.1, // Low creativity for consistency
		MaxTokens:   2000,
	}

	// Make API call with timeout
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
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

func buildNormalizationPrompt(recipe RecipeData) string {
	ingredientsJson, _ := json.Marshal(recipe.Ingredients)
	instructionsJson, _ := json.Marshal(recipe.Instructions)

	return fmt.Sprintf(`You are a professional recipe editor tasked with normalizing recipe data for consistent storage and presentation.

Input Recipe Data:
- Title: "%s"
- Ingredients: %s
- Instructions: %s

Please normalize this recipe following these strict guidelines:

TITLE NORMALIZATION:
- Use Title Case (capitalize major words, lowercase articles/prepositions)
- Remove excessive punctuation or emoji
- Standardize descriptive terms (e.g., "Easy" → "Simple", "Super Yummy" → "Delicious")
- Keep titles concise (max 60 characters)

INGREDIENT NORMALIZATION:
- Standardize units (cups, tablespoons, teaspoons, ounces, pounds, grams)
- Use consistent fraction formatting (1/2, 1/4, 3/4)
- Standardize ingredient names (e.g., "all-purpose flour" not "AP flour")
- Include preparation methods when relevant ("diced", "chopped", "minced")
- Use specific salt types when mentioned ("kosher salt", "sea salt")

INSTRUCTION NORMALIZATION:
- Use imperative voice ("Mix flour" not "You should mix flour")
- Start each step with action verb when possible
- Keep steps concise but complete
- Use consistent temperature formats (375°F, 190°C)
- Standardize timing formats ("10 minutes", "1 hour")

METADATA ENHANCEMENT:
- Infer cuisine type when possible
- Identify cooking methods (baked, sautéed, grilled, etc.)
- Detect dietary information (vegetarian, gluten-free, dairy-free)
- Estimate difficulty level (Simple, Moderate, Complex)

Return ONLY valid JSON in this exact format:
{
  "normalizedTitle": "Normalized Recipe Title",
  "normalizedIngredients": [
    {"text": "1 cup all-purpose flour"},
    {"text": "1/2 teaspoon kosher salt"}
  ],
  "normalizedInstructions": [
    {"stepNumber": 1, "text": "Preheat oven to 375°F (190°C)."},
    {"stepNumber": 2, "text": "Mix flour and salt in large bowl."}
  ],
  "inferredMetadata": {
    "cuisineType": "American",
    "cookingMethods": ["baked"],
    "dietaryInfo": ["vegetarian"],
    "difficultyLevel": "Simple"
  },
  "qualityScore": 8.5,
  "normalizationNotes": "Standardized units and temperature format"
}`, recipe.Title, string(ingredientsJson), string(instructionsJson))
}

func applyNormalization(original RecipeData, normalized *NormalizationResponse) RecipeData {
	result := original // Copy original data

	// Apply normalized fields
	result.Title = normalized.NormalizedTitle
	result.Ingredients = normalized.NormalizedIngredients
	result.Instructions = normalized.NormalizedInstructions

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