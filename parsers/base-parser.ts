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
                let jsonText = $(script).html() || $(script).text() || "";
                // Remove control characters that break JSON.parse
                jsonText = jsonText.replace(/[\u0000-\u001F\u007F]/g, "");
                // Fix undefined values in JSON (common Food52 issue)
                jsonText = jsonText.replace(/:\s*undefined\b/g, ': null').replace(/,\s*undefined\b/g, ', null').replace(/\[\s*undefined\b/g, '[null');
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
        if (!text) return "";
        
        // First decode HTML entities
        let cleaned = this.decodeHtmlEntities(text);
        
        // Then normalize whitespace and remove zero-width characters
        return cleaned.trim()
            .replace(/\s+/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")  // Remove zero-width spaces
            .trim();
    }

    /**
     * Decode HTML entities in text strings
     * Handles common entities like &#8211; -> –, &#39; -> ', &quot; -> ", etc.
     */
    private decodeHtmlEntities(text: string): string {
        if (!text) return text;
        
        // Common HTML entities mapping
        const entityMap: { [key: string]: string } = {
            // Numeric entities (including the problematic em dash)
            '&#8211;': '–',  // En dash - this fixes the reported issue
            '&#8212;': '—',  // Em dash
            '&#39;': "'",    // Apostrophe
            '&#x27;': "'",   // Apostrophe (hex)
            '&#34;': '"',    // Double quote
            '&#x22;': '"',   // Double quote (hex)
            '&#38;': '&',    // Ampersand
            '&#x26;': '&',   // Ampersand (hex)
            '&#60;': '<',    // Less than
            '&#x3C;': '<',   // Less than (hex)
            '&#62;': '>',    // Greater than
            '&#x3E;': '>',   // Greater than (hex)
            '&#32;': ' ',    // Space
            '&#x20;': ' ',   // Space (hex)
            '&#160;': ' ',   // Non-breaking space
            '&#xa0;': ' ',   // Non-breaking space (hex)
            
            // Named entities
            '&quot;': '"',
            '&apos;': "'",
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&nbsp;': ' ',   // Non-breaking space
            '&ndash;': '–',  // En dash
            '&mdash;': '—',  // Em dash
            '&hellip;': '…', // Horizontal ellipsis
            '&rsquo;': "'",  // Right single quotation mark
            '&lsquo;': "'",  // Left single quotation mark  
            '&rdquo;': '"',  // Right double quotation mark
            '&ldquo;': '"',  // Left double quotation mark
            '&deg;': '°',    // Degree symbol
            '&frac12;': '½', // Fraction 1/2
            '&frac14;': '¼', // Fraction 1/4
            '&frac34;': '¾', // Fraction 3/4
        };
        
        let decoded = text;
        
        // Replace all known entities
        for (const [entity, replacement] of Object.entries(entityMap)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
        }
        
        // Handle generic numeric entities (&#123; format)
        decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
            try {
                return String.fromCharCode(parseInt(code, 10));
            } catch (e) {
                return match; // Return original if parsing fails
            }
        });
        
        // Handle generic hex entities (&#x1A; format)
        decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, code) => {
            try {
                return String.fromCharCode(parseInt(code, 16));
            } catch (e) {
                return match; // Return original if parsing fails
            }
        });
        
        return decoded;
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
