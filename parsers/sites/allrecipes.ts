// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe } from "../types";

export class AllRecipesParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("allrecipes.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const $ = cheerio.load(html);

        // Detect AllRecipes 404/error page
        const canonicalUrl = $('link[rel="canonical"]').attr('href');
        const ogUrl = $('meta[property="og:url"]').attr('content');
        const pageTitle = $('title').text().trim();
        if ((canonicalUrl && canonicalUrl.includes('/404')) || (ogUrl && ogUrl.includes('/404')) || pageTitle === 'Page Not Found') {
            // Strictly return empty contract fields for error pages
            return {
                title: '',
                source: url,
                ingredients: [],
                instructions: [],
            };
        }

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
                servings: Array.isArray(jsonLd.recipeYield) ? jsonLd.recipeYield.join(", ") : jsonLd.recipeYield?.toString(),
                notes: jsonLd.description ? [this.sanitizeText(jsonLd.description)] : undefined
            };
            const validation = this.validateRecipe(recipe);
            if (validation.isValid) {
                // Ensure required contract fields are present and non-empty
                if (recipe.title && recipe.ingredients.length > 0 && recipe.instructions.length > 0) {
                    return recipe;
                }
            }
        }

        // Fallback selectors for AllRecipes specific structure
        const title = this.sanitizeText(
            $('h1.headline, h1.recipe-title, h1').first().text() || ""
        );

        const author = this.sanitizeText(
            $('.recipe-author, .by-author, .author-name').first().text().replace(/^by\s*/i, '') || ""
        );

        // Extract ingredients - AllRecipes often uses structured lists
        let ingredients: { text: string }[] = [];
        const ingredientSelectors = [
            '.recipe-ingredients li',
            '.mntl-structured-ingredients__list-item',
            '.ingredients li',
            '[data-ingredient] li',
            'ul li'
        ];
        
        for (const selector of ingredientSelectors) {
            const found = $(selector).map((_, el) => {
                const text = this.sanitizeText($(el).text());
                return text && text.length > 0 ? { text } : null;
            }).get().filter(Boolean);
            if (found.length > 0) {
                ingredients = found;
                break;
            }
        }

        // Extract instructions - AllRecipes often uses ordered lists
        let instructions: { stepNumber: number; text: string }[] = [];
        const instructionSelectors = [
            '.recipe-instructions li',
            '.mntl-sc-block-group--LI .mntl-sc-block',
            '.instructions li',
            '[data-instruction] li',
            'ol li'
        ];
        
        for (const selector of instructionSelectors) {
            const found = $(selector).map((i, el) => {
                const text = this.sanitizeText($(el).text());
                return text && text.length > 0 ? { stepNumber: i + 1, text } : null;
            }).get().filter(Boolean);
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
        const prepTime = this.sanitizeText($('.prep-time, .recipe-prep-time, [data-prep-time]').first().text());
        const cookTime = this.sanitizeText($('.cook-time, .recipe-cook-time, [data-cook-time]').first().text());
        const totalTime = this.sanitizeText($('.total-time, .recipe-total-time, [data-total-time]').first().text());
        const servings = this.sanitizeText($('.servings, .recipe-yield, .recipe-servings, [data-servings]').first().text());

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
export default AllRecipesParser;
