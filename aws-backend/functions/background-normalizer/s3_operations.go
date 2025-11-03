package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

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
	defer func() {
		if closeErr := result.Body.Close(); closeErr != nil {
			fmt.Printf("WARN: Failed to close S3 response body: %v\n", closeErr)
		}
	}()

	// First decode to a generic map to handle field name inconsistencies
	var rawData map[string]interface{}
	decoder := json.NewDecoder(result.Body)
	if err := decoder.Decode(&rawData); err != nil {
		return nil, fmt.Errorf("failed to decode recipe JSON: %w", err)
	}

	// Handle field name inconsistencies from web extension vs Go backend
	if prepTime, exists := rawData["prepTime"]; exists && rawData["prepTimeMinutes"] == nil {
		rawData["prepTimeMinutes"] = prepTime
		delete(rawData, "prepTime")
	}
	if cookTime, exists := rawData["cookTime"]; exists && rawData["cookTimeMinutes"] == nil {
		rawData["cookTimeMinutes"] = cookTime
		delete(rawData, "cookTime")
	}

	// Handle web extension format conversion for ingredients and instructions
	if ingredients, exists := rawData["ingredients"]; exists {
		if ingredientsSlice, ok := ingredients.([]interface{}); ok {
			var convertedIngredients []map[string]interface{}
			for _, ing := range ingredientsSlice {
				if ingMap, ok := ing.(map[string]interface{}); ok {
					// If already has the full structure, keep it
					if _, hasAmount := ingMap["amount"]; hasAmount || len(ingMap) > 1 {
						convertedIngredients = append(convertedIngredients, ingMap)
					} else {
						// Convert simple {text: "..."} format to full structure
						convertedIngredient := map[string]interface{}{
							"text":       ingMap["text"],
							"amount":     nil,
							"unit":       nil,
							"ingredient": nil,
						}
						convertedIngredients = append(convertedIngredients, convertedIngredient)
					}
				}
			}
			rawData["ingredients"] = convertedIngredients
		}
	}

	if instructions, exists := rawData["instructions"]; exists {
		if instructionsSlice, ok := instructions.([]interface{}); ok {
			var convertedInstructions []map[string]interface{}
			for i, inst := range instructionsSlice {
				if instMap, ok := inst.(map[string]interface{}); ok {
					// Ensure stepNumber exists
					if _, hasStepNumber := instMap["stepNumber"]; !hasStepNumber {
						instMap["stepNumber"] = i + 1
					}
					convertedInstructions = append(convertedInstructions, instMap)
				}
			}
			rawData["instructions"] = convertedInstructions
		}
	}

	// Handle mealType conversion from array to string
	if mealType, exists := rawData["searchMetadata"]; exists {
		if metadata, ok := mealType.(map[string]interface{}); ok {
			if mealTypeField, exists := metadata["mealType"]; exists {
				if mealTypeArray, ok := mealTypeField.([]interface{}); ok && len(mealTypeArray) > 0 {
					// Convert array to single string (take first element)
					if firstMealType, ok := mealTypeArray[0].(string); ok {
						metadata["mealType"] = firstMealType
					}
				}
			}
		}
	}

	// Re-encode and decode to Recipe struct
	fixedData, err := json.Marshal(rawData)
	if err != nil {
		return nil, fmt.Errorf("failed to re-marshal corrected data: %w", err)
	}

	var recipe Recipe
	if err := json.Unmarshal(fixedData, &recipe); err != nil {
		return nil, fmt.Errorf("failed to unmarshal recipe: %w", err)
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
