import { Recipe, ValidationResult, JsonLdRecipe } from '../types';

describe('Recipe Interface', () => {
    it('should create a valid recipe object', () => {
        const recipe: Recipe = {
            title: 'Test Recipe',
            source: 'https://test.com/recipe',
            ingredients: ['ingredient 1', 'ingredient 2'],
            instructions: ['step 1', 'step 2']
        };

        expect(recipe.title).toBe('Test Recipe');
        expect(recipe.ingredients.length).toBe(2);
        expect(recipe.instructions.length).toBe(2);
    });

    it('should allow optional fields', () => {
        const recipe: Recipe = {
            title: 'Test Recipe',
            source: 'https://test.com/recipe',
            ingredients: ['ingredient 1'],
            instructions: ['step 1'],
            author: 'Test Author',
            imageUrl: 'https://test.com/image.jpg',
            prepTime: '10 minutes',
            cookTime: '20 minutes',
            totalTime: '30 minutes',
            servings: '4 servings',
            notes: ['note 1', 'note 2'],
            tags: ['dessert', 'chocolate']
        };

        expect(recipe.imageUrl).toBeDefined();
        expect(recipe.notes?.length).toBe(2);
        expect(recipe.tags?.length).toBe(2);
    });
});

describe('ValidationResult Interface', () => {
    it('should create a valid validation result', () => {
        const result: ValidationResult = {
            isValid: true,
            missingFields: [],
            invalidFields: [],
            warnings: [],
            fieldErrors: {}
        };

        expect(result.isValid).toBe(true);
        expect(result.missingFields.length).toBe(0);
        expect(result.invalidFields.length).toBe(0);
        expect(result.warnings.length).toBe(0);
    });

    it('should handle validation errors', () => {
        const result: ValidationResult = {
            isValid: false,
            missingFields: ['ingredients', 'instructions'],
            invalidFields: ['title'],
            warnings: ['Title is too long'],
            fieldErrors: {
                title: {
                    code: 'TOO_LONG',
                    message: 'Title must be 200 characters or less',
                    value: 'A'.repeat(201)
                }
            }
        };

        expect(result.isValid).toBe(false);
        expect(result.missingFields).toContain('ingredients');
        expect(result.invalidFields).toContain('title');
        expect(result.warnings).toContain('Title is too long');
        const titleError = result.fieldErrors?.title;
        expect(titleError?.code).toBe('TOO_LONG');
    });
});

describe('JsonLdRecipe Interface', () => {
    it('should parse JSON-LD recipe data', () => {
        const jsonLd: JsonLdRecipe = {
            "@type": "Recipe",
            "name": "Test Recipe",
            "author": "Test Author",
            "recipeIngredient": ["ingredient 1", "ingredient 2"],
            "recipeInstructions": ["step 1", "step 2"]
        };

        expect(jsonLd["@type"]).toBe("Recipe");
        expect(jsonLd.name).toBe("Test Recipe");
        expect(jsonLd.recipeIngredient?.length).toBe(2);
    });

    it('should handle author as object', () => {
        const jsonLd: JsonLdRecipe = {
            "@type": "Recipe",
            "author": { name: "Test Author" }
        };

        expect(jsonLd.author).toBeDefined();
        if (typeof jsonLd.author === 'object') {
            expect(jsonLd.author.name).toBe("Test Author");
        }
    });

    it('should handle instructions as objects', () => {
        const jsonLd: JsonLdRecipe = {
            "@type": "Recipe",
            "recipeInstructions": [
                { text: "step 1" },
                { text: "step 2" }
            ]
        };

        expect(jsonLd.recipeInstructions).toBeDefined();
        expect(jsonLd.recipeInstructions?.length).toBe(2);
    });
});
