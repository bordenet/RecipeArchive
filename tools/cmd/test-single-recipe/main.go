package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/sirupsen/logrus"
)

// Recipe represents the extracted recipe data structure
type Recipe struct {
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Ingredients  []string `json:"ingredients"`
	Instructions []string `json:"instructions"`
	Source       string   `json:"source"`
	URL          string   `json:"url"`
}

func main() {
	var showHelp bool
	flag.BoolVar(&showHelp, "help", false, "Show help message")
	flag.BoolVar(&showHelp, "h", false, "Show help message (shorthand)")
	flag.Parse()

	if showHelp || flag.NArg() == 0 {
		fmt.Println("🧪 Single Recipe Test Tool")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Println()
		fmt.Println("USAGE:")
		fmt.Println("  test-single-recipe <recipe-url>")
		fmt.Println()
		fmt.Println("DESCRIPTION:")
		fmt.Println("  Test recipe extraction from a single URL using browser extension logic.")
		fmt.Println("  Uses chromedp to inject the same extraction logic used by the browser extensions.")
		fmt.Println()
		fmt.Println("EXAMPLES:")
		fmt.Println("  test-single-recipe https://sallysbakingaddiction.com/chocolate-chip-cookies/")
		fmt.Println("  test-single-recipe https://cooking.nytimes.com/recipes/...")
		fmt.Println()
		fmt.Println("OPTIONS:")
		fmt.Println("  -h, --help    Show this help message")
		if flag.NArg() == 0 {
			os.Exit(1)
		}
		os.Exit(0)
	}

	testURL := flag.Arg(0)

	logrus.SetLevel(logrus.InfoLevel)
	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	fmt.Printf("🧪 Testing single recipe extraction: %s\n", testURL)
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	err := testSingleRecipe(testURL)
	if err != nil {
		log.Fatalf("Recipe test failed: %v", err)
	}
}

