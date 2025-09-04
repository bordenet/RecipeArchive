// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class FoodNetworkParser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("foodnetwork.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
    // Detect Food Network 404 page and throw error
    if (html.includes('Page Not Found | Food Network') || html.includes('The page you\'re looking for seems to have disappeared!')) {
        throw new Error(`[FoodNetwork] 404 page detected for URL: ${url}`);
    }
    const $ = cheerio.load(html);

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe: Recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? this.sanitizeText(jsonLd.author) : this.sanitizeText(jsonLd.author?.name) || "Food Network",
                ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })).filter(ing => typeof ing.text === 'string' && ing.text.length > 0),
                instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ stepNumber: idx + 1, text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) })).filter(inst => typeof inst.text === 'string' && inst.text.length > 0),
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

        // Fallback to DOM parsing for Food Network specific selectors
        const title = this.sanitizeText([
            $('h1.o-AssetTitle__a-HeadlineText').text(),
            $('h1.recipe-title').text(),
            $('h1').text()
        ].find(t => t && t.trim().length > 0) || "");

        const author = this.sanitizeText([
            $('.o-Attribution__a-Name').text(),
            $('.recipe-author').text(),
            $('.chef-name').text()
        ].find(a => a && a.trim().length > 0) || "Food Network");

        let ingredients: Ingredient[] = [];
        // Try main selectors first
        $('.o-Ingredients__a-Ingredient, .ingredients-list__item, .ingredient, .recipe-ingredients li, ul li, .entry-content ul li').each((_, el) => {
            let label = $(el).find('.o-Ingredients__a-Ingredient--CheckboxLabel').text().trim();
            if (!label) label = $(el).text().trim();
            if (label && label.toLowerCase() !== 'deselect all') {
                ingredients.push({ text: label });
            }
        });
        // Fallback: all <li> under any <ul> after h2 containing 'Ingredients'
        if (ingredients.length === 0) {
            $('h2:contains("Ingredients")').nextAll('ul').each((_, ul) => {
                $(ul).find('li').each((__, el) => {
                    const text = $(el).text().trim();
                    if (text) ingredients.push({ text });
                });
            });
        }

        // Extract instructions with Food Network specific selectors  
        let instructionsRaw: string[] = [];
        const instructionSelectors = [
            ".o-Method__m-Step",
            ".recipe-instructions .o-Method__m-Step",
            ".o-Method__m-Body li",
            ".o-Method li",
            "[data-module=\"InstructionsList\"] li",
            ".recipe-instructions ol li",
            ".recipe-instructions li",
            ".recipe-directions li",
            "section[aria-labelledby=\"recipe-instructions-section\"] li",
            "ul.instructions li",
            "li.instruction",
            "span.instruction-text"
        ];
        for (const selector of instructionSelectors) {
            $(selector).each((_, el) => {
                const text = this.sanitizeText($(el).text());
                if (text && text.length > 0) instructionsRaw.push(text);
            });
        }
        let instructions: Instruction[] = instructionsRaw
            .filter(text => typeof text === 'string' && text.trim().length > 0)
            .map((text, idx) => ({ stepNumber: idx + 1, text }));
        // Fallback: all <li> under any <ul> after h2 containing 'Directions' or 'Instructions'
        if (instructions.length === 0) {
            $('h2:contains("Directions"), h2:contains("Instructions")').nextAll('ul').each((ulIdx, ul) => {
                $(ul).find('li').each((liIdx, el) => {
                    const text = $(el).text().trim();
                    if (text) instructions.push({ stepNumber: instructions.length + 1, text });
                });
            });
        }

    // Extract image
    let imageUrl = $(".recipe-hero img, .o-AssetPhoto img, img").first().attr("src") || undefined;
    // Try to find a better image if available
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) imageUrl = ogImage;

        // Extract timing and serving info with comprehensive selectors
        const prepTime = this.sanitizeText(
            $('.recipe-timing .prep-time, [data-testid="prep-time"], .preparation-time').first().text() ||
            $('.recipe-meta-prep, .prep-time-value, [data-prep-time]').first().text() ||
            $('[aria-label*="prep"], [title*="prep"], .recipe-times .prep').first().text() ||
            $('.recipe-time:contains("prep") ~ .time-value, .time-prep').first().text()
        );
        
        const cookTime = this.sanitizeText(
            $('.recipe-timing .cook-time, [data-testid="cook-time"], .cooking-time').first().text() ||
            $('.recipe-meta-cook, .cook-time-value, [data-cook-time]').first().text() ||
            $('[aria-label*="cook"], [title*="cook"], .recipe-times .cook').first().text() ||
            $('.recipe-time:contains("cook") ~ .time-value, .time-cook').first().text()
        );
        
        const totalTime = this.sanitizeText(
            $('.recipe-timing .total-time, [data-testid="total-time"], .recipe-duration').first().text() ||
            $('.recipe-meta-total, .total-time-value, [data-total-time]').first().text() ||
            $('[aria-label*="total"], [title*="total"], .recipe-times .total').first().text() ||
            $('.recipe-time:contains("total") ~ .time-value, .time-total').first().text()
        );
        
        const servings = this.sanitizeText(
            $('.recipe-servings, [data-testid="servings"], [data-servings]').first().text() ||
            $('.recipe-yield, .servings-value, .recipe-meta-servings').first().text() ||
            $('[aria-label*="servings"], [title*="servings"], .recipe-serving-size').first().text() ||
            $('.nutrition-info .servings, .recipe-facts .servings').first().text() ||
            $('.recipe-info:contains("serves") .value, .serves-value').first().text()
        );

        // Create and validate recipe object
        const recipe: Recipe = {
            title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl,
            prepTime: prepTime || undefined,
            cookTime: cookTime || undefined,
            totalTime: totalTime || undefined,
            servings: servings || undefined
        };

        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            throw new Error(`[FoodNetwork] Contract validation failed: ${JSON.stringify(validation)}`);
        }

        return recipe;
    }
}
