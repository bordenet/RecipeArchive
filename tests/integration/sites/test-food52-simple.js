#!/usr/bin/env node

const { chromium } = require('playwright');

// Food52 test recipes
const FOOD52_TEST_RECIPES = [
  {
    url: 'https://food52.com/recipes/78143-chocolate-chip-cookies',
    expected: 'Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/34243-aunt-lolly-s-oatmeal-chocolate-chip-cookies',
    expected: 'Aunt Lolly\'s Oatmeal Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/22155-gingerbread-cookies',
    expected: 'Gingerbread Cookies',
  },
];

async function testFood52Recipe(url, expectedTitle) {
  console.log(`🧪 Testing Food52 Recipe: ${expectedTitle}`);
  console.log(`   URL: ${url}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to recipe
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait for content
    await page.waitForTimeout(8000);

    // Dismiss popups aggressively
    await page.evaluate(() => {
      // Remove popup overlays
      const popupSelectors = [
        '.modal',
        '.overlay',
        '.popup',
        '.newsletter',
        '.signup',
        '[data-modal]',
        '[data-overlay]',
        '[data-popup]',
        '.gdpr',
        '.cookie',
        '.privacy',
        '.subscription',
        '[class*="modal"]',
        '[class*="popup"]',
        '[class*="overlay"]',
        '[id*="modal"]',
        '[id*="popup"]',
        '[id*="overlay"]',
        '.newsletter-signup',
        '.email-capture',
        '.subscribe-modal',
      ];

      popupSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          if (el) {
            el.style.display = 'none';
            el.remove();
          }
        });
      });

      // Click dismiss buttons
      const dismissButtons = document.querySelectorAll(
        'button, [role="button"], .close, .dismiss'
      );
      dismissButtons.forEach((btn) => {
        const text = (btn.textContent || '').toLowerCase().trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

        if (
          text.includes('close') ||
          text.includes('dismiss') ||
          text === '×' ||
          text.includes('no thanks') ||
          ariaLabel.includes('close') ||
          text.includes('skip') ||
          text.includes('maybe later')
        ) {
          try {
            btn.click();
          } catch (e) {
            // Ignore click errors
          }
        }
      });
    });

    // Wait after popup cleanup
    await page.waitForTimeout(3000);

    // Extract recipe data
    const result = await page.evaluate(() => {
      // Check if we're on a valid page
      const pageTitle = document.title;
      const url = window.location.href;

      if (pageTitle.includes('404') || url.includes('404')) {
        return { error: '404 Not Found', title: pageTitle };
      }

      function extractRecipeFromJsonLd() {
        const jsonLdScripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );

        for (const script of jsonLdScripts) {
          try {
            const jsonData = JSON.parse(script.textContent);
            let recipe = null;

            // Handle different JSON-LD structures
            if (jsonData['@type'] === 'Recipe') {
              recipe = jsonData;
            } else if (Array.isArray(jsonData)) {
              recipe = jsonData.find(
                (item) => item && item['@type'] === 'Recipe'
              );
            } else if (jsonData['@graph']) {
              recipe = jsonData['@graph'].find(
                (item) => item && item['@type'] === 'Recipe'
              );
            }

            if (recipe && recipe.name) {
              console.log('Food52: Found JSON-LD Recipe data');

              const ingredients = recipe.recipeIngredient
                ? [
                    {
                      title: null,
                      items: Array.isArray(recipe.recipeIngredient)
                        ? recipe.recipeIngredient
                        : [recipe.recipeIngredient],
                    },
                  ]
                : [];

              let steps = [];
              if (recipe.recipeInstructions) {
                const stepItems = recipe.recipeInstructions
                  .map((instruction) => {
                    if (typeof instruction === 'string') return instruction;
                    if (instruction && instruction.text)
                      return instruction.text;
                    if (instruction && instruction.name)
                      return instruction.name;
                    return '';
                  })
                  .filter(Boolean);

                if (stepItems.length > 0) {
                  steps = [{ title: null, items: stepItems }];
                }
              }

              return {
                title: recipe.name,
                ingredients,
                steps,
                servingSize: recipe.recipeYield || recipe.yield || null,
                time:
                  recipe.totalTime ||
                  recipe.cookTime ||
                  recipe.prepTime ||
                  null,
                photos: recipe.image
                  ? Array.isArray(recipe.image)
                    ? recipe.image
                    : [recipe.image]
                  : [],
                source: 'json-ld',
                success: true,
              };
            }
          } catch (e) {
            console.log('Food52: JSON-LD parsing failed:', e.message);
          }
        }

        return null;
      }

      function extractFood52Manual() {
        console.log('Food52: Attempting manual extraction...');

        const title =
          document.querySelector('h1')?.textContent?.trim() ||
          document.querySelector('.recipe-title')?.textContent?.trim() ||
          document
            .querySelector('[data-testid="recipe-title"]')
            ?.textContent?.trim() ||
          document.title;

        let ingredients = [];
        let steps = [];

        // Try various selectors for ingredients
        const ingredientSelectors = [
          '.recipe-list--ingredients li',
          '.recipe-ingredients li',
          '[data-testid="ingredients"] li',
          '[data-testid*="ingredient"] li',
          'ul[data-testid*="ingredient"] li',
          '.ingredients li',
          '[class*="ingredient"] li',
          '.recipe-card-ingredients li',
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
                `Food52: Found ingredients with: ${selector} (${items.length} items)`
              );
              break;
            }
          }
        }

        // Try various selectors for steps
        const stepSelectors = [
          '.recipe-list--instructions li',
          '.recipe-instructions li',
          '[data-testid="instructions"] li',
          '[data-testid*="instruction"] li',
          'ol[data-testid*="instruction"] li',
          '.instructions li',
          '[class*="instruction"] li',
          '.recipe-card-instructions li',
        ];

        for (const selector of stepSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const items = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 10);

            if (items.length > 0) {
              steps = [{ title: null, items }];
              console.log(
                `Food52: Found steps with: ${selector} (${items.length} items)`
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
          photos: [],
          source: 'food52-manual',
          success: ingredients.length > 0 && steps.length > 0,
        };
      }

      // Try JSON-LD first
      let result = extractRecipeFromJsonLd();
      if (result && result.success) {
        return result;
      }

      // Try manual extraction
      result = extractFood52Manual();
      return result;
    });

    // Validate and report results
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
      return { success: false, error: result.error, url };
    }

    const hasTitle =
      result.title && result.title.length > 0 && !result.title.includes('404');
    const hasIngredients =
      result.ingredients &&
      result.ingredients.some((s) => s.items && s.items.length > 0);
    const hasSteps =
      result.steps && result.steps.some((s) => s.items && s.items.length > 0);

    const success = hasTitle && hasIngredients && hasSteps;

    console.log(`   Source: ${result.source}`);
    console.log(`   Title: ${result.title}`);
    console.log(
      `   Ingredients: ${result.ingredients?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );
    console.log(
      `   Steps: ${result.steps?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );
    console.log(`   Result: ${success ? '✅ SUCCESS' : '❌ FAILURE'}`);

    if (!success) {
      const issues = [];
      if (!hasTitle) issues.push('Missing title');
      if (!hasIngredients) issues.push('Missing ingredients');
      if (!hasSteps) issues.push('Missing steps');
      console.log(`   Issues: ${issues.join(', ')}`);

      // Debug information
      if (!hasIngredients || !hasSteps) {
        const debugInfo = await page.evaluate(() => {
          const ulCount = document.querySelectorAll('ul').length;
          const olCount = document.querySelectorAll('ol').length;
          const liCount = document.querySelectorAll('li').length;
          const recipeElements = document.querySelectorAll(
            '[class*="recipe"], [data-recipe]'
          ).length;

          return { ulCount, olCount, liCount, recipeElements };
        });

        console.log(
          `   Debug: ul=${debugInfo.ulCount}, ol=${debugInfo.olCount}, li=${debugInfo.liCount}, recipe-elements=${debugInfo.recipeElements}`
        );
      }
    }

    return { success, result, url };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message, url };
  } finally {
    await browser.close();
  }
}

async function runFood52Tests() {
  console.log('🚀 Starting Food52 Recipe Tests');
  console.log(`📊 Testing ${FOOD52_TEST_RECIPES.length} Food52 recipes`);

  const results = [];
  let successCount = 0;

  for (const recipe of FOOD52_TEST_RECIPES) {
    const result = await testFood52Recipe(recipe.url, recipe.expected);
    results.push({ recipe, ...result });

    if (result.success) successCount++;

    // Delay between tests
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Summary
  console.log('\n📊 FOOD52 TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log(
    `\n✅ Success Rate: ${successCount}/${FOOD52_TEST_RECIPES.length} (${((successCount / FOOD52_TEST_RECIPES.length) * 100).toFixed(1)}%)`
  );

  results.forEach((r, index) => {
    const status = r.success ? '✅' : '❌';
    console.log(`   ${status} [${index + 1}] ${r.recipe.expected}`);
    if (!r.success && r.error) {
      console.log(`       Error: ${r.error}`);
    }
  });

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'food52-simple-test-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\\n💾 Results saved to: food52-simple-test-results.json');

  if (successCount > 0) {
    console.log('\\n🎉 Some Food52 tests passed! Parser is working.');

    // If tests pass, we can now update our main parsers
    console.log('\\nNext steps:');
    console.log(
      '1. Update Chrome/Safari content scripts with working Food52 parser'
    );
    console.log('2. Run full test suite with all 60+ Food52 recipes');
    console.log('3. Move on to Food Network, AllRecipes, etc.');
  } else {
    console.log('\\n⚠️  All Food52 tests failed. Need to investigate further.');
  }
}

// Run the tests
runFood52Tests().catch(console.error);
