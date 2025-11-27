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
