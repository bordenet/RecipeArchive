#!/usr/bin/env node

/**
 * Washington Post Recipe Parser Test Suite
 *
 * PURPOSE: Test and validate recipe extraction from Washington Post food articles
 *
 * MAINTAINABILITY NOTES:
 * - Run this test suite every few weeks to catch website layout changes
 * - When tests fail, check the page analysis output for new selectors
 * - Update the extension parser functions based on failing test insights
 * - Washington Post may have paywall restrictions that affect access
 *
 * KEY DEBUGGING INFO PROVIDED:
 * - Page structure analysis (H1s, lists, containers)
 * - Recipe keyword detection
 * - JSON-LD structured data availability
 * - Potential ingredient/step container discovery
 * - Detailed selector matching results
 *
 * ADAPTATION STRATEGY:
 * 1. If tests fail, examine pageAnalysis in results JSON
 * 2. Look for new CSS selectors in potentialIngredientContainers/potentialStepContainers
 * 3. Update extension parser functions with new selectors
 * 4. Re-run tests to validate fixes
 *
 * Last Updated: August 2025
 */

const { chromium } = require('playwright');

// Washington Post recipe URLs for testing
const WASHINGTON_POST_RECIPES = [
  {
    url: 'https://www.washingtonpost.com/food/2025/06/28/30-minute-summer-meals/',
    expected: '30-Minute Summer Meals',
    description:
      'Eggplant Stir-Fry, Shrimp with Hot Honey Glaze, Zucchini Pasta, Grilled Skirt Steak, Spicy Noodle Dish',
  },
  {
    url: 'https://www.washingtonpost.com/food/2025/06/07/blueberry-recipes-muffins-cake-salad/',
    expected: 'Blueberry Recipes',
    description: 'Blueberry Muffins, BBQ Sauce, Cardamom-Infused Clafoutis',
  },
  {
    url: 'https://www.washingtonpost.com/food/2025/04/05/30-minute-pasta-recipes-spring/',
    expected: '30-Minute Pasta Recipes',
    description: 'Spicy Chipotle Pasta with Spring Vegetables',
  },
  {
    url: 'https://www.washingtonpost.com/food/2025/05/03/taco-recipes-chicken-pork-shrimp-fish-beans/',
    expected: 'Taco Recipes',
    description: 'Puffy Crunchy Cheesy Tacos with Chicken and Beans',
  },
];

