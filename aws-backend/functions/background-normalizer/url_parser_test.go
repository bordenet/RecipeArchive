package main

import (
	"testing"
)

// Test isPlaceholderRecipe with empty title
func TestIsPlaceholderRecipe_EmptyTitle(t *testing.T) {
	recipe := &Recipe{
		Title:        "",
		Ingredients:  []Ingredient{{Text: "flour"}},
		Instructions: []Instruction{{Text: "mix"}},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with empty title to be placeholder")
	}
}

// Test isPlaceholderRecipe with "Manual Recipe Entry" title
func TestIsPlaceholderRecipe_ManualEntry(t *testing.T) {
	recipe := &Recipe{
		Title:        "Manual Recipe Entry",
		Ingredients:  []Ingredient{{Text: "flour"}},
		Instructions: []Instruction{{Text: "mix"}},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with 'Manual Recipe Entry' title to be placeholder")
	}
}

// Test isPlaceholderRecipe with "Temporary Title"
func TestIsPlaceholderRecipe_TemporaryTitle(t *testing.T) {
	recipe := &Recipe{
		Title:        "Temporary Title",
		Ingredients:  []Ingredient{{Text: "flour"}},
		Instructions: []Instruction{{Text: "mix"}},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with 'Temporary Title' to be placeholder")
	}
}

// Test isPlaceholderRecipe with empty ingredients
func TestIsPlaceholderRecipe_EmptyIngredients(t *testing.T) {
	recipe := &Recipe{
		Title:        "Chocolate Cake",
		Ingredients:  []Ingredient{},
		Instructions: []Instruction{{Text: "mix"}},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with empty ingredients to be placeholder")
	}
}

// Test isPlaceholderRecipe with empty instructions
func TestIsPlaceholderRecipe_EmptyInstructions(t *testing.T) {
	recipe := &Recipe{
		Title:        "Chocolate Cake",
		Ingredients:  []Ingredient{{Text: "flour"}},
		Instructions: []Instruction{},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with empty instructions to be placeholder")
	}
}

// Test isPlaceholderRecipe with temporary ingredient
func TestIsPlaceholderRecipe_TemporaryIngredient(t *testing.T) {
	recipe := &Recipe{
		Title:        "Chocolate Cake",
		Ingredients:  []Ingredient{{Text: "Temporary ingredient"}},
		Instructions: []Instruction{{Text: "mix"}},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with temporary ingredient to be placeholder")
	}
}

// Test isPlaceholderRecipe with temporary instruction
func TestIsPlaceholderRecipe_TemporaryInstruction(t *testing.T) {
	recipe := &Recipe{
		Title:        "Chocolate Cake",
		Ingredients:  []Ingredient{{Text: "flour"}},
		Instructions: []Instruction{{Text: "Temporary instruction"}},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with temporary instruction to be placeholder")
	}
}

// Test isPlaceholderRecipe with valid recipe
func TestIsPlaceholderRecipe_ValidRecipe(t *testing.T) {
	recipe := &Recipe{
		Title:        "Chocolate Cake",
		Ingredients:  []Ingredient{{Text: "2 cups flour"}, {Text: "1 cup sugar"}},
		Instructions: []Instruction{{Text: "Mix ingredients"}, {Text: "Bake at 350°F"}},
	}

	if isPlaceholderRecipe(recipe) {
		t.Error("Expected valid recipe not to be placeholder")
	}
}

// Test isPlaceholderRecipe with multiple ingredients but one is temporary
func TestIsPlaceholderRecipe_MultipleIngredientsWithTemporary(t *testing.T) {
	recipe := &Recipe{
		Title:        "Chocolate Cake",
		Ingredients:  []Ingredient{{Text: "flour"}, {Text: "sugar"}},
		Instructions: []Instruction{{Text: "mix"}},
	}

	// This should NOT be a placeholder because it has multiple ingredients
	if isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with multiple real ingredients not to be placeholder")
	}
}

// Test isPlaceholderRecipe with multiple instructions but one is temporary
func TestIsPlaceholderRecipe_MultipleInstructionsWithTemporary(t *testing.T) {
	recipe := &Recipe{
		Title:        "Chocolate Cake",
		Ingredients:  []Ingredient{{Text: "flour"}},
		Instructions: []Instruction{{Text: "mix"}, {Text: "bake"}},
	}

	// This should NOT be a placeholder because it has multiple instructions
	if isPlaceholderRecipe(recipe) {
		t.Error("Expected recipe with multiple real instructions not to be placeholder")
	}
}

// Test isPlaceholderRecipe with all placeholder indicators
func TestIsPlaceholderRecipe_AllPlaceholders(t *testing.T) {
	recipe := &Recipe{
		Title:        "",
		Ingredients:  []Ingredient{},
		Instructions: []Instruction{},
	}

	if !isPlaceholderRecipe(recipe) {
		t.Error("Expected completely empty recipe to be placeholder")
	}
}

// Test isRecipeSchema with Recipe type as string
func TestIsRecipeSchema_StringType(t *testing.T) {
	item := map[string]interface{}{
		"@type": "Recipe",
		"name":  "Test Recipe",
	}

	if !isRecipeSchema(item) {
		t.Error("Expected Recipe @type string to be detected")
	}
}

// Test isRecipeSchema with non-Recipe type
func TestIsRecipeSchema_NonRecipe(t *testing.T) {
	item := map[string]interface{}{
		"@type": "WebPage",
		"name":  "Homepage",
	}

	if isRecipeSchema(item) {
		t.Error("Expected WebPage type not to be detected as Recipe")
	}
}

