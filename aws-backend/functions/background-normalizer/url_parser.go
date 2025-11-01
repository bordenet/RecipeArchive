package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/net/html"
)

// isPlaceholderRecipe checks if recipe needs URL parsing
func isPlaceholderRecipe(recipe *Recipe) bool {
	// Check for empty fields
	if recipe.Title == "" || recipe.Title == "Manual Recipe Entry" ||
		len(recipe.Ingredients) == 0 || len(recipe.Instructions) == 0 {
		return true
	}

	// Check for placeholder content from content-ops tool
	if recipe.Title == "Temporary Title" {
		return true
	}

	// Check for temporary ingredients/instructions
	if len(recipe.Ingredients) == 1 && recipe.Ingredients[0].Text == "Temporary ingredient" {
		return true
	}

	if len(recipe.Instructions) == 1 && recipe.Instructions[0].Text == "Temporary instruction" {
		return true
	}

	return false
}

// parseRecipeFromURL extracts recipe data from a URL using multiple parsing strategies
// If providedHTML is supplied, it will be used instead of fetching the URL
func parseRecipeFromURL(ctx context.Context, url string, providedHTML *string) (*Recipe, error) {
	fmt.Printf("🌐 Parsing recipe from URL: %s\n", url)

	var doc *html.Node
	var err error

	// Use provided HTML if available (mobile share or web extension)
	if providedHTML != nil && len(*providedHTML) > 0 {
		fmt.Printf("✅ Using provided HTML (%d characters) - skipping URL fetch\n", len(*providedHTML))
		doc, err = html.Parse(strings.NewReader(*providedHTML))
		if err != nil {
			return nil, fmt.Errorf("failed to parse provided HTML: %w", err)
		}
	} else {
		// Fallback: Fetch HTML from URL (existing code path)
		fmt.Printf("📡 No HTML provided - fetching from URL\n")

		// Create HTTP request with timeout
		client := &http.Client{
			Timeout: 30 * time.Second,
		}

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		// Set user agent to avoid bot detection
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.5")

		resp, err := client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch URL: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("HTTP error: %d %s", resp.StatusCode, resp.Status)
		}

		// Parse HTML
		doc, err = html.Parse(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to parse HTML: %w", err)
		}
	}

	recipe := &Recipe{
		SourceURL: url,
	}

	fmt.Println("🔍 Attempting multi-tier recipe extraction...")

	// Look for JSON-LD structured data first
	if err := extractJSONLD(doc, recipe); err == nil && recipe.Title != "" {
		fmt.Printf("✅ Successfully extracted recipe using JSON-LD: %s\n", recipe.Title)
		return recipe, nil
	} else {
		fmt.Printf("⚠️ JSON-LD extraction failed: %v\n", err)
	}

	// Try microdata extraction
	if err := extractMicrodata(doc, recipe); err == nil && recipe.Title != "" {
		fmt.Printf("✅ Successfully extracted recipe using microdata: %s\n", recipe.Title)
		return recipe, nil
	} else {
		fmt.Printf("⚠️ Microdata extraction failed: %v\n", err)
	}

	// Try Smitten Kitchen specific extraction
	if strings.Contains(recipe.SourceURL, "smittenkitchen.com") {
		if err := extractSmittenKitchen(doc, recipe); err == nil && recipe.Title != "" {
			fmt.Printf("✅ Successfully extracted recipe using Smitten Kitchen parser: %s\n", recipe.Title)
			return recipe, nil
		} else {
			fmt.Printf("⚠️ Smitten Kitchen extraction failed: %v\n", err)
		}
	}

	// Fall back to common selectors
	if err := extractCommonSelectors(doc, recipe); err == nil && recipe.Title != "" {
		fmt.Printf("✅ Successfully extracted recipe using common selectors: %s\n", recipe.Title)
		return recipe, nil
	} else {
		fmt.Printf("⚠️ Common selectors extraction failed: %v\n", err)
	}

	return nil, fmt.Errorf("no recipe data found using any extraction method")
}

// extractJSONLD extracts recipe from JSON-LD structured data
func extractJSONLD(doc *html.Node, recipe *Recipe) error {
	var traverse func(*html.Node) error
	traverse = func(n *html.Node) error {
		if n.Type == html.ElementNode && n.Data == "script" {
			// Check if it's JSON-LD
			for _, attr := range n.Attr {
				if attr.Key == "type" && attr.Val == "application/ld+json" {
					// Get script content
					if n.FirstChild != nil && n.FirstChild.Type == html.TextNode {
						jsonContent := n.FirstChild.Data

						// Parse JSON
						var data interface{}
						if err := json.Unmarshal([]byte(jsonContent), &data); err != nil {
							continue // Try next script
						}

						// Handle different JSON-LD structures
						if err := parseJSONLDData(data, recipe); err == nil {
							return nil // Success
						}
					}
				}
			}
		}

		// Continue traversing
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if err := traverse(c); err == nil {
				return nil // Found recipe data
			}
		}
		return fmt.Errorf("no JSON-LD recipe found")
	}

	return traverse(doc)
}

