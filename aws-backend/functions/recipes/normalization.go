package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"

	"recipe-archive/models"
)

// NormalizationMessage represents an SQS message for async recipe normalization
type NormalizationMessage struct {
	RecipeID string `json:"recipeId"`
	UserID   string `json:"userId"`
	Action   string `json:"action"`
}

// queueRecipeNormalization sends a message to SQS to normalize a recipe in the background.
//
// If the normalization queue is not configured, this is a no-op and returns nil.
// This allows recipe creation to succeed even when background normalization is unavailable.
func queueRecipeNormalization(ctx context.Context, userID, recipeID string) error {
	queueURL := os.Getenv("NORMALIZATION_QUEUE_URL")
	if queueURL == "" {
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

	logger.Info("queued normalization job", "recipeID", recipeID)
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
