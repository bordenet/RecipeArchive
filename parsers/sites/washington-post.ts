import { BaseParser } from "../base-parser.js";
import { Recipe } from "../types.js";
import * as cheerio from "cheerio";

/**
 * Washington Post Recipe Parser
 * 
 * Handles paywall-protected recipe content from washingtonpost.com
 * Uses authentication infrastructure from tools/cmd/wapost-cookies/
 * 
 * Key Features:
 * - Paywall bypass through authenticated session
 * - Multiple recipe format support (single recipes, recipe collections)
 * - Robust ingredient/instruction extraction
 * - JSON-LD structured data fallback
 */
export class WashingtonPostParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes('washingtonpost.com/food') || 
               url.includes('washingtonpost.com') && url.includes('recipe');
    }

    async parse(html: string, url: string): Promise<Recipe> {
        // First try JSON-LD structured data
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            return this.parseFromJsonLD(jsonLd, url);
        }

        // Fallback to HTML parsing for Washington Post specific structure
        const $ = cheerio.load(html);
        
        // Washington Post recipe structure detection
        const title = this.extractTitle($);
        const ingredients = this.extractIngredients($);
        let instructions = this.extractInstructions($);
        const imageUrl = this.extractImage($);
        const metadata = this.extractMetadata($);

        // Fallback: If no instructions found, use recipe description as a single step
        if (instructions.length === 0) {
            const description = metadata.notes?.[0] || '';
            if (description) {
                instructions = [{ stepNumber: 1, text: description }];
            } else {
                instructions = [{ stepNumber: 1, text: 'No instructions provided.' }];
            }
        }

        const recipe: Recipe = {
            title,
            source: url,
            ingredients,
            instructions,
            imageUrl,
            ...metadata
        };

        // Validate the extracted recipe
        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            throw new Error(`[WashingtonPost] Contract validation failed: ${JSON.stringify(validation)}`);
        }

        return recipe;
    }

    private extractTitle($: cheerio.CheerioAPI): string {
        // Washington Post title selectors (in order of preference)
        const titleSelectors = [
            'h1[data-qa="headline"]',
            'h1.headline',
            'h1.font--headline',
            'h1',
            '.headline h1',
            '[data-qa="headline"]'
        ];

        for (const selector of titleSelectors) {
            const title = $(selector).first().text().trim();
            if (title) {
                return this.sanitizeText(title);
            }
        }

        return 'Recipe from Washington Post';
    }

    private extractIngredients($: cheerio.CheerioAPI): Array<{ text: string }> {
        const ingredients: Array<{ text: string }> = [];

        // Washington Post ingredient selectors
        const ingredientSelectors = [
            '.recipe-ingredients li',
            '.ingredients-section li',
            '.ingredient-list li',
            'ul[data-qa="ingredients"] li',
            '.wpds-box ul li', // Washington Post Design System
            'li[data-ingredient]'
        ];

        for (const selector of ingredientSelectors) {
            $(selector).each((_, el) => {
                const text = $(el).text().trim();
                if (text && !this.isIngredientHeader(text)) {
                    ingredients.push({ text: this.sanitizeText(text) });
                }
            });
            if (ingredients.length > 0) break; // Use first successful selector
        }

        // If no structured ingredients found, try paragraph-based extraction
        if (ingredients.length === 0) {
            ingredients.push(...this.extractIngredientsFromParagraphs($));
        }

        return ingredients;
    }

    private extractInstructions($: cheerio.CheerioAPI): Array<{ stepNumber: number; text: string }> {
        const instructions: Array<{ stepNumber: number; text: string }> = [];

        // Washington Post instruction selectors
        const instructionSelectors = [
            '.recipe-instructions li',
            '.instructions-section li',
            '.method-steps li',
            'ol[data-qa="instructions"] li',
            '.recipe-method li',
            '.directions li'
        ];

        for (const selector of instructionSelectors) {
            $(selector).each((idx, el) => {
                const text = $(el).text().trim();
                if (text && !this.isInstructionHeader(text)) {
                    instructions.push({
                        stepNumber: idx + 1,
                        text: this.sanitizeText(text)
                    });
                }
            });
            if (instructions.length > 0) break; // Use first successful selector
        }

        // If no structured instructions found, try paragraph-based extraction
        if (instructions.length === 0) {
            instructions.push(...this.extractInstructionsFromParagraphs($));
        }

        return instructions;
    }

    private extractImage($: cheerio.CheerioAPI): string | undefined {
        // Washington Post image selectors
        const imageSelectors = [
            '.recipe-hero img',
            '.lead-image img',
            '.featured-image img',
            'img[data-qa="hero-image"]',
            '.wpds-image img',
            'meta[property="og:image"]'
        ];

        for (const selector of imageSelectors) {
            if (selector.startsWith('meta')) {
                const content = $(selector).attr('content');
                if (content) return content;
            } else {
                const src = $(selector).first().attr('src') || $(selector).first().attr('data-src');
                if (src) return src.startsWith('http') ? src : `https://washingtonpost.com${src}`;
            }
        }

        return undefined;
    }

    private extractMetadata($: cheerio.CheerioAPI): Partial<Recipe> {
        const metadata: Partial<Recipe> = {};

        // Extract cooking times
        const prepTime = $('[data-qa="prep-time"], .prep-time').text().trim();
        const cookTime = $('[data-qa="cook-time"], .cook-time').text().trim();
        const totalTime = $('[data-qa="total-time"], .total-time').text().trim();

        if (prepTime) metadata.prepTime = prepTime;
        if (cookTime) metadata.cookTime = cookTime;
        if (totalTime) metadata.totalTime = totalTime;

        // Extract servings
        const servings = $('[data-qa="servings"], .servings, .yield').text().trim();
        if (servings) metadata.servings = servings;

        // Extract description/notes
        const description = $('.recipe-description, .article-summary, .dek').first().text().trim();
        if (description) {
            metadata.notes = [this.sanitizeText(description)];
        }

        return metadata;
    }

    private isIngredientHeader(text: string): boolean {
        const headers = ['ingredients', 'for the', 'you will need', 'shopping list'];
        return headers.some(header => text.toLowerCase().includes(header));
    }

    private isInstructionHeader(text: string): boolean {
        const headers = ['instructions', 'method', 'directions', 'steps'];
        return headers.some(header => text.toLowerCase().includes(header));
    }

    private extractIngredientsFromParagraphs($: cheerio.CheerioAPI): Array<{ text: string }> {
        const ingredients: Array<{ text: string }> = [];
        
        // Look for paragraphs that might contain ingredients
        $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (this.looksLikeIngredient(text)) {
                ingredients.push({ text: this.sanitizeText(text) });
            }
        });

        return ingredients;
    }

    private extractInstructionsFromParagraphs($: cheerio.CheerioAPI): Array<{ stepNumber: number; text: string }> {
        const instructions: Array<{ stepNumber: number; text: string }> = [];
        
        // Look for paragraphs that might contain cooking instructions
        $('p').each((idx, el) => {
            const text = $(el).text().trim();
            if (this.looksLikeInstruction(text)) {
                instructions.push({
                    stepNumber: instructions.length + 1,
                    text: this.sanitizeText(text)
                });
            }
        });

        return instructions;
    }

    private looksLikeIngredient(text: string): boolean {
        const ingredientIndicators = [
            /\d+.*(?:cup|tablespoon|teaspoon|pound|ounce|gram|kg|lb)/i,
            /\b(?:salt|pepper|oil|butter|flour|sugar|egg|milk|water|onion|garlic)\b/i,
            /^\d+(?:\s*-\s*\d+)?\s+/
        ];
        return ingredientIndicators.some(pattern => pattern.test(text)) && text.length < 200;
    }

    private looksLikeInstruction(text: string): boolean {
        const instructionIndicators = [
            /^(?:heat|cook|add|mix|stir|bake|roast|grill|sauté|simmer|boil)/i,
            /(?:minutes?|hours?|until|degrees?|°[CF])/i,
            /\b(?:oven|pan|skillet|pot|bowl|plate)\b/i
        ];
        return instructionIndicators.some(pattern => pattern.test(text)) && 
               text.length > 20 && text.length < 500;
    }

    private parseFromJsonLD(jsonLd: any, url: string): Recipe {
        return {
            title: this.sanitizeText(jsonLd.name || 'Recipe'),
            source: url,
            ingredients: (jsonLd.recipeIngredient || []).map((i: string) => ({ 
                text: this.sanitizeText(i) 
            })),
            instructions: (jsonLd.recipeInstructions || []).map((instruction: any, idx: number) => ({
                stepNumber: idx + 1,
                text: typeof instruction === 'string' ? 
                    this.sanitizeText(instruction) : 
                    this.sanitizeText(instruction.text)
            })),
            imageUrl: this.extractImageFromJsonLD(jsonLd),
            prepTime: jsonLd.prepTime,
            cookTime: jsonLd.cookTime, 
            totalTime: jsonLd.totalTime,
            servings: jsonLd.recipeYield?.toString(),
            notes: jsonLd.description ? [this.sanitizeText(jsonLd.description)] : undefined
        };
    }

    private extractImageFromJsonLD(jsonLd: any): string | undefined {
        if (typeof jsonLd.image === 'string') return jsonLd.image;
        if (Array.isArray(jsonLd.image)) {
            const firstImage = jsonLd.image[0];
            return typeof firstImage === 'string' ? firstImage : firstImage?.url;
        }
        return jsonLd.image?.url;
    }
}

export default WashingtonPostParser;