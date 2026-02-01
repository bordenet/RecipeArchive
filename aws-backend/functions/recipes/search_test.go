package main

import (
	"testing"

	"recipe-archive/models"
)

// Test levenshteinDistance with identical strings
func TestLevenshteinDistance_Identical(t *testing.T) {
	distance := levenshteinDistance("hello", "hello")
	if distance != 0 {
		t.Errorf("Expected distance 0 for identical strings, got %d", distance)
	}
}

// Test levenshteinDistance with one empty string
func TestLevenshteinDistance_EmptyString(t *testing.T) {
	distance := levenshteinDistance("", "hello")
	if distance != 5 {
		t.Errorf("Expected distance 5, got %d", distance)
	}

	distance = levenshteinDistance("hello", "")
	if distance != 5 {
		t.Errorf("Expected distance 5, got %d", distance)
	}
}

// Test levenshteinDistance with single character difference
func TestLevenshteinDistance_SingleDifference(t *testing.T) {
	distance := levenshteinDistance("hello", "hallo")
	if distance != 1 {
		t.Errorf("Expected distance 1, got %d", distance)
	}
}

// Test levenshteinDistance with multiple differences
func TestLevenshteinDistance_MultipleDifferences(t *testing.T) {
	distance := levenshteinDistance("kitten", "sitting")
	if distance != 3 {
		t.Errorf("Expected distance 3, got %d", distance)
	}
}

// Test levenshteinDistance with both empty strings
func TestLevenshteinDistance_BothEmpty(t *testing.T) {
	distance := levenshteinDistance("", "")
	if distance != 0 {
		t.Errorf("Expected distance 0 for both empty strings, got %d", distance)
	}
}

// Test levenshteinDistance with insertion
func TestLevenshteinDistance_Insertion(t *testing.T) {
	distance := levenshteinDistance("cat", "cats")
	if distance != 1 {
		t.Errorf("Expected distance 1, got %d", distance)
	}
}

// Test levenshteinDistance with deletion
func TestLevenshteinDistance_Deletion(t *testing.T) {
	distance := levenshteinDistance("cats", "cat")
	if distance != 1 {
		t.Errorf("Expected distance 1, got %d", distance)
	}
}