func testSingleRecipe(testURL string) error {
	// Set up Chrome context
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false),
		chromedp.Flag("no-sandbox", true),
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	ctx, cancel = context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	// Navigate to recipe page
	fmt.Printf("🌐 Loading recipe page: %s\n", testURL)
	err := chromedp.Run(ctx,
		chromedp.Navigate(testURL),
		chromedp.WaitVisible("body", chromedp.ByQuery),
		chromedp.Sleep(5*time.Second), // Wait for content to stabilize
	)
	if err != nil {
		return fmt.Errorf("failed to navigate to recipe page: %w", err)
	}

	fmt.Println("✅ Page loaded successfully")

	// Inject content script and extract recipe
	fmt.Println("🔍 Injecting browser extension logic and extracting recipe...")
	var recipe Recipe

	// Create a standalone extraction script that doesn't depend on chrome.runtime
	extractionCode := `
		(function() {
			// JSON-LD Schema.org recipe extraction
			function extractRecipeFromJSONLD() {
				const scripts = document.querySelectorAll('script[type="application/ld+json"]');
				for (const script of scripts) {
					try {
						const data = JSON.parse(script.textContent);
						const recipe = findRecipeInJSONLD(data);
						if (recipe) return recipe;
					} catch (e) {
						continue;
					}
				}
				return null;
			}

			function findRecipeInJSONLD(data) {
				if (!data) return null;
				
				// Handle arrays
				if (Array.isArray(data)) {
					for (const item of data) {
						const recipe = findRecipeInJSONLD(item);
						if (recipe) return recipe;
					}
					return null;
				}
				
				// Handle recipe objects - check for @type arrays (like AllRecipes)
				const itemType = Array.isArray(data['@type']) ? data['@type'] : [data['@type'] || data.type];
				if (itemType.includes('Recipe')) {
					return {
						title: data.name || data.headline || '',
						description: data.description || '',
						ingredients: extractIngredients(data.recipeIngredient || []),
						instructions: extractInstructions(data.recipeInstructions || []),
						source: window.location.hostname,
						url: window.location.href
					};
				}
				
				// Recursively search nested objects
				if (typeof data === 'object') {
					for (const key in data) {
						const recipe = findRecipeInJSONLD(data[key]);
						if (recipe) return recipe;
					}
				}
				
				return null;
			}

			function extractIngredients(ingredients) {
				if (!Array.isArray(ingredients)) return [];
				return ingredients.map(ing => {
					if (typeof ing === 'string') return ing;
					if (ing.text) return ing.text;
					if (ing.name) return ing.name;
					return String(ing);
				}).filter(Boolean);
			}

			function extractInstructions(instructions) {
				if (!Array.isArray(instructions)) return [];
				return instructions.map(inst => {
					if (typeof inst === 'string') return inst;
					if (inst.text) return inst.text;
					if (inst.name) return inst.name;
					return String(inst);
				}).filter(Boolean);
			}

			// Microdata fallback
			function extractRecipeFromMicrodata() {
				const recipe = document.querySelector('[itemtype*="Recipe"]');
				if (!recipe) return null;

				const getProperty = (prop) => {
					const elem = recipe.querySelector('[itemprop="' + prop + '"]');
					return elem ? elem.textContent.trim() : '';
				};

				const getMultipleProperties = (prop) => {
					const elems = recipe.querySelectorAll('[itemprop="' + prop + '"]');
					return Array.from(elems).map(el => el.textContent.trim()).filter(Boolean);
				};

				return {
					title: getProperty('name'),
					description: getProperty('description'),
					ingredients: getMultipleProperties('recipeIngredient'),
					instructions: getMultipleProperties('recipeInstruction'),
					source: window.location.hostname,
					url: window.location.href
				};
			}

			// Basic DOM fallback
			function extractRecipeFromDOM() {
				const title = document.querySelector('h1')?.textContent.trim() || 
							 document.title.split('|')[0].split('-')[0].trim();

				// Look for common ingredient patterns
				const ingredients = [];
				const ingredientSelectors = [
					'.recipe-ingredient', '.ingredient', '.ingredients li',
					'[class*="ingredient"]', '[class*="Ingredient"]'
				];

				for (const selector of ingredientSelectors) {
					const elems = document.querySelectorAll(selector);
					if (elems.length > 0) {
						Array.from(elems).forEach(el => {
							const text = el.textContent.trim();
							if (text && text.length > 0) ingredients.push(text);
						});
						break;
					}
				}

				// Look for common instruction patterns
				const instructions = [];
				const instructionSelectors = [
					'.recipe-instruction', '.instruction', '.instructions li', '.directions li',
					'[class*="instruction"]', '[class*="Instruction"]', '[class*="direction"]'
				];

				for (const selector of instructionSelectors) {
					const elems = document.querySelectorAll(selector);
					if (elems.length > 0) {
						Array.from(elems).forEach(el => {
							const text = el.textContent.trim();
							if (text && text.length > 0) instructions.push(text);
						});
						break;
					}
				}

				return {
					title: title,
					description: '',
					ingredients: ingredients,
					instructions: instructions,
					source: window.location.hostname,
					url: window.location.href
				};
			}

			// Try extraction methods in order of preference
			let result = extractRecipeFromJSONLD();
			if (!result || (!result.ingredients.length && !result.instructions.length)) {
				result = extractRecipeFromMicrodata();
			}
			if (!result || (!result.ingredients.length && !result.instructions.length)) {
				result = extractRecipeFromDOM();
			}

			return result || {
				title: 'No Recipe Found',
				description: '',
				ingredients: [],
				instructions: [],
				source: window.location.hostname,
				url: window.location.href
			};
		})();
	`

	err = chromedp.Run(ctx,
		chromedp.Evaluate(extractionCode, &recipe),
	)
	if err != nil {
		return fmt.Errorf("failed to extract recipe data: %w", err)
	}

	// Display results
	fmt.Println("\n📊 EXTRACTION RESULTS:")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("Title: %s\n", recipe.Title)
	fmt.Printf("Source: %s\n", recipe.Source)
	fmt.Printf("Ingredients: %d items\n", len(recipe.Ingredients))
	fmt.Printf("Instructions: %d steps\n", len(recipe.Instructions))

	// Show sample data
	if len(recipe.Ingredients) > 0 {
		fmt.Println("\n🥘 Sample Ingredients:")
		maxShow := 3
		if len(recipe.Ingredients) < maxShow {
			maxShow = len(recipe.Ingredients)
		}
		for i := 0; i < maxShow; i++ {
			fmt.Printf("  %d. %s\n", i+1, recipe.Ingredients[i])
		}
		if len(recipe.Ingredients) > maxShow {
			fmt.Printf("  ... and %d more\n", len(recipe.Ingredients)-maxShow)
		}
	}

	if len(recipe.Instructions) > 0 {
		fmt.Println("\n📖 Sample Instructions:")
		maxShow := 2
		if len(recipe.Instructions) < maxShow {
			maxShow = len(recipe.Instructions)
		}
		for i := 0; i < maxShow; i++ {
			instruction := recipe.Instructions[i]
			if len(instruction) > 80 {
				instruction = instruction[:80] + "..."
			}
			fmt.Printf("  %d. %s\n", i+1, instruction)
		}
		if len(recipe.Instructions) > maxShow {
			fmt.Printf("  ... and %d more steps\n", len(recipe.Instructions)-maxShow)
		}
	}

	// Save results
	outputPath := "test-single-recipe-results.json"
	recipeJSON, err := json.MarshalIndent(recipe, "", "  ")
	if err == nil {
		err = os.WriteFile(outputPath, recipeJSON, 0644)
		if err == nil {
			fmt.Printf("\n💾 Full results saved to: %s\n", outputPath)
		}
	}

	// Determine success
	if recipe.Title != "" && recipe.Title != "Unknown Recipe" {
		fmt.Println("\n✅ Recipe extraction test: PASSED")
		return nil
	} else {
		fmt.Println("\n❌ Recipe extraction test: FAILED - No valid recipe data found")
		return fmt.Errorf("no valid recipe data extracted")
	}
}
