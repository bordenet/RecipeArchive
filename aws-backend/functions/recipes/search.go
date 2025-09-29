package main

import (
	"strings"

	"recipe-archive/models"
)

// MatchesSearchCriteria determines if a recipe matches the given search filters
func MatchesSearchCriteria(recipe models.Recipe, searchQuery string,
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
		searchTerms := ParseSearchArray(searchQuery)
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
		sourcesToMatch := ParseSearchArray(sourceFilter)
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

		// Time category matching
		if timeCategory != "" && !MatchesTimeCategory(recipe.SearchMetadata.TimeCategory, timeCategory) {
			return false
		}

		// Complexity matching
		if complexity != "" && strings.ToLower(recipe.SearchMetadata.Complexity) != strings.ToLower(complexity) {
			return false
		}

		// Meal type matching
		if len(mealTypes) > 0 {
			mealTypeMatched := false
			for _, mealType := range mealTypes {
				if strings.ToLower(recipe.SearchMetadata.MealType) == strings.ToLower(mealType) {
					mealTypeMatched = true
					break
				}
			}
			if !mealTypeMatched {
				return false
			}
		}
	}

	return true
}

// MatchesTimeCategory checks if recipe time category matches search criteria
func MatchesTimeCategory(recipeTimeCategory, searchTimeCategory string) bool {
	if recipeTimeCategory == "" || searchTimeCategory == "" {
		return true
	}

	recipeTime := strings.ToLower(recipeTimeCategory)
	searchTime := strings.ToLower(searchTimeCategory)

	// Exact match
	if recipeTime == searchTime {
		return true
	}

	// Hierarchical matching - quick recipes can match medium, medium can match long
	if searchTime == "medium" && recipeTime == "quick" {
		return true
	}
	if searchTime == "long" && (recipeTime == "quick" || recipeTime == "medium") {
		return true
	}

	return false
}

// ParseSearchArray splits comma-separated search terms
func ParseSearchArray(value string) []string {
	if value == "" {
		return []string{}
	}

	// Split by comma and clean up whitespace
	parts := strings.Split(value, ",")
	var result []string
	for _, part := range parts {
		cleaned := strings.TrimSpace(part)
		if cleaned != "" {
			result = append(result, strings.ToLower(cleaned))
		}
	}
	return result
}

// containsAnyMatch checks if any search terms match any recipe values
func containsAnyMatch(searchTerms []string, recipeValues []string) bool {
	for _, searchTerm := range searchTerms {
		for _, recipeValue := range recipeValues {
			if strings.ToLower(recipeValue) == strings.ToLower(searchTerm) {
				return true
			}
		}
	}
	return false
}