// ...existing code...
import { BaseParser } from "../base-parser";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class EpicuriousParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("epicurious.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        // Detect Epicurious 404 page and throw error
        if (html.includes('Page Not Found | Epicurious')) {
            throw new Error(`[Epicurious] 404 page detected for URL: ${url}`);
        }
        const $ = cheerio.load(html);
        
        // First try JSON-LD extraction
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name,
                ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
                instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ 
                    stepNumber: idx + 1, 
                    text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) 
                })),
                imageUrl: typeof jsonLd.image === "string" ? jsonLd.image : 
                         Array.isArray(jsonLd.image) ? 
                         (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : 
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

        // Fallback selectors for Epicurious specific structure
        const title = this.sanitizeText(
            $('h1.recipe-hed, h1').first().text() || ""
        );

        const author = this.sanitizeText(
            $('.author-name, .by-author, [data-testid="BylineWrapper"]').first().text().replace(/^by\s*/i, '') || ""
        );

        // Extract ingredients - Epicurious often uses structured lists
        let ingredients: Ingredient[] = [];
        const ingredientSelectors = [
            '[data-testid="IngredientList"] li',
            '.recipe-ingredients li',
            '.ingredients li',
            '.ingredient',
            'ul li'
        ];
        
        for (const selector of ingredientSelectors) {
            const found = $(selector).map((_, el) => {
                const text = this.sanitizeText($(el).text());
                return text && text.length > 0 ? { text } : null;
            }).get().filter(Boolean) as Ingredient[];
            if (found.length > 0) {
                ingredients = found;
                break;
            }
        }

        // Extract instructions - Epicurious often uses ordered lists
        let instructions: Instruction[] = [];
        const instructionSelectors = [
            '[data-testid="InstructionsWrapper"] li',
            '.recipe-instructions li', 
            '.instructions li',
            '.preparation li',
            'ol li'
        ];
        
        for (const selector of instructionSelectors) {
            const found = $(selector).map((i, el) => {
                const text = this.sanitizeText($(el).text());
                return text && text.length > 0 ? { stepNumber: i + 1, text } : null;
            }).get().filter(Boolean) as Instruction[];
            if (found.length > 0) {
                instructions = found;
                break;
            }
        }

        // Extract image
        let imageUrl = $('.recipe-header-image img, .recipe-image img, .hero-image img').first().attr('src');
        if (!imageUrl) {
            imageUrl = $('meta[property="og:image"]').attr('content');
        }

        // Extract timing and serving info
        const prepTime = this.sanitizeText($('.prep-time, [data-testid="PrepTime"]').first().text());
        const cookTime = this.sanitizeText($('.cook-time, [data-testid="CookTime"]').first().text());
        const totalTime = this.sanitizeText($('.total-time, [data-testid="TotalTime"]').first().text());
        const servings = this.sanitizeText($('.servings, .recipe-yield, [data-testid="Yield"]').first().text());

        const recipe: Recipe = {
            title,
            source: url,
            author: author || undefined,
            ingredients,
            instructions,
            imageUrl: imageUrl || undefined,
            prepTime: prepTime || undefined,
            cookTime: cookTime || undefined,
            totalTime: totalTime || undefined,
            servings: servings || undefined
        };

        return recipe;
    }
}
export default EpicuriousParser;
