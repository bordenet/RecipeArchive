const URL_REGEX = /^https?:\/\/.+/;
const MAX_TITLE_LENGTH = 200;
const MAX_INSTRUCTION_LENGTH = 5000;
export function validateRecipe(recipe) {
    const result = {
        isValid: true,
        missingFields: [],
        invalidFields: [],
        warnings: [],
        fieldErrors: {}
    };
    // Required fields presence check
    const requiredFields = ['title', 'source', 'ingredients', 'instructions'];
    for (const field of requiredFields) {
        if (!recipe[field]) {
            result.missingFields.push(field);
            result.isValid = false;
        }
    }
    // Title validation
    if (recipe.title) {
        if (recipe.title.length > MAX_TITLE_LENGTH) {
            result.invalidFields.push('title');
            result.fieldErrors.title = {
                code: 'TOO_LONG',
                message: `Title must be ${MAX_TITLE_LENGTH} characters or less`,
                value: recipe.title
            };
            result.isValid = false;
        }
        if (/<[^>]*>/g.test(recipe.title)) {
            const sanitized = recipe.title.replace(/<[^>]*>/g, '');
            recipe.title = sanitized;
            result.warnings.push('Title contained HTML that was removed');
        }
    }
    // Source URL validation
    if (recipe.source) {
        if (!URL_REGEX.test(recipe.source)) {
            result.invalidFields.push('source');
            result.fieldErrors.source = {
                code: 'INVALID_FORMAT',
                message: 'Source must be a valid HTTP(S) URL',
                value: recipe.source
            };
            result.isValid = false;
        }
        if (/^javascript:/i.test(recipe.source)) {
            result.invalidFields.push('source');
            result.fieldErrors.source = {
                code: 'INVALID_PROTOCOL',
                message: 'Invalid URL protocol',
                value: recipe.source
            };
            result.isValid = false;
        }
    }
    // Ingredients validation
    if (recipe.ingredients) {
        if (!Array.isArray(recipe.ingredients)) {
            result.invalidFields.push('ingredients');
            result.fieldErrors.ingredients = {
                code: 'INVALID_TYPE',
                message: 'Ingredients must be an array',
                value: recipe.ingredients
            };
            result.isValid = false;
        }
        else if (recipe.ingredients.length === 0) {
            result.invalidFields.push('ingredients');
            result.fieldErrors.ingredients = {
                code: 'EMPTY_ARRAY',
                message: 'At least one ingredient is required',
            };
            result.isValid = false;
        }
        else {
            const invalidIngredients = recipe.ingredients.filter(i => !i || !i.trim());
            if (invalidIngredients.length > 0) {
                result.invalidFields.push('ingredients');
                result.fieldErrors.ingredients = {
                    code: 'INVALID_CONTENT',
                    message: 'Each ingredient must have content',
                    value: invalidIngredients
                };
                result.isValid = false;
            }
        }
    }
    // Instructions validation
    if (recipe.instructions) {
        if (!Array.isArray(recipe.instructions)) {
            result.invalidFields.push('instructions');
            result.fieldErrors.instructions = {
                code: 'INVALID_TYPE',
                message: 'Instructions must be an array',
                value: recipe.instructions
            };
            result.isValid = false;
        }
        else if (recipe.instructions.length === 0) {
            result.invalidFields.push('instructions');
            result.fieldErrors.instructions = {
                code: 'EMPTY_ARRAY',
                message: 'At least one instruction is required',
            };
            result.isValid = false;
        }
        else {
            const invalidInstructions = recipe.instructions.filter(i => !i || !i.trim());
            if (invalidInstructions.length > 0) {
                result.invalidFields.push('instructions');
                result.fieldErrors.instructions = {
                    code: 'INVALID_CONTENT',
                    message: 'Each instruction must have content',
                    value: invalidInstructions
                };
                result.isValid = false;
            }
            const longInstructions = recipe.instructions.filter(i => i && i.length > MAX_INSTRUCTION_LENGTH);
            if (longInstructions.length > 0) {
                result.invalidFields.push('instructions');
                result.fieldErrors.instructions = {
                    code: 'CONTENT_TOO_LONG',
                    message: `Instructions must be ${MAX_INSTRUCTION_LENGTH} characters or less`,
                    value: longInstructions
                };
                result.isValid = false;
            }
        }
    }
    // Check for emoji characters
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(JSON.stringify(recipe));
    if (hasEmoji) {
        result.warnings.push('Recipe contains emoji characters');
    }
    // Check for HTML content
    const recipeStr = JSON.stringify(recipe);
    if (/<[^>]*>/g.test(recipeStr)) {
        result.warnings.push('Content contained potentially unsafe HTML');
    }
    return result;
}
