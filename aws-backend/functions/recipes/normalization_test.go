package main

import (
	"testing"

	"recipe-archive/models"
)

func TestInferTimesFromInstructions_BakeTime(t *testing.T) {
	instructions := []models.Instruction{
		{Text: "Mix all ingredients together"},
		{Text: "Bake for 30 minutes at 350F"},
	}

	prepTime, cookTime := inferTimesFromInstructions(instructions)
	if prepTime != 15 {
		t.Errorf("Expected default prepTime 15, got %d", prepTime)
	}
	if cookTime != 30 {
		t.Errorf("Expected cookTime 30, got %d", cookTime)
	}
}

func TestInferTimesFromInstructions_WithChopPrep(t *testing.T) {
	instructions := []models.Instruction{
		{Text: "Chop the onions and dice the garlic"},
		{Text: "Cook for 20 minutes"},
	}

	prepTime, cookTime := inferTimesFromInstructions(instructions)
	if prepTime != 20 {
		t.Errorf("Expected prepTime 20 (due to chopping), got %d", prepTime)
	}
	if cookTime != 20 {
		t.Errorf("Expected cookTime 20, got %d", cookTime)
	}
}

func TestInferTimesFromInstructions_NoTimeFound(t *testing.T) {
	instructions := []models.Instruction{
		{Text: "Mix ingredients"},
		{Text: "Bake until golden brown"},
	}

	prepTime, cookTime := inferTimesFromInstructions(instructions)
	if prepTime != 15 {
		t.Errorf("Expected default prepTime 15, got %d", prepTime)
	}
	if cookTime != 25 {
		t.Errorf("Expected default cookTime 25, got %d", cookTime)
	}
}

func TestInferTimesFromInstructions_VariousTimes(t *testing.T) {
	tests := []struct {
		name             string
		instructions     []models.Instruction
		expectedCookTime int
	}{
		{"25 minutes", []models.Instruction{{Text: "Bake for 25 minutes"}}, 25},
		{"15 mins", []models.Instruction{{Text: "Cook for 15 mins"}}, 15},
		{"45 minutes", []models.Instruction{{Text: "Roast for 45 minutes"}}, 45},
		{"1 hour", []models.Instruction{{Text: "Bake for 1 hour"}}, 60},
		{"60 minutes", []models.Instruction{{Text: "Cook for 60 minutes"}}, 60},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, cookTime := inferTimesFromInstructions(tt.instructions)
			if cookTime != tt.expectedCookTime {
				t.Errorf("Expected cookTime %d, got %d", tt.expectedCookTime, cookTime)
			}
		})
	}
}

func TestInferServingsFromIngredients_ChickenBreasts(t *testing.T) {
	ingredients := []models.Ingredient{
		{Text: "4 chicken breasts"},
		{Text: "1 cup rice"},
	}

	servings := inferServingsFromIngredients(ingredients)
	if servings != 4 {
		t.Errorf("Expected 4 servings, got %d", servings)
	}
}

func TestInferServingsFromIngredients_Pasta(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		expected int
	}{
		{"1 pound pasta", "1 pound pasta", 6},
		{"16 oz spaghetti", "16 oz spaghetti", 6},
		{"8 oz pasta", "8 oz pasta", 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ingredients := []models.Ingredient{{Text: tt.text}}
			servings := inferServingsFromIngredients(ingredients)
			if servings != tt.expected {
				t.Errorf("Expected %d servings, got %d", tt.expected, servings)
			}
		})
	}
}

func TestInferServingsFromIngredients_DefaultServings(t *testing.T) {
	// Simple recipe with few ingredients defaults to 2
	simple := []models.Ingredient{
		{Text: "1 cup flour"},
		{Text: "1 egg"},
	}
	if servings := inferServingsFromIngredients(simple); servings != 2 {
		t.Errorf("Expected 2 servings for simple recipe, got %d", servings)
	}

	// Complex recipe with many ingredients defaults to 4
	complex := []models.Ingredient{
		{Text: "1 cup flour"}, {Text: "2 eggs"}, {Text: "1 cup milk"},
		{Text: "salt"}, {Text: "pepper"}, {Text: "1 onion"},
		{Text: "2 cloves garlic"}, {Text: "1 cup cheese"}, {Text: "herbs"},
	}
	if servings := inferServingsFromIngredients(complex); servings != 4 {
		t.Errorf("Expected 4 servings for complex recipe, got %d", servings)
	}
}

