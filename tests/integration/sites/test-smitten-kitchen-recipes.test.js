/* eslint-env node, browser */
// Polyfill setImmediate for Node.js compatibility
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}
/* eslint-env node, browser */

/**
 * @jest-environment jsdom
 */

const { chromium } = require('playwright');

const SMITTEN_KITCHEN_RECIPES = [
  {
    url: 'https://smittenkitchen.com/2025/04/simplest-brisket-with-braised-onions/',
    expected: 'Simplest Brisket with Braised Onions',
    category: 'main',
  },
];

describe('Smitten Kitchen Recipe Extraction', () => {
  let browser;
  let context;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  test.each(SMITTEN_KITCHEN_RECIPES)(
    'should extract recipe data from %s',
    async (recipe) => {
      const page = await context.newPage();
      try {
        await page.goto(recipe.url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await page.waitForTimeout(3000);

        const result = await testRecipeExtraction(page, recipe);

        // AWS backend contract validation
        expect(result.title).toBeTruthy();
        expect(result.title.length).toBeLessThanOrEqual(200);
        expect(result.title).toContain(recipe.expected);
        expect(result.ingredients).toBeTruthy();
        expect(Array.isArray(result.ingredients)).toBe(true);
        expect(result.ingredients.length).toBeGreaterThan(0);
        result.ingredients.forEach(ing => {
          expect(typeof ing.text).toBe('string');
          expect(ing.text.length).toBeGreaterThan(0);
        });
        expect(result.instructions).toBeTruthy();
        expect(Array.isArray(result.instructions)).toBe(true);
        expect(result.instructions.length).toBeGreaterThan(0);
        result.instructions.forEach((step, idx) => {
          expect(typeof step.text).toBe('string');
          expect(step.text.length).toBeGreaterThan(0);
          expect(typeof step.stepNumber).toBe('number');
          expect(step.stepNumber).toBe(idx + 1);
        });
        expect(result.sourceUrl).toBe(recipe.url);
        // Optional fields
        if (result.mainPhotoUrl) expect(typeof result.mainPhotoUrl).toBe('string');
        if (result.prepTimeMinutes) expect(typeof result.prepTimeMinutes).toBe('number');
        if (result.cookTimeMinutes) expect(typeof result.cookTimeMinutes).toBe('number');
        if (result.totalTimeMinutes) expect(typeof result.totalTimeMinutes).toBe('number');
        if (result.servings) expect(typeof result.servings).toBe('number');
        if (result.yield) expect(typeof result.yield).toBe('string');
        console.log(`✅ AWS contract validated for ${recipe.expected}`);
      } finally {
        await page.close();
      }
    },
    90000 // Extended timeout for slow network
  );
});

async function testRecipeExtraction(page, recipe) {
  const result = await page.evaluate(() => {
    // JSON-LD Extraction (Primary method for Smitten Kitchen)
    function extractRecipeFromJsonLd() {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        try {
          const jsonData = JSON.parse(script.textContent);
          let recipeData = null;
          if (Array.isArray(jsonData)) {
            recipeData = jsonData.find(item => item['@type'] === 'Recipe');
          } else if (jsonData['@type'] === 'Recipe') {
            recipeData = jsonData;
          }
          if (recipeData && recipeData.name) {
            const ingredients = recipeData.recipeIngredient
              ? recipeData.recipeIngredient.map(text => ({ text }))
              : [];
            let instructions = [];
            if (recipeData.recipeInstructions) {
              instructions = recipeData.recipeInstructions.map((instruction, idx) => {
                let text = '';
                if (typeof instruction === 'string') text = instruction;
                else if (instruction.text) text = instruction.text;
                else if (instruction.name) text = instruction.name;
                return { stepNumber: idx + 1, text };
              });
            }
            return {
              title: recipeData.name,
              ingredients,
              instructions,
              sourceUrl: window.location.href,
              mainPhotoUrl: recipeData.image ? (Array.isArray(recipeData.image) ? recipeData.image[0] : recipeData.image) : undefined,
              prepTimeMinutes: undefined,
              cookTimeMinutes: undefined,
              totalTimeMinutes: undefined,
              servings: undefined,
              yield: recipeData.recipeYield || undefined,
            };
          }
        } catch (e) {
          console.log('Smitten Kitchen: JSON-LD parsing failed:', e.message);
        }
      }
      return null;
    }
    // Fallback: Smitten Kitchen HTML parsing (if needed)
    function extractSmittenKitchenRecipe() {
      const title = document.querySelector('h1')?.textContent?.trim() || document.title || 'Unknown Recipe';
      let ingredients = [];
      const ingredientSelectors = ['.ingredient', '.recipe__ingredients li', '.entry-content ul li'];
      for (const selector of ingredientSelectors) {
        const ingredientElements = document.querySelectorAll(selector);
        if (ingredientElements.length > 0) {
          const items = Array.from(ingredientElements)
            .map(el => el.textContent?.trim())
            .filter(text => text && text.length > 3);
          if (items.length > 0) {
            ingredients = items.map(text => ({ text }));
            break;
          }
        }
      }
      let instructions = [];
      const stepSelectors = ['.instruction', '.recipe__instructions li', '.entry-content ol li'];
      for (const selector of stepSelectors) {
        const stepElements = document.querySelectorAll(selector);
        if (stepElements.length > 0) {
          const items = Array.from(stepElements)
            .map(el => el.textContent?.trim())
            .filter(text => text && text.length > 10);
          if (items.length > 0) {
            instructions = items.map((text, idx) => ({ stepNumber: idx + 1, text }));
            break;
          }
        }
      }
      return {
        title,
        ingredients,
        instructions,
        sourceUrl: window.location.href,
      };
    }
    const jsonLdResult = extractRecipeFromJsonLd();
    if (jsonLdResult) return jsonLdResult;
    return extractSmittenKitchenRecipe();
  });
  return result;
}
