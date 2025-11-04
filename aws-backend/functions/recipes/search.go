package main

import (
	"sort"
	"strings"

	"recipe-archive/models"
)

// parseSearchArray parses a comma-separated string into a slice of lowercase search terms
func parseSearchArray(value string) []string {
	if value == "" {
		return nil
	}

	// Split on commas, "and", and "or" (case-insensitive)
	// First replace logical delimiters with commas for uniform processing
	normalizedValue := strings.ToLower(value)
	normalizedValue = strings.ReplaceAll(normalizedValue, " and ", ",")
	normalizedValue = strings.ReplaceAll(normalizedValue, " or ", ",")
	parts := strings.Split(normalizedValue, ",")

	var result []string
	for _, part := range parts {
		if trimmed := strings.ToLower(strings.TrimSpace(part)); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// matchesSearchCriteria performs cost-efficient in-memory recipe filtering
func matchesSearchCriteria(recipe models.Recipe, searchQuery string,
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
		searchTerms := parseSearchArray(searchQuery)
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
		sourcesToMatch := parseSearchArray(sourceFilter)
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

		// Time category matching - cumulative (long includes medium and quick)
		if timeCategory != "" && !matchesTimeCategory(strings.ToLower(recipe.SearchMetadata.TimeCategory), timeCategory) {
			return false
		}

		// Complexity matching
		if complexity != "" && strings.ToLower(recipe.SearchMetadata.Complexity) != complexity {
			return false
		}

		// Meal type matching - use OR logic for multiple meal types
		if len(mealTypes) > 0 {
			// Convert single MealType to slice for matching
			recipeMealTypes := []string{recipe.SearchMetadata.MealType}
			if !containsAnyMatch(mealTypes, recipeMealTypes) {
				return false
			}
		}
	} else {
		// If SearchMetadata is not available, only fail if advanced filters are being used
		// This ensures backward compatibility with recipes that haven't been normalized yet
		if len(semanticTags) > 0 || len(primaryIngredients) > 0 || len(cookingMethods) > 0 ||
			len(dietaryTags) > 0 || len(flavorProfile) > 0 || len(equipment) > 0 ||
			timeCategory != "" || complexity != "" || len(mealTypes) > 0 {
			return false // Skip recipes without SearchMetadata when advanced filters are used
		}
	}

	return true
}

// matchesTimeCategory implements cumulative time category matching
func matchesTimeCategory(recipeTimeCategory, searchTimeCategory string) bool {
	// Define time category hierarchy for cumulative matching
	timeCategoryRank := map[string]int{
		"quick-15min":     1,
		"medium-30min":    2,
		"long-60min":      3,
		"extended-120min": 4,
	}

	recipeRank, recipeExists := timeCategoryRank[recipeTimeCategory]
	searchRank, searchExists := timeCategoryRank[searchTimeCategory]

	if !recipeExists || !searchExists {
		return recipeTimeCategory == searchTimeCategory // Fallback to exact match
	}

	// Cumulative matching: recipe matches if it's at or below the search category
	// (e.g., searching for "long" includes "quick", "medium", and "long")
	return recipeRank <= searchRank
}

// containsAnyMatch checks if any search term matches any value in the target list (case-insensitive)
func containsAnyMatch(searchTerms, targetValues []string) bool {
	for _, searchTerm := range searchTerms {
		searchLower := strings.ToLower(searchTerm)
		for _, targetValue := range targetValues {
			if strings.ToLower(targetValue) == searchLower || strings.Contains(strings.ToLower(targetValue), searchLower) {
				return true
			}
		}
	}
	return false
}

// SortSearchResults sorts recipes by the specified field and order
func SortSearchResults(recipes []models.Recipe, sortBy, sortOrder string) {
	if sortBy == "" {
		sortBy = "createdAt"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	sort.Slice(recipes, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "title":
			less = recipes[i].Title < recipes[j].Title
		case "updatedAt":
			less = recipes[i].UpdatedAt.Before(recipes[j].UpdatedAt)
		case "createdAt":
			fallthrough
		default:
			less = recipes[i].CreatedAt.Before(recipes[j].CreatedAt)
		}

		if sortOrder == "desc" {
			return !less
		}
		return less
	})
}
