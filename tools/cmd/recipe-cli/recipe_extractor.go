package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"github.com/sirupsen/logrus"
)

func extractRecipe(cookiesFile, testURL string) error {
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

	var err error

	// Load saved cookies if needed
	var cookies []Cookie
	if cookiesFile != "" {
		logrus.Info("🔄 Loading authentication cookies...")
		cookiesData, err := os.ReadFile(cookiesFile)
		if err != nil {
			return fmt.Errorf("failed to read cookies file %s: %w", cookiesFile, err)
		}

		err = json.Unmarshal(cookiesData, &cookies)
		if err != nil {
			return fmt.Errorf("failed to parse cookies: %w", err)
		}

		// Set cookies in browser context
		err = chromedp.Run(ctx,
			chromedp.ActionFunc(func(ctx context.Context) error {
				for _, cookie := range cookies {
					err := network.SetCookie(cookie.Name, cookie.Value).
						WithDomain(cookie.Domain).
						WithPath(cookie.Path).
						WithHTTPOnly(cookie.HTTPOnly).
						WithSecure(cookie.Secure).
						Do(ctx)
					if err != nil {
						logrus.Warnf("Failed to set cookie %s: %v", cookie.Name, err)
					}
				}
				return nil
			}),
		)
		if err != nil {
			return fmt.Errorf("failed to set cookies: %w", err)
		}

		fmt.Printf("✅ Loaded %d cookies\n", len(cookies))
	} else {
		fmt.Println("ℹ️  No authentication cookies needed for this site")
	}

	// Navigate to recipe page
	fmt.Printf("\n🌐 Loading recipe: %s\n", testURL)
	err = chromedp.Run(ctx,
		chromedp.Navigate(testURL),
		chromedp.WaitVisible("body", chromedp.ByQuery),
		chromedp.Sleep(3*time.Second),
	)
	if err != nil {
		return fmt.Errorf("failed to navigate to recipe page: %w", err)
	}

	// Extract recipe data using same logic as browser extension
	fmt.Println("\n🔍 Extracting recipe data...")
	var recipe Recipe

	err = chromedp.Run(ctx,
		chromedp.Evaluate(`(() => {
			// Try JSON-LD first
			const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
			let recipe = null;

			for (const script of jsonLdScripts) {
				try {
					const data = JSON.parse(script.textContent);

					// Handle different JSON-LD structures
					if (data['@type'] === 'Recipe') {
						recipe = data;
						break;
					} else if (Array.isArray(data)) {
						const recipeItem = data.find(item => item['@type'] === 'Recipe');
						if (recipeItem) {
							recipe = recipeItem;
							break;
						}
					} else if (data['@graph']) {
						const recipeItem = data['@graph'].find(item => item['@type'] === 'Recipe');
						if (recipeItem) {
							recipe = recipeItem;
							break;
						}
					}
				} catch (e) {
					console.log('JSON-LD parsing error:', e);
				}
			}

			if (!recipe) {
				// Fallback to manual extraction
				const title = document.querySelector('h1.entry-title, h1, .recipe-title, .post-title')?.textContent?.trim() ||
							 document.querySelector('meta[property="og:title"]')?.content ||
							 'Unknown Recipe';

				const description = document.querySelector('.recipe-description, .entry-summary, meta[name="description"]')?.textContent?.trim() ||
								   document.querySelector('meta[name="description"]')?.content ||
								   document.querySelector('meta[property="og:description"]')?.content ||
								   '';

				// Extract ingredients
				let ingredientElements = document.querySelectorAll('.recipe-ingredient, .ingredient, [data-ingredient], .wp-block-recipe-card-ingredient');
				if (ingredientElements.length === 0) {
					ingredientElements = document.querySelectorAll('li[itemprop="recipeIngredient"], .ingredients li, ul.ingredients li');
				}
				const ingredients = Array.from(ingredientElements).map(el => el.textContent.trim()).filter(Boolean);

				// Extract instructions
				let instructionElements = document.querySelectorAll('.recipe-instruction, .instruction, .directions li, .directions p, [data-instruction]');
				if (instructionElements.length === 0) {
					instructionElements = document.querySelectorAll('li[itemprop="recipeInstructions"], .instructions li, ol.instructions li, .recipe-directions li');
				}
				const instructions = Array.from(instructionElements).map(el => el.textContent.trim()).filter(Boolean);

				recipe = {
					'@type': 'Recipe',
					name: title,
					description: description,
					recipeIngredient: ingredients,
					recipeInstructions: instructions.map(instruction => ({
						'@type': 'HowToStep',
						text: instruction
					}))
				};
			}

			// Convert to our Go structure format
			const result = {
				title: recipe.name || 'Unknown Recipe',
				description: recipe.description || '',
				ingredients: Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [],
				instructions: [],
				source: window.location.hostname,
				url: window.location.href
			};

			// Handle instructions
			if (recipe.recipeInstructions) {
				result.instructions = recipe.recipeInstructions.map(instruction => {
					if (typeof instruction === 'string') {
						return instruction;
					} else if (instruction.text) {
						return instruction.text;
					} else if (instruction.name) {
						return instruction.name;
					}
					return JSON.stringify(instruction);
				});
			}

			// Extract timing information if available
			if (recipe.prepTime) result.prepTime = recipe.prepTime;
			if (recipe.cookTime) result.cookTime = recipe.cookTime;
			if (recipe.totalTime) result.totalTime = recipe.totalTime;
			if (recipe.recipeYield) result.servingSize = recipe.recipeYield.toString();

			return result;
		})()`, &recipe),
	)
	if err != nil {
		return fmt.Errorf("failed to extract recipe data: %w", err)
	}

	// Display results
	fmt.Println("\n📊 Recipe Extraction Results:")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	if recipe.Title != "" {
		fmt.Println("✅ Recipe extraction successful!")
		fmt.Printf("\n📋 Recipe Name: %s\n", recipe.Title)
		if recipe.Description != "" {
			desc := recipe.Description
			if len(desc) > 100 {
				desc = desc[:100] + "..."
			}
			fmt.Printf("📝 Description: %s\n", desc)
		}
		fmt.Printf("🥘 Ingredients: %d found\n", len(recipe.Ingredients))
		fmt.Printf("📖 Instructions: %d steps found\n", len(recipe.Instructions))

		// Show sample ingredients
		if len(recipe.Ingredients) > 0 {
			fmt.Println("\n🥘 Sample Ingredients:")
			maxShow := 3
			if len(recipe.Ingredients) < maxShow {
				maxShow = len(recipe.Ingredients)
			}
			for i := 0; i < maxShow; i++ {
				fmt.Printf("   %d. %s\n", i+1, recipe.Ingredients[i])
			}
			if len(recipe.Ingredients) > maxShow {
				fmt.Printf("   ... and %d more\n", len(recipe.Ingredients)-maxShow)
			}
		}

		// Show sample instructions
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
				fmt.Printf("   %d. %s\n", i+1, instruction)
			}
			if len(recipe.Instructions) > maxShow {
				fmt.Printf("   ... and %d more steps\n", len(recipe.Instructions)-maxShow)
			}
		}

		// Save full data
		outputPath := "extracted-recipe.json"
		recipeJSON, err := json.MarshalIndent(recipe, "", "  ")
		if err == nil {
			err = os.WriteFile(outputPath, recipeJSON, 0644)
			if err == nil {
				fmt.Printf("\n💾 Full recipe data saved to: %s\n", outputPath)
			}
		}

	} else {
		fmt.Println("❌ No recipe data found")
	}

	return nil
}
