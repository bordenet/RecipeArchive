// TypeScript Parser Bundle for Chrome Extension
// This file bundles all the TypeScript parsers into a single browser-compatible file

// Base Parser Class
class BaseParser {
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
                    const recipe = jsonData.find((item) =>
                        item && typeof item === "object" && item["@type"] === "Recipe"
                    );
                    if (recipe) return recipe;
                }

                // Handle @graph structure
                if (jsonData["@graph"]) {
                    const recipe = jsonData["@graph"].find((item) =>
                        item && typeof item === "object" && item["@type"] === "Recipe"
                    );
                    if (recipe) return recipe;
                }
            } catch (err) {
                console.warn("Error parsing JSON-LD:", err);
            }
        }

        return null;
    }

    sanitizeText(text) {
        return text?.trim()
            .replace(/\s+/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")  // Remove zero-width spaces
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
            } catch (err) {
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

// Food Network Parser  
class FoodNetworkParser extends BaseParser {
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
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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

        const imageEl = doc.querySelector(".recipe-hero img, .o-AssetPhoto img, img");
        const imageUrl = imageEl?.getAttribute("src") || undefined;

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl
        };

        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            throw new Error(`Failed to extract recipe: ${validation.missingFields.join(", ")}`);
        }

        return recipe;
    }
}

// NYT Cooking Parser
class NYTCookingParser extends BaseParser {
    canParse(url) {
        return url.includes("cooking.nytimes.com");
    }

    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "NYT Cooking",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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

        // Fallback to DOM parsing for NYT Cooking specific selectors
        const title = this.extractElements(doc, [
            "h1.recipe-title",
            "h1[data-testid=\"recipe-title\"]",
            "h1.pantry-recipe-title",
            "h1"
        ])[0];

        const author = this.extractElements(doc, [
            ".recipe-author",
            "[data-testid=\"recipe-author\"]",
            ".byline-author",
            ".author"
        ])[0] || "NYT Cooking";

        const ingredients = this.extractElements(doc, [
            "[data-testid=\"IngredientList\"] li",
            ".recipe-ingredients li",
            ".ingredients-section li",
            "[data-module=\"Ingredients\"] li",
            "ul[data-testid=\"ingredients\"] li"
        ]);

        const instructions = this.extractElements(doc, [
            "[data-testid=\"MethodList\"] li",
            ".recipe-instructions li",
            ".instructions-section li", 
            "[data-module=\"Instructions\"] li",
            "ol[data-testid=\"instructions\"] li"
        ]);

        const imageEl = doc.querySelector(".recipe-photo img, [data-testid=\"recipe-image\"] img, img");
        const imageUrl = imageEl?.getAttribute("src") || undefined;

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl
        };

        const validation = this.validateRecipe(recipe);
        if (!validation.isValid) {
            throw new Error(`Failed to extract recipe: ${validation.missingFields.join(", ")}`);
        }

        return recipe;
    }
}

// Smitten Kitchen Parser
class SmittenKitchenParser extends BaseParser {
    canParse(url) {
        return url.includes("smittenkitchen.com");
    }

    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Deb Perelman",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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

        const author = this.extractElements(doc, [
            'p.recipe-meta + p',
            '.author-meta',
            '.author'
        ])[0]?.replace('Author:', '').trim() || 'Deb Perelman';

        // Extract ingredients - check for Jetpack recipe format first
        let ingredients = this.extractElements(doc, [
            ".jetpack-recipe-ingredient",
            ".recipe-ingredients ul li",
            ".ingredients li",
            "[class*=\"ingredient\"] li"
        ]);

        // Extract instructions - check for Jetpack recipe format first
        let instructions = [];
        
