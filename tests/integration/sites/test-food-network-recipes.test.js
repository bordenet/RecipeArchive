const { chromium } = require('playwright');

const FOOD_NETWORK_RECIPES = [
  {
    url: 'https://www.foodnetwork.com/recipes/alton-brown/margarita-recipe-1949048',
    expected: 'Margarita',
    category: 'cocktails',
  },
];

describe('Food Network Recipe Extraction', () => {
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

  test.each(FOOD_NETWORK_RECIPES)(
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
    // JSON-LD Extraction (Primary method for Food Network)
    function extractRecipeFromJsonLd() {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      
      for (const script of jsonLdScripts) {
        try {
          const jsonData = JSON.parse(script.textContent);
          let recipeData = null;
          
          // Handle array of JSON-LD objects
          if (Array.isArray(jsonData)) {
            recipeData = jsonData.find(item => item['@type'] === 'Recipe');
          } else if (jsonData['@type'] === 'Recipe') {
            recipeData = jsonData;
          }
          
          if (recipeData && recipeData.name) {
            const ingredients = recipeData.recipeIngredient 
              ? [{ title: null, items: recipeData.recipeIngredient }]
              : [];
            
            let steps = [];
            if (recipeData.recipeInstructions) {
              const stepItems = recipeData.recipeInstructions
                .map(instruction => {
                  if (typeof instruction === 'string') return instruction;
                  if (instruction.text) return instruction.text;
                  if (instruction.name) return instruction.name;
                  return '';
                })
                .filter(Boolean);
              
              if (stepItems.length > 0) {
                steps = [{ title: null, items: stepItems }];
              }
            }
            
            return {
              method: 'json-ld',
              title: recipeData.name,
              ingredients,
              steps,
              servingSize: recipeData.recipeYield || recipeData.yield || null,
              time: recipeData.totalTime || recipeData.cookTime || recipeData.prepTime || null,
              photos: recipeData.image ? (Array.isArray(recipeData.image) ? recipeData.image : [recipeData.image]) : [],
              success: true
            };
          }
        } catch (e) {
          console.log('Food Network: JSON-LD parsing failed:', e.message);
        }
      }
      return null;
    }

    // Food Network HTML extraction fallback
    function extractFoodNetworkRecipe() {
      const title = document.querySelector('h1')?.textContent?.trim() || 
                   document.title || 
                   'Unknown Recipe';

      // Extract ingredients - avoiding metadata
      let ingredients = [];
      const ingredientSelectors = [
        '.o-RecipeInfo__a-Ingredients li',
        '.o-Ingredients__a-ListItem', 
        'section[aria-labelledby="recipe-ingredients-section"] li'
      ];

      for (const selector of ingredientSelectors) {
        const ingredientElements = document.querySelectorAll(selector);
        if (ingredientElements.length > 0) {
          const items = Array.from(ingredientElements)
            .map(el => el.textContent?.trim())
            .filter(text => 
              text && 
              text.length > 3 &&
              !text.includes('Level:') &&
              !text.includes('Total:') &&
              !text.includes('Prep:') &&
              !text.includes('Yield:') &&
              !text.includes('Nutrition Info') &&
              !text.includes('Save Recipe') &&
              !text.includes('{')
            );

          if (items.length > 0) {
            ingredients = [{ title: null, items }];
            break;
          }
        }
      }

      // Extract steps
      let steps = [];
      const stepSelectors = [
        '.o-Method__m-Body li',
        '.o-Method li',
        '.recipe-directions li',
        'section[aria-labelledby="recipe-instructions-section"] li'
      ];

      for (const selector of stepSelectors) {
        const stepElements = document.querySelectorAll(selector);
        if (stepElements.length > 0) {
          const items = Array.from(stepElements)
            .map(el => el.textContent?.trim())
            .filter(text => text && text.length > 10);

          if (items.length > 0) {
            steps = [{ title: null, items }];
            break;
          }
        }
      }

      return {
        method: 'html-parsing',
        title,
        ingredients,
        steps,
        servingSize: null,
        time: null,
        photos: [],
        success: ingredients.length > 0 && steps.length > 0
      };
    }

    // Try JSON-LD first (preferred for Food Network)
    const jsonLdResult = extractRecipeFromJsonLd();
    if (jsonLdResult) return jsonLdResult;

    // Fallback to HTML parsing
    return extractFoodNetworkRecipe();
  });

  return result;
}