// Test isRecipeSchema with Recipe type as array
func TestIsRecipeSchema_ArrayType(t *testing.T) {
	item := map[string]interface{}{
		"@type": []interface{}{"WebPage", "Recipe"},
		"name":  "Test Recipe",
	}

	if !isRecipeSchema(item) {
		t.Error("Expected Recipe in @type array to be detected")
	}
}

// Test isRecipeSchema with missing @type
func TestIsRecipeSchema_MissingType(t *testing.T) {
	item := map[string]interface{}{
		"name": "Test Recipe",
	}

	if isRecipeSchema(item) {
		t.Error("Expected missing @type not to be detected as Recipe")
	}
}

// Test parseRecipeSchema with basic data
func TestParseRecipeSchema_Basic(t *testing.T) {
	schema := map[string]interface{}{
		"@type": "Recipe",
		"name":  "Chocolate Cake",
		"recipeIngredient": []interface{}{
			"2 cups flour",
			"1 cup sugar",
		},
		"recipeInstructions": []interface{}{
			"Mix ingredients",
			"Bake at 350F",
		},
	}

	recipe := &Recipe{}
	err := parseRecipeSchema(schema, recipe)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if recipe.Title != "Chocolate Cake" {
		t.Errorf("Expected title 'Chocolate Cake', got '%s'", recipe.Title)
	}
	if len(recipe.Ingredients) != 2 {
		t.Errorf("Expected 2 ingredients, got %d", len(recipe.Ingredients))
	}
	if len(recipe.Instructions) != 2 {
		t.Errorf("Expected 2 instructions, got %d", len(recipe.Instructions))
	}
}

// Test parseRecipeSchema with HowToStep instructions
func TestParseRecipeSchema_HowToStep(t *testing.T) {
	schema := map[string]interface{}{
		"@type": "Recipe",
		"name":  "Test Recipe",
		"recipeInstructions": []interface{}{
			map[string]interface{}{"@type": "HowToStep", "text": "Step 1"},
			map[string]interface{}{"@type": "HowToStep", "name": "Step 2"},
		},
	}

	recipe := &Recipe{}
	err := parseRecipeSchema(schema, recipe)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if len(recipe.Instructions) != 2 {
		t.Errorf("Expected 2 instructions, got %d", len(recipe.Instructions))
	}
}

// Test parseRecipeSchema with prepTime and cookTime
func TestParseRecipeSchema_WithTimes(t *testing.T) {
	schema := map[string]interface{}{
		"@type":    "Recipe",
		"name":     "Quick Pasta",
		"prepTime": "PT15M",
		"cookTime": "PT20M",
	}

	recipe := &Recipe{}
	err := parseRecipeSchema(schema, recipe)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if recipe.PrepTimeMinutes.Value == nil || *recipe.PrepTimeMinutes.Value != 15 {
		t.Error("Expected prepTime of 15 minutes")
	}
	if recipe.CookTimeMinutes.Value == nil || *recipe.CookTimeMinutes.Value != 20 {
		t.Error("Expected cookTime of 20 minutes")
	}
}

// Test parseRecipeSchema with recipeYield
func TestParseRecipeSchema_WithServings(t *testing.T) {
	schema := map[string]interface{}{
		"@type":       "Recipe",
		"name":        "Cookies",
		"recipeYield": "12 servings",
	}

	recipe := &Recipe{}
	err := parseRecipeSchema(schema, recipe)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if recipe.Servings.Value == nil || *recipe.Servings.Value != 12 {
		t.Errorf("Expected 12 servings, got %v", recipe.Servings.Value)
	}
}

// Test parseJSONLDData with map containing Recipe
func TestParseJSONLDData_MapWithRecipe(t *testing.T) {
	data := map[string]interface{}{
		"@type": "Recipe",
		"name":  "Test Recipe",
	}

	recipe := &Recipe{}
	err := parseJSONLDData(data, recipe)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if recipe.Title != "Test Recipe" {
		t.Errorf("Expected title 'Test Recipe', got '%s'", recipe.Title)
	}
}

// Test parseJSONLDData with @graph structure
func TestParseJSONLDData_GraphStructure(t *testing.T) {
	data := map[string]interface{}{
		"@graph": []interface{}{
			map[string]interface{}{"@type": "WebPage", "name": "Homepage"},
			map[string]interface{}{"@type": "Recipe", "name": "Graph Recipe"},
		},
	}

	recipe := &Recipe{}
	err := parseJSONLDData(data, recipe)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if recipe.Title != "Graph Recipe" {
		t.Errorf("Expected title 'Graph Recipe', got '%s'", recipe.Title)
	}
}

// Test parseJSONLDData with array of items
func TestParseJSONLDData_Array(t *testing.T) {
	data := []interface{}{
		map[string]interface{}{"@type": "WebPage", "name": "Homepage"},
		map[string]interface{}{"@type": "Recipe", "name": "Array Recipe"},
	}

	recipe := &Recipe{}
	err := parseJSONLDData(data, recipe)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if recipe.Title != "Array Recipe" {
		t.Errorf("Expected title 'Array Recipe', got '%s'", recipe.Title)
	}
}

// Test parseJSONLDData with no recipe
func TestParseJSONLDData_NoRecipe(t *testing.T) {
	data := map[string]interface{}{
		"@type": "WebPage",
		"name":  "Homepage",
	}

	recipe := &Recipe{}
	err := parseJSONLDData(data, recipe)

	if err == nil {
		t.Error("Expected error when no recipe found")
	}
}
