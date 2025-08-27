import { SmittenKitchenParser } from '../../sites/smitten-kitchen';
import { Recipe } from '../../types';

describe('SmittenKitchenParser', () => {
    let parser: SmittenKitchenParser;
    const validUrl = 'https://smittenkitchen.com/2023/08/double-chocolate-zucchini-bread/';

    beforeEach(() => {
        parser = new SmittenKitchenParser();
    });

    describe('canParse', () => {
        it('should return true for Smitten Kitchen URLs', () => {
            expect(parser.canParse(validUrl)).toBe(true);
            expect(parser.canParse('https://www.smittenkitchen.com/recipe/test/')).toBe(true);
        });

        it('should return false for non-Smitten Kitchen URLs', () => {
            expect(parser.canParse('https://example.com/recipe')).toBe(false);
            expect(parser.canParse('https://cooking.nytimes.com/recipe')).toBe(false);
        });
    });

    describe('parse', () => {
        const mockHtml = `
            <article class="post recipe">
                <h1>Double Chocolate Zucchini Bread</h1>
                <div class="entry">
                    <p class="recipe-meta">Prep Time: 15 minutes Cook Time: 45 minutes Total Time: 1 hour</p>
                    <p>Author: Deb Perelman</p>
                    <img src="https://smittenkitchen.com/images/zucchini-bread.jpg" alt="Zucchini bread" />

                    <div class="recipe-ingredients">
                        <h3>Ingredients</h3>
                        <ul>
                            <li>2 cups grated zucchini</li>
                            <li>1 cup chocolate chips</li>
                        </ul>
                    </div>

                    <div class="recipe-instructions">
                        <h3>Instructions</h3>
                        <ol>
                            <li>Mix ingredients</li>
                            <li>Bake at 350°F</li>
                        </ol>
                    </div>

                    <div class="recipe-notes">
                        <h3>Notes</h3>
                        <ul>
                            <li>Best served warm</li>
                        </ul>
                    </div>
                </div>
            </article>
        `;

        it('should parse Smitten Kitchen recipes correctly', async () => {
            const recipe = await parser.parse(mockHtml, validUrl);

            expect(recipe).toMatchObject<Partial<Recipe>>({
                title: 'Double Chocolate Zucchini Bread',
                source: validUrl,
                author: 'Deb Perelman',
                ingredients: ['2 cups grated zucchini', '1 cup chocolate chips'],
                instructions: ['Mix ingredients', 'Bake at 350°F'],
                imageUrl: 'https://smittenkitchen.com/images/zucchini-bread.jpg',
                prepTime: '15 minutes',
                cookTime: '45 minutes',
                totalTime: '1 hour',
                notes: ['Best served warm'],
                tags: ['chocolate', 'zucchini', 'bread']
            });
        });

        it('should handle missing optional fields', async () => {
            const minimalHtml = `
                <article class="post recipe">
                    <h1>Simple Recipe</h1>
                    <div class="entry">
                        <div class="recipe-ingredients">
                            <h3>Ingredients</h3>
                            <ul><li>ingredient</li></ul>
                        </div>
                        <div class="recipe-instructions">
                            <h3>Instructions</h3>
                            <ol><li>step</li></ol>
                        </div>
                    </div>
                </article>
            `;

            const recipe = await parser.parse(minimalHtml, validUrl);

            expect(recipe).toMatchObject<Partial<Recipe>>({
                title: 'Simple Recipe',
                source: validUrl,
                ingredients: ['ingredient'],
                instructions: ['step']
            });

            expect(recipe.imageUrl).toBeUndefined();
            expect(recipe.prepTime).toBeUndefined();
            expect(recipe.cookTime).toBeUndefined();
            expect(recipe.totalTime).toBeUndefined();
            expect(recipe.notes).toBeUndefined();
        });

        it('should handle recipes with multiple images and sections', async () => {
            const complexHtml = `
                <article class="post recipe">
                    <h1>Complex Recipe</h1>
                    <div class="entry">
                        <img src="image1.jpg" />
                        <div class="recipe-ingredients">
                            <h3>For the base:</h3>
                            <ul><li>base ingredient</li></ul>
                            <h3>For the topping:</h3>
                            <ul><li>topping ingredient</li></ul>
                        </div>
                        <div class="recipe-instructions">
                            <h3>Prepare the base:</h3>
                            <ol><li>base step</li></ol>
                            <h3>Add the topping:</h3>
                            <ol><li>topping step</li></ol>
                        </div>
                    </div>
                </article>
            `;

            const recipe = await parser.parse(complexHtml, validUrl);

            expect(recipe.ingredients).toEqual(['base ingredient', 'topping ingredient']);
            expect(recipe.instructions).toEqual(['base step', 'topping step']);
            expect(recipe.imageUrl).toBe('image1.jpg');
        });
    });
});
