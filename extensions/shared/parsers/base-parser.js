export class BaseParser {
    constructor() {
        if (this.constructor === BaseParser) {
            throw new Error("Cannot instantiate abstract BaseParser class");
        }
    }
    // Utility methods
    extractJsonLD(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const scripts = Array.from(doc.querySelectorAll("script[type=\"application/ld+json\"]"));
        for (const script of scripts) {
            try {
                const jsonData = JSON.parse(script.textContent || "");
                // Handle single recipe
                if (jsonData["@type"] === "Recipe") {
                    return jsonData;
                }
                // Handle array of items
                if (Array.isArray(jsonData)) {
                    const recipe = jsonData.find((item) => item && typeof item === "object" && item["@type"] === "Recipe");
                    if (recipe)
                        return recipe;
                }
                // Handle @graph structure
                if (jsonData["@graph"]) {
                    const recipe = jsonData["@graph"].find((item) => item && typeof item === "object" && item["@type"] === "Recipe");
                    if (recipe)
                        return recipe;
                }
            }
            catch (err) {
                console.warn("Error parsing JSON-LD:", err);
            }
        }
        return null;
    }
    sanitizeText(text) {
        return text?.trim()
            .replace(/\s+/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width spaces
            .trim() || "";
    }
    extractElements(doc, selectors) {
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
            }
            catch (err) {
                console.warn(`Error with selector "${selector}":`, err);
            }
        }
        return [];
    }
    validateRecipe(recipe) {
        const missingFields = [];
        const invalidFields = [];
        const warnings = [];
        const fieldErrors = {};
        // Check required fields
        if (!recipe.title)
            missingFields.push("title");
        if (!recipe.source)
            missingFields.push("source");
        if (!recipe.ingredients?.length)
            missingFields.push("ingredients");
        if (!recipe.instructions?.length)
            missingFields.push("instructions");
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
        if (!recipe.imageUrl)
            warnings.push("No image URL provided");
        if (!recipe.prepTime && !recipe.cookTime && !recipe.totalTime) {
            warnings.push("No timing information available");
        }
        if (!recipe.servings)
            warnings.push("No serving size information");
        return {
            isValid: missingFields.length === 0 && invalidFields.length === 0,
            missingFields,
            invalidFields,
            warnings,
            fieldErrors
        };
    }
}
