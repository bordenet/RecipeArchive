// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class SmittenKitchenParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("smittenkitchen.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const $ = cheerio.load(html);
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Deb Perelman",
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
        const title = this.sanitizeText($('h1.entry-title, h1.post-title, h1').first().text() || $('h1').first().text() || "");
        const author = this.sanitizeText($('p.recipe-meta + p, .author-meta, .author').first().text().replace('Author:', '').trim() || 'Deb Perelman');
        let ingredients: Ingredient[] = [];
        // Try main selectors first
        ingredients = $('.recipe-ingredients li, .ingredients li, .ingredient, .wprm-recipe-ingredient, ul li, .entry-content ul li').map((_, el) => ({ text: this.sanitizeText($(el).text()) })).get();
        // Fallback: all <li> under any <ul> after h2 containing 'Ingredients'
        if (ingredients.length === 0) {
            $('h2:contains("Ingredients")').nextAll('ul').each((_, ul) => {
                $(ul).find('li').each((__, el) => {
                    const text = $(el).text().trim();
                    if (text) ingredients.push({ text });
                });
            });
        }
        let instructions: Instruction[] = [];
        instructions = $('.instructions li, .instruction, .wprm-recipe-instruction-text, .preparation-step, ul li, .entry-content ol li, .entry-content ul li').map((i, el) => ({ stepNumber: i + 1, text: this.sanitizeText($(el).text()) })).get();
        // Fallback: all <li> under any <ul> after h2 containing 'Directions' or 'Instructions'
        if (instructions.length === 0) {
            $('h2:contains("Directions"), h2:contains("Instructions")').nextAll('ul').each((ulIdx, ul) => {
                $(ul).find('li').each((liIdx, el) => {
                    const text = $(el).text().trim();
                    if (text) instructions.push({ stepNumber: instructions.length + 1, text });
                });
            });
        }
        // Fallback image extraction: look for main recipe image
        let imageUrl = $('.recipe-photo img, img').first().attr('src') || undefined;
        // Try to find a better image if available
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) imageUrl = ogImage;
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
export default SmittenKitchenParser;
