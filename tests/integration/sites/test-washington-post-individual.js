/* eslint-env node, browser */
/* eslint-env node, browser */
/**
 * Washington Post Individual Recipe Test Suite
 *
 * PURPOSE: Test specific individual recipe pages rather than article collections
 *
 * NOTES:
 * - These are individual recipe pages that should have structured ingredient lists
 * - Requires Washington Post subscription for full access
 * - Tests both JSON-LD and manual extraction methods
 */

const { chromium } = require('playwright');

// Individual Washington Post recipe URLs for testing
const WASHINGTON_POST_INDIVIDUAL_RECIPES = [
  {
    url: 'https://www.washingtonpost.com/recipes/eggplant-stir-fry-with-ground-pork/',
    expected: 'Eggplant Stir-Fry with Ground Pork',
    description: 'Eggplant stir-fry recipe',
  },
  {
    url: 'https://www.washingtonpost.com/recipes/shrimp-with-hot-honey-glaze/',
    expected: 'Shrimp with Hot Honey Glaze',
    description: 'Shrimp with hot honey glaze and cabbage slaw',
  },
  // Note: Using example URLs - may need to find actual working URLs
  // These can be updated based on real Washington Post recipe URLs
];

async function testWashingtonPostIndividualRecipe(recipe, index) {
  console.log(
    `\n🧪 [${index + 1}/${WASHINGTON_POST_INDIVIDUAL_RECIPES.length}] Testing: ${recipe.expected}`
  );
  console.log(`   URL: ${recipe.url}`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // Navigate to recipe page
    await page.goto(recipe.url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Wait for content to load
    await page.waitForTimeout(8000);

    console.log('   📍 Please log in to Washington Post if needed...');
    console.log('   📍 Waiting 20 seconds for manual login if required...');
    await page.waitForTimeout(20000);

    // Page analysis for debugging
    const pageAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        h1Count: document.querySelectorAll('h1').length,
        h1Texts: Array.from(document.querySelectorAll('h1'))
          .map((h) => h.textContent?.trim())
          .slice(0, 3),
        recipeKeywords: (() => {
          const bodyText = document.body.textContent.toLowerCase();
          const keywords = [
            'ingredient',
            'instruction',
            'step',
            'cup',
            'tablespoon',
            'teaspoon',
            'oven',
            'bake',
            'cook',
            'recipe',
          ];
          return keywords.filter((kw) => bodyText.includes(kw)).length;
        })(),
        hasJsonLd: document.querySelectorAll(
          'script[type="application/ld+json"]'
        ).length,
        jsonLdContent: (() => {
          const scripts = document.querySelectorAll(
            'script[type="application/ld+json"]'
          );
          const jsonLdData = [];
          for (let script of scripts) {
            try {
              const data = JSON.parse(script.textContent);
              if (
                data['@type'] === 'Recipe' ||
                (Array.isArray(data) &&
                  data.some((item) => item['@type'] === 'Recipe'))
              ) {
                jsonLdData.push('Recipe found');
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
          return jsonLdData;
        })(),
        potentialSelectors: {
          ingredients: [
            '.recipe-ingredients li',
            '.ingredients li',
            '.ingredient-list li',
            '[class*="ingredient"] li',
            '.wp-recipe-ingredients li',
            '[data-testid*="ingredient"] li',
          ]
            .map((sel) => ({
              selector: sel,
              count: document.querySelectorAll(sel).length,
              preview: Array.from(document.querySelectorAll(sel))
                .slice(0, 2)
                .map((el) => el.textContent?.trim().slice(0, 50)),
            }))
            .filter((item) => item.count > 0),
          steps: [
            '.recipe-instructions li',
            '.instructions li',
            '.directions li',
            '[class*="instruction"] li',
            '.wp-recipe-instructions li',
            '[data-testid*="instruction"] li',
          ]
            .map((sel) => ({
              selector: sel,
              count: document.querySelectorAll(sel).length,
              preview: Array.from(document.querySelectorAll(sel))
                .slice(0, 2)
                .map((el) => el.textContent?.trim().slice(0, 80)),
            }))
            .filter((item) => item.count > 0),
        },
      };
    });

    console.log(
      `   📊 Analysis: Title="${pageAnalysis.title.slice(0, 60)}..."`
    );
    console.log(
      `      Recipe keywords: ${pageAnalysis.recipeKeywords}, JSON-LD: ${pageAnalysis.hasJsonLd}, Recipes in JSON-LD: ${pageAnalysis.jsonLdContent.length}`
    );

    if (pageAnalysis.potentialSelectors.ingredients.length > 0) {
      console.log('      Found ingredient selectors:');
      pageAnalysis.potentialSelectors.ingredients.forEach((sel) => {
        console.log(
          `        ${sel.selector}: ${sel.count} items, preview: ${sel.preview.join(' | ')}`
        );
      });
    }

    if (pageAnalysis.potentialSelectors.steps.length > 0) {
      console.log('      Found step selectors:');
      pageAnalysis.potentialSelectors.steps.forEach((sel) => {
        console.log(
          `        ${sel.selector}: ${sel.count} items, preview: ${sel.preview.join(' | ')}`
        );
      });
    }

    // Extract using Washington Post parser
    const result = await page.evaluate(() => {
      function extractWashingtonPostRecipe() {
        // Try JSON-LD first
        const jsonLdScripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );

        for (const script of jsonLdScripts) {
          try {
            const jsonData = JSON.parse(script.textContent);
            const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];

            for (const item of recipes) {
              if (item['@type'] === 'Recipe') {
                console.log('Found Washington Post JSON-LD Recipe');

                const ingredients = item.recipeIngredient
                  ? [{ title: null, items: item.recipeIngredient }]
                  : [];

                let steps = [];
                if (item.recipeInstructions) {
                  const stepItems = item.recipeInstructions
                    .map((instruction) => {
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
                  title: item.name || document.title,
                  ingredients,
                  steps,
                  servingSize: item.recipeYield || item.yield || null,
                  time:
                    item.totalTime || item.cookTime || item.prepTime || null,
                  source: 'washingtonpost-json-ld',
                };
              }
            }
          } catch (e) {
            console.log('JSON-LD parsing failed:', e.message);
          }
        }

        // Manual extraction fallback with extended selectors
        const title =
          document.querySelector('h1')?.textContent?.trim() ||
          document.querySelector('.headline')?.textContent?.trim() ||
          document.querySelector('[data-qa="headline"]')?.textContent?.trim() ||
          document.title;

        let ingredients = [];
        const ingredientSelectors = [
          '.recipe-ingredients li',
          '.ingredients li',
          '.ingredient-list li',
          '[class*="ingredient"] li',
          '.wp-recipe-ingredients li',
          '[data-testid*="ingredient"] li',
          'ul[class*="ingredient"] li',
        ];

        for (const selector of ingredientSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const items = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 2);

            if (items.length > 0) {
              ingredients = [{ title: null, items }];
              console.log(
                `Found ingredients with: ${selector} (${items.length} items)`
              );
              break;
            }
          }
        }

        let steps = [];
        const stepSelectors = [
          '.recipe-instructions li',
          '.instructions li',
          '.directions li',
          '[class*="instruction"] li',
          '.wp-recipe-instructions li',
          '[data-testid*="instruction"] li',
          'ol[class*="instruction"] li',
        ];

        for (const selector of stepSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const items = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 15);

            if (items.length > 0) {
              steps = [{ title: null, items }];
              console.log(
                `Found steps with: ${selector} (${items.length} items)`
              );
              break;
            }
          }
        }

        return {
          title: title || 'Unknown Recipe',
          ingredients,
          steps,
          servingSize: null,
          time: null,
          source: 'washingtonpost-manual',
        };
      }

      return extractWashingtonPostRecipe();
    });

    // Validate
    const hasTitle = result.title && result.title.length > 0;
    const hasIngredients =
      result.ingredients &&
      result.ingredients.some((s) => s.items && s.items.length > 0);
    const hasSteps =
      result.steps && result.steps.some((s) => s.items && s.items.length > 0);
    const success = hasTitle && hasIngredients && hasSteps;

    console.log(`   Source: ${result.source}`);
    console.log(`   Title: ${result.title?.slice(0, 60)}...`);
    console.log(
      `   Ingredients: ${result.ingredients?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );
    console.log(
      `   Steps: ${result.steps?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );
    console.log(`   Result: ${success ? '✅ SUCCESS' : '❌ FAILURE'}`);

    if (hasIngredients && result.ingredients[0].items.length > 0) {
      console.log(
        `   Sample ingredients: ${result.ingredients[0].items
          .slice(0, 3)
          .map((i) => i.slice(0, 30))
          .join(', ')}`
      );
    }

    return { success, result, recipe, pageAnalysis };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message, recipe };
  } finally {
    await browser.close();
  }
}

