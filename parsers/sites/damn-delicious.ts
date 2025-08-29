import { BaseParser } from "../base-parser";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class DamnDeliciousParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("damndelicious.net");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const $ = cheerio.load(html);
        
        // First try JSON-LD extraction
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Chungah Rhee",
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

        // Fallback selectors for Damn Delicious specific structure
        const title = this.sanitizeText(
            $('h1.entry-title, h1.post-title, h1').first().text() || ""
        );

        // Damn Delicious is authored by Chungah Rhee
        const author = this.sanitizeText(
            $('.author, .by-author').first().text() || "Chungah Rhee"
        );

        // Extract ingredients - Damn Delicious often uses recipe cards
        let ingredients: Ingredient[] = [];
        const ingredientSelectors = [
            '.recipe-card-ingredients li',
            '.wp-block-recipe-card-ingredients li',
            '.ingredients li',
            '.recipe-ingredients li',
            '.entry-content ul li',
            'h3:contains("Ingredients") + ul li, h3:contains("INGREDIENTS") + ul li'
        ];
        
        for (const selector of ingredientSelectors) {
            if (selector.includes(':contains')) {
                // Handle jQuery :contains selector separately
                const headerSelectors = ['h3:contains("Ingredients")', 'h3:contains("INGREDIENTS")'];
                for (const headerSelector of headerSelectors) {
                    const headerElements = $(headerSelector.split(':contains')[0]).filter((_, el) => 
                        $(el).text().toLowerCase().includes('ingredients')
                    );
                    if (headerElements.length > 0) {
                        const ingredientsList = headerElements.next('ul').find('li');
                        if (ingredientsList.length > 0) {
                            ingredients = ingredientsList.map((_, el) => ({ 
                                text: this.sanitizeText($(el).text()) 
                            })).get();
                            break;
                        }
                    }
                }
            } else {
                const found = $(selector).map((_, el) => ({ 
                    text: this.sanitizeText($(el).text()) 
                })).get();
                if (found.length > 0) {
                    ingredients = found;
                    break;
                }
            }
        }

        // Extract instructions - Damn Delicious often uses ordered lists
        let instructions: Instruction[] = [];
        const instructionSelectors = [
            '.recipe-card-directions li',
            '.wp-block-recipe-card-directions li', 
            '.instructions ol li',
            '.recipe-instructions ol li',
            '.entry-content ol li',
            'h3:contains("Directions") + ol li, h3:contains("DIRECTIONS") + ol li'
        ];
        
        for (const selector of instructionSelectors) {
            if (selector.includes(':contains')) {
                // Handle jQuery :contains selector separately
                const headerSelectors = ['h3:contains("Directions")', 'h3:contains("DIRECTIONS")'];
                for (const headerSelector of headerSelectors) {
                    const headerElements = $(headerSelector.split(':contains')[0]).filter((_, el) => 
                        $(el).text().toLowerCase().includes('directions')
                    );
                    if (headerElements.length > 0) {
                        const instructionsList = headerElements.next('ol').find('li');
                        if (instructionsList.length > 0) {
                            instructions = instructionsList.map((i, el) => ({ 
                                stepNumber: i + 1, 
                                text: this.sanitizeText($(el).text()) 
                            })).get();
                            break;
                        }
                    }
                }
            } else {
                const found = $(selector).map((i, el) => ({ 
                    stepNumber: i + 1, 
                    text: this.sanitizeText($(el).text()) 
                })).get();
                if (found.length > 0) {
                    instructions = found;
                    break;
                }
            }
        }

        // Extract image
        let imageUrl = $('.recipe-card-image img, .post-thumbnail img, .wp-post-image').first().attr('src');
        if (!imageUrl) {
            imageUrl = $('meta[property="og:image"]').attr('content');
        }

        // Extract timing and serving info
        const prepTime = this.sanitizeText($('.recipe-card-prep-time, .prep-time, [itemprop="prepTime"]').first().text());
        const cookTime = this.sanitizeText($('.recipe-card-cook-time, .cook-time, [itemprop="cookTime"]').first().text());
        const totalTime = this.sanitizeText($('.recipe-card-total-time, .total-time, [itemprop="totalTime"]').first().text());
        const servings = this.sanitizeText($('.recipe-card-servings, .servings, [itemprop="recipeYield"]').first().text());

        const recipe: Recipe = {
            title,
            source: url,
            author: author,
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

export default DamnDeliciousParser;