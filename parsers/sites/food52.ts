// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class Food52Parser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("food52.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const jsonLd = this.extractJsonLD(html);
        let recipe: Recipe;
        if (jsonLd) {
            recipe = {
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
        } else {
            // Fallback: extract from HTML
            const $ = cheerio.load(html);
            const title = $('h1').first().text().trim();
            const ingredients: Ingredient[] = [];
                $('h2:contains("Ingredients")').nextAll('ul').first().find('li').each((_, el) => {
                    const text = $(el).text().trim();
                    if (text) ingredients.push({ text });
                });
            const instructions: Instruction[] = [];
                $('h2:contains("Directions")').nextAll('ul').first().find('li').each((i, el) => {
                    const text = $(el).find('p').text().trim();
                    if (text) instructions.push({ stepNumber: i + 1, text });
                });
                // Fallback image extraction: look for main recipe image
                let imageUrl = $('img').first().attr('src');
                // Try to find a better image if available
                const ogImage = $('meta[property="og:image"]').attr('content');
                if (ogImage) imageUrl = ogImage;
            recipe = {
                title,
                source: url,
                ingredients,
                instructions,
                    imageUrl,
                notes: undefined
            };
        }
        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            throw new Error(`[Food52] Contract validation failed: ${JSON.stringify(validation)}`);
        }
        return recipe;
    }
}
export default Food52Parser;
