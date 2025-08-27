import { ParserRegistry } from '../shared/parsers/parser-registry';

/**
 * Bridge between web extensions and TypeScript parser system.
 * This ensures we're using the same parsing logic across the entire system.
 */
export async function extractRecipeFromPage(): Promise<any> {
    const registry = new ParserRegistry();
    const url = window.location.href;
    
    console.log("🔍 Using TypeScript parser registry for:", url);

    try {
        // Use the TypeScript parser registry to parse the page
        const recipe = await registry.parseRecipe(document.documentElement.outerHTML, url);

        if (!recipe) {
            console.log("⚠️ No TypeScript parser found for this URL, using fallback");
            return {
                title: document.title || "Unknown Recipe",
                url: window.location.href,
                timestamp: new Date().toISOString(),
                ingredients: [],
                steps: [],
                source: "no-typescript-parser-available"
            };
        }

        // Transform the parsed recipe into the format expected by the web extensions
        const transformedRecipe = {
            title: recipe.title,
            url: recipe.source,
            timestamp: new Date().toISOString(),
            // Convert flat string arrays to grouped format for extension compatibility
            ingredients: recipe.ingredients.length > 0 ? [{ title: null, items: recipe.ingredients }] : [],
            steps: recipe.instructions.length > 0 ? [{ title: null, items: recipe.instructions }] : [],
            servingSize: recipe.servings || null,
            time: recipe.totalTime || recipe.cookTime || recipe.prepTime || null,
            prepTime: recipe.prepTime || null,
            cookTime: recipe.cookTime || null,
            photos: recipe.imageUrl ? [recipe.imageUrl] : [],
            source: "typescript-parser",
            author: recipe.author,
            notes: recipe.notes
        };

        console.log("✅ TypeScript parser extracted recipe:", {
            title: transformedRecipe.title,
            ingredientCount: transformedRecipe.ingredients.length,
            stepCount: transformedRecipe.steps.length,
            source: transformedRecipe.source
        });

        return transformedRecipe;
    } catch (error) {
        console.error("🚨 TypeScript recipe parsing error:", error);
        return {
            title: document.title || "Unknown Recipe",
            url: window.location.href,
            timestamp: new Date().toISOString(),
            ingredients: [],
            steps: [],
            source: "typescript-parser-error",
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Check if TypeScript parser registry can handle the current URL
 */
export function canTypeScriptParserHandle(url: string): boolean {
    const registry = new ParserRegistry();
    return registry.getParserForUrl(url) !== null;
}

/**
 * Fallback JSON-LD extraction using TypeScript base parser utilities
 */
export function extractJsonLdWithTypeScript(html: string): any | null {
    try {
        // Use the BaseParser's JSON-LD extraction logic
        const doc = new DOMParser().parseFromString(html, "text/html");
        const scripts = Array.from(doc.querySelectorAll("script[type='application/ld+json']"));

        for (const script of scripts) {
            try {
                const jsonData = JSON.parse(script.textContent || "");

                // Handle single recipe
                if (jsonData["@type"] === "Recipe") {
                    return jsonData;
                }

                // Handle array of items
                if (Array.isArray(jsonData)) {
                    const recipe = jsonData.find((item: unknown) =>
                        item && typeof item === "object" && (item as any)["@type"] === "Recipe"
                    );
                    if (recipe) return recipe;
                }

                // Handle @graph structure
                if (jsonData["@graph"]) {
                    const recipe = jsonData["@graph"].find((item: unknown) =>
                        item && typeof item === "object" && (item as any)["@type"] === "Recipe"
                    );
                    if (recipe) return recipe;
                }
            } catch (err) {
                console.warn("Error parsing JSON-LD:", err);
            }
        }

        return null;
    } catch (error) {
        console.error("Error extracting JSON-LD with TypeScript:", error);
        return null;
    }
}
