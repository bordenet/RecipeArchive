// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class NYTCookingParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("cooking.nytimes.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const $ = cheerio.load(html);
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "NYT Cooking",
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
            if (validation.isValid) {
                return recipe;
            }
        }
        // Fallback selectors using Cheerio
        const title = this.sanitizeText($('h1.recipe-title, h1[data-testid="recipe-title"], h1.pantry-recipe-title, h1').first().text() || "");
        const author = this.sanitizeText($('.recipe-author, [data-testid="recipe-author"], .byline-author, .author').first().text() || "NYT Cooking");
        const ingredients = $('[data-testid="IngredientList"] li, .recipe-ingredients li, .ingredients-section li, [data-module="Ingredients"] li, ul[data-testid="ingredients"] li').map((_, el) => ({ text: this.sanitizeText($(el).text()) })).get();
        const instructions = $('[data-testid="MethodList"] li, .recipe-instructions li, .instructions-section li, [data-module="Instructions"] li, ol[data-testid="instructions"] li').map((_, el) => ({ stepNumber: _ + 1, text: this.sanitizeText($(el).text()) })).get();
        const imageUrl = $('.recipe-photo img, [data-testid="recipe-image"] img, img').first().attr('src') || undefined;
        const recipe: Recipe = {
            title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl
        };
        return recipe;
    }
}
export default NYTCookingParser;
