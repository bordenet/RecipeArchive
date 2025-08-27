// Recipe data structure types
export interface Recipe {
    // Required fields
    title: string;       // Required, max 200 chars
    source: string;      // Required, valid URL of the original recipe
    ingredients: string[]; // Required, non-empty list
    instructions: string[]; // Required, non-empty list

    // Optional fields
    author?: string;     // Author name
    imageUrl?: string;   // URL to recipe image
    prepTime?: string;   // ISO 8601 duration preferred
    cookTime?: string;   // ISO 8601 duration preferred
    totalTime?: string;  // ISO 8601 duration preferred
    servings?: string;   // Number or descriptive text
    notes?: string[];    // Additional recipe notes/tips
    tags?: string[];     // Recipe categories/keywords
}

export interface ValidationResult {
    isValid: boolean;
    missingFields: string[];   // Required fields that are missing
    invalidFields: string[];   // Fields that fail validation rules
    warnings: string[];        // Non-critical issues to report
    fieldErrors: {
        [key: string]: {
            code: string;      // Error code (e.g., 'TOO_LONG', 'INVALID_FORMAT')
            message: string;   // Human-readable error message
            value?: any;      // The invalid value (for debugging)
        }
    };
}

// JSON-LD types
export interface JsonLdRecipe {
    "@type": string;
    "@graph"?: JsonLdRecipe[];
    name?: string;
    author?: string | { name: string };
    recipeIngredient?: string[];
    recipeInstructions?: (string | { text: string })[];
    image?: string | { url: string } | (string | { url: string })[];
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    recipeYield?: string;
    description?: string;
}
