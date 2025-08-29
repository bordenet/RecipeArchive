// ...existing code...
import { BaseParser } from "../base-parser";
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
        // Refined selectors for Smitten Kitchen
        const title = this.sanitizeText($('h1.entry-title, h1.post-title, h1').first().text() || $('h1').first().text() || "");
        const author = this.sanitizeText($('.byline .author').first().text() || 'Deb Perelman');
        let ingredients: Ingredient[] = [];
        let instructions: Instruction[] = [];
        // Find the <p> with bolded recipe title, then extract following <p> tags for ingredients and instructions
        const entryContent = $('.entry-content');
        const recipeTitleP = entryContent.find('p b:contains("Ina Garten")').parent();
        // Ingredients: first <p> after recipeTitleP, split by <br>
        let ingredientP = recipeTitleP.next('p');
        if (ingredientP.length) {
            const raw = ingredientP.html();
            if (raw) {
                ingredients = raw.split(/<br\s*\/?>/i).map(t => ({ text: this.sanitizeText($(t).text() || $("<div>"+t+"</div>").text()) })).filter(i => i.text);
            }
        }
        // Instructions: next <p> tags after ingredients, until a <p> with <u> or unrelated content
        let instrIdx = ingredientP.index();
        entryContent.find('p').slice(instrIdx + 1).each((i, el) => {
            const html = $(el).html();
            if (html && (html.includes('Preheat oven') || html.match(/\bBake\b|\bAllow to cool\b|\bDo ahead\b|\bFlouring\b|\bSift together\b|\bPour into\b|\bMelt together\b|\bStir\b|\bAdd to\b|\bToss the walnuts\b|\bDo not overbake\b/))) {
                instructions.push({ stepNumber: instructions.length + 1, text: this.sanitizeText($(el).text()) });
            }
        });
        // Fallback image extraction: look for main recipe image
        let imageUrl = $('.post-thumbnail-container img').first().attr('src') || undefined;
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
