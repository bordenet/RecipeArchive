import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class SeriousEatsParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("seriouseats.com");
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

        // Fallback selectors for Serious Eats specific structure
        const title = this.sanitizeText(
            $('h1.heading-1, h1.recipe-title, h1').first().text() || ""
        );

        const author = this.sanitizeText(
            $('.recipe-author, .author-name, [data-author], .by-author').first().text().replace(/^by\s*/i, '') || ""
        );

        // Extract ingredients - Serious Eats often uses structured recipe components
        let ingredients: Ingredient[] = [];
        const ingredientSelectors = [
            '.structured-ingredients__list-item',
            '.recipe-ingredients li',
            '.ingredients li',
            '.mntl-structured-ingredients__list-item',
            'section[data-module="StructuredIngredients"] li',
            '.recipe-ingredient-group li'
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

        // Extract instructions - Serious Eats often uses detailed instruction blocks
        let instructions: Instruction[] = [];
        const instructionSelectors = [
            '.structured-instructions__list-item',
            '.recipe-instructions li', 
            '.instructions li',
            '.mntl-sc-block-group--LI .mntl-sc-block',
            'section[data-module="StructuredInstructions"] li',
            '.recipe-instruction-group li'
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

        // Alternative instruction extraction for Serious Eats' detailed format
        if (instructions.length === 0) {
            const instructionBlocks = $('.mntl-sc-block-html');
            if (instructionBlocks.length > 0) {
                instructions = instructionBlocks.map((i, el) => {
                    const text = this.sanitizeText($(el).text());
                    return text && text.length > 10 ? { stepNumber: i + 1, text } : null;
                }).get().filter(Boolean) as Instruction[];
            }
        }

        // Extract image
        let imageUrl = $('.recipe-image img, .primary-image img, .hero-image img').first().attr('src');
        if (!imageUrl) {
            imageUrl = $('meta[property="og:image"]').attr('content');
        }

        // Extract timing and serving info
        const prepTime = this.sanitizeText($('.recipe-prep-time, .prep-time, [data-prep-time], [itemprop="prepTime"]').first().text());
        const cookTime = this.sanitizeText($('.recipe-cook-time, .cook-time, [data-cook-time], [itemprop="cookTime"]').first().text());
        const totalTime = this.sanitizeText($('.recipe-total-time, .total-time, [data-total-time], [itemprop="totalTime"]').first().text());
        const servings = this.sanitizeText($('.recipe-servings, .servings, .recipe-yield, [data-servings], [itemprop="recipeYield"]').first().text());

        // Extract additional notes/tips that Serious Eats often includes
        const notes: string[] = [];
        $('.recipe-notes li, .chef-note, .recipe-tips li').each((_, el) => {
            const noteText = this.sanitizeText($(el).text());
            if (noteText && noteText.length > 0) {
                notes.push(noteText);
            }
        });

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
            servings: servings || undefined,
            notes: notes.length > 0 ? notes : undefined
        };

        return recipe;
    }
}

export default SeriousEatsParser;