import { BaseParser } from "../base-parser";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class FoodAndWineParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("foodandwine.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
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

        // Fallback selectors for Food & Wine specific structure
        const title = this.sanitizeText(
            $('h1.headline, h1.recipe-title, h1').first().text() || ""
        );

        const author = this.sanitizeText(
            $('.author-name, .by-author, .recipe-author, [rel="author"]').first().text().replace(/^by\s*/i, '') || ""
        );

        // Extract ingredients - Food & Wine often uses structured lists
        let ingredients: Ingredient[] = [];
        const ingredientSelectors = [
            '.recipe-ingredients li',
            '.ingredients li',
            '.recipe-ingredient',
            '.mntl-structured-ingredients__list-item',
            '.structured-ingredients li'
        ];
        
        for (const selector of ingredientSelectors) {
            const found = $(selector).map((_, el) => ({ 
                text: this.sanitizeText($(el).text()) 
            })).get();
            if (found.length > 0) {
                ingredients = found;
                break;
            }
        }

        // Extract instructions - Food & Wine often uses ordered lists
        let instructions: Instruction[] = [];
        const instructionSelectors = [
            '.recipe-instructions li',
            '.instructions li', 
            '.recipe-instruction',
            '.mntl-sc-block-group--LI .mntl-sc-block',
            '.recipe-directions li'
        ];
        
        for (const selector of instructionSelectors) {
            const found = $(selector).map((i, el) => ({ 
                stepNumber: i + 1, 
                text: this.sanitizeText($(el).text()) 
            })).get();
            if (found.length > 0) {
                instructions = found;
                break;
            }
        }

        // Extract image
        let imageUrl = $('.recipe-image img, .hero-image img, .primary-image img').first().attr('src');
        if (!imageUrl) {
            imageUrl = $('meta[property="og:image"]').attr('content');
        }

        // Extract timing and serving info
        const prepTime = this.sanitizeText($('.prep-time, .recipe-prep-time, [itemprop="prepTime"]').first().text());
        const cookTime = this.sanitizeText($('.cook-time, .recipe-cook-time, [itemprop="cookTime"]').first().text());
        const totalTime = this.sanitizeText($('.total-time, .recipe-total-time, [itemprop="totalTime"]').first().text());
        const servings = this.sanitizeText($('.servings, .recipe-servings, .recipe-yield, [itemprop="recipeYield"]').first().text());

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

export default FoodAndWineParser;