package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"recipe-archive/models"

	"golang.org/x/net/html"
)

// JSONLDRecipe represents the JSON-LD Recipe schema structure
type JSONLDRecipe struct {
	Context            interface{} `json:"@context"`
	Type               interface{} `json:"@type"` // Can be string or []string
	Name               string      `json:"name"`
	Description        string      `json:"description"`
	Author             interface{} `json:"author"` // Can be string or object
	RecipeIngredient   []string    `json:"recipeIngredient"`
	RecipeInstructions interface{} `json:"recipeInstructions"` // Can be string, []string, or []HowToStep
	Image              interface{} `json:"image"`              // Can be string, []string, or object
	PrepTime           string      `json:"prepTime"`
	CookTime           string      `json:"cookTime"`
	TotalTime          string      `json:"totalTime"`
	RecipeYield        interface{} `json:"recipeYield"` // Can be string or number
}

// HowToStep represents a recipe instruction step
type HowToStep struct {
	Type string `json:"@type"`
	Text string `json:"text"`
	Name string `json:"name"`
}

// parseHTMLToRecipe extracts recipe data from HTML content
// This implements the same multi-layered approach as the TypeScript parsers:
// 1. Try JSON-LD extraction (most reliable)
// 2. Fall back to DOM parsing for common patterns
func parseHTMLToRecipe(htmlContent string, sourceURL string) (*models.CreateRecipeRequest, error) {
	// Try JSON-LD extraction first
	recipe, err := extractJSONLD(htmlContent)
	if err == nil && recipe != nil {
		// Validate that we got meaningful data
		if len(recipe.Ingredients) > 0 || len(recipe.Instructions) > 0 {
			recipe.SourceURL = sourceURL
			fmt.Printf("✅ JSON-LD extraction successful: %s (%d ingredients, %d instructions)\n",
				recipe.Title, len(recipe.Ingredients), len(recipe.Instructions))
			return recipe, nil
		}
	}

	// Fallback to DOM parsing (less reliable - requires both ingredients AND instructions)
	fmt.Printf("⚠️ JSON-LD extraction failed or incomplete, trying DOM parsing\n")
	recipe, err = extractFromDOM(htmlContent, sourceURL)
	if err == nil && recipe != nil {
		// DOM parsing is unreliable (grabs all <li> elements), so require BOTH ingredients AND instructions
		// This prevents false positives from blog homepages/listings with random <li> elements
		if len(recipe.Ingredients) > 0 && len(recipe.Instructions) > 0 {
			// Additional validation: reject if we have too many items (likely scraped a whole page)
			if len(recipe.Ingredients) > 50 || len(recipe.Instructions) > 50 {
				fmt.Printf("⚠️ DOM extraction found suspiciously many items (%d ingredients, %d instructions) - likely not a recipe page\n",
					len(recipe.Ingredients), len(recipe.Instructions))
				return nil, fmt.Errorf("DOM parsing found too many items - page may be a blog homepage or listing")
			}
			fmt.Printf("✅ DOM extraction successful: %s (%d ingredients, %d instructions)\n",
				recipe.Title, len(recipe.Ingredients), len(recipe.Instructions))
			return recipe, nil
		}
		fmt.Printf("⚠️ DOM extraction incomplete: %d ingredients, %d instructions (need both)\n",
			len(recipe.Ingredients), len(recipe.Instructions))
	}

	return nil, fmt.Errorf("no recipe data could be extracted from HTML")
}