// parseJSONLDData parses JSON-LD data structures
func parseJSONLDData(data interface{}, recipe *Recipe) error {
	switch v := data.(type) {
	case map[string]interface{}:
		if isRecipeSchema(v) {
			return parseRecipeSchema(v, recipe)
		}
		// Check for @graph property
		if graph, ok := v["@graph"].([]interface{}); ok {
			for _, item := range graph {
				if itemMap, ok := item.(map[string]interface{}); ok && isRecipeSchema(itemMap) {
					return parseRecipeSchema(itemMap, recipe)
				}
			}
		}
	case []interface{}:
		for _, item := range v {
			if itemMap, ok := item.(map[string]interface{}); ok && isRecipeSchema(itemMap) {
				return parseRecipeSchema(itemMap, recipe)
			}
		}
	}
	return fmt.Errorf("no recipe schema found in JSON-LD")
}

// isRecipeSchema checks if JSON-LD item is a recipe
func isRecipeSchema(item map[string]interface{}) bool {
	if typeVal, exists := item["@type"]; exists {
		switch t := typeVal.(type) {
		case string:
			return t == "Recipe"
		case []interface{}:
			for _, typ := range t {
				if s, ok := typ.(string); ok && s == "Recipe" {
					return true
				}
			}
		}
	}
	return false
}

// parseRecipeSchema parses recipe from JSON-LD schema
func parseRecipeSchema(schema map[string]interface{}, recipe *Recipe) error {
	// Extract title
	if name, ok := schema["name"].(string); ok {
		recipe.Title = name
	}

	// Extract description (Note: Recipe struct doesn't have Description field currently)
	// if desc, ok := schema["description"].(string); ok {
	//     recipe.Description = desc
	// }

	// Extract ingredients
	if ingredients, ok := schema["recipeIngredient"]; ok {
		switch ing := ingredients.(type) {
		case []interface{}:
			for _, ingredient := range ing {
				if str, ok := ingredient.(string); ok {
					recipe.Ingredients = append(recipe.Ingredients, Ingredient{
						Text: str,
					})
				}
			}
		}
	}

	// Extract instructions
	if instructions, ok := schema["recipeInstructions"]; ok {
		switch inst := instructions.(type) {
		case []interface{}:
			for i, instruction := range inst {
				text := ""
				switch instrType := instruction.(type) {
				case string:
					text = instrType
				case map[string]interface{}:
					if t, ok := instrType["text"].(string); ok {
						text = t
					} else if t, ok := instrType["name"].(string); ok {
						text = t
					}
				}
				if text != "" {
					recipe.Instructions = append(recipe.Instructions, Instruction{
						StepNumber: i + 1,
						Text:       text,
					})
				}
			}
		}
	}

	// Extract timing
	if prepTime, ok := schema["prepTime"].(string); ok {
		minutes := parseDuration(prepTime)
		if minutes > 0 {
			recipe.PrepTimeMinutes = FlexInt{Value: &minutes}
		}
	}

	if cookTime, ok := schema["cookTime"].(string); ok {
		minutes := parseDuration(cookTime)
		if minutes > 0 {
			recipe.CookTimeMinutes = FlexInt{Value: &minutes}
		}
	}

	// Extract servings
	if yield, ok := schema["recipeYield"]; ok {
		servings := parseServings(yield)
		if servings > 0 {
			recipe.Servings = FlexInt{Value: &servings}
		}
	}

	return nil
}