        // Check for Jetpack recipe directions first
        const jetpackDirections = this.extractElements(doc, [".jetpack-recipe-directions"]);
        if (jetpackDirections.length > 0) {
            // Jetpack stores all instructions in a single text block, split by periods or new lines
            const fullText = jetpackDirections[0];
            instructions = fullText.split(/\.\s+|\n\s*/).filter(step => step.trim().length > 10);
        } else {
            // Fallback to standard selectors
            instructions = this.extractElements(doc, [
                ".recipe-instructions ol li",
                ".instructions li",
                ".recipe-method ol li",
                ".recipe-steps ol li",
                ".recipe-method li",
                ".method li",
                ".steps li",
                ".instructions-section li"
            ]);
        }

        // If no instructions found, look in main content area
        if (instructions.length === 0) {
            const contentArea = doc.querySelector(".entry-content");
            if (contentArea) {
                const orderedLists = Array.from(contentArea.querySelectorAll("ol"));
                for (const list of orderedLists) {
                    const listItems = Array.from(list.querySelectorAll("li"))
                        .map(li => li.textContent?.trim())
                        .filter(text => text && text.length > 20);

                    if (listItems.length > 0) {
                        instructions = listItems;
                        break;
                    }
                }
            }
        }

        // Try to find image
        const imageEl = doc.querySelector(".post-photo img, .entry-content img");
        let imageUrl;
        if (imageEl) {
            const imgSrc = imageEl.getAttribute("src");
            if (imgSrc) {
                imageUrl = imgSrc;
            }
        }

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl
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

// Parser Registry
// AllRecipes Parser
class AllRecipesParser extends BaseParser {
    canParse(url) {
        return url.includes("allrecipes.com");
    }

    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : 
                       jsonLd.author?.name || "AllRecipes",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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

        // Fallback to DOM parsing for AllRecipes specific selectors
        const title = this.extractElements(doc, [
            "h1.recipe-summary__h1",
            "h1.entry-title",
            ".recipe-title h1",
            ".recipe-header h1",
            "h1"
        ])[0];

        const author = this.extractElements(doc, [
            ".recipe-summary__author",
            ".by-author",
            ".recipe-author",
            ".attribution__by"
        ])[0] || "AllRecipes";

        const ingredients = this.extractElements(doc, [
            ".recipe-ingred_txt",
            ".ingredients-item-name", 
            ".recipe-ingredient",
            ".ingredient-list li",
            "span[data-ingredient]",
            ".mntl-structured-ingredients__list-item",
            "[data-ingredient-name]"
        ]);

        const instructions = this.extractElements(doc, [
            ".recipe-directions__list--item",
            ".instructions-section .section-body",
            ".recipe-instruction",
            ".direction-list li",
            ".mntl-sc-block-group--LI .mntl-sc-block",
            ".recipe-directions li"
        ]);

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl: doc.querySelector(".recipe-summary__image img, .hero-photo__image, .primary-image img, img[data-src]")?.getAttribute("src") || undefined
        };

        return recipe;
    }
}

// Love and Lemons Parser
class LoveAndLemonsParser extends BaseParser {
    canParse(url) {
        return url.includes("loveandlemons.com");
    }

    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : 
                       jsonLd.author?.name || "Love and Lemons",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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
            ".entry-title",
            ".recipe-card-title",
            ".wp-block-group h1",
            "h1.has-large-font-size",
            "h1"
        ])[0];

        const author = this.extractElements(doc, [
            ".recipe-card-author",
            ".author-name", 
            ".entry-author",
            ".byline"
        ])[0] || "Love and Lemons";

        const ingredients = this.extractElements(doc, [
            ".wp-block-recipe-card-blocks-ingredients ul li",
            ".recipe-ingredients li",
            ".ingredient-list li",
            ".wp-block-list li",
            "[data-ingredient]"
        ]);

        const instructions = this.extractElements(doc, [
            ".wp-block-recipe-card-blocks-instructions ol li",
            ".recipe-instructions li", 
            ".recipe-method li",
            ".wp-block-list.instructions li",
            ".method-step"
        ]);

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl: doc.querySelector(".recipe-card-image img, .wp-post-image, .entry-content img:first-of-type, .featured-image img")?.getAttribute("src") || undefined
        };

        return recipe;
    }
}