// extractJSONLD extracts recipe data from JSON-LD structured data
// Handles all the quirks discovered in TypeScript parsers:
// - Control character cleaning (ASCII 0-31)
// - HTML entity decoding
// - @graph structures
// - Array wrapping
// - Nested recipe objects
func extractJSONLD(htmlContent string) (*models.CreateRecipeRequest, error) {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Find all JSON-LD script tags
	var jsonLDScripts []string
	var findScripts func(*html.Node)
	findScripts = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "script" {
			// Check if this is a JSON-LD script
			for _, attr := range n.Attr {
				if attr.Key == "type" && attr.Val == "application/ld+json" {
					// Get the script content
					if n.FirstChild != nil && n.FirstChild.Type == html.TextNode {
						jsonLDScripts = append(jsonLDScripts, n.FirstChild.Data)
					}
					break
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findScripts(c)
		}
	}
	findScripts(doc)

	fmt.Printf("🔍 Found %d JSON-LD scripts\n", len(jsonLDScripts))

	// Try to parse each JSON-LD script
	for i, scriptContent := range jsonLDScripts {
		// Clean the JSON text (same as TypeScript parser)
		cleanedJSON := cleanJSONText(scriptContent)

		var jsonData interface{}
		if err := json.Unmarshal([]byte(cleanedJSON), &jsonData); err != nil {
			fmt.Printf("⚠️ Failed to parse JSON-LD script %d: %v\n", i, err)
			continue
		}

		// Find recipe in the JSON structure
		recipeObj := findRecipeObject(jsonData)
		if recipeObj != nil {
			return convertJSONLDToRecipe(recipeObj), nil
		}
	}

	return nil, fmt.Errorf("no recipe found in JSON-LD scripts")
}

// cleanJSONText removes problematic characters from JSON text
// Implements the same cleaning as TypeScript parser:
// - Removes control characters (ASCII 0-31) that break JSON.parse
// - Fixes undefined values (common in Food52)
// - Normalizes whitespace
func cleanJSONText(text string) string {
	// Remove control characters (ASCII 0-31 and DEL)
	// Build regex dynamically to avoid ESLint no-control-regex equivalent
	controlCharsRemoved := regexp.MustCompile(`[\x00-\x1F\x7F]+`).ReplaceAllString(text, " ")

	// Fix undefined values (Food52 parser issue)
	fixedUndefined := regexp.MustCompile(`:\s*undefined\b`).ReplaceAllString(controlCharsRemoved, ": null")
	fixedUndefined = regexp.MustCompile(`,\s*undefined\b`).ReplaceAllString(fixedUndefined, ", null")
	fixedUndefined = regexp.MustCompile(`\[\s*undefined\b`).ReplaceAllString(fixedUndefined, "[null")

	// Normalize whitespace
	normalized := regexp.MustCompile(`\s+`).ReplaceAllString(fixedUndefined, " ")

	return strings.TrimSpace(normalized)
}

// findRecipeObject recursively searches for a Recipe object in JSON-LD data
// Handles all the nesting patterns found in the wild:
// - Direct Recipe object
// - Recipe in array
// - Recipe in @graph
// - Recipe in mainEntity
func findRecipeObject(obj interface{}) map[string]interface{} {
	if obj == nil {
		return nil
	}

	// Handle maps
	if m, ok := obj.(map[string]interface{}); ok {
		// Check if this is a Recipe object
		if typeVal, exists := m["@type"]; exists {
			if isRecipeType(typeVal) {
				return m
			}
		}

		// Check @graph
		if graph, exists := m["@graph"]; exists {
			if result := findRecipeObject(graph); result != nil {
				return result
			}
		}

		// Check mainEntity
		if mainEntity, exists := m["mainEntity"]; exists {
			if result := findRecipeObject(mainEntity); result != nil {
				return result
			}
		}

		// Check other properties that might contain recipes
		for key, value := range m {
			if strings.Contains(strings.ToLower(key), "recipe") {
				if result := findRecipeObject(value); result != nil {
					return result
				}
			}
		}
	}

	// Handle arrays
	if arr, ok := obj.([]interface{}); ok {
		for _, item := range arr {
			if result := findRecipeObject(item); result != nil {
				return result
			}
		}
	}

	return nil
}

// isRecipeType checks if the @type field indicates a Recipe
// @type can be:
// - string: "Recipe"
// - array: ["Recipe", "Article"]
func isRecipeType(typeVal interface{}) bool {
	switch v := typeVal.(type) {
	case string:
		return v == "Recipe"
	case []interface{}:
		for _, t := range v {
			if str, ok := t.(string); ok && str == "Recipe" {
				return true
			}
		}
	}
	return false
}

// convertJSONLDToRecipe converts JSON-LD recipe object to CreateRecipeRequest
func convertJSONLDToRecipe(jsonLD map[string]interface{}) *models.CreateRecipeRequest {
	recipe := &models.CreateRecipeRequest{}

	// Extract title
	if name, ok := jsonLD["name"].(string); ok {
		recipe.Title = sanitizeText(name)
	}

	// Extract description
	if desc, ok := jsonLD["description"].(string); ok {
		descText := sanitizeText(desc)
		recipe.Description = &descText
	}

	// Extract ingredients
	if ingredients, ok := jsonLD["recipeIngredient"].([]interface{}); ok {
		for _, ing := range ingredients {
			if ingStr, ok := ing.(string); ok {
				text := sanitizeText(ingStr)
				if text != "" {
					recipe.Ingredients = append(recipe.Ingredients, models.Ingredient{
						Text: text,
					})
				}
			}
		}
	}

	// Extract instructions (complex - can be string, array, or HowToStep objects)
	recipe.Instructions = extractInstructions(jsonLD["recipeInstructions"])

	// Extract image URL
	if imageURL := extractImageURL(jsonLD["image"]); imageURL != "" {
		recipe.MainPhotoURL = &imageURL
		fmt.Printf("🖼️ Extracted image URL: %s\n", imageURL)
	} else {
		fmt.Printf("⚠️ No image URL found in JSON-LD\n")
	}

	// Extract times
	if prepTime, ok := jsonLD["prepTime"].(string); ok {
		if minutes := parseISO8601Duration(prepTime); minutes > 0 {
			recipe.PrepTimeMinutes = &minutes
		}
	}
	if cookTime, ok := jsonLD["cookTime"].(string); ok {
		if minutes := parseISO8601Duration(cookTime); minutes > 0 {
			recipe.CookTimeMinutes = &minutes
		}
	}
	if totalTime, ok := jsonLD["totalTime"].(string); ok {
		if minutes := parseISO8601Duration(totalTime); minutes > 0 {
			recipe.TotalTimeMinutes = &minutes
		}
	}

	// Extract yield/servings
	if yieldVal, ok := jsonLD["recipeYield"]; ok {
		switch v := yieldVal.(type) {
		case string:
			if servings := parseServings(v); servings > 0 {
				recipe.Servings = &servings
			}
		case float64:
			servings := int(v)
			recipe.Servings = &servings
		}
	}

	return recipe
}

// extractInstructions handles the various formats of recipe instructions
// Can be:
// - string: "Mix all ingredients. Bake at 350F."
// - []string: ["Mix ingredients", "Bake at 350F"]
// - []HowToStep: [{"@type": "HowToStep", "text": "Mix ingredients"}, ...]
func extractInstructions(instructionsVal interface{}) []models.Instruction {
	var instructions []models.Instruction

	switch v := instructionsVal.(type) {
	case string:
		// Single string - split by periods or newlines
		steps := splitInstructions(v)
		for i, step := range steps {
			if step != "" {
				instructions = append(instructions, models.Instruction{
					StepNumber: i + 1,
					Text:       step,
				})
			}
		}

	case []interface{}:
		stepNum := 1
		for _, item := range v {
			switch itemVal := item.(type) {
			case string:
				text := sanitizeText(itemVal)
				if text != "" {
					instructions = append(instructions, models.Instruction{
						StepNumber: stepNum,
						Text:       text,
					})
					stepNum++
				}

			case map[string]interface{}:
				// HowToStep object
				text := ""
				if textVal, ok := itemVal["text"].(string); ok {
					text = sanitizeText(textVal)
				} else if nameVal, ok := itemVal["name"].(string); ok {
					text = sanitizeText(nameVal)
				}
				if text != "" {
					instructions = append(instructions, models.Instruction{
						StepNumber: stepNum,
						Text:       text,
					})
					stepNum++
				}
			}
		}
	}

	return instructions
}

// extractImageURL extracts image URL from various JSON-LD image formats
// Can be:
// - string: "https://example.com/image.jpg"
// - []string: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
// - object: {"@type": "ImageObject", "url": "https://example.com/image.jpg"}
// - array of objects
func extractImageURL(imageVal interface{}) string {
	switch v := imageVal.(type) {
	case string:
		return v

	case []interface{}:
		if len(v) > 0 {
			// Try first item
			switch first := v[0].(type) {
			case string:
				return first
			case map[string]interface{}:
				if url, ok := first["url"].(string); ok {
					return url
				}
			}
		}

	case map[string]interface{}:
		if url, ok := v["url"].(string); ok {
			return url
		}
	}

	return ""
}

// splitInstructions splits instruction text into individual steps
// Handles common patterns:
// - Period followed by capital letter
// - Semicolon followed by transition words
func splitInstructions(text string) []string {
	text = sanitizeText(text)
	if text == "" {
		return nil
	}

	// Split on period followed by space and capital letter (manual implementation since Go regex doesn't support lookahead)
	periodRe := regexp.MustCompile(`\.\s+[A-Z]`)
	matches := periodRe.FindAllStringIndex(text, -1)

	var periodSplit []string
	lastIdx := 0
	for _, match := range matches {
		// Split before the capital letter (include period and space in previous part)
		periodSplit = append(periodSplit, text[lastIdx:match[1]-1])
		lastIdx = match[1] - 1
	}
	if lastIdx < len(text) {
		periodSplit = append(periodSplit, text[lastIdx:])
	}
	if len(periodSplit) == 0 {
		periodSplit = []string{text}
	}

	var steps []string
	for _, step := range periodSplit {
		step = strings.TrimSpace(step)
		if len(step) > 5 { // Ignore very short steps
			steps = append(steps, step)
		}
	}

	if len(steps) == 0 {
		// Fallback: return whole text as single step
		return []string{text}
	}

	return steps
}

// sanitizeText cleans text by decoding HTML entities and normalizing whitespace
// Implements the same sanitization as TypeScript parser
func sanitizeText(text string) string {
	if text == "" {
		return ""
	}

	// Decode HTML entities
	decoded := decodeHTMLEntities(text)

	// Normalize whitespace
	normalized := regexp.MustCompile(`\s+`).ReplaceAllString(decoded, " ")

	// Remove zero-width characters (using hex notation for Unicode in Go regex)
	cleaned := regexp.MustCompile(`[\x{200B}-\x{200D}\x{FEFF}]`).ReplaceAllString(normalized, "")

	return strings.TrimSpace(cleaned)
}

// decodeHTMLEntities decodes common HTML entities
// Implements the same entity map as TypeScript parser
func decodeHTMLEntities(text string) string {
	// Common HTML entities
	entities := map[string]string{
		// Numeric entities
		"&#8211;": "–",  // En dash
		"&#8212;": "—",  // Em dash
		"&#39;":   "'",  // Apostrophe
		"&#x27;":  "'",  // Apostrophe (hex)
		"&#34;":   "\"", // Double quote
		"&#x22;":  "\"", // Double quote (hex)
		"&#38;":   "&",  // Ampersand
		"&#x26;":  "&",  // Ampersand (hex)
		"&#160;":  " ",  // Non-breaking space
		"&#xa0;":  " ",  // Non-breaking space (hex)

		// Named entities
		"&quot;":   "\"",
		"&apos;":   "'",
		"&amp;":    "&",
		"&lt;":     "<",
		"&gt;":     ">",
		"&nbsp;":   " ",
		"&ndash;":  "–",
		"&mdash;":  "—",
		"&hellip;": "…",
		"&rsquo;":  "'",
		"&lsquo;":  "'",
		"&rdquo;":  "\"",
		"&ldquo;":  "\"",
		"&deg;":    "°",
		"&frac12;": "½",
		"&frac14;": "¼",
		"&frac34;": "¾",
	}

	result := text
	for entity, replacement := range entities {
		result = strings.ReplaceAll(result, entity, replacement)
	}

	// Handle generic numeric entities &#123;
	numericEntityRe := regexp.MustCompile(`&#(\d+);`)
	result = numericEntityRe.ReplaceAllStringFunc(result, func(match string) string {
		// Extract number
		var code int
		if _, err := fmt.Sscanf(match, "&#%d;", &code); err == nil {
			if code > 0 && code < 1114112 { // Valid Unicode range
				return string(rune(code))
			}
		}
		return match
	})

	// Handle generic hex entities &#x1A;
	hexEntityRe := regexp.MustCompile(`&#x([0-9A-Fa-f]+);`)
	result = hexEntityRe.ReplaceAllStringFunc(result, func(match string) string {
		var code int
		if _, err := fmt.Sscanf(strings.ToLower(match), "&#x%x;", &code); err == nil {
			if code > 0 && code < 1114112 { // Valid Unicode range
				return string(rune(code))
			}
		}
		return match
	})

	return result
}

// parseISO8601Duration converts ISO 8601 duration to minutes
// Examples: "PT30M" -> 30, "PT1H30M" -> 90, "PT2H" -> 120
func parseISO8601Duration(duration string) int {
	if duration == "" {
		return 0
	}

	// Remove PT prefix
	duration = strings.TrimPrefix(duration, "PT")
	if duration == "" {
		return 0
	}

	var hours, minutes int

	// Parse hours
	if strings.Contains(duration, "H") {
		if _, err := fmt.Sscanf(duration, "%dH", &hours); err != nil {
			hours = 0
		}
		duration = duration[strings.Index(duration, "H")+1:]
	}

	// Parse minutes
	if strings.Contains(duration, "M") {
		if _, err := fmt.Sscanf(duration, "%dM", &minutes); err != nil {
			minutes = 0
		}
	}

	return hours*60 + minutes
}

// parseServings extracts number of servings from text
// Examples: "4 servings" -> 4, "6" -> 6, "Serves 8" -> 8
func parseServings(text string) int {
	// Try to extract first number
	re := regexp.MustCompile(`\d+`)
	match := re.FindString(text)
	if match != "" {
		var servings int
		if _, err := fmt.Sscanf(match, "%d", &servings); err != nil {
			servings = 0
		}
		return servings
	}
	return 0
}

// extractFromDOM extracts recipe data using DOM patterns
// Fallback when JSON-LD is not available
func extractFromDOM(htmlContent string, sourceURL string) (*models.CreateRecipeRequest, error) {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	recipe := &models.CreateRecipeRequest{
		SourceURL: sourceURL,
	}

	// Extract title from <h1> or <title>
	recipe.Title = extractTitle(doc)

	// Extract ingredients using common selectors
	ingredientSelectors := []string{
		".recipe-ingredients li",
		".ingredients li",
		"[class*=\"ingredient\"] li",
		"ul li[class*=\"ingredient\"]",
	}
	recipe.Ingredients = extractListItems(doc, ingredientSelectors)

	// Extract instructions using common selectors
	instructionSelectors := []string{
		".recipe-instructions li",
		".instructions li",
		".recipe-directions li",
		"[class*=\"instruction\"] li",
		"ol li[class*=\"step\"]",
	}
	instructionTexts := extractListItemsText(doc, instructionSelectors)
	for i, text := range instructionTexts {
		recipe.Instructions = append(recipe.Instructions, models.Instruction{
			StepNumber: i + 1,
			Text:       text,
		})
	}

	// Extract image URL
	if imgURL := extractRecipeImage(doc); imgURL != "" {
		recipe.MainPhotoURL = &imgURL
	}

	if recipe.Title == "" || (len(recipe.Ingredients) == 0 && len(recipe.Instructions) == 0) {
		return nil, fmt.Errorf("insufficient recipe data extracted from DOM")
	}

	return recipe, nil
}

// extractTitle extracts the page title
func extractTitle(doc *html.Node) string {
	var title string

	var findTitle func(*html.Node)
	findTitle = func(n *html.Node) {
		if title != "" {
			return
		}
		if n.Type == html.ElementNode {
			if n.Data == "h1" && n.FirstChild != nil {
				title = sanitizeText(n.FirstChild.Data)
				return
			}
			if n.Data == "title" && n.FirstChild != nil {
				title = sanitizeText(n.FirstChild.Data)
				return
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findTitle(c)
		}
	}
	findTitle(doc)

	return title
}

// hasRecipeClass checks if a node or its ancestors have recipe-related class names
func hasRecipeClass(n *html.Node, keywords []string) bool {
	for n != nil {
		if n.Type == html.ElementNode {
			for _, attr := range n.Attr {
				if attr.Key == "class" || attr.Key == "id" {
					lowerVal := strings.ToLower(attr.Val)
					for _, keyword := range keywords {
						if strings.Contains(lowerVal, keyword) {
							return true
						}
					}
				}
			}
		}
		n = n.Parent
	}
	return false
}

// extractListItems extracts ingredients from list items
func extractListItems(doc *html.Node, selectors []string) []models.Ingredient {
	var ingredients []models.Ingredient
	// Look for <li> elements that are children of recipe-related containers
	recipeKeywords := []string{"ingredient", "recipe"}
	var findLi func(*html.Node)
	findLi = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "li" {
			// Only extract if this <li> is within a recipe-related container
			if hasRecipeClass(n.Parent, recipeKeywords) {
				text := getNodeText(n)
				if text != "" && len(text) > 2 && len(text) < 500 { // Reject very long text (likely not an ingredient)
					ingredients = append(ingredients, models.Ingredient{
						Text: sanitizeText(text),
					})
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findLi(c)
		}
	}
	findLi(doc)
	return ingredients
}

// extractListItemsText extracts text from list items
func extractListItemsText(doc *html.Node, selectors []string) []string {
	var texts []string
	// Look for <li> elements that are children of instruction-related containers
	instructionKeywords := []string{"instruction", "direction", "step", "method", "recipe"}
	var findLi func(*html.Node)
	findLi = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "li" {
			// Only extract if this <li> is within an instruction-related container
			if !hasRecipeClass(n.Parent, instructionKeywords) {
				// Skip this <li>
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					findLi(c)
				}
				return
			}
			text := getNodeText(n)
			if text != "" && len(text) > 5 {
				texts = append(texts, sanitizeText(text))
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findLi(c)
		}
	}
	findLi(doc)
	return texts
}

// getNodeText recursively extracts text content from a node
func getNodeText(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}
	var text string
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		text += getNodeText(c)
	}
	return text
}

