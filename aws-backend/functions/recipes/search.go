package main

import (
	"sort"
	"strings"

	"recipe-archive/models"
)

// levenshteinDistance calculates the Levenshtein distance between two strings
// Used for fuzzy matching in search (e.g., "drink" matches "drinks")
func levenshteinDistance(s1, s2 string) int {
	if len(s1) == 0 {
		return len(s2)
	}
	if len(s2) == 0 {
		return len(s1)
	}

	// Create a 2D slice for dynamic programming
	matrix := make([][]int, len(s1)+1)
	for i := range matrix {
		matrix[i] = make([]int, len(s2)+1)
	}

	// Initialize first row and column
	for i := 0; i <= len(s1); i++ {
		matrix[i][0] = i
	}
	for j := 0; j <= len(s2); j++ {
		matrix[0][j] = j
	}

	// Fill in the rest of the matrix
	for i := 1; i <= len(s1); i++ {
		for j := 1; j <= len(s2); j++ {
			cost := 0
			if s1[i-1] != s2[j-1] {
				cost = 1
			}

			matrix[i][j] = min(
				matrix[i-1][j]+1,      // deletion
				matrix[i][j-1]+1,      // insertion
				matrix[i-1][j-1]+cost, // substitution
			)
		}
	}

	return matrix[len(s1)][len(s2)]
}

