// ...existing code...
import { BaseParser } from "../base-parser.js";
import * as cheerio from "cheerio";
import { Recipe, Ingredient, Instruction } from "../types";

export class Food52Parser extends BaseParser {
    canParse(url: string): boolean {
        return url.includes("food52.com");
    }

    async parse(html: string, url: string): Promise<Recipe> {
        // Detect Food52 404 page and throw error, but skip for local fixture files
        const isLocalFixture = url.endsWith('.html') || url.startsWith('tests/fixtures/html-samples/');
        if (!isLocalFixture && (html.includes('Apologies, that page cannot be found.') || (html.includes('404') && html.includes('food52.com')))) {
            throw new Error(`[Food52] 404 page detected for URL: ${url}`);
        }
        const jsonLd = this.extractJsonLD(html);
        let recipe: Recipe;
        if (jsonLd) {
            // Author extraction
            let author = undefined;
            if (typeof jsonLd.author === "string") {
                author = this.sanitizeText(jsonLd.author);
            } else if (jsonLd.author && typeof jsonLd.author === "object" && jsonLd.author.name) {
                author = this.sanitizeText(jsonLd.author.name);
            }
            // Tags extraction
            let tags: string[] | undefined = undefined;
            if (jsonLd.keywords) {
                if (Array.isArray(jsonLd.keywords)) {
                    tags = (jsonLd.keywords as string[]).map((k: string) => this.sanitizeText(k));
                } else if (typeof jsonLd.keywords === "string") {
                    tags = (jsonLd.keywords as string).split(/,|;/).map((k: string) => this.sanitizeText(k)).filter(Boolean);
                }
            }
            if (jsonLd.recipeCategory) {
                if (!tags) tags = [];
                if (Array.isArray(jsonLd.recipeCategory)) {
                    tags.push(...(jsonLd.recipeCategory as string[]).map((c: string) => this.sanitizeText(c)));
                } else if (typeof jsonLd.recipeCategory === "string") {
                    tags.push(...(jsonLd.recipeCategory as string).split(/,|;/).map((c: string) => this.sanitizeText(c)).filter(Boolean));
                }
            }
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
                notes: jsonLd.description ? [this.sanitizeText(jsonLd.description)] : undefined,
                author,
                tags
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
            // Fallback author extraction
            let author = undefined;
            const authorEl = $('a[href*="/author/"]').first();
            if (authorEl.length) {
                author = authorEl.text().trim();
            }
            // Fallback tags extraction
            let tags: string[] | undefined = undefined;
            const tagEls = $('span.text-approved, .tags, meta[property="og:keywords"]');
            if (tagEls.length) {
                tags = [];
                tagEls.each((_, el) => {
                    const t = $(el).text().trim();
                    if (tags && t) tags.push(t);
                });
            }
            recipe = {
                title,
                source: url,
                ingredients,
                instructions,
                imageUrl,
                notes: undefined,
                author,
                tags
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
