import { Recipe, ValidationResult, JsonLdRecipe } from "./types";

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
        const doc = new DOMParser().parseFromString(html, "text/html");
        const scripts = Array.from(doc.querySelectorAll("script[type=\"application/ld+json\"]"));

        for (const script of scripts) {
            try {
                const jsonData = JSON.parse(script.textContent || "");

                // Handle single recipe
                if (jsonData["@type"] === "Recipe") {
                    return jsonData as JsonLdRecipe;
                }

                // Handle array of items
                if (Array.isArray(jsonData)) {
                    const recipe = jsonData.find((item: unknown) =>
                        item && typeof item === "object" && (item as JsonLdRecipe)["@type"] === "Recipe"
                    );
                    if (recipe) return recipe as JsonLdRecipe;
                }

                // Handle @graph structure
                if (jsonData["@graph"]) {
                    const recipe = jsonData["@graph"].find((item: unknown) =>
                        item && typeof item === "object" && (item as JsonLdRecipe)["@type"] === "Recipe"
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
        const invalidFields: string[] = [];
        const warnings: string[] = [];
        const fieldErrors: Record<string, { code: string; message: string; value: string }> = {};

        // Check required fields
        if (!recipe.title) missingFields.push("title");
        if (!recipe.source) missingFields.push("source");
        if (!recipe.ingredients?.length) missingFields.push("ingredients");
        if (!recipe.instructions?.length) missingFields.push("instructions");

        // Validate field lengths and content
        if (recipe.title && recipe.title.length > 200) {
            invalidFields.push("title");
            fieldErrors.title = {
                code: "TOO_LONG",
                message: "Title must be 200 characters or less",
                value: recipe.title
            };
        }

        // Add warnings for missing optional fields
        if (!recipe.imageUrl) warnings.push("No image URL provided");
        if (!recipe.prepTime && !recipe.cookTime && !recipe.totalTime) {
            warnings.push("No timing information available");
        }
        if (!recipe.servings) warnings.push("No serving size information");

        return {
            isValid: missingFields.length === 0 && invalidFields.length === 0,
            missingFields,
            invalidFields,
            warnings,
            fieldErrors
        };
    }
}
