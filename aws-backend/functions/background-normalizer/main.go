package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/aws"
)

// SQS Message format for recipe normalization
type NormalizationMessage struct {
	RecipeID string `json:"recipeId"`
	UserID   string `json:"userId"`
	Action   string `json:"action"`
}

// Simplified recipe structure for normalization
type Recipe struct {
	ID           string         `json:"id"`
	UserID       string         `json:"userId"`
	Title        string         `json:"title"`
	Ingredients  []Ingredient   `json:"ingredients"`
	Instructions []Instruction  `json:"instructions"`
	SourceURL    string         `json:"sourceUrl"`
	MainPhotoURL string         `json:"mainPhotoUrl,omitempty"`
	Servings     string         `json:"servings,omitempty"`
	TotalTime    string         `json:"totalTimeMinutes,omitempty"`
	PrepTime     string         `json:"prepTime,omitempty"`
	CookTime     string         `json:"cookTime,omitempty"`
	Tags         []string       `json:"tags,omitempty"`
	CreatedAt    string         `json:"createdAt"`
	UpdatedAt    string         `json:"updatedAt"`
	IsDeleted    bool           `json:"isDeleted"`
	Version      int            `json:"version"`
}

type Ingredient struct {
	Text string `json:"text"`
}

type Instruction struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
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

// NormalizationResponse represents the output from OpenAI
type NormalizationResponse struct {
	NormalizedTitle        string            `json:"normalizedTitle"`
	NormalizedIngredients  []Ingredient      `json:"normalizedIngredients"`
	NormalizedInstructions []Instruction     `json:"normalizedInstructions"`
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

// Background normalizer processes SQS messages to normalize recipes
func handler(ctx context.Context, event events.SQSEvent) error {
	fmt.Printf("🔧 Background normalizer received %d messages\n", len(event.Records))

	// Initialize S3 client
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}
	
	s3Client := s3.NewFromConfig(cfg)
	bucketName := os.Getenv("S3_STORAGE_BUCKET")

	if bucketName == "" {
		return fmt.Errorf("S3_STORAGE_BUCKET environment variable not set")
	}

	// Process each SQS message
	for _, record := range event.Records {
		fmt.Printf("Processing message: %s\n", record.MessageId)

		// Parse the message
		var message NormalizationMessage
		if err := json.Unmarshal([]byte(record.Body), &message); err != nil {
			log.Printf("❌ Failed to parse message %s: %v", record.MessageId, err)
			continue // Skip this message but don't fail the whole batch
		}

		fmt.Printf("📝 Normalizing recipe %s for user %s\n", message.RecipeID, message.UserID)

		// Get the recipe from S3
		recipe, err := getRecipeFromS3(ctx, s3Client, bucketName, message.UserID, message.RecipeID)
		if err != nil {
			log.Printf("❌ Failed to get recipe %s: %v", message.RecipeID, err)
			continue
		}

		// Always normalize the recipe with OpenAI, even if title looks good
		// This ensures we get servings inference, time estimation, and other enhancements
		normalizedRecipe, err := normalizeRecipeWithOpenAI(ctx, recipe)
		if err != nil {
			log.Printf("❌ Failed to normalize recipe %s with OpenAI: %v", message.RecipeID, err)
			// Fallback to simple title normalization
			originalTitle := recipe.Title
			recipe.Title = normalizeTitle(recipe.Title)
			if recipe.Title != originalTitle {
				if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
					log.Printf("❌ Failed to update recipe %s: %v", message.RecipeID, err)
					continue
				}
				fmt.Printf("✅ Fallback normalized recipe %s: \"%s\" → \"%s\"\n", message.RecipeID, originalTitle, recipe.Title)
			} else {
				fmt.Printf("✅ Recipe %s title already normalized (OpenAI failed): %s\n", message.RecipeID, recipe.Title)
			}
			continue
		}

		// Update with normalized data
		*recipe = *normalizedRecipe
		
		// Always save the recipe (even if only metadata was added)
		if err := saveRecipeToS3(ctx, s3Client, bucketName, recipe); err != nil {
			log.Printf("❌ Failed to update normalized recipe %s: %v", message.RecipeID, err)
			continue
		}

		fmt.Printf("✅ OpenAI normalized recipe %s with enhanced metadata\n", message.RecipeID)
	}

	return nil
}

// getRecipeFromS3 retrieves a recipe from S3
func getRecipeFromS3(ctx context.Context, s3Client *s3.Client, bucketName, userID, recipeID string) (*Recipe, error) {
	key := fmt.Sprintf("recipes/%s/%s.json", userID, recipeID)
	
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get recipe from S3: %w", err)
	}
	defer result.Body.Close()

	var recipe Recipe
	if err := json.NewDecoder(result.Body).Decode(&recipe); err != nil {
		return nil, fmt.Errorf("failed to decode recipe JSON: %w", err)
	}

	return &recipe, nil
}

