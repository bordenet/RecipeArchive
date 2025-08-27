import { BaseParser } from "../base-parser";
import { Recipe } from "../types";

export class NYTCookingParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("cooking.nytimes.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "NYT Cooking",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
                imageUrl: typeof jsonLd.image === "string" ? jsonLd.image :
                    Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) :
                        jsonLd.image?.url,
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

        // Fallback to DOM parsing for NYT Cooking specific selectors
        const title = this.extractElements(doc, [
            "h1.recipe-title",
            "h1[data-testid=\"recipe-title\"]",
            "h1.pantry-recipe-title",
            "h1"
        ])[0];

        const author = this.extractElements(doc, [
            ".recipe-author",
            "[data-testid=\"recipe-author\"]",
            ".byline-author",
            ".author"
        ])[0] || "NYT Cooking";

        // Extract ingredients with NYT Cooking specific selectors
        const ingredients = this.extractElements(doc, [
            "[data-testid=\"IngredientList\"] li",
            ".recipe-ingredients li",
            ".ingredients-section li",
            "[data-module=\"Ingredients\"] li",
            "ul[data-testid=\"ingredients\"] li"
        ]);

        // Extract instructions with NYT Cooking specific selectors
        const instructions = this.extractElements(doc, [
            "[data-testid=\"MethodList\"] li",
            ".recipe-instructions li",
            ".instructions-section li", 
            "[data-module=\"Instructions\"] li",
            "ol[data-testid=\"instructions\"] li"
        ]);

        // Extract image
        const imageEl = doc.querySelector(".recipe-photo img, [data-testid=\"recipe-image\"] img, img");
        const imageUrl = imageEl?.getAttribute("src") || undefined;

        // Extract timing and serving information
        const prepTime = this.extractElements(doc, [
            "[data-testid=\"prep-time\"]",
            ".recipe-time-prep",
            ".prep-time"
        ])[0];

        const cookTime = this.extractElements(doc, [
            "[data-testid=\"cook-time\"]",
            ".recipe-time-cook", 
            ".cook-time"
        ])[0];

        const totalTime = this.extractElements(doc, [
            "[data-testid=\"total-time\"]",
            ".recipe-time-total",
            ".total-time"
        ])[0];

        const servings = this.extractElements(doc, [
            "[data-testid=\"yield\"]",
            ".recipe-yield",
            ".servings",
            ".yield"
        ])[0];

        // Extract notes/tips
        const notes = this.extractElements(doc, [
            ".recipe-notes li",
            "[data-testid=\"recipe-notes\"] li",
            ".tips li",
            ".recipe-tips li"
        ]);

        const recipe: Recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl,
            prepTime,
            cookTime,
            totalTime,
            servings,
            notes: notes.length > 0 ? notes : undefined
        };

        // Validate before returning
        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            console.warn("Recipe validation failed:", validation.missingFields.join(", "));
            throw new Error(`Failed to extract recipe: ${validation.missingFields.join(", ")}`);
        }

        return recipe;
    }
}