async function testWashingtonPostRecipe(recipe, index) {
  console.log(
    `\n🧪 [${index + 1}/${WASHINGTON_POST_RECIPES.length}] Testing: ${recipe.expected}`
  );
  console.log(`   URL: ${recipe.url}`);
  console.log(`   Description: ${recipe.description}`);

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
    // Check for login credentials in environment
    const wapostUser = process.env.WAPOST_USERNAME;
    const wapostPass = process.env.WAPOST_PASSWORD;

    if (wapostUser && wapostPass) {
      console.log('   📍 Logging into Washington Post...');

      // Go to login page first
      await page.goto('https://www.washingtonpost.com/subscribe/signin/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.waitForTimeout(3000);

      // Fill in login form (two-step process)
      try {
        // Step 1: Fill email and click Next
        await page.fill('input[id="username"]', wapostUser);
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(3000);

        // Step 2: Fill password and submit
        await page.fill('input[type="password"]', wapostPass);
        await page.click('button[type="submit"]');

        // Wait for login to complete
        await page.waitForTimeout(5000);
        console.log('   ✅ Login completed');
      } catch (loginError) {
        console.log(
          '   ⚠️  Login attempt failed, continuing without authentication'
        );
        console.log(`   Error: ${loginError.message}`);
      }
    } else {
      console.log(
        '   📍 No credentials found in environment variables WAPOST_USERNAME/WAPOST_PASSWORD'
      );
    }

    // Navigate to recipe page
    await page.goto(recipe.url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Wait for content to load
    await page.waitForTimeout(8000);

    // Accept cookies if present
    try {
      const cookieAcceptButton = page
        .locator(
          'button:has-text("Accept"), button:has-text("I Accept"), button:has-text("Accept All"), [aria-label*="accept" i]'
        )
        .first();
      if (await cookieAcceptButton.isVisible({ timeout: 3000 })) {
        console.log('   📍 Accepting cookies...');
        await cookieAcceptButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      // No cookies dialog found, continue
    }

    // Dismiss any popups/newsletters
    try {
      const dismissButtons = page
        .locator(
          'button:has-text("Maybe Later"), button:has-text("No Thanks"), button:has-text("Skip"), [aria-label*="close" i], .close'
        )
        .first();
      if (await dismissButtons.isVisible({ timeout: 2000 })) {
        console.log('   📍 Dismissing popup...');
        await dismissButtons.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // No popup found, continue
    }

    // Check if paywall is blocking access
    const paywallCheck = await page.evaluate(() => {
      const paywallIndicators = [
        'paywall',
        'subscription',
        'subscriber',
        'premium',
        'sign up',
        'create account',
        'register',
      ];
      const bodyText = document.body.textContent.toLowerCase();
      return paywallIndicators.some((indicator) =>
        bodyText.includes(indicator)
      );
    });

    if (paywallCheck) {
      console.log('   ⚠️  Paywall detected - may limit recipe access');
    }

    // Page analysis for debugging layout changes
    const pageAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        h1Count: document.querySelectorAll('h1').length,
        h1Texts: Array.from(document.querySelectorAll('h1'))
          .map((h) => h.textContent?.trim())
          .filter(Boolean),
        ulCount: document.querySelectorAll('ul').length,
        olCount: document.querySelectorAll('ol').length,
        liCount: document.querySelectorAll('li').length,
        recipeKeywords: (() => {
          const bodyText = document.body.textContent.toLowerCase();
          const keywords = [
            'recipe',
            'ingredient',
            'instruction',
            'step',
            'cup',
            'tablespoon',
            'teaspoon',
            'oven',
            'bake',
            'cook',
          ];
          return keywords.filter((kw) => bodyText.includes(kw)).length;
        })(),
        hasJsonLd:
          document.querySelectorAll('script[type="application/ld+json"]')
            .length > 0,
        potentialIngredientContainers: [
          '.recipe-ingredients',
          '.ingredients',
          '[data-testid="ingredients"]',
          '.ingredient-list',
          '[class*="ingredient"]',
          '.wprecipe-ingredients',
        ]
          .map((selector) => ({
            selector,
            count: document.querySelectorAll(selector).length,
            hasLi: document.querySelectorAll(`${selector} li`).length > 0,
          }))
          .filter((item) => item.count > 0),
        potentialStepContainers: [
          '.recipe-instructions',
          '.instructions',
          '[data-testid="instructions"]',
          '.directions',
          '[class*="instruction"]',
          '.wprecipe-instructions',
          '.recipe-directions',
        ]
          .map((selector) => ({
            selector,
            count: document.querySelectorAll(selector).length,
            hasLi: document.querySelectorAll(`${selector} li`).length > 0,
          }))
          .filter((item) => item.count > 0),
      };
    });

    console.log('   📊 Page Analysis:');
    console.log(`      Title: ${pageAnalysis.title}`);
    console.log(
      `      H1s: ${pageAnalysis.h1Count} (${pageAnalysis.h1Texts.join(', ')})`
    );
    console.log(
      `      Lists: ul=${pageAnalysis.ulCount}, ol=${pageAnalysis.olCount}, li=${pageAnalysis.liCount}`
    );
    console.log(`      Recipe keywords found: ${pageAnalysis.recipeKeywords}`);
    console.log(`      JSON-LD scripts: ${pageAnalysis.hasJsonLd}`);
    console.log(
      `      Potential ingredient containers: ${pageAnalysis.potentialIngredientContainers.length}`
    );
    console.log(
      `      Potential step containers: ${pageAnalysis.potentialStepContainers.length}`
    );

    if (pageAnalysis.potentialIngredientContainers.length > 0) {
      console.log(
        `      Ingredient selectors found: ${pageAnalysis.potentialIngredientContainers.map((c) => `${c.selector}(${c.count})`).join(', ')}`
      );
    }
    if (pageAnalysis.potentialStepContainers.length > 0) {
      console.log(
        `      Step selectors found: ${pageAnalysis.potentialStepContainers.map((c) => `${c.selector}(${c.count})`).join(', ')}`
      );
    }

    // Extract recipe data using Washington Post parser logic
    const result = await page.evaluate(() => {
      // Simulate the Washington Post extraction logic from the extension
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

        // Manual extraction fallback
        const title =
          document.querySelector('h1')?.textContent?.trim() ||
          document.querySelector('.headline')?.textContent?.trim() ||
          document.querySelector('[data-qa="headline"]')?.textContent?.trim() ||
          document.title;

        let ingredients = [];
        const ingredientSelectors = [
          '.recipe-ingredients li',
          '.ingredients li',
          '[data-testid="ingredients"] li',
          '.ingredient-list li',
          '[class*="ingredient"] li',
          '.wprecipe-ingredients li',
        ];

        for (const selector of ingredientSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const items = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 2);

            if (items.length > 0) {
              ingredients = [{ title: null, items }];
              console.log(`Found ingredients with selector: ${selector}`);
              break;
            }
          }
        }

        let steps = [];
        const stepSelectors = [
          '.recipe-instructions li',
          '.instructions li',
          '[data-testid="instructions"] li',
          '.directions li',
          '[class*="instruction"] li',
          '.wprecipe-instructions li',
          '.recipe-directions li',
        ];

        for (const selector of stepSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const items = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter((text) => text && text.length > 15);

            if (items.length > 0) {
              steps = [{ title: null, items }];
              console.log(`Found steps with selector: ${selector}`);
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

    // Validate results
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
    }

    return {
      success,
      result,
      recipe,
      pageAnalysis, // Include page analysis for debugging future changes
      issues: success ? [] : ['Missing required fields'],
      testTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message, recipe };
  } finally {
    await browser.close();
  }
}

async function runWashingtonPostTests() {
  console.log('🚀 Starting Washington Post Recipe Test Suite');
  console.log(
    `📊 Testing ${WASHINGTON_POST_RECIPES.length} Washington Post recipe pages`
  );

  const results = [];
  let successCount = 0;

  for (let i = 0; i < WASHINGTON_POST_RECIPES.length; i++) {
    const result = await testWashingtonPostRecipe(
      WASHINGTON_POST_RECIPES[i],
      i
    );
    results.push(result);

    if (result.success) successCount++;

    // Delay between tests
    if (i < WASHINGTON_POST_RECIPES.length - 1) {
      console.log('   ⏱️  Waiting 5 seconds before next test...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Generate summary
  console.log('\n📊 WASHINGTON POST TEST RESULTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log(
    `\n✅ Success Rate: ${successCount}/${WASHINGTON_POST_RECIPES.length} (${((successCount / WASHINGTON_POST_RECIPES.length) * 100).toFixed(1)}%)`
  );

  // Show individual results
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
    'washington-post-test-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Results saved to: washington-post-test-results.json');

  if (successCount > 0) {
    console.log('\n🎉 Some Washington Post tests passed! Parser is working.');
    console.log(
      '\nNote: Washington Post may have paywall restrictions that limit recipe access.'
    );
  } else {
    console.log(
      '\n⚠️  All Washington Post tests failed. May be due to paywall or access restrictions.'
    );
    console.log(
      'Try testing with valid Washington Post subscription or check selectors.'
    );
  }
}

// Run the Washington Post tests
runWashingtonPostTests().catch(console.error);