// Food52 Parser
class Food52Parser extends BaseParser {
    canParse(url) {
        return url.includes("food52.com");
    }

    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : 
                       jsonLd.author?.name || "Food52",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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
            ".recipe__title",
            ".recipe-header h1",
            ".content-header h1",
            "h1.recipe-title",
            "h1"
        ])[0];

        const author = this.extractElements(doc, [
            ".recipe__author",
            ".byline .author",
            ".recipe-author",
            ".content-header .author"
        ])[0] || "Food52";

        const ingredients = this.extractElements(doc, [
            ".recipe__ingredients li",
            ".recipe-ingredients li", 
            ".ingredients-list li",
            ".recipe-ingredient",
            "[data-ingredient]"
        ]);

        const instructions = this.extractElements(doc, [
            ".recipe__instructions li",
            ".recipe-instructions li",
            ".recipe-method li",
            ".instructions-list li",
            ".recipe-step"
        ]);

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl: doc.querySelector(".recipe__image img, .recipe-hero img, .content-image img, .featured-image img")?.getAttribute("src") || undefined
        };

        return recipe;
    }
}

// Epicurious Parser
class EpicuriousParser extends BaseParser {
    canParse(url) {
        return url.includes("epicurious.com");
    }

    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : 
                       jsonLd.author?.name || "Epicurious",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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
            ".recipe__header h1",
            ".recipe-title",
            ".content-header h1",
            "h1.recipe-hed",
            "h1"
        ])[0];

        const author = this.extractElements(doc, [
            ".recipe__header .by",
            ".recipe-author",
            ".byline .author",
            ".author-name"
        ])[0] || "Epicurious";

        const ingredients = this.extractElements(doc, [
            ".recipe__ingredients li",
            ".ingredients li",
            ".recipe-ingredients li",
            "[data-testid=\"ingredients-list\"] li",
            ".ingredient"
        ]);

        const instructions = this.extractElements(doc, [
            ".recipe__instructions li",
            ".instructions li",
            ".recipe-instructions li",
            "[data-testid=\"instructions-list\"] li",
            ".instruction"
        ]);

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl: doc.querySelector(".recipe__image img, .recipe-hero img, .lede-image img, .primary-image img")?.getAttribute("src") || undefined
        };

        return recipe;
    }
}

// Alexandra Cooks Parser
class AlexandraCooksParser extends BaseParser {
    canParse(url) {
        return url.includes("alexandracooks.com");
    }

    async parse(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // First try JSON-LD
        const jsonLd = this.extractJsonLD(html);
        if (jsonLd) {
            const recipe = {
                title: this.sanitizeText(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : 
                       jsonLd.author?.name || "Alexandra Cooks",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeText(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
                ),
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
            ".entry-title",
            ".recipe-title", 
            ".post-title",
            "h1.entry-title",
            "h1"
        ])[0];

        const author = this.extractElements(doc, [
            ".recipe-author",
            ".author-name",
            ".entry-author",
            ".byline"
        ])[0] || "Alexandra Cooks";

        const ingredients = this.extractElements(doc, [
            ".recipe-ingredients li",
            ".ingredients li",
            ".wp-block-list li",
            ".ingredient-list li",
            "[data-ingredient]"
        ]);

        const instructions = this.extractElements(doc, [
            ".recipe-instructions li",
            ".instructions li", 
            ".recipe-method li",
            ".wp-block-list.instructions li",
            ".method-step"
        ]);

        const recipe = {
            title: title || document.title,
            source: url,
            author,
            ingredients,
            instructions,
            imageUrl: doc.querySelector(".recipe-image img, .wp-post-image, .entry-content img:first-of-type, .featured-image img")?.getAttribute("src") || undefined
        };

        return recipe;
    }
}

class ParserRegistry {
    constructor() {
        this.parsers = [];
        // Register all parsers
        this.parsers.push(
            new SmittenKitchenParser(),
            new FoodNetworkParser(), 
            new NYTCookingParser(),
            new AllRecipesParser(),
            new LoveAndLemonsParser(),
            new Food52Parser(),
            new EpicuriousParser(),
            new AlexandraCooksParser()
        );
    }

