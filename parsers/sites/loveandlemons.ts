// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class LoveAndLemonsParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("loveandlemons.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const $ = cheerio.load(html);
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
                instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ stepNumber: idx + 1, text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) })),
                imageUrl: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
                prepTime: jsonLd.prepTime,
                cookTime: jsonLd.cookTime,
                totalTime: jsonLd.totalTime,
                servings: jsonLd.recipeYield?.toString(),
                notes: jsonLd.description ? [this.sanitizeText(jsonLd.description)] : undefined
            };
            const validation = this.validateRecipe(recipe);
            if (validation.isValid) return recipe;
        }
        // Fallback selectors using Cheerio
        const title = this.sanitizeText($('h1.entry-title').first().text() || "");
        const ingredients = $('.wprm-recipe-ingredient').map((_, el) => ({ text: this.sanitizeText($(el).text()) })).get();
        const instructions = $('.wprm-recipe-instruction-text').map((_, el) => ({ stepNumber: _ + 1, text: this.sanitizeText($(el).text()) })).get();
        const recipe: Recipe = {
            title,
            source: url,
            ingredients,
            instructions
        };
        return recipe;
    }
}
export default LoveAndLemonsParser;