// eslint-disable-next-line no-unused-vars
async function runWashingtonPostIndividualTests() {
  console.log('🚀 Starting Washington Post Individual Recipe Tests');
  console.log(
    '📍 Make sure you are logged into Washington Post for full access\n'
  );

  const results = [];
  let successCount = 0;

  for (let i = 0; i < WASHINGTON_POST_INDIVIDUAL_RECIPES.length; i++) {
    const result = await testWashingtonPostIndividualRecipe(
      WASHINGTON_POST_INDIVIDUAL_RECIPES[i],
      i
    );
    results.push(result);

    if (result.success) successCount++;

    if (i < WASHINGTON_POST_INDIVIDUAL_RECIPES.length - 1) {
      console.log('   ⏱️  Waiting 3 seconds before next test...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log('\n📊 WASHINGTON POST INDIVIDUAL TESTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    `✅ Success Rate: ${successCount}/${WASHINGTON_POST_INDIVIDUAL_RECIPES.length} (${((successCount / WASHINGTON_POST_INDIVIDUAL_RECIPES.length) * 100).toFixed(1)}%)`
  );

  results.forEach((r, index) => {
    const status = r.success ? '✅' : '❌';
    console.log(`   ${status} [${index + 1}] ${r.recipe.expected}`);
  });

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'washington-post-individual-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Results saved to: washington-post-individual-results.json');

  if (successCount > 0) {
    console.log(
      '\n🎉 Washington Post parser is working on individual recipe pages!'
    );
  } else {
    console.log(
      '\n⚠️  Tests failed - may need valid recipe URLs or parser updates'
    );
    console.log(
      'Check the page analysis in results JSON for selector insights'
    );
  }
}

console.log(
  'NOTE: The test URLs may be examples. Replace with actual Washington Post recipe URLs.'
);
console.log(
  'You can find individual recipe URLs by browsing Washington Post Food section.\n'
);

// Uncomment to run tests:
// runWashingtonPostIndividualTests().catch(console.error);
