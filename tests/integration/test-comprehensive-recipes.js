#!/usr/bin/env node

const { chromium } = require('playwright');

// Comprehensive test suite with multiple sites and recipes
const TEST_RECIPES = [
  // Love & Lemons - our primary test site
  {
    url: 'https://www.loveandlemons.com/vegan-sugar-cookies/',
    expected: 'Vegan Sugar Cookies',
    site: 'Love & Lemons',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/brownies-recipe/',
    expected: 'Best Brownies',
    site: 'Love & Lemons',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/hummus/',
    expected: 'Hummus',
    site: 'Love & Lemons',
    category: 'snacks',
  },

  // Food52 - should work with JSON-LD
  {
    url: 'https://food52.com/recipes/78143-chocolate-chip-cookies',
    expected: 'Chocolate Chip Cookies',
    site: 'Food52',
    category: 'baking',
  },

  // AllRecipes - should work with JSON-LD
  {
    url: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/',
    expected: 'Best Chocolate Chip Cookies',
    site: 'AllRecipes',
    category: 'baking',
  },
];

async function testRecipeExtraction(page, recipe) {
  console.log(`\n🧪 Testing: ${recipe.site} - ${recipe.expected}`);
  console.log(`   URL: ${recipe.url}`);

  try {
    // Navigate to recipe
    await page.goto(recipe.url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Wait for content
    await page.waitForTimeout(3000);

    // Dismiss popups/overlays
    await page.evaluate(() => {
      // Remove common popup elements
      const selectors = [
        '[id*="overlay"]',
        '.modal',
        '.gdpr',
        '.newsletter',
        '.popup',
        '[data-testid*="modal"]',
        '[class*="modal"]',
        '[class*="popup"]',
        '.newsletter-signup',
        '.email-signup',
        '.subscribe-popup',
        '.cookie-notice',
        '.privacy-banner',
      ];

      selectors.forEach((selector) => {
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
        const text = (btn.textContent || btn.innerText || '').toLowerCase();
        const title = (btn.title || '').toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

        if (
          text.includes('close') ||
          text.includes('dismiss') ||
          text.includes('×') ||
          text.includes('accept') ||
          text.includes('got it') ||
          title.includes('close') ||
          ariaLabel.includes('close')
        ) {
          try {
            btn.click();
          } catch (e) {
            // Ignore click errors
          }
        }
      });
    });

    // Extract recipe data
    const result = await page.evaluate(() => {
      // JSON-LD Extraction
      function extractRecipeFromJsonLd() {
        const jsonLdScripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );

        for (const script of jsonLdScripts) {
          try {
            const jsonData = JSON.parse(script.textContent);
            const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];

            for (const item of recipes) {
              // Handle nested recipe data
              let recipeData = null;
              if (item['@type'] === 'Recipe') {
                recipeData = item;
              } else if (item['@graph']) {
                recipeData = item['@graph'].find(
                  (g) => g['@type'] === 'Recipe'
                );
              } else if (Array.isArray(item) && item.length > 0) {
                recipeData = item.find((i) => i['@type'] === 'Recipe');
              }

              if (recipeData) {
                console.log('Found JSON-LD Recipe data');

                const ingredients = recipeData.recipeIngredient
                  ? [{ title: null, items: recipeData.recipeIngredient }]
                  : [];

                let steps = [];
                if (recipeData.recipeInstructions) {
                  const stepItems = recipeData.recipeInstructions
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
                  title: recipeData.name || document.title,
                  ingredients,
                  steps,
                  servingSize:
                    recipeData.recipeYield || recipeData.yield || null,
                  time:
                    recipeData.totalTime ||
                    recipeData.cookTime ||
                    recipeData.prepTime ||
                    null,
                  photos: recipeData.image
                    ? Array.isArray(recipeData.image)
                      ? recipeData.image
                      : [recipeData.image]
                    : [],
                  source: 'json-ld',
                };
              }
            }
          } catch (e) {
            console.log('Failed to parse JSON-LD:', e.message);
          }
        }

        return null;
      }

      // Love & Lemons specific extraction
      function extractLoveLemonsManual() {
        const title =
          document.querySelector('h1')?.textContent?.trim() || document.title;

        let ingredients = [];
        const ingredientElements = document.querySelectorAll(
          '.entry-content ul li'
        );
        const ingredientItems = Array.from(ingredientElements)
          .map((li) => li.textContent?.trim())
          .filter(
            (text) =>
              text &&
              !text.includes('RECIPES') &&
              !text.includes('ABOUT') &&
              !text.includes('NEWSLETTER') &&
              !text.includes('Easy Cookie Recipes') &&
              !text.includes('Or any of these') &&
              !text.includes('Follow me on') &&
              !text.includes('Email') &&
              !text.includes('Instagram') &&
              text.length > 5 &&
              text.length < 200 &&
              !/^[A-Z\s]+$/.test(text) &&
              !/\\d+\\s+(Easy|Cookie|Recipe)/.test(text)
          );

        if (ingredientItems.length > 0) {
          ingredients = [{ title: null, items: ingredientItems }];
        }

        let steps = [];
        const stepElements = document.querySelectorAll('.entry-content ol li');
        const stepItems = Array.from(stepElements)
          .map((li) => li.textContent?.trim())
          .filter((text) => text && text.length > 20);

        if (stepItems.length > 0) {
          steps = [{ title: null, items: stepItems }];
        }

        return {
          title,
          ingredients,
          steps,
          servingSize: null,
          time: null,
          photos: [],
          source: 'love-lemons-manual',
        };
      }

      // Generic fallback extraction
      function extractGenericRecipe() {
        const title =
          document.querySelector('h1')?.textContent?.trim() || document.title;

        let ingredients = [];
        const ingredientSelectors = [
          '.recipe-ingredients li',
          '.ingredients li',
          '.recipe-ingredient li',
          'ul[class*="ingredient"] li',
          '[data-ingredient] li',
        ];

        for (const selector of ingredientSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const items = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 3 && text.length < 200);

            if (items.length > 0) {
              ingredients = [{ title: null, items }];
              break;
            }
          }
        }

        let steps = [];
        const stepSelectors = [
          '.recipe-instructions li',
          '.instructions li',
          '.recipe-instruction li',
          'ol[class*="instruction"] li',
          '[data-instruction] li',
        ];

        for (const selector of stepSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const items = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 10);

            if (items.length > 0) {
              steps = [{ title: null, items }];
              break;
            }
          }
        }

        return {
          title,
          ingredients,
          steps,
          servingSize: null,
          time: null,
          photos: [],
          source: 'generic-fallback',
        };
      }

      // Main extraction logic
      const site = window.location.hostname;

      // Try JSON-LD first for all sites
      let result = extractRecipeFromJsonLd();
      if (result && result.ingredients.length > 0 && result.steps.length > 0) {
        return result;
      }

      // Site-specific manual extraction
      if (site.includes('loveandlemons.com')) {
        result = extractLoveLemonsManual();
        if (result.ingredients.length > 0 && result.steps.length > 0) {
          return result;
        }
      }

      // Generic fallback
      result = extractGenericRecipe();
      return result;
    });

    // Validate results
    const hasTitle = result.title && result.title.length > 0;
    const hasIngredients =
      result.ingredients &&
      result.ingredients.some((s) => s.items && s.items.length > 0);
    const hasSteps =
      result.steps && result.steps.some((s) => s.items && s.items.length > 0);

    const success = hasTitle && hasIngredients && hasSteps;

    // Log results
    console.log(`   Source: ${result.source}`);
    console.log(`   Title: ${result.title}`);
    console.log(
      `   Ingredients: ${result.ingredients?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );
    console.log(
      `   Steps: ${result.steps?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );
    console.log(`   Success: ${success ? '✅' : '❌'}`);

    if (!success) {
      console.log('   Issues:');
      if (!hasTitle) console.log('     - Missing title');
      if (!hasIngredients) console.log('     - Missing ingredients');
      if (!hasSteps) console.log('     - Missing steps');
    }

    return {
      success,
      result,
      issues: success ? [] : ['Missing required fields'],
    };
  } catch (error) {
    console.log(`   Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      issues: ['Test execution failed'],
    };
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive Recipe Extraction Test');
  console.log(
    `📊 Testing ${TEST_RECIPES.length} recipes across multiple sites`
  );

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Set user agent and viewport
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );
  await page.setViewportSize({ width: 1280, height: 720 });

  const results = [];
  let successCount = 0;

  try {
    for (const recipe of TEST_RECIPES) {
      const result = await testRecipeExtraction(page, recipe);
      results.push({ recipe, ...result });

      if (result.success) successCount++;

      // Small delay between tests
      await page.waitForTimeout(2000);
    }

    // Generate summary
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log(
      `\n✅ Success Rate: ${successCount}/${TEST_RECIPES.length} (${((successCount / TEST_RECIPES.length) * 100).toFixed(1)}%)`
    );

    // Group results by site
    const resultsBySite = {};
    results.forEach((r) => {
      const site = r.recipe.site;
      if (!resultsBySite[site]) resultsBySite[site] = { passed: 0, failed: 0 };
      if (r.success) resultsBySite[site].passed++;
      else resultsBySite[site].failed++;
    });

    console.log('\n📈 Results by Site:');
    Object.entries(resultsBySite).forEach(([site, stats]) => {
      const total = stats.passed + stats.failed;
      const percentage = ((stats.passed / total) * 100).toFixed(1);
      console.log(`   ${site}: ${stats.passed}/${total} (${percentage}%)`);
    });

    // Show failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.log('\n❌ Failed Tests:');
      failures.forEach((f) => {
        console.log(`   ${f.recipe.site}: ${f.recipe.expected}`);
        console.log(`     URL: ${f.recipe.url}`);
        if (f.error) {
          console.log(`     Error: ${f.error}`);
        } else if (f.issues) {
          console.log(`     Issues: ${f.issues.join(', ')}`);
        }
      });
    }

    // Save detailed results
    const fs = require('fs');
    fs.writeFileSync(
      'comprehensive-test-results.json',
      JSON.stringify(results, null, 2)
    );
    console.log(
      '\\n💾 Detailed results saved to: comprehensive-test-results.json'
    );

    if (successCount === TEST_RECIPES.length) {
      console.log(
        '\\n🎉 All tests passed! Recipe extraction is working correctly across all sites.'
      );
    } else {
      console.log(
        `\\n⚠️  ${TEST_RECIPES.length - successCount} test(s) failed. Review and improve parsers.`
      );
    }
  } finally {
    await browser.close();
  }
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