// Test stem with plural forms
func TestStem_Plurals(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"drinks", "drink"},
		{"eggs", "egg"},
		{"berries", "berry"},
		{"tomatoes", "tomato"},
		{"dishes", "dish"},
		{"glasses", "glass"},
	}

	for _, tt := range tests {
		result := stem(tt.input)
		if result != tt.expected {
			t.Errorf("stem(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Test stem with verb forms
func TestStem_Verbs(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"baking", "bak"},   // stem removes 'ing' but doesn't preserve final 'e'
		{"cooking", "cook"}, // 'cook' doesn't end in 'e'
		{"baked", "bak"},    // stem removes 'ed' but doesn't preserve final 'e'
		{"cooked", "cook"},  // 'cook' doesn't end in 'e'
	}

	for _, tt := range tests {
		result := stem(tt.input)
		if result != tt.expected {
			t.Errorf("stem(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Test stem with short words (should not be stemmed)
func TestStem_ShortWords(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"egg", "egg"},
		{"tea", "tea"},
		{"pie", "pie"},
	}

	for _, tt := range tests {
		result := stem(tt.input)
		if result != tt.expected {
			t.Errorf("stem(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Test stem with uppercase (should be lowercased)
func TestStem_Uppercase(t *testing.T) {
	result := stem("DRINKS")
	if result != "drink" {
		t.Errorf("stem(\"DRINKS\") = %q, expected \"drink\"", result)
	}
}

// Test min function
func TestMin(t *testing.T) {
	tests := []struct {
		a, b, c  int
		expected int
	}{
		{1, 2, 3, 1},
		{3, 2, 1, 1},
		{2, 1, 3, 1},
		{5, 5, 5, 5},
		{0, 10, 20, 0},
	}

	for _, tt := range tests {
		result := min(tt.a, tt.b, tt.c)
		if result != tt.expected {
			t.Errorf("min(%d, %d, %d) = %d, expected %d", tt.a, tt.b, tt.c, result, tt.expected)
		}
	}
}

// Test fuzzyMatch with exact matches
func TestFuzzyMatch_ExactMatch(t *testing.T) {
	if !fuzzyMatch("chicken", "chicken") {
		t.Error("Expected exact match to return true")
	}
	if !fuzzyMatch("Chicken", "chicken") {
		t.Error("Expected case-insensitive match to return true")
	}
}

// Test fuzzyMatch with substring matches
func TestFuzzyMatch_SubstringMatch(t *testing.T) {
	if !fuzzyMatch("chick", "chicken breast") {
		t.Error("Expected substring match to return true")
	}
	if !fuzzyMatch("egg", "scrambled eggs") {
		t.Error("Expected substring match to return true")
	}
}

// Test fuzzyMatch with stemming
func TestFuzzyMatch_Stemming(t *testing.T) {
	if !fuzzyMatch("baking", "baked") {
		t.Error("Expected stemming match (baking->baked) to return true")
	}
	if !fuzzyMatch("drinks", "drink") {
		t.Error("Expected stemming match (drinks->drink) to return true")
	}
}

// Test fuzzyMatch with Levenshtein distance
func TestFuzzyMatch_FuzzyDistance(t *testing.T) {
	// Medium words (5-8 chars) have threshold of 2
	if !fuzzyMatch("chicken", "chickne") {
		t.Error("Expected fuzzy match for typo to return true")
	}
	// Short words (<=3 chars) have threshold of 0
	if fuzzyMatch("egg", "leg") {
		t.Error("Expected short word mismatch to return false")
	}
}

// Test parseSearchArray
func TestParseSearchArray_CommaSeparated(t *testing.T) {
	result := parseSearchArray("chicken, beef, pork")
	if len(result) != 3 {
		t.Errorf("Expected 3 items, got %d", len(result))
	}
	expected := []string{"chicken", "beef", "pork"}
	for i, v := range expected {
		if result[i] != v {
			t.Errorf("Expected %s at index %d, got %s", v, i, result[i])
		}
	}
}

func TestParseSearchArray_WithAnd(t *testing.T) {
	result := parseSearchArray("chicken and beef")
	if len(result) != 2 {
		t.Errorf("Expected 2 items, got %d", len(result))
	}
}

func TestParseSearchArray_WithOr(t *testing.T) {
	result := parseSearchArray("chicken or beef")
	if len(result) != 2 {
		t.Errorf("Expected 2 items, got %d", len(result))
	}
}

func TestParseSearchArray_Empty(t *testing.T) {
	result := parseSearchArray("")
	if result != nil {
		t.Errorf("Expected nil for empty string, got %v", result)
	}
}

// Test stem with -ly suffix
func TestStem_Ly(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"quickly", "quick"},
		{"slowly", "slow"},
		{"gently", "gent"},
	}

	for _, tt := range tests {
		result := stem(tt.input)
		if result != tt.expected {
			t.Errorf("stem(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Test SortSearchResults by title
func TestSortSearchResults_ByTitle(t *testing.T) {
	recipes := []models.Recipe{
		{ID: "1", Title: "Zucchini Bread"},
		{ID: "2", Title: "Apple Pie"},
		{ID: "3", Title: "Banana Cake"},
	}

	SortSearchResults(recipes, "title", "asc", "")
	if recipes[0].Title != "Apple Pie" {
		t.Errorf("Expected first recipe to be Apple Pie, got %s", recipes[0].Title)
	}
	if recipes[2].Title != "Zucchini Bread" {
		t.Errorf("Expected last recipe to be Zucchini Bread, got %s", recipes[2].Title)
	}
}

func TestSortSearchResults_ByTitleDesc(t *testing.T) {
	recipes := []models.Recipe{
		{ID: "1", Title: "Apple Pie"},
		{ID: "2", Title: "Zucchini Bread"},
		{ID: "3", Title: "Banana Cake"},
	}

	SortSearchResults(recipes, "title", "desc", "")
	if recipes[0].Title != "Zucchini Bread" {
		t.Errorf("Expected first recipe to be Zucchini Bread, got %s", recipes[0].Title)
	}
}

func TestSortSearchResults_DefaultSort(t *testing.T) {
	// Default should be createdAt desc
	recipes := []models.Recipe{
		{ID: "1", Title: "Old Recipe"},
		{ID: "2", Title: "New Recipe"},
	}

	// Just ensure it doesn't panic
	SortSearchResults(recipes, "", "", "")
}

// Test calculateRelevanceScore
func TestCalculateRelevanceScore_EmptyQuery(t *testing.T) {
	recipe := models.Recipe{Title: "Chicken Soup"}
	score := calculateRelevanceScore(recipe, "")
	if score != 0.0 {
		t.Errorf("Expected 0.0 for empty query, got %f", score)
	}
}

func TestCalculateRelevanceScore_TitleMatch(t *testing.T) {
	recipe := models.Recipe{Title: "Chicken Soup"}
	score := calculateRelevanceScore(recipe, "chicken")
	if score <= 0 {
		t.Errorf("Expected positive score for title match, got %f", score)
	}
}

func TestCalculateRelevanceScore_ExactPhraseBonus(t *testing.T) {
	recipe := models.Recipe{Title: "Chicken Soup Recipe"}
	exactScore := calculateRelevanceScore(recipe, "chicken soup")
	singleScore := calculateRelevanceScore(recipe, "chicken")
	if exactScore <= singleScore {
		t.Errorf("Expected exact phrase to score higher (%f vs %f)", exactScore, singleScore)
	}
}

func TestCalculateRelevanceScore_TagMatch(t *testing.T) {
	recipe := models.Recipe{
		Title: "Some Recipe",
		Tags:  []string{"Italian", "Pasta"},
	}
	score := calculateRelevanceScore(recipe, "pasta")
	if score <= 0 {
		t.Errorf("Expected positive score for tag match, got %f", score)
	}
}

func TestCalculateRelevanceScore_IngredientMatch(t *testing.T) {
	recipe := models.Recipe{
		Title:       "Some Recipe",
		Ingredients: []models.Ingredient{{Text: "2 cups flour"}},
	}
	score := calculateRelevanceScore(recipe, "flour")
	if score <= 0 {
		t.Errorf("Expected positive score for ingredient match, got %f", score)
	}
}

func TestCalculateRelevanceScore_InstructionMatch(t *testing.T) {
	recipe := models.Recipe{
		Title:        "Some Recipe",
		Instructions: []models.Instruction{{Text: "Bake at 350 degrees"}},
	}
	score := calculateRelevanceScore(recipe, "bake")
	if score <= 0 {
		t.Errorf("Expected positive score for instruction match, got %f", score)
	}
}

func TestSortSearchResults_ByRelevance(t *testing.T) {
	recipes := []models.Recipe{
		{ID: "1", Title: "Beef Stew"}, // Low relevance for "chicken"
		{ID: "2", Title: "Chicken Soup"},       // High relevance
		{ID: "3", Title: "Chicken Fried Rice"}, // High relevance
	}

	SortSearchResults(recipes, "relevance", "desc", "chicken")
	// Recipes with "chicken" in title should come first
	if recipes[0].Title != "Chicken Soup" && recipes[0].Title != "Chicken Fried Rice" {
		t.Errorf("Expected chicken recipe first, got %s", recipes[0].Title)
	}
	if recipes[2].Title != "Beef Stew" {
		t.Errorf("Expected Beef Stew last, got %s", recipes[2].Title)
	}
}

// Test matchesSearchCriteria basic search
func TestMatchesSearchCriteria_BasicSearch(t *testing.T) {
	recipe := models.Recipe{
		Title: "Chicken Soup",
		Ingredients: []models.Ingredient{
			{Text: "1 cup chicken broth"},
			{Text: "2 carrots, diced"},
		},
		Instructions: []models.Instruction{
			{Text: "Boil the broth"},
		},
	}

	// Title match
	if !matchesSearchCriteria(recipe, "chicken", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to match 'chicken' search")
	}

	// Ingredient match
	if !matchesSearchCriteria(recipe, "carrots", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to match 'carrots' search")
	}

	// No match
	if matchesSearchCriteria(recipe, "beef", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe NOT to match 'beef' search")
	}
}

// Test matchesSearchCriteria with time filters
func TestMatchesSearchCriteria_TimeFilters(t *testing.T) {
	prepTime := 30
	cookTime := 45
	recipe := models.Recipe{
		Title:           "Quick Pasta",
		PrepTimeMinutes: &prepTime,
		CookTimeMinutes: &cookTime,
	}

	// Max prep time filter - should pass
	maxPrep := 60
	if !matchesSearchCriteria(recipe, "", &maxPrep, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to pass max prep time filter")
	}

	// Max prep time filter - should fail
	maxPrep = 15
	if matchesSearchCriteria(recipe, "", &maxPrep, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to fail max prep time filter")
	}

	// Max cook time filter - should pass
	maxCook := 60
	if !matchesSearchCriteria(recipe, "", nil, &maxCook, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to pass max cook time filter")
	}

	// Max cook time filter - should fail
	maxCook = 30
	if matchesSearchCriteria(recipe, "", nil, &maxCook, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to fail max cook time filter")
	}
}

// Test matchesSearchCriteria with comma-separated search
func TestMatchesSearchCriteria_MultipleSearchTerms(t *testing.T) {
	recipe := models.Recipe{
		Title: "Beef Tacos",
	}

	// "chicken, beef" should match (OR logic)
	if !matchesSearchCriteria(recipe, "chicken, beef", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to match 'chicken, beef' (OR logic)")
	}

	// "chicken, pork" should NOT match
	if matchesSearchCriteria(recipe, "chicken, pork", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe NOT to match 'chicken, pork'")
	}
}

// Test matchesSearchCriteria with tags
func TestMatchesSearchCriteria_TagSearch(t *testing.T) {
	recipe := models.Recipe{
		Title: "Some Recipe",
		Tags:  []string{"Italian", "Quick", "Easy"},
	}

	// Tag match
	if !matchesSearchCriteria(recipe, "italian", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to match 'italian' tag search")
	}

	// Tag match (partial)
	if !matchesSearchCriteria(recipe, "quick", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to match 'quick' tag search")
	}
}

// Test matchesSearchCriteria with source filter
func TestMatchesSearchCriteria_SourceFilter(t *testing.T) {
	recipe := models.Recipe{
		Title:     "Recipe",
		SourceURL: "https://www.allrecipes.com/recipe/12345",
	}

	// Should match source
	if !matchesSearchCriteria(recipe, "", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "allrecipes") {
		t.Error("Expected recipe to match source filter 'allrecipes'")
	}

	// Should NOT match different source
	if matchesSearchCriteria(recipe, "", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "foodnetwork") {
		t.Error("Expected recipe NOT to match source filter 'foodnetwork'")
	}
}

// Test empty search query (should match all)
func TestMatchesSearchCriteria_EmptyQuery(t *testing.T) {
	recipe := models.Recipe{
		Title: "Any Recipe",
	}

	// Empty query should match
	if !matchesSearchCriteria(recipe, "", nil, nil, nil, nil, nil, nil, nil, nil, nil, "", "", "") {
		t.Error("Expected recipe to match empty search query")
	}
}
