import { BaseParser } from "../base-parser";
export class FoodNetworkParser extends BaseParser {
    canParse(url) {
        return url.includes("foodnetwork.com");
    }
    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Food Network",
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
        // Fallback to DOM parsing for Food Network specific selectors
        const title = this.extractElements(doc, [
            "h1.o-AssetTitle__a-HeadlineText",
            "h1.recipe-title",
            "h1"
        ])[0];
        const author = this.extractElements(doc, [
            ".o-Attribution__a-Name",
            ".recipe-author",
            ".chef-name"
        ])[0] || "Food Network";
        // Extract ingredients with Food Network specific selectors
        const ingredients = this.extractElements(doc, [
            ".o-RecipeIngredients__a-Ingredient",
            ".o-Ingredients__a-Ingredient",
            ".o-RecipeInfo__a-Ingredients li",
            ".o-Ingredients__a-ListItem",
            "[data-module=\"IngredientsList\"] li",
            ".recipe-ingredients li",
            ".o-RecipeIngredients li",
            "section[aria-labelledby=\"recipe-ingredients-section\"] li"
        ]);
        // Extract instructions with Food Network specific selectors  
        const instructions = this.extractElements(doc, [
            ".o-Method__m-Step",
            ".recipe-instructions .o-Method__m-Step",
            ".o-Method__m-Body li",
            ".o-Method li",
            "[data-module=\"InstructionsList\"] li",
            ".recipe-instructions ol li",
            ".recipe-instructions li",
            ".recipe-directions li",
            "section[aria-labelledby=\"recipe-instructions-section\"] li"
        ]);
        // Extract image
        const imageEl = doc.querySelector(".recipe-hero img, .o-AssetPhoto img, img");
        const imageUrl = imageEl?.getAttribute("src") || undefined;
        // Extract timing information
        const prepTime = this.extractElements(doc, [
            "[data-module=\"RecipeInfo\"] .prep-time",
            ".recipe-prep-time",
            ".prep-time"
        ])[0];
        const cookTime = this.extractElements(doc, [
            "[data-module=\"RecipeInfo\"] .cook-time",
            ".recipe-cook-time",
            ".cook-time"
        ])[0];
        const servings = this.extractElements(doc, [
            "[data-module=\"RecipeInfo\"] .servings",
            ".recipe-servings",
            ".servings",
            ".yield"
        ])[0];
        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl,
            prepTime,
            cookTime,
            servings
        };
        // Validate before returning
        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            console.warn("Recipe validation failed:", validation.missingFields.join(", "));
            throw new Error(`Failed to extract recipe: ${validation.missingFields.join(", ")}`);
        }
        return recipe;
    }
}