// extractRecipeImage finds the first suitable recipe image
func extractRecipeImage(doc *html.Node) string {
	var imageURL string
	recipeKeywords := []string{"recipe", "wp-post-image", "featured", "main"}

	var findImg func(*html.Node)
	findImg = func(n *html.Node) {
		if imageURL != "" {
			return // Already found an image
		}

		if n.Type == html.ElementNode && n.Data == "img" {
			// Check if image is in a recipe-related container
			isRecipeImage := false
			var src string

			// Get the src attribute
			for _, attr := range n.Attr {
				if attr.Key == "src" {
					src = attr.Val
				}
				// Check if img has recipe-related class
				if attr.Key == "class" {
					lowerVal := strings.ToLower(attr.Val)
					for _, keyword := range recipeKeywords {
						if strings.Contains(lowerVal, keyword) {
							isRecipeImage = true
							break
						}
					}
				}
			}

			// Also check parent containers
			if !isRecipeImage {
				isRecipeImage = hasRecipeClass(n.Parent, recipeKeywords)
			}

			// If it's a recipe image and has a valid src, use it
			if isRecipeImage && src != "" && !strings.Contains(src, "gravatar") && !strings.Contains(src, "icon") {
				imageURL = src
				return
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findImg(c)
		}
	}

	findImg(doc)
	return imageURL
}
