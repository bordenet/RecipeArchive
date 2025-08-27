import { BaseParser } from "../base-parser";
export class SmittenKitchenParser extends BaseParser {
    canParse(url) {
        return url.includes("smittenkitchen.com");
    }
    debugSelectors(doc, selectors) {
        selectors.forEach(selector => {
            const elements = Array.from(doc.querySelectorAll(selector));
            console.debug(`Selector "${selector}" found ${elements.length} elements:`, elements.map(el => ({
                text: el.textContent?.trim(),
                classes: el.className,
                parentClasses: el.parentElement?.className
            })));
        });
    }
    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        // Debug full HTML structure
        console.debug("Full parsed HTML:", doc.documentElement.outerHTML);
        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Deb Perelman",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i => typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)),
                imageUrl: typeof jsonLd.image === "string" ? jsonLd.image :
                    Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) :
                        jsonLd.image?.url,
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
        // Fallback to DOM parsing
        const title = this.extractElements(doc, [
            "h1.entry-title",
            "h1.post-title",
            "h1"
        ])[0];
        // Extract author
        const author = this.extractElements(doc, [
            'p.recipe-meta + p',
            '.author-meta',
            '.author'
        ])[0]?.replace('Author:', '').trim() || 'Deb Perelman';
        // Extract timing information
        const timingText = this.extractElements(doc, [
            '.recipe-meta',
            '.timing',
            'p:contains("Time")'
        ])[0];
        // Extract timing information using more precise regex
        const prepTimeMatch = timingText?.match(/Prep Time: ([\d\s\w]+?)(?=\s*(?:Cook|Total|$))/);
        const cookTimeMatch = timingText?.match(/Cook Time: ([\d\s\w]+?)(?=\s*(?:Total|$))/);
        const totalTimeMatch = timingText?.match(/Total Time: ([\d\s\w]+)$/);
        // Extract image URL
        const img = doc.querySelector('img');
        const imageUrl = img?.getAttribute('src') || undefined;
        // Extract notes
        const notes = this.extractElements(doc, [
            '.recipe-notes li',
            '.notes li',
            '[class*="note"] li'
        ]);
        // Extract ingredients
        const ingredients = this.extractElements(doc, [
            ".recipe-ingredients ul li",
            ".ingredients li",
            "[class*=\"ingredient\"] li"
        ]);
        // Extract instructions
        let instructions = this.extractElements(doc, [
            ".recipe-instructions ol li",
            ".instructions li",
            ".recipe-method ol li",
            ".recipe-steps ol li",
            ".recipe-method li",
            ".method li",
            ".steps li",
            ".instructions-section li"
        ]);
        // If no instructions found in standard sections, try to find the main content ordered list
        if (instructions.length === 0) {
            // Look for .entry-content first, since that's the main content area
            const contentArea = doc.querySelector(".entry-content");
            if (contentArea) {
                // Find all ordered lists in the content area
                const orderedLists = Array.from(contentArea.querySelectorAll("ol"));
                // Look for a list that likely contains instructions (typically longer text items)
                for (const list of orderedLists) {
                    const listItems = Array.from(list.querySelectorAll("li"))
                        .map(li => li.textContent?.trim())
                        .filter(text => text && text.length > 20); // Instructions are typically longer than 20 chars
                    if (listItems.length > 0) {
                        instructions = listItems;
                        break;
                    }
                }
            }
        }
        // Debug selector matches
        this.debugSelectors(doc, [
            ".recipe-instructions ol li",
            ".instructions li",
            ".recipe-method ol li",
            ".recipe-steps ol li",
            ".recipe-method li",
            ".method li",
            ".steps li",
            ".instructions-section li",
            ".entry-content ol li"
        ]);
        // Generate tags based on the recipe title and ingredients
        const tags = new Set();
        const titleWords = (title || '').toLowerCase().split(/\s+/);
        const commonIngredients = ['chocolate', 'zucchini', 'bread', 'cake', 'cookie', 'chicken', 'beef', 'pork', 'fish', 'vegetable'];
        commonIngredients.forEach(ingredient => {
            if (titleWords.includes(ingredient)) {
                tags.add(ingredient);
            }
        });
        ingredients.forEach(ingredient => {
            commonIngredients.forEach(commonIngr => {
                if (ingredient.toLowerCase().includes(commonIngr)) {
                    tags.add(commonIngr);
                }
            });
        });
        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl,
            prepTime: prepTimeMatch?.[1],
            cookTime: cookTimeMatch?.[1],
            totalTime: totalTimeMatch?.[1],
            notes: notes.length > 0 ? notes : undefined,
            tags: tags.size > 0 ? Array.from(tags) : undefined
        };
        // Try to find image
        const imageEl = doc.querySelector(".post-photo img, .entry-content img");
        if (imageEl) {
            const imgSrc = imageEl.getAttribute("src");
            if (imgSrc) {
                recipe.imageUrl = imgSrc;
            }
        }
        // Validate before returning
        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            console.warn("Recipe validation failed:", validation.missingFields.join(", "));
            throw new Error(`Failed to extract recipe: ${validation.missingFields.join(", ")}`);
        }
        return recipe;
    }
}
