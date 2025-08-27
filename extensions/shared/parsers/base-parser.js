// Base parser class for recipe extraction
class BaseParser {
    constructor() {
        if (this.constructor === BaseParser) {
            throw new Error("Cannot instantiate abstract BaseParser class");
        }
    }

    // Abstract methods that must be implemented by subclasses
    async parse(html, url) {
        throw new Error("parse() must be implemented by subclass");
    }

    canParse(url) {
        throw new Error("canParse() must be implemented by subclass");
    }

    // Utility methods
    protected extractJsonLD(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const scripts = doc.querySelectorAll("script[type=\"application/ld+json\"]");

        for (const script of scripts) {
            try {
                const jsonData = JSON.parse(script.textContent || "");

                // Handle single recipe
                if (jsonData["@type"] === "Recipe") {
                    return jsonData;
                }

                // Handle array of items
                if (Array.isArray(jsonData)) {
                    const recipe = jsonData.find(item => item && item["@type"] === "Recipe");
                    if (recipe) return recipe;
                }

                // Handle @graph structure
                if (jsonData["@graph"]) {
                    const recipe = jsonData["@graph"].find(item => item && item["@type"] === "Recipe");
                    if (recipe) return recipe;
                }
            } catch (err) {
                console.warn("Error parsing JSON-LD:", err);
            }
        }

        return null;
    }

    protected sanitizeText(text) {
        return text?.trim()
            .replace(/\s+/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")  // Remove zero-width spaces
            .trim() || "";
    }

    protected extractElements(doc, selectors) {
        if (typeof selectors === "string") {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            try {
                const elements = doc.querySelectorAll(selector);
                if (elements.length) {
                    return Array.from(elements)
                        .map(el => this.sanitizeText(el.textContent))
                        .filter(text => text.length > 0);
                }
            } catch (err) {
                console.warn(`Error with selector "${selector}":`, err);
            }
        }

        return [];
    }
}
