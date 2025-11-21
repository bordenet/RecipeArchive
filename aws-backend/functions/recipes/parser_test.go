package main

import (
	"testing"
)

// Test extractJSONLD with valid JSON-LD
func TestExtractJSONLD_ValidRecipe(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@context": "https://schema.org",
					"@type": "Recipe",
					"name": "Chocolate Chip Cookies",
					"author": "Test Author",
					"recipeIngredient": ["2 cups flour", "1 cup sugar"],
					"recipeInstructions": [
						{"@type": "HowToStep", "text": "Mix ingredients"},
						{"@type": "HowToStep", "text": "Bake at 350F"}
					],
					"prepTime": "PT15M",
					"cookTime": "PT12M"
				}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err != nil {
		t.Fatalf("extractJSONLD failed: %v", err)
	}
	if recipe == nil {
		t.Fatal("extractJSONLD returned nil recipe")
	}

	if recipe.Title != "Chocolate Chip Cookies" {
		t.Errorf("Expected title 'Chocolate Chip Cookies', got '%s'", recipe.Title)
	}
	if len(recipe.Ingredients) != 2 {
		t.Errorf("Expected 2 ingredients, got %d", len(recipe.Ingredients))
	}
	if len(recipe.Instructions) != 2 {
		t.Errorf("Expected 2 instructions, got %d", len(recipe.Instructions))
	}
	if recipe.PrepTimeMinutes == nil || *recipe.PrepTimeMinutes != 15 {
		t.Errorf("Expected prepTime 15 minutes, got %v", recipe.PrepTimeMinutes)
	}
	if recipe.CookTimeMinutes == nil || *recipe.CookTimeMinutes != 12 {
		t.Errorf("Expected cookTime 12 minutes, got %v", recipe.CookTimeMinutes)
	}
}

// Test extractJSONLD with @graph structure
func TestExtractJSONLD_GraphStructure(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@context": "https://schema.org",
					"@graph": [
						{"@type": "WebPage", "name": "Homepage"},
						{
							"@type": "Recipe",
							"name": "Test Recipe",
							"recipeIngredient": ["ingredient 1"],
							"recipeInstructions": ["step 1"]
						}
					]
				}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err != nil {
		t.Fatalf("extractJSONLD failed: %v", err)
	}
	if recipe == nil {
		t.Fatal("extractJSONLD returned nil recipe")
	}

	if recipe.Title != "Test Recipe" {
		t.Errorf("Expected title 'Test Recipe', got '%s'", recipe.Title)
	}
}

// Test extractJSONLD with array of recipes
func TestExtractJSONLD_ArrayOfRecipes(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				[
					{"@type": "WebPage", "name": "Homepage"},
					{
						"@type": "Recipe",
						"name": "First Recipe",
						"recipeIngredient": ["ingredient 1"],
						"recipeInstructions": ["step 1"]
					}
				]
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err != nil {
		t.Fatalf("extractJSONLD failed: %v", err)
	}
	if recipe == nil {
		t.Fatal("extractJSONLD returned nil recipe")
	}

	if recipe.Title != "First Recipe" {
		t.Errorf("Expected title 'First Recipe', got '%s'", recipe.Title)
	}
}

// Test extractJSONLD with string instructions
func TestExtractJSONLD_StringInstructions(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@type": "Recipe",
					"name": "Simple Recipe",
					"recipeIngredient": ["ingredient 1"],
					"recipeInstructions": ["Step 1", "Step 2", "Step 3"]
				}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err != nil {
		t.Fatalf("extractJSONLD failed: %v", err)
	}

	if len(recipe.Instructions) != 3 {
		t.Errorf("Expected 3 instructions, got %d", len(recipe.Instructions))
	}
}

// Test extractJSONLD with string image
func TestExtractJSONLD_StringImage(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@type": "Recipe",
					"name": "Test Recipe",
					"image": "https://example.com/image.jpg",
					"recipeIngredient": ["ingredient 1"],
					"recipeInstructions": ["step 1"]
				}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err != nil {
		t.Fatalf("extractJSONLD failed: %v", err)
	}

	if recipe.MainPhotoURL == nil || *recipe.MainPhotoURL != "https://example.com/image.jpg" {
		t.Errorf("Expected image URL 'https://example.com/image.jpg', got %v", recipe.MainPhotoURL)
	}
}

// Test extractJSONLD with array image
func TestExtractJSONLD_ArrayImage(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@type": "Recipe",
					"name": "Test Recipe",
					"image": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
					"recipeIngredient": ["ingredient 1"],
					"recipeInstructions": ["step 1"]
				}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err != nil {
		t.Fatalf("extractJSONLD failed: %v", err)
	}

	if recipe.MainPhotoURL == nil || *recipe.MainPhotoURL != "https://example.com/image1.jpg" {
		t.Errorf("Expected first image URL 'https://example.com/image1.jpg', got %v", recipe.MainPhotoURL)
	}
}

// Test extractJSONLD with object image
func TestExtractJSONLD_ObjectImage(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@type": "Recipe",
					"name": "Test Recipe",
					"image": {"@type": "ImageObject", "url": "https://example.com/image.jpg"},
					"recipeIngredient": ["ingredient 1"],
					"recipeInstructions": ["step 1"]
				}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err != nil {
		t.Fatalf("extractJSONLD failed: %v", err)
	}

	if recipe.MainPhotoURL == nil || *recipe.MainPhotoURL != "https://example.com/image.jpg" {
		t.Errorf("Expected image URL 'https://example.com/image.jpg', got %v", recipe.MainPhotoURL)
	}
}

// Test extractJSONLD with no recipe data
func TestExtractJSONLD_NoRecipe(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@type": "WebPage",
					"name": "Homepage"
				}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err == nil {
		t.Error("Expected error for non-recipe JSON-LD, got nil")
	}
	if recipe != nil {
		t.Error("Expected nil recipe for non-recipe JSON-LD")
	}
}

// Test extractJSONLD with invalid JSON
func TestExtractJSONLD_InvalidJSON(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{invalid json}
				</script>
			</head>
		</html>
	`

	recipe, err := extractJSONLD(html)
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
	if recipe != nil {
		t.Error("Expected nil recipe for invalid JSON")
	}
}

// Test parseHTMLToRecipe with valid JSON-LD
func TestParseHTMLToRecipe_ValidJSONLD(t *testing.T) {
	html := `
		<html>
			<head>
				<script type="application/ld+json">
				{
					"@type": "Recipe",
					"name": "Test Recipe",
					"recipeIngredient": ["ingredient 1"],
					"recipeInstructions": ["step 1"]
				}
				</script>
			</head>
		</html>
	`

	recipe, err := parseHTMLToRecipe(html, "https://example.com/recipe")
	if err != nil {
		t.Fatalf("parseHTMLToRecipe failed: %v", err)
	}
	if recipe == nil {
		t.Fatal("parseHTMLToRecipe returned nil recipe")
	}

	if recipe.SourceURL != "https://example.com/recipe" {
		t.Errorf("Expected sourceURL 'https://example.com/recipe', got '%s'", recipe.SourceURL)
	}
}
