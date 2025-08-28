// ...existing code...
import { BaseParser } from "../base-parser.js";
import { Recipe, Ingredient, Instruction } from "../types";

export class FoodNetworkDebugParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("foodnetwork.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? this.sanitizeText(jsonLd.author) : this.sanitizeText(jsonLd.author?.name) || "Food Network",
                ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })).filter(ing => typeof ing.text === 'string' && ing.text.length > 0),
                instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ stepNumber: idx + 1, text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) })).filter(inst => typeof inst.text === 'string' && inst.text.length > 0),
                imageUrl: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
                prepTime: jsonLd.prepTime,
                cookTime: jsonLd.cookTime,
                totalTime: jsonLd.totalTime,
                servings: jsonLd.recipeYield?.toString(),
                notes: jsonLd.description ? [this.sanitizeText(jsonLd.description)] : undefined
            };
            const validation = this.validateRecipe(recipe);
            if (validation.isValid) {
                return recipe;
            }
        }

        // Fallback to DOM parsing for Food Network specific selectors
        const title = this.sanitizeText(this.extractElements(doc, [
            "h1.o-AssetTitle__a-HeadlineText",
            "h1.recipe-title",
            "h1"
        ])[0] || "");

        const author = this.sanitizeText(this.extractElements(doc, [
            ".o-Attribution__a-Name",
            ".recipe-author",
            ".chef-name"
        ])[0] || "Food Network");

        // Refined ingredient extraction for Margarita recipe
        let ingredientsRaw: string[] = [];
        const ingredientSelectors = [
            ".o-RecipeIngredients__a-Ingredient",
            ".o-Ingredients__a-Ingredient"
        ];
        for (const selector of ingredientSelectors) {
            const found = Array.from(doc.querySelectorAll(selector)).map(el => this.sanitizeText(el.textContent));
            console.debug(`[FoodNetworkDebug] Selector: ${selector}, Found:`, found);
            ingredientsRaw.push(...found);
        }
        let ingredients = ingredientsRaw
            .map(text => ({ text }))
            .filter(ing => typeof ing.text === 'string' && ing.text !== undefined && ing.text !== null && ing.text.trim().length > 0);
        console.debug('[FoodNetworkDebug] Final ingredients:', ingredients);

        // If no ingredients found, try extracting all <li> elements
        if (ingredients.length === 0) {
            const allLi = Array.from(doc.querySelectorAll('li')).map(el => this.sanitizeText(el.textContent));
            console.debug('[FoodNetworkDebug] Fallback <li> extraction:', allLi);
            ingredients = allLi
                .filter(text => typeof text === 'string' && text !== undefined && text !== null && text.trim().length > 0)
                .map(text => ({ text }));
        }

        // Debug instruction extraction
        let instructionsRaw: string[] = [];
        const instructionSelectors = [
            ".o-Method__m-Step",
            ".recipe-instructions .o-Method__m-Step",
            ".o-Method__m-Body li", 
            ".o-Method li",
            "[data-module=\"InstructionsList\"] li",
            ".recipe-instructions ol li",
            ".recipe-instructions li",
            ".recipe-directions li",
            "section[aria-labelledby=\"recipe-instructions-section\"] li",
            "ul.instructions li",
            "li.instruction",
            "span.instruction-text"
        ];
        for (const selector of instructionSelectors) {
            const found = Array.from(doc.querySelectorAll(selector)).map(el => this.sanitizeText(el.textContent));
            console.debug(`[FoodNetworkDebug] Selector: ${selector}, Found:`, found);
            instructionsRaw.push(...found);
        }
        let instructions = instructionsRaw
            .filter(text => typeof text === 'string' && text !== undefined && text !== null && text.trim().length > 0)
            .map((text, idx) => ({ stepNumber: idx + 1, text }));
        console.debug('[FoodNetworkDebug] Final instructions:', instructions);

        // Extract image
        const imageEl = doc.querySelector(".recipe-hero img, .o-AssetPhoto img, img");
        const imageUrl = imageEl?.getAttribute("src") || undefined;

        // Return recipe object
        return {
            title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl
        };
    }
}
