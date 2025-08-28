import { Recipe, ValidationResult, JsonLdRecipe } from "./types";
import * as cheerio from "cheerio";

export abstract class BaseParser {
    constructor() {
        if (this.constructor === BaseParser) {
            throw new Error("Cannot instantiate abstract BaseParser class");
        }
    }

    // Abstract methods that must be implemented by subclasses
    abstract parse(html: string, url: string): Promise<Recipe>;
    abstract canParse(url: string): boolean;

    // Utility methods
    protected extractJsonLD(html: string): JsonLdRecipe | null {
        const $ = cheerio.load(html);
        const scripts = $('script[type="application/ld+json"]');

        for (let i = 0; i < scripts.length; i++) {
            try {
                const script = scripts[i];
                const jsonText = $(script).html() || $(script).text() || "";
                const jsonData = JSON.parse(jsonText);

                // Helper to check if @type is Recipe (string or array)
                const isRecipeType = (type: unknown): boolean => {
                    if (!type) return false;
                    if (typeof type === "string") return type === "Recipe";
                    if (Array.isArray(type)) return (type as string[]).includes("Recipe");
                    return false;
                };

                // Handle single recipe
                if (isRecipeType(jsonData["@type"])) {
                    return jsonData as JsonLdRecipe;
                }

                // Handle array of items
                if (Array.isArray(jsonData)) {
                    const recipe = jsonData.find((item: any) =>
                        item && typeof item === "object" && isRecipeType(item["@type"])
                    );
                    if (recipe) return recipe as JsonLdRecipe;
                }

                // Handle @graph structure
                if (jsonData["@graph"]) {
                    const recipe = jsonData["@graph"].find((item: any) =>
                        item && typeof item === "object" && isRecipeType(item["@type"])
                    );
                    if (recipe) return recipe as JsonLdRecipe;
                }
            } catch (err) {
                console.warn("Error parsing JSON-LD:", err);
            }
        }

        return null;
    }

    protected sanitizeText(text?: string): string {
        return text?.trim()
            .replace(/\s+/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")  // Remove zero-width spaces
            .trim() || "";
    }

    protected extractElements(doc: Document, selectors: string | string[]): string[] {
        if (typeof selectors === "string") {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            try {
                const elements = Array.from(doc.querySelectorAll(selector));
                if (elements.length) {
                    return elements
                        .map(el => this.sanitizeText(el.textContent))
                        .filter(text => text.length > 0);
                }
            } catch (err) {
                console.warn(`Error with selector "${selector}":`, err);
            }
        }

        return [];
    }

    protected validateRecipe(recipe: Recipe): ValidationResult {
        const missingFields: string[] = [];
        // ...rest of validation logic...
        return {
            isValid: true,
            missingFields,
            invalidFields: [],
            warnings: [],
            fieldErrors: {}
        };
    }
}
