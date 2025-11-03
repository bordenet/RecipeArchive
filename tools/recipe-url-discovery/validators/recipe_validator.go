package validators

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// Recipe matches the TypeScript Recipe interface
type Recipe struct {
	Title        string        `json:"title"`
	Source       string        `json:"source"`
	Ingredients  []Ingredient  `json:"ingredients"`
	Instructions []Instruction `json:"instructions"`
	Author       string        `json:"author,omitempty"`
	ImageURL     string        `json:"imageUrl,omitempty"`
	PrepTime     string        `json:"prepTime,omitempty"`
	CookTime     string        `json:"cookTime,omitempty"`
	TotalTime    string        `json:"totalTime,omitempty"`
	Servings     string        `json:"servings,omitempty"`
	Notes        []string      `json:"notes,omitempty"`
	Tags         []string      `json:"tags,omitempty"`
}

type Ingredient struct {
	Text string `json:"text"`
}

type Instruction struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
}

// ValidationResult contains the validation outcome
type ValidationResult struct {
	URL              string
	IsValid          bool
	QualityScore     int
	Recipe           *Recipe
	ErrorMessage     string
	ValidationErrors []string
}

// RecipeValidator validates recipe URLs using the TypeScript parser
type RecipeValidator struct {
	parserBundlePath string
}

// NewRecipeValidator creates a new recipe validator
func NewRecipeValidator(parserBundlePath string) *RecipeValidator {
	return &RecipeValidator{
		parserBundlePath: parserBundlePath,
	}
}

// ValidateURL fetches and validates a recipe URL
func (v *RecipeValidator) ValidateURL(url string, minIngredients, minInstructions int) (*ValidationResult, error) {
	// Step 1: Use Node.js + Playwright to fetch page and run parser
	// This matches exactly how the E2E tests work

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create a temporary Node.js script that:
	// 1. Launches Playwright browser
	// 2. Navigates to URL
	// 3. Injects parser bundle
	// 4. Runs TypeScriptParser.extractRecipeFromPage()
	// 5. Outputs JSON to stdout

	scriptContent := fmt.Sprintf(`
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'RecipeArchive-URLDiscovery/1.0 (Educational Project)'
    });
    const page = await context.newPage();

    try {
        await page.goto('%s', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Inject parser bundle
        const parserBundle = fs.readFileSync('%s', 'utf-8');
        await page.addScriptTag({ content: parserBundle });
        await page.waitForTimeout(5000);

        // Run parser
        const result = await page.evaluate(() => {
            if (window.TypeScriptParser && window.TypeScriptParser.extractRecipeFromPage) {
                return window.TypeScriptParser.extractRecipeFromPage();
            }
            return { error: 'Parser not loaded' };
        });

        console.log(JSON.stringify(result));
    } catch (error) {
        console.log(JSON.stringify({ error: error.message }));
    } finally {
        await browser.close();
    }
})();
`, url, v.parserBundlePath)

	// Write script to temp file
	tmpfile, err := os.CreateTemp("", "recipe_parser_*.js")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer func() { _ = os.Remove(tmpfile.Name()) }()
	defer func() { _ = tmpfile.Close() }()

	if _, err := tmpfile.WriteString(scriptContent); err != nil {
		return nil, fmt.Errorf("failed to write script to temp file: %w", err)
	}

	cmd := exec.CommandContext(ctx, "node", tmpfile.Name())
	cmd.Dir = "../../"
	cmd.Env = os.Environ()
	nodeModulesPath, absErr := filepath.Abs("../../node_modules")
	if absErr != nil {
		return nil, fmt.Errorf("failed to get absolute path to node_modules: %w", absErr)
	}
	cmd.Env = append(cmd.Env, "NODE_PATH=" + nodeModulesPath)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	if err != nil {
		return &ValidationResult{
			URL:          url,
			IsValid:      false,
			ErrorMessage: fmt.Sprintf("Failed to run parser: %v, Stderr: %s", err, stderr.String()),
		}, nil
	}

	// Parse result
	var recipe Recipe
	if err := json.Unmarshal(stdout.Bytes(), &recipe); err != nil {
		return &ValidationResult{
			URL:          url,
			IsValid:      false,
			ErrorMessage: fmt.Sprintf("Failed to parse recipe JSON: %v, Stdout: %s, Stderr: %s", err, stdout.String(), stderr.String()),
		}, nil
	}

	// Validate recipe
	result := v.validateRecipe(&recipe, url, minIngredients, minInstructions)
	return result, nil
}

func (v *RecipeValidator) validateRecipe(recipe *Recipe, url string, minIngredients, minInstructions int) *ValidationResult {
	result := &ValidationResult{
		URL:    url,
		Recipe: recipe,
	}

	// Required field validation
	if recipe.Title == "" || len(recipe.Title) > 200 {
		result.ValidationErrors = append(result.ValidationErrors, "Invalid title")
	}

	if recipe.Source != url {
		result.ValidationErrors = append(result.ValidationErrors,
			fmt.Sprintf("Source mismatch: expected %s, got %s", url, recipe.Source))
	}

	if len(recipe.Ingredients) < minIngredients {
		result.ValidationErrors = append(result.ValidationErrors,
			fmt.Sprintf("Insufficient ingredients: %d < %d", len(recipe.Ingredients), minIngredients))
	}

	if len(recipe.Instructions) < minInstructions {
		result.ValidationErrors = append(result.ValidationErrors,
			fmt.Sprintf("Insufficient instructions: %d < %d", len(recipe.Instructions), minInstructions))
	}

	// Validate instruction step numbers
	for i, instruction := range recipe.Instructions {
		expectedStep := i + 1
		if instruction.StepNumber != expectedStep {
			result.ValidationErrors = append(result.ValidationErrors,
				fmt.Sprintf("Invalid step number: step %d has stepNumber %d", expectedStep, instruction.StepNumber))
		}
		if instruction.Text == "" {
			result.ValidationErrors = append(result.ValidationErrors,
				fmt.Sprintf("Empty instruction text at step %d", expectedStep))
		}
	}

	// Validate ingredients
	for i, ingredient := range recipe.Ingredients {
		if ingredient.Text == "" {
			result.ValidationErrors = append(result.ValidationErrors,
				fmt.Sprintf("Empty ingredient text at index %d", i))
		}
	}

	// Calculate quality score
	score := 0
	if recipe.Title != "" {
		score += 10
	}
	if len(recipe.Ingredients) > 0 {
		score += 20
	}
	if len(recipe.Instructions) > 0 {
		score += 20
	}
	if recipe.ImageURL != "" {
		score += 10
	}
	if recipe.PrepTime != "" || recipe.CookTime != "" || recipe.TotalTime != "" {
		score += 10
	}

	// Bonus for quantity
	ingredientBonus := min(len(recipe.Ingredients), 10) * 2
	instructionBonus := min(len(recipe.Instructions), 10) * 2
	score += ingredientBonus + instructionBonus

	result.QualityScore = score
	result.IsValid = len(result.ValidationErrors) == 0 && score >= 70

	if !result.IsValid && len(result.ValidationErrors) > 0 {
		result.ErrorMessage = result.ValidationErrors[0]
	}

	return result
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}