func TestInferBasicTags_CuisineTags(t *testing.T) {
	tests := []struct {
		title       string
		expectedTag string
	}{
		{"Italian Pasta Carbonara", "Italian"},
		{"Pasta Primavera", "Italian"},
		{"Beef Tacos", "Mexican"},
		{"Chicken Burrito Bowl", "Mexican"},
		{"Caesar Salad", "Salad"},
		{"Tomato Soup", "Soup"},
		{"Grilled Chicken", "Chicken"},
		{"Beef Stroganoff", "Beef"},
	}

	for _, tt := range tests {
		t.Run(tt.title, func(t *testing.T) {
			tags := inferBasicTags(tt.title, nil, nil)
			found := false
			for _, tag := range tags {
				if tag == tt.expectedTag {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("Expected tag %s in %v for title %s", tt.expectedTag, tags, tt.title)
			}
		})
	}
}

func TestInferBasicTags_CookingMethodTags(t *testing.T) {
	tests := []struct {
		name        string
		instruction string
		expectedTag string
	}{
		{"baked", "Bake in the oven for 30 minutes", "Baked"},
		{"oven", "Place in oven at 350F", "Baked"},
		{"grilled", "Grill over medium heat", "Grilled"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			instructions := []models.Instruction{{Text: tt.instruction}}
			tags := inferBasicTags("Test Recipe", nil, instructions)
			found := false
			for _, tag := range tags {
				if tag == tt.expectedTag {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("Expected tag %s in %v", tt.expectedTag, tags)
			}
		})
	}
}

func TestInferBasicTags_ComplexityTags(t *testing.T) {
	tests := []struct {
		name         string
		numSteps     int
		expectedTag  string
	}{
		{"simple", 2, "Simple"},
		{"simple edge", 3, "Simple"},
		{"moderate", 5, "Moderate"},
		{"moderate edge", 6, "Moderate"},
		{"complex", 8, "Complex"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			instructions := make([]models.Instruction, tt.numSteps)
			for i := 0; i < tt.numSteps; i++ {
				instructions[i] = models.Instruction{Text: "Step"}
			}
			tags := inferBasicTags("Test", nil, instructions)
			found := false
			for _, tag := range tags {
				if tag == tt.expectedTag {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("Expected complexity tag %s in %v for %d steps", tt.expectedTag, tags, tt.numSteps)
			}
		})
	}
}

func TestInferBasicTags_VegetableTag(t *testing.T) {
	ingredients := []models.Ingredient{
		{Text: "2 tomatoes, diced"},
		{Text: "1 carrot, sliced"},
	}
	tags := inferBasicTags("Garden Bowl", ingredients, nil)
	found := false
	for _, tag := range tags {
		if tag == "Vegetables" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Expected Vegetables tag in %v", tags)
	}
}

func TestApplyBasicNormalization_InfersTimes(t *testing.T) {
	recipe := models.Recipe{
		Title: "Test Recipe",
		Instructions: []models.Instruction{
			{Text: "Chop vegetables"},
			{Text: "Bake for 30 minutes"},
		},
	}

	normalized, err := applyBasicNormalization(recipe)
	if err != nil {
		t.Fatalf("Expected normalization to succeed, got error: %v", err)
	}
	if normalized.PrepTimeMinutes == nil || *normalized.PrepTimeMinutes != 20 {
		t.Errorf("Expected prepTime 20 (chop), got %v", normalized.PrepTimeMinutes)
	}
	if normalized.CookTimeMinutes == nil || *normalized.CookTimeMinutes != 30 {
		t.Errorf("Expected cookTime 30, got %v", normalized.CookTimeMinutes)
	}
	if normalized.TotalTimeMinutes == nil || *normalized.TotalTimeMinutes != 50 {
		t.Errorf("Expected totalTime 50, got %v", normalized.TotalTimeMinutes)
	}
}

func TestApplyBasicNormalization_InfersServings(t *testing.T) {
	recipe := models.Recipe{
		Title: "Chicken Dinner",
		Ingredients: []models.Ingredient{
			{Text: "4 chicken breasts"},
		},
	}

	normalized, err := applyBasicNormalization(recipe)
	if err != nil {
		t.Fatalf("Expected normalization to succeed, got error: %v", err)
	}
	if normalized.Servings == nil || *normalized.Servings != 4 {
		t.Errorf("Expected 4 servings, got %v", normalized.Servings)
	}
}

func TestApplyBasicNormalization_InfersTags(t *testing.T) {
	recipe := models.Recipe{
		Title: "Pasta Carbonara",
		Instructions: []models.Instruction{
			{Text: "Boil pasta"},
			{Text: "Mix with sauce"},
		},
	}

	normalized, err := applyBasicNormalization(recipe)
	if err != nil {
		t.Fatalf("Expected normalization to succeed, got error: %v", err)
	}
	if len(normalized.Tags) == 0 {
		t.Error("Expected tags to be inferred")
	}
	found := false
	for _, tag := range normalized.Tags {
		if tag == "Italian" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Expected Italian tag in %v", normalized.Tags)
	}
}

func TestApplyBasicNormalization_NoChangesNeeded(t *testing.T) {
	prepTime := 15
	cookTime := 30
	servings := 4
	recipe := models.Recipe{
		Title:           "Complete Recipe",
		PrepTimeMinutes: &prepTime,
		CookTimeMinutes: &cookTime,
		Servings:        &servings,
		Tags:            []string{"Dinner"},
	}

	_, err := applyBasicNormalization(recipe)
	if err == nil {
		t.Error("Expected error when no changes needed")
	}
}

