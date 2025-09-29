package main

import (
	"encoding/json"
	"fmt"
)

// buildNormalizationPrompt creates the OpenAI prompt for recipe normalization
func buildNormalizationPrompt(recipe *Recipe) string {
	ingredientsJson, _ := json.Marshal(recipe.Ingredients)
	instructionsJson, _ := json.Marshal(recipe.Instructions)

	// Extract current servings info for context
	servingsInfo := "not specified"
	if recipe.Servings.Value != nil {
		servingsInfo = recipe.Servings.String()
	}

	// Extract current time info for context
	timeInfo := "not specified"
	if recipe.PrepTimeMinutes.Value != nil || recipe.CookTimeMinutes.Value != nil || recipe.TotalTime.Value != nil {
		timeInfo = fmt.Sprintf("prep: %s, cook: %s, total: %s", recipe.PrepTimeMinutes.String(), recipe.CookTimeMinutes.String(), recipe.TotalTime.String())
	}

	return fmt.Sprintf(`You are a professional recipe editor for Food & Wine Magazine tasked with normalizing recipe data for consistent storage and presentation.

Input Recipe Data:
- Title: "%s"
- Ingredients: %s
- Instructions: %s
- Current Servings: %s
- Current Times: %s

Please normalize this recipe following these strict guidelines:

SPECIAL INSTRUCTIONS FOR SMOKING/BARBECUE RECIPES:
- PRESERVE ALL EQUIPMENT SETUP STEPS: charcoal preparation, smoker setup, temperature control
- PRESERVE ALL MONITORING STEPS: temperature checks, timing intervals, visual cues, rotation instructions
- PRESERVE ALL DETAILED PROCESSES: chimney lighting, coal arrangement, wood preparation
- MAINTAIN COMPLETE SMOKING WORKFLOW: setup → lighting → temperature control → monitoring → finishing

TITLE NORMALIZATION:
- Use Title Case (capitalize major words, lowercase articles/prepositions)
- IMPORTANT: Apostrophes should NOT capitalize the letter after them (e.g., 'Kylie\'s' not 'Kylie\'S' and 'General Tso\'s' not 'General Tso\'S')
- Remove the trailing word "Recipe" from recipe titles if present

INGREDIENT NORMALIZATION:
- Standardize units (cups, tablespoons, teaspoons, ounces, pounds, grams)
- Use consistent fraction formatting (1/2, 1/4, 3/4)
- Standardize ingredient names (e.g., "all-purpose flour" not "AP flour")

INSTRUCTION NORMALIZATION (CRITICAL - ENHANCED RULES):
- Use imperative voice ("Mix flour" not "You should mix flour")
- ABSOLUTE PRESERVATION RULE: NEVER oversimplify or collapse detailed instructions into generic steps
- MAINTAIN COMPLETE STEP SEQUENCES: Keep all preparation, setup, monitoring, and finishing steps exactly as detailed in original
- INSTRUCTION PRESERVATION MANDATE: Maintain at least 90% of original instruction detail - if original has specific timing, temperatures, visual cues, preserve them ALL
- ANTI-SIMPLIFICATION: If original says "Simmer on low until beans are tender, about 2 1/2 to 3 hours. Stir occasionally" do NOT reduce to "Cook until done"
- CRITICAL TIMING PRESERVATION: NEVER change specific cooking times like "2 1/2 to 3 hours" to generic times like "20 minutes"
- HEAT LEVEL PRESERVATION: ALWAYS preserve heat specifications like "on low", "high heat", "medium-low", etc.
- ENDPOINT PRESERVATION: Keep specific doneness indicators like "until beans are tender", "until vegetables are soft", "until meat shreds easily"
- TECHNIQUE PRESERVATION: Keep stirring instructions, basting directions, monitoring cues exactly as written
- PRESERVE ORIGINAL LANGUAGE: Keep specific phrases like "until the chicken has fallen apart", "help it along by reaching into the pot with two forks and shredding"
- Use consistent temperature formats (375°F, 190°C)
- Standardize timing formats ("10 minutes", "1 hour") but PRESERVE specific timing ranges
- PRESERVE EQUIPMENT SETUP STEPS: Include all equipment preparation and setup instructions
- PRESERVE MONITORING STEPS: Include temperature checks, timing intervals, and visual cues

COOKING METHOD CLASSIFICATION (CRITICAL - ENHANCED RULES):
- MULTI-METHOD PRIORITY: Actively look for recipes that SHOULD have multiple cooking methods based on recipe type and ingredients
- AUTOMATIC MULTI-METHOD DETECTION: Generate multiple cooking methods for these recipe types even if not explicitly stated:
  * CHILI/STEW recipes with beans → Generate Stovetop, Slow Cooker, and Instant Pot methods
  * SOUP recipes with long cooking times → Generate Stovetop and Slow Cooker methods
  * RICE/GRAIN dishes → Generate Stovetop and Rice Cooker methods
  * ROASTED VEGETABLES → Generate Oven and Air Fryer methods
  * GRILLED PROTEINS → Generate Grill and Broiler methods
- INTELLIGENT METHOD GENERATION: When generating multiple methods, preserve original instruction detail while adapting for each method:
  * PRESERVE ORIGINAL STEPS: Keep all original preparation, monitoring, and finishing steps
  * ADAPT TIMING: Adjust cooking times appropriately for each method (Stovetop 2-3 hours, Slow Cooker 6-10 hours, Instant Pot 30 minutes)
  * PRESERVE SPECIFICITY: Maintain specific temperatures, visual cues, stirring instructions, and finishing techniques
  * NEVER OVERSIMPLIFY: A detailed 5-step stovetop recipe should not become a 1-step "add everything and cook" instruction

SEQUENTIAL METHOD-SPECIFIC INSTRUCTION DETECTION (CRITICAL NEW RULES):
- IMPLICIT PATTERN RECOGNITION: When instructions follow a sequential pattern without explicit method labels, analyze instruction content to detect method boundaries:
  * Instructions 1-2: Often shared prep (chopping, mixing, seasoning) → normalizedInstructions
  * Instructions 3+: Often method-specific cooking → separate into cookingMethods based on cooking technique
- COOKING TECHNIQUE ANALYSIS: Identify method-specific instructions by cooking technique keywords:
  * STOVETOP indicators: "heat oil in pot", "bring to boil", "simmer", "stir occasionally", "on stove"
  * SLOW COOKER indicators: "add to slow cooker", "cook on low/high", "6-8 hours", "slow cook"
  * INSTANT POT indicators: "pressure cook", "natural release", "quick release", "pressure cooker"
- SEQUENTIAL BOUNDARY DETECTION: Look for instruction sequences where cooking method changes mid-recipe:
  * Example: Instructions 1-2 (prep) → 3-11 (stovetop method) → 12-18 (slow cooker method)
  * Pattern: Prep steps → First cooking method → Second cooking method
- INSTRUCTION SEGREGATION RULES:
  * SHARED STEPS: Basic prep work that applies to all methods (chopping vegetables, seasoning)
  * METHOD-SPECIFIC STEPS: Actual cooking instructions that vary by cooking method
  * FINISHING STEPS: Final steps that may apply to all methods (adjust seasoning, serve)

SHARED STEPS HANDLING: Put shared preparation steps (chopping, mixing, seasoning) in normalizedInstructions, method-specific cooking in cookingMethods
- CRITICAL NO DUPLICATION RULE: NEVER duplicate any instruction between normalizedInstructions and cookingMethods arrays
- SEQUENTIAL INSTRUCTION MAPPING: When original has sequential instructions (1-18), properly separate:
  * Steps 1-2 (shared prep) → normalizedInstructions
  * Steps 3-11 (first method) → cookingMethods[0].instructions
  * Steps 12-18 (second method) → cookingMethods[1].instructions
- METHOD-SPECIFIC INSTRUCTIONS MANDATORY: Each cooking method MUST have accurate terminology (Stovetop="simmer in pot", Slow Cooker="cook in slow cooker", Instant Pot="pressure cook")
- TIMING INTELLIGENCE: Adjust cooking times appropriately (Slow Cooker=6-8x longer, Instant Pot=4-5x faster than stovetop)

CRITICAL EXAMPLES OF WHAT NOT TO DO:
❌ WRONG: "On the stove: Simmer the ingredients on low until the beans are tender, about 2 1/2 to 3 hours. Stir occasionally." → "Simmer until the chicken has fallen apart, about 20 minutes."
✅ CORRECT: "On the stove: Simmer the ingredients on low until the beans are tender, about 2 1/2 to 3 hours. Stir occasionally." → "Simmer the ingredients on low until the beans are tender, about 2 1/2 to 3 hours. Stir occasionally."

SEQUENTIAL METHOD PATTERN EXAMPLES (CRITICAL):
❌ WRONG APPROACH: Original recipe has 18 instructions where 1-2 are prep, 3-11 are stovetop, 12-18 are slow cooker
   - BAD: Put instructions 3-11 in both normalizedInstructions AND stovetop cookingMethod
   - BAD: Duplicate stovetop instructions in shared section
   - BAD: Ignore sequential pattern and treat all as shared instructions

✅ CORRECT APPROACH: Recognize sequential method boundaries
   - GOOD: Instructions 1-2 → normalizedInstructions (shared prep)
   - GOOD: Instructions 3-11 → cookingMethods[0] "Stovetop" (first cooking method)
   - GOOD: Instructions 12-18 → cookingMethods[1] "Slow Cooker" (second cooking method)
   - GOOD: NO duplication between normalizedInstructions and any cookingMethod

SOUP/NOODLE RECIPE SPECIFIC PATTERN:
- When recipe has instructions like "Heat oil in pot" followed later by "Add to slow cooker"
- This indicates TWO distinct cooking methods, not shared instructions
- Stovetop method: Instructions involving pot, stove, simmering
- Slow Cooker method: Instructions involving slow cooker, low/high settings, longer times

SHARED PREP IDENTIFICATION RULES:
- ALWAYS include basic prep work in normalizedInstructions: "Chop vegetables", "Pull off chicken meat", "Season ingredients"
- These are steps that apply to ALL cooking methods before method-specific cooking begins
- DON'T put method-specific cooking steps (heating oil, adding to slow cooker) in normalizedInstructions
- Example pattern: normalizedInstructions (prep) → cookingMethods (actual cooking for each method)

BEAN/LEGUME COOKING TIMES ARE CRITICAL:
- Dried beans require 2-3 hours on stovetop, 6-10 hours in slow cooker, 30-35 minutes in pressure cooker
- NEVER reduce bean cooking times to "20 minutes" unless using pre-cooked beans
- "Until beans are tender" is the correct endpoint, not "until chicken falls apart"

EXPANDED METHOD ALTERNATIVES (recognize these common trade-offs):
- Stovetop ↔ Oven: "Heat oil in oven-safe skillet on stovetop, then transfer to oven" OR "Cook entirely on stovetop"
- Oven ↔ Air Fryer: "Bake in oven at 400°F" OR "Air fry at 380°F for less time"
- Pressure Cooker ↔ Slow Cooker: "Instant Pot 20 minutes" OR "Slow cooker 6-8 hours"
- Grill ↔ Broiler: "Grill outdoors" OR "Broil indoors for similar results"
- Stovetop ↔ Microwave: "Stovetop for better texture" OR "Microwave for speed"
- Oven ↔ Sous Vide: "Traditional oven roasting" OR "Sous vide for precision"

SERVINGS AND TIME INFERENCE (CRITICAL - REQUIRED):
- MANDATORY: You MUST provide numeric values for inferredServings, inferredTotalTime, inferredPrepTime, and inferredCookTime
- NEVER leave these fields null, undefined, or omitted - they are REQUIRED
- ALWAYS estimate servings if not provided: analyze ingredient quantities to determine realistic serving count
- ALWAYS estimate times in minutes if missing: analyze instructions for realistic timing

SEARCH METADATA GENERATION (CRITICAL FOR SEARCH FUNCTIONALITY):
Generate comprehensive search metadata to enable intelligent recipe discovery:

SEMANTIC TAGS (3-10 tags per recipe):

- Cuisine Types:
"italian", "mexican", "asian", "american", "mediterranean", "indian", "french", "greek", "thai", "chinese", "japanese",
"korean", "vietnamese", "middle-eastern", "caribbean", "african", "german", "spanish", "cajun", "southern", "nordic", "fusion", "global"

- Meal Types:
"breakfast", "brunch", "lunch", "dinner", "snack", "appetizer", "side-dish", "main-course", "dessert",
"drink", "cocktail", "soup", "salad", "bread", "sauce", "condiment"

- Occasion Tags:
"weeknight", "weekend", "holiday", "party", "potluck", "picnic", "barbecue", "comfort-food",
"date-night", "family-friendly", "kid-friendly", "romantic", "celebratory", "game-day", "meal-prep", "leftovers-friendly"

- Style Tags:
"quick", "easy", "healthy", "indulgent", "rustic", "elegant", "casual", "fancy", "budget-friendly",
"gourmet", "traditional", "modern", "experimental", "one-pot", "no-cook", "low-carb", "high-protein",
"plant-based", "gluten-free", "dairy-free", "vegan", "vegetarian", "paleo", "keto", "low-fat", "low-sodium"

- Season Tags:
"summer", "winter", "spring", "fall", "seasonal", "harvest", "holiday-season", "grilling-season",
"back-to-school", "cold-weather", "warm-weather"

COOKING METHODS (1-3 methods):
- Heat-based methods: "baked", "roasted", "oven", "convection", "broiled", "toasted"
- Stovetop methods: "sautéed", "pan-fried", "stir-fried", "simmered", "boiled", "steamed"
- Grill/flame methods: "grilled", "barbecued", "smoked", "charred", "flame-grilled"
- Pressure/slow methods: "pressure-cooked", "slow-cooked", "braised", "stewed"
- Specialty methods: "air-fried", "deep-fried", "sous-vide", "rotisserie", "tandoor"
- Quick/convenience: "microwave", "instant-pot", "no-cook", "raw"
- IMPORTANT: Distinguish between "grilled" (direct high heat) and "smoked" (indirect low heat with wood smoke)
- MULTI-METHOD SUPPORT: When recipes offer genuine alternatives (e.g., "oven OR grill", "stovetop OR pressure cooker"), include both methods

DIETARY TAGS (identify applicable restrictions):
- "vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "egg-free", "low-carb", "keto", "paleo", "whole30"

Return ONLY valid JSON in this exact format (ALL FIELDS REQUIRED):
{
  "normalizedTitle": "Title",
  "normalizedIngredients": [{"text": "ingredient"}],
  "normalizedInstructions": [{"stepNumber": 1, "text": "step"}],
  "cookingMethods": [{"name": "Stovetop", "instructions": [{"stepNumber": 1, "text": "step"}]}],
  "inferredServings": 4,
  "inferredTotalTime": 30,
  "inferredPrepTime": 10,
  "inferredCookTime": 20,
  "searchMetadata": {
    "semanticTags": ["tag1", "tag2"],
    "primaryIngredients": ["ingredient1", "ingredient2"],
    "cookingMethods": ["method1"],
    "dietaryTags": ["tag1"],
    "flavorProfile": ["flavor1", "flavor2"],
    "equipment": ["equipment1"],
    "timeCategory": "medium-30min",
    "complexity": "intermediate",
    "mealType": "dinner"
  },
  "inferredMetadata": {
    "cuisineType": "Cuisine",
    "cookingMethods": ["method1"],
    "dietaryInfo": ["diet1"],
    "difficultyLevel": "Level"
  },
  "qualityScore": 8.5,
  "normalizationNotes": "Notes"
}`, recipe.Title, string(ingredientsJson), string(instructionsJson), servingsInfo, timeInfo)
}

// normalizeTitle applies proper title capitalization
func normalizeTitle(title string) string {
	if len(title) == 0 {
		return title
	}

	// Convert to runes for proper Unicode handling
	runes := []rune(title)

	// Capitalize first letter
	if runes[0] >= 'a' && runes[0] <= 'z' {
		runes[0] = runes[0] - 'a' + 'A'
	}

	// Capitalize letters after spaces and hyphens, but NOT after apostrophes
	for i := 1; i < len(runes); i++ {
		if (runes[i-1] == ' ' || runes[i-1] == '-') &&
			runes[i] >= 'a' && runes[i] <= 'z' {
			runes[i] = runes[i] - 'a' + 'A'
		}
	}

	return string(runes)
}
