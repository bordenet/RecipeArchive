#!/usr/bin/env node

const { chromium } = require('playwright');

async function testExtractionOnly(url, _expectedTitle) {
  console.log(`🧪 Testing extraction for: ${url}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to recipe
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('✅ Page loaded');

    // Wait for content to stabilize
    await page.waitForTimeout(5000);

    // Test extraction directly without browser extension APIs
    const result = await page.evaluate(() => {
      // Inline extraction functions (simplified)
      function extractRecipeFromJsonLd() {
        const jsonLdScripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );

        for (const script of jsonLdScripts) {
          try {
            const jsonData = JSON.parse(script.textContent);
            const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];

            for (const item of recipes) {
              if (item['@type'] === 'Recipe') {
                console.log('Found JSON-LD Recipe data');

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
                  photos: item.image
                    ? Array.isArray(item.image)
                      ? item.image
                      : [item.image]
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

      function extractLoveLemonsManual() {
        console.log('Extracting Love & Lemons recipe manually...');

        const title =
          document.querySelector('h1')?.textContent?.trim() || document.title;

        // Ingredients from entry-content ul li (filter out navigation items)
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
              !text.includes('Cookies') && // Filter out related recipe links
              text.length > 5 &&
              !/^[A-Z\s]+$/.test(text) // Not all caps navigation
          );

        if (ingredientItems.length > 0) {
          ingredients = [{ title: null, items: ingredientItems }];
        }

        // Steps from entry-content ol li
        let steps = [];
        const stepElements = document.querySelectorAll('.entry-content ol li');
        const stepItems = Array.from(stepElements)
          .map((li) => li.textContent?.trim())
          .filter((text) => text && text.length > 20); // Steps should be substantial

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

      // Try JSON-LD first
      let result = extractRecipeFromJsonLd();
      if (result) return result;

      // Try manual extraction for Love & Lemons
      if (window.location.hostname.includes('loveandlemons.com')) {
        return extractLoveLemonsManual();
      }

      return { error: 'No extraction method matched' };
    });

    console.log('\n📊 EXTRACTION RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Title: ${result.title}`);
    console.log(`Source: ${result.source}`);
    console.log(
      `Ingredients: ${result.ingredients?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );
    console.log(
      `Steps: ${result.steps?.reduce((sum, s) => sum + s.items.length, 0) || 0} items`
    );

    if (
      result.ingredients?.length > 0 &&
      result.ingredients[0].items.length > 0
    ) {
      console.log('\n🥗 Sample Ingredients:');
      result.ingredients[0].items.slice(0, 5).forEach((item) => {
        console.log(`   - ${item}`);
      });
    }

    if (result.steps?.length > 0 && result.steps[0].items.length > 0) {
      console.log('\n📋 Sample Steps:');
      result.steps[0].items.slice(0, 3).forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.slice(0, 100)}...`);
      });
    }

    // Validation
    const hasTitle = result.title && result.title !== 'Unknown Recipe';
    const hasIngredients =
      result.ingredients &&
      result.ingredients.some((s) => s.items && s.items.length > 0);
    const hasSteps =
      result.steps && result.steps.some((s) => s.items && s.items.length > 0);

    console.log('\n✅ VALIDATION:');
    console.log(`   Title: ${hasTitle ? '✓' : '✗'}`);
    console.log(`   Ingredients: ${hasIngredients ? '✓' : '✗'}`);
    console.log(`   Steps: ${hasSteps ? '✓' : '✗'}`);

    const success = hasTitle && hasIngredients && hasSteps;
    console.log(
      `\n${success ? '🎉' : '💥'} Overall: ${success ? 'SUCCESS' : 'FAILURE'}`
    );

    if (!success) {
      console.log('\n🔍 DEBUG INFO:');
      if (!hasIngredients) {
        console.log('   No ingredients found. Checking selectors...');

        const debugInfo = await page.evaluate(() => {
          const allUlLi = document.querySelectorAll(
            '.entry-content ul li'
          ).length;
          const allOlLi = document.querySelectorAll(
            '.entry-content ol li'
          ).length;
          const allUls = document.querySelectorAll('.entry-content ul').length;
          const allOls = document.querySelectorAll('.entry-content ol').length;

          return { allUlLi, allOlLi, allUls, allOls };
        });

        console.log(`     .entry-content ul li: ${debugInfo.allUlLi} elements`);
        console.log(`     .entry-content ol li: ${debugInfo.allOlLi} elements`);
        console.log(`     .entry-content ul: ${debugInfo.allUls} elements`);
        console.log(`     .entry-content ol: ${debugInfo.allOls} elements`);
      }
    }

    return { success, result };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

// Test with a Love & Lemons recipe
const testUrl = 'https://www.loveandlemons.com/vegan-sugar-cookies/';
const expectedTitle = 'Vegan Sugar Cookies';

testExtractionOnly(testUrl, expectedTitle).catch(console.error);