// extractMicrodata extracts recipe from microdata
func extractMicrodata(doc *html.Node, recipe *Recipe) error {
	// Look for elements with recipe microdata
	var traverse func(*html.Node) bool
	traverse = func(n *html.Node) bool {
		if n.Type == html.ElementNode {
			// Check for recipe microdata
			for _, attr := range n.Attr {
				if attr.Key == "itemtype" && strings.Contains(attr.Val, "Recipe") {
					extractRecipeFromMicrodata(n, recipe)
					return true
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if traverse(c) {
				return true
			}
		}
		return false
	}

	if traverse(doc) && recipe.Title != "" {
		return nil
	}
	return fmt.Errorf("no microdata recipe found")
}

// extractRecipeFromMicrodata extracts recipe data from microdata container
func extractRecipeFromMicrodata(container *html.Node, recipe *Recipe) {
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode {
			for _, attr := range n.Attr {
				if attr.Key == "itemprop" {
					switch attr.Val {
					case "name":
						recipe.Title = getTextContent(n)
					case "description":
						// Note: Recipe struct doesn't have Description field currently
						// recipe.Description = getTextContent(n)
					case "recipeIngredient":
						recipe.Ingredients = append(recipe.Ingredients, Ingredient{
							Text: getTextContent(n),
						})
					case "recipeInstructions":
						recipe.Instructions = append(recipe.Instructions, Instruction{
							StepNumber: len(recipe.Instructions) + 1,
							Text:       getTextContent(n),
						})
					case "prepTime":
						if content := getTimeContent(n); content != "" {
							minutes := parseDuration(content)
							if minutes > 0 {
								recipe.PrepTimeMinutes = FlexInt{Value: &minutes}
							}
						}
					case "cookTime":
						if content := getTimeContent(n); content != "" {
							minutes := parseDuration(content)
							if minutes > 0 {
								recipe.CookTimeMinutes = FlexInt{Value: &minutes}
							}
						}
					case "recipeYield":
						servings := parseServings(getTextContent(n))
						if servings > 0 {
							recipe.Servings = FlexInt{Value: &servings}
						}
					}
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}

	traverse(container)
}

// getTimeContent gets time content from element (checking datetime attribute)
func getTimeContent(n *html.Node) string {
	// Check for datetime attribute first
	for _, attr := range n.Attr {
		if attr.Key == "datetime" {
			return attr.Val
		}
	}
	// Fall back to text content
	return getTextContent(n)
}

// extractCommonSelectors extracts recipe using common CSS selectors
func extractCommonSelectors(doc *html.Node, recipe *Recipe) error {
	// Title selectors
	titleSelectors := []string{
		"h1.recipe-title", "h1.entry-title", ".recipe-header h1",
		"h1", ".post-title", ".recipe-name", "[data-testid='recipe-title']",
	}
	recipe.Title = findElementBySelectors(doc, titleSelectors)

	// Description selectors (Note: Recipe struct doesn't have Description field currently)
	// descSelectors := []string{
	//     ".recipe-description", ".recipe-summary", ".entry-summary",
	//     ".recipe-intro", "[data-testid='recipe-description']",
	// }
	// recipe.Description = findElementBySelectors(doc, descSelectors)

	// Ingredient selectors
	ingredientSelectors := []string{
		".recipe-ingredient", ".ingredient", ".recipe-ingredients li",
		"[data-testid='recipe-ingredient']", ".ingredients li", "ul.ingredients li",
	}
	ingredientTexts := findListBySelectors(doc, ingredientSelectors)
	for _, text := range ingredientTexts {
		if text != "" {
			recipe.Ingredients = append(recipe.Ingredients, Ingredient{Text: text})
		}
	}

	// Instruction selectors
	instructionSelectors := []string{
		".recipe-instruction", ".instruction", ".recipe-directions li",
		"[data-testid='recipe-instruction']", ".instructions li", "ol.instructions li",
	}
	instructionTexts := findListBySelectors(doc, instructionSelectors)
	for i, text := range instructionTexts {
		if text != "" {
			recipe.Instructions = append(recipe.Instructions, Instruction{
				StepNumber: i + 1,
				Text:       text,
			})
		}
	}

	if recipe.Title != "" && len(recipe.Ingredients) > 0 {
		return nil
	}
	return fmt.Errorf("insufficient recipe data found")
}

// extractSmittenKitchen extracts recipe from Smitten Kitchen's custom format
func extractSmittenKitchen(doc *html.Node, recipe *Recipe) error {
	fmt.Println("🍳 Using Smitten Kitchen-specific parser...")

	// First try microdata for basic data (title, ingredients, servings)
	extractMicrodata(doc, recipe)

	// Now handle the custom instruction format
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode {
			// Look for jetpack-recipe-directions
			for _, attr := range n.Attr {
				if attr.Key == "class" && strings.Contains(attr.Val, "jetpack-recipe-directions") {
					extractSmittenKitchenInstructions(n, recipe)
					return
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(doc)

	if recipe.Title != "" && len(recipe.Ingredients) > 0 {
		return nil
	}
	return fmt.Errorf("insufficient Smitten Kitchen recipe data found")
}

// extractSmittenKitchenInstructions handles the custom multi-method instruction format
func extractSmittenKitchenInstructions(container *html.Node, recipe *Recipe) {
	fmt.Println("📝 Parsing Smitten Kitchen instructions...")

	var instructionTexts []string

	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "li":
				// Each li contains method-specific cooking instructions
				liText := strings.TrimSpace(getTextContent(n))
				if liText != "" && len(liText) > 10 { // Reasonable minimum length for an instruction
					instructionTexts = append(instructionTexts, liText)
				}
			case "p":
				// Paragraphs contain finishing instructions and other important steps
				pText := strings.TrimSpace(getTextContent(n))
				// Include substantial paragraphs that contain cooking instructions
				if pText != "" && len(pText) > 20 &&
					(strings.Contains(strings.ToLower(pText), "finish") ||
						strings.Contains(strings.ToLower(pText), "chicken") ||
						strings.Contains(strings.ToLower(pText), "serve") ||
						strings.Contains(strings.ToLower(pText), "taste") ||
						strings.Contains(strings.ToLower(pText), "season")) {
					instructionTexts = append(instructionTexts, pText)
				}
			default:
				// Continue traversing child nodes
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					traverse(c)
				}
			}
		}
	}
	traverse(container)

	// Convert to recipe instructions, maintaining order from the HTML
	for i, text := range instructionTexts {
		if text != "" {
			recipe.Instructions = append(recipe.Instructions, Instruction{
				StepNumber: i + 1,
				Text:       text,
			})
		}
	}

	fmt.Printf("✅ Extracted %d Smitten Kitchen instructions\n", len(recipe.Instructions))
}
