// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe } from "../types";

export class AllRecipesParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("allrecipes.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const jsonLd = this.extractJsonLD(html);
        if (!jsonLd) {
            throw new Error("[AllRecipes] No JSON-LD recipe data found. Strict contract enforcement: no fallback.");
        }
        const recipe: Recipe = {
            title: this.sanitizeText(jsonLd.name),
            source: url,
            ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
            instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({
                stepNumber: idx + 1,
                text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
            })),
            imageUrl: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
            prepTime: jsonLd.prepTime,
            cookTime: jsonLd.cookTime,
            totalTime: jsonLd.totalTime,
            servings: Array.isArray(jsonLd.recipeYield) ? jsonLd.recipeYield.join(", ") : jsonLd.recipeYield?.toString(),
            notes: jsonLd.description ? [this.sanitizeText(jsonLd.description)] : undefined
        };
        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            throw new Error(`[AllRecipes] Contract validation failed: ${JSON.stringify(validation)}`);
        }
        return recipe;
    }
}
export default AllRecipesParser;