// saveRecipeToS3 saves a recipe to S3
func saveRecipeToS3(ctx context.Context, s3Client *s3.Client, bucketName string, recipe *Recipe) error {
	key := fmt.Sprintf("recipes/%s/%s.json", recipe.UserID, recipe.ID)
	
	recipeJSON, err := json.Marshal(recipe)
	if err != nil {
		return fmt.Errorf("failed to marshal recipe: %w", err)
	}

	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(key),
		Body:        strings.NewReader(string(recipeJSON)),
		ContentType: aws.String("application/json"),
	})
	
	if err != nil {
		return fmt.Errorf("failed to save recipe to S3: %w", err)
	}

	return nil
}

// normalizeRecipeWithOpenAI normalizes recipe using OpenAI API
func normalizeRecipeWithOpenAI(ctx context.Context, recipe *Recipe) (*Recipe, error) {
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
				Content: "You are a professional recipe editor for Food & Wine Magazine. Review and return only valid JSON with no additional text. Normalize recipe name capitalization using proper Title Case - NEVER capitalize letters after apostrophes (e.g., 'Kylie\'s' not 'Kylie\'S' and 'General Tso\'s' not 'General Tso\'S'). Remove redundant word Recipe in recipe titles. Normalize all nonstandard characters other than vulgar fractions to ensure we don't serialize escape sequences. CRITICAL: Always infer missing servings count and time estimates (prep/cook/total in minutes) based on ingredients and instructions. For cocktails and drinks, typical serving is 1-2. For main dishes, analyze ingredient quantities to estimate servings. Add recipe timing details inline within instructions when multiple timing phases exist.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.1,
		MaxTokens:   2000,
	}

	// Make API call with timeout
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

	// Apply normalized data to recipe
	result := *recipe // Copy original data
	result.Title = normResponse.NormalizedTitle
	result.Ingredients = normResponse.NormalizedIngredients
	result.Instructions = normResponse.NormalizedInstructions

	// Apply inferred servings if not already present
	if result.Servings == "" && normResponse.InferredServings != nil {
		result.Servings = fmt.Sprintf("%d", *normResponse.InferredServings)
	}

	// Apply inferred times if not already present
	if result.TotalTime == "" && normResponse.InferredTotalTime != nil {
		result.TotalTime = fmt.Sprintf("%d", *normResponse.InferredTotalTime)
	}
	if result.PrepTime == "" && normResponse.InferredPrepTime != nil {
		result.PrepTime = fmt.Sprintf("%d", *normResponse.InferredPrepTime)
	}
	if result.CookTime == "" && normResponse.InferredCookTime != nil {
		result.CookTime = fmt.Sprintf("%d", *normResponse.InferredCookTime)
	}

	// Add inferred metadata as tags if not already present
	if normResponse.InferredMetadata.CuisineType != "" {
		result.Tags = append(result.Tags, normResponse.InferredMetadata.CuisineType)
	}
	if normResponse.InferredMetadata.DifficultyLevel != "" {
		result.Tags = append(result.Tags, normResponse.InferredMetadata.DifficultyLevel)
	}
	for _, method := range normResponse.InferredMetadata.CookingMethods {
		result.Tags = append(result.Tags, method)
	}
	for _, diet := range normResponse.InferredMetadata.DietaryInfo {
		result.Tags = append(result.Tags, diet)
	}

	return &result, nil
}

func buildNormalizationPrompt(recipe *Recipe) string {
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
- IMPORTANT: Apostrophes should NOT capitalize the letter after them (e.g., 'Kylie\'s' not 'Kylie\'S' and 'General Tso\'s' not 'General Tso\'S')
- Examples: "Bob's Burgers", "Mom's Apple Pie", "Baker's Dozen"
- Remove excessive punctuation or emoji
- Remove the trailing word "Recipe" from recipe titles if present
- Fix common misspellings
- Correct grammar issues
- Remove redundant words (e.g., "Delicious Recipe" → "Delicious")
- Standardize capitalization of brand names (e.g., "Kylie\'s" not "Kylie\'S")
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
}`, recipe.Title, string(ingredientsJson), string(instructionsJson), servingsInfo, timeInfo)
}

// normalizeTitle applies proper title capitalization
func normalizeTitle(title string) string {
	if len(title) == 0 {
		return title
	}

	// Convert to runes for proper Unicode handling
	runes := []rune(title)
	
	// Capitalize first letter
	if runes[0] >= 'a' && runes[0] <= 'z' {
		runes[0] = runes[0] - 'a' + 'A'
	}
	
	// Capitalize letters after spaces, apostrophes, and hyphens
	for i := 1; i < len(runes); i++ {
		if (runes[i-1] == ' ' || runes[i-1] == '\'' || runes[i-1] == '-') && 
		   runes[i] >= 'a' && runes[i] <= 'z' {
			runes[i] = runes[i] - 'a' + 'A'
		}
	}
	
	return string(runes)
}

func main() {
	lambda.Start(handler)
}