// min returns the minimum of three integers
func min(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

// stem applies basic English stemming rules to a word
// Implements a simplified Porter Stemmer for common cooking terms
func stem(word string) string {
	word = strings.ToLower(word)

	// Skip very short words
	if len(word) <= 3 {
		return word
	}

	// Common plural forms
	if strings.HasSuffix(word, "ies") && len(word) > 4 {
		return word[:len(word)-3] + "y" // berries -> berry
	}
	if strings.HasSuffix(word, "es") && len(word) > 3 {
		// Special case: -ches, -shes, -sses, -xes
		if strings.HasSuffix(word, "ches") || strings.HasSuffix(word, "shes") ||
		   strings.HasSuffix(word, "sses") || strings.HasSuffix(word, "xes") {
			return word[:len(word)-2] // dishes -> dish, glasses -> glass
		}
		return word[:len(word)-2] // tomatoes -> tomato
	}
	if strings.HasSuffix(word, "s") && len(word) > 3 {
		return word[:len(word)-1] // drinks -> drink, eggs -> egg
	}

	// Common verb forms
	if strings.HasSuffix(word, "ing") && len(word) > 5 {
		return word[:len(word)-3] // baking -> bake, cooking -> cook
	}
	if strings.HasSuffix(word, "ed") && len(word) > 4 {
		return word[:len(word)-2] // baked -> bake, cooked -> cook
	}

	// Common adjective/adverb forms
	if strings.HasSuffix(word, "ly") && len(word) > 4 {
		return word[:len(word)-2] // quickly -> quick
	}

	return word
}

// fuzzyMatch checks if two strings match within a Levenshtein distance threshold
// Now also includes stemming for better ingredient matching
func fuzzyMatch(search, target string) bool {
	searchLower := strings.ToLower(search)
	targetLower := strings.ToLower(target)

	// Exact match - fastest path
	if searchLower == targetLower {
		return true
	}

	// Substring match - second fastest path
	// Check if the target word contains the search term (NOT the other way around)
	if strings.Contains(targetLower, searchLower) {
		return true
	}

	// Stemming match - check if stemmed forms match
	searchStem := stem(searchLower)
	targetStem := stem(targetLower)
	if searchStem == targetStem {
		return true // "baking" matches "baked" via stem "bake"
	}

	// Calculate distance threshold based on search term length
	// Shorter words get stricter thresholds to avoid false positives
	var threshold int
	searchLen := len(searchLower)
	switch {
	case searchLen <= 3:
		threshold = 0 // No fuzzy matching for very short words (e.g., "egg" shouldn't match "leg")
	case searchLen <= 5:
		threshold = 1 // 1 character difference for short words (e.g., "drink" matches "drinks")
	case searchLen <= 8:
		threshold = 2 // 2 character difference for medium words
	default:
		threshold = 3 // 3 character difference for long words
	}

	if threshold == 0 {
		return false
	}

	distance := levenshteinDistance(searchLower, targetLower)
	return distance <= threshold
}

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

		// Collect all text fields for fuzzy matching
		var allWords []string
		allWords = append(allWords, strings.Fields(strings.ToLower(recipe.Title))...)

		// Search in ingredients
		for _, ingredient := range recipe.Ingredients {
			ingredientText := strings.ToLower(ingredient.Text)
			recipeText += " " + ingredientText
			allWords = append(allWords, strings.Fields(ingredientText)...)
		}

		// Search in instructions
		for _, instruction := range recipe.Instructions {
			instructionText := strings.ToLower(instruction.Text)
			recipeText += " " + instructionText
			allWords = append(allWords, strings.Fields(instructionText)...)
		}

		// Search in user-added tags (critical for manual tag search)
		for _, tag := range recipe.Tags {
			tagText := strings.ToLower(tag)
			recipeText += " " + tagText
			allWords = append(allWords, strings.Fields(tagText)...)
		}

		// Check if search query matches any part of the recipe text
		// Support comma-separated OR queries (e.g., "drink, cocktail")
		searchTerms := parseSearchArray(searchQuery)
		if len(searchTerms) > 1 {
			// Multiple terms - use OR logic with fuzzy matching
			found := false
			for _, term := range searchTerms {
				term = strings.TrimSpace(strings.ToLower(term))
				// First try exact substring match (fastest)
				if strings.Contains(recipeText, term) {
					found = true
					break
				}
				// Then try fuzzy matching against individual words
				for _, word := range allWords {
					if fuzzyMatch(term, word) {
						found = true
						break
					}
				}
				if found {
					break
				}
			}
			if !found {
				return false
			}
		} else {
			// Single term - use exact match first, then fuzzy match
			searchTerm := strings.ToLower(searchQuery)
			if !strings.Contains(recipeText, searchTerm) {
				// Try fuzzy matching against individual words
				fuzzyFound := false
				for _, word := range allWords {
					if fuzzyMatch(searchTerm, word) {
						fuzzyFound = true
						break
					}
				}
				if !fuzzyFound {
					return false
				}
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
// Now supports fuzzy matching to improve search flexibility
func containsAnyMatch(searchTerms, targetValues []string) bool {
	for _, searchTerm := range searchTerms {
		searchLower := strings.ToLower(searchTerm)
		for _, targetValue := range targetValues {
			targetLower := strings.ToLower(targetValue)
			// Try exact match first (fastest)
			if targetLower == searchLower || strings.Contains(targetLower, searchLower) {
				return true
			}
			// Try fuzzy matching for partial matches
			// Split target into words for word-level fuzzy matching
			targetWords := strings.Fields(targetLower)
			for _, word := range targetWords {
				if fuzzyMatch(searchLower, word) {
					return true
				}
			}
		}
	}
	return false
}

// calculateRelevanceScore computes a relevance score for a recipe based on search query matches
// Higher scores indicate better matches. Scoring:
// - Title match: 3x weight (most important)
// - Ingredient match: 2x weight
// - Instruction match: 1x weight
// - Tag match: 2x weight (user-curated)
func calculateRelevanceScore(recipe models.Recipe, searchQuery string) float64 {
	if searchQuery == "" {
		return 0.0 // No search query, all recipes equally relevant
	}

	score := 0.0
	query := strings.ToLower(searchQuery)
	queryWords := strings.Fields(query)

	// Title matches (3x weight) - most important
	titleLower := strings.ToLower(recipe.Title)
	titleWords := strings.Fields(titleLower)

	// Exact phrase match in title (bonus)
	if strings.Contains(titleLower, query) {
		score += 30.0 // High bonus for exact phrase in title
	}

	// Individual word matches in title
	for _, queryWord := range queryWords {
		for _, titleWord := range titleWords {
			if fuzzyMatch(queryWord, titleWord) {
				score += 3.0
			}
		}
	}

	// Tag matches (2x weight) - user-curated, important
	for _, tag := range recipe.Tags {
		tagLower := strings.ToLower(tag)
		if strings.Contains(tagLower, query) {
			score += 10.0 // Bonus for exact phrase in tags
		}
		tagWords := strings.Fields(tagLower)
		for _, queryWord := range queryWords {
			for _, tagWord := range tagWords {
				if fuzzyMatch(queryWord, tagWord) {
					score += 2.0
				}
			}
		}
	}

	// Ingredient matches (2x weight)
	for _, ingredient := range recipe.Ingredients {
		ingredientLower := strings.ToLower(ingredient.Text)
		if strings.Contains(ingredientLower, query) {
			score += 6.0 // Bonus for exact phrase in ingredients
		}
		ingredientWords := strings.Fields(ingredientLower)
		for _, queryWord := range queryWords {
			for _, ingredientWord := range ingredientWords {
				if fuzzyMatch(queryWord, ingredientWord) {
					score += 2.0
				}
			}
		}
	}

	// Instruction matches (1x weight) - least important
	for _, instruction := range recipe.Instructions {
		instructionLower := strings.ToLower(instruction.Text)
		if strings.Contains(instructionLower, query) {
			score += 2.0 // Bonus for exact phrase in instructions
		}
		instructionWords := strings.Fields(instructionLower)
		for _, queryWord := range queryWords {
			for _, instructionWord := range instructionWords {
				if fuzzyMatch(queryWord, instructionWord) {
					score += 1.0
				}
			}
		}
	}

	return score
}

// SortSearchResults sorts recipes by the specified field and order
// When sortBy is "relevance", recipes are scored based on search query match quality
func SortSearchResults(recipes []models.Recipe, sortBy, sortOrder, searchQuery string) {
	if sortBy == "" {
		sortBy = "createdAt"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	// Pre-calculate relevance scores if needed
	var relevanceScores map[string]float64
	if sortBy == "relevance" && searchQuery != "" {
		relevanceScores = make(map[string]float64, len(recipes))
		for _, recipe := range recipes {
			relevanceScores[recipe.ID] = calculateRelevanceScore(recipe, searchQuery)
		}
	}

	sort.Slice(recipes, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "relevance":
			if relevanceScores != nil {
				// Higher score = more relevant (should come first in desc order)
				less = relevanceScores[recipes[i].ID] < relevanceScores[recipes[j].ID]
			} else {
				// Fallback to createdAt if no search query
				less = recipes[i].CreatedAt.Before(recipes[j].CreatedAt)
			}
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
