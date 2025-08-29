import { BaseParser } from "../base-parser";
import { Recipe } from "../types";

export class JsonLdParser extends BaseParser {
    canParse(url: string): boolean {
        // Accept any URL for universal JSON-LD extraction
        return true;
    }

    async parse(html: string, url: string): Promise<Recipe> {
        const jsonLd = this.extractJsonLD(html);
        if (!jsonLd) {
            throw new Error("No valid JSON-LD recipe found");
        }
        return {
            title: this.sanitizeText(jsonLd.name),
            source: url,
            author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name,
            ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
            instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({
                stepNumber: idx + 1,
                text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
            })),
            imageUrl: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
            prepTime: jsonLd.prepTime,
            cookTime: jsonLd.cookTime,
            totalTime: jsonLd.totalTime,
            servings: jsonLd.recipeYield?.toString(),
            notes: jsonLd.description ? [this.sanitizeText(jsonLd.description)] : undefined
        };
    }
}

export default JsonLdParser;