    async parseRecipe(html, url) {
        // Find the first parser that can handle this URL
        const parser = this.parsers.find(p => p.canParse(url));

        if (parser) {
            // Use site-specific parser
            try {
                const recipe = await parser.parse(html, url);
                return recipe;
            } catch (err) {
                console.error(`Error parsing recipe from ${url} with site-specific parser:`, err);
                // Fall back to JSON-LD if site-specific parsing fails
            }
        }

        // Try JSON-LD extraction as universal fallback
        console.log(`No site-specific parser for ${url}, trying JSON-LD extraction`);
        const jsonLd = this.extractJsonLDStatic(html);
        
        if (jsonLd && jsonLd.name) {
            // Transform JSON-LD to our Recipe format
            const recipe = {
                title: this.sanitizeTextStatic(jsonLd.name),
                source: url,
                author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Unknown",
                ingredients: (jsonLd.recipeIngredient || []).map(i => this.sanitizeTextStatic(i)),
                instructions: (jsonLd.recipeInstructions || []).map(i =>
                    typeof i === "string" ? this.sanitizeTextStatic(i) : this.sanitizeTextStatic(i.text)
                ),
                imageUrl: typeof jsonLd.image === "string" ? jsonLd.image :
                    Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) :
                        jsonLd.image?.url,
                prepTime: jsonLd.prepTime,
                cookTime: jsonLd.cookTime,
                totalTime: jsonLd.totalTime,
                servings: jsonLd.recipeYield?.toString()
            };

            const validation = this.validateRecipeStatic(recipe);
            if (validation.isValid) {
                console.log(`✅ JSON-LD extraction successful for ${url}`);
                return recipe;
            } else {
                console.warn(`❌ JSON-LD validation failed for ${url}:`, validation.missingFields.join(", "));
            }
        }

        console.warn(`❌ No recipe data found for ${url}`);
        return null;
    }

    getParserForUrl(url) {
        return this.parsers.find(p => p.canParse(url)) || null;
    }

    // Static helper methods for JSON-LD fallback
    extractJsonLDStatic(html) {
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
                    const recipe = jsonData.find((item) =>
                        item && typeof item === "object" && item["@type"] === "Recipe"
                    );
                    if (recipe) return recipe;
                }

                // Handle @graph structure
                if (jsonData["@graph"]) {
                    const recipe = jsonData["@graph"].find((item) =>
                        item && typeof item === "object" && item["@type"] === "Recipe"
                    );
                    if (recipe) return recipe;
                }
            } catch (err) {
                console.warn("Error parsing JSON-LD:", err);
            }
        }

        return null;
    }

    sanitizeTextStatic(text) {
        return text?.trim()
            .replace(/\s+/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")  // Remove zero-width spaces
            .trim() || "";
    }

    validateRecipeStatic(recipe) {
        const missingFields = [];
        const invalidFields = [];
        const warnings = [];
        const fieldErrors = {};

        // Check required fields
        if (!recipe.title) missingFields.push("title");
        if (!recipe.source) missingFields.push("source");
        if (!recipe.ingredients?.length) missingFields.push("ingredients");
        if (!recipe.instructions?.length) missingFields.push("instructions");

        return {
            isValid: missingFields.length === 0 && invalidFields.length === 0,
            missingFields,
            invalidFields,
            warnings,
            fieldErrors
        };
    }
}

// Export functions for use in content script
window.TypeScriptParser = {
    async extractRecipeFromPage() {
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
    },

    canTypeScriptParserHandle(url) {
        const registry = new ParserRegistry();
        return registry.getParserForUrl(url) !== null;
    }
};

console.log("🎯 TypeScript parser bundle loaded");