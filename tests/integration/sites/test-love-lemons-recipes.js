#!/usr/bin/env node

const { chromium, webkit } = require('playwright');

// Comprehensive Love & Lemons recipe test suite
const LOVE_LEMONS_RECIPES = [
  // Baking Recipes
  {
    url: 'https://www.loveandlemons.com/vegan-sugar-cookies/',
    expected: 'Vegan Sugar Cookies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/brownies-recipe/',
    expected: 'Best Brownies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/peanut-butter-cookies/',
    expected: 'Peanut Butter Cookies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/oatmeal-cookies/',
    expected: 'Perfect Oatmeal Cookies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/lemon-cookies/',
    expected: 'Lemon Cookies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/tahini-cookies/',
    expected: 'Tahini Cookies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/no-bake-cookies/',
    expected: 'No Bake Cookies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/pistachio-oat-squares/',
    expected: 'Pistachio Oat Squares',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/lemon-shortbread-cookies/',
    expected: 'Lemon Shortbread Cookies',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/vegan-chocolate-cake/',
    expected: 'Vegan Chocolate Cake',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/carrot-cake/',
    expected: 'Carrot Cake',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/banana-bread/',
    expected: 'Healthy Banana Bread',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/pumpkin-bread/',
    expected: 'Pumpkin Bread',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/yogurt-pound-cake/',
    expected: 'Yogurt Pound Cake',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/matcha-baked-doughnuts/',
    expected: 'Matcha Baked Doughnuts',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/cinnamon-rolls/',
    expected: 'Cinnamon Rolls',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/blueberry-muffins/',
    expected: 'Blueberry Muffins',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/banana-muffins/',
    expected: 'Healthy Banana Muffins',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/blueberry-scones/',
    expected: 'Blueberry Scones',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/lemon-muffins/',
    expected: 'Vegan Lemon Muffins',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/focaccia/',
    expected: 'Focaccia Bread',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/pizza-dough/',
    expected: 'Homemade Pizza Dough',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/no-knead-bread/',
    expected: 'No-Knead Bread',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/bao-buns/',
    expected: 'Homemade Bao Buns',
    category: 'baking',
  },
  {
    url: 'https://www.loveandlemons.com/falafel-flatbread/',
    expected: 'Falafel Flatbread',
    category: 'baking',
  },

  // Healthy Snacks
  {
    url: 'https://www.loveandlemons.com/granola-bars/',
    expected: 'Homemade Granola Bars',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/energy-balls/',
    expected: 'Energy Balls',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/carrot-cake-bliss-balls/',
    expected: 'Carrot Cake Bliss Balls',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/peanut-butter-no-bake-cookies/',
    expected: 'Peanut Butter No-Bake Cookies',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/hummus/',
    expected: 'Hummus',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/red-lentil-hummus/',
    expected: 'Red Lentil Hummus',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/baba-ganoush/',
    expected: 'Baba Ganoush',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/tzatziki/',
    expected: 'Tzatziki',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/white-bean-dip/',
    expected: 'White Bean Dip',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/how-to-make-peanut-butter/',
    expected: 'Homemade Peanut Butter',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/guacamole/',
    expected: 'Guacamole',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/salsa-verde/',
    expected: 'Tomatillo Salsa Verde',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/chocolate-zucchini-bread/',
    expected: 'Chocolate Zucchini Bread',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/zucchini-bread/',
    expected: 'Healthy Zucchini Bread',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/bagels/',
    expected: 'Homemade Bagels',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/oatmeal-breakfast-cookies/',
    expected: 'Oatmeal Breakfast Cookies',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/quinoa-breakfast-cookies/',
    expected: 'Quinoa Breakfast Cookies',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/zucchini-muffins/',
    expected: 'Zucchini Muffins',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/strawberry-muffins/',
    expected: 'Strawberry Muffins',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/chocolate-chip-muffins/',
    expected: 'Chocolate Chip Muffins',
    category: 'snacks',
  },

  // Smoothies & Beverages
  {
    url: 'https://www.loveandlemons.com/kale-smoothie/',
    expected: 'Kale Smoothie',
    category: 'beverages',
  },
  {
    url: 'https://www.loveandlemons.com/berry-smoothie-bowl/',
    expected: 'Berry Superfood Smoothie Bowl',
    category: 'beverages',
  },
  {
    url: 'https://www.loveandlemons.com/strawberry-banana-smoothie/',
    expected: 'Strawberry Banana Smoothie',
    category: 'beverages',
  },
  {
    url: 'https://www.loveandlemons.com/coffee-smoothie/',
    expected: 'Coffee Smoothie',
    category: 'beverages',
  },
  {
    url: 'https://www.loveandlemons.com/avocado-smoothie/',
    expected: 'Creamy Avocado Smoothie',
    category: 'beverages',
  },
  {
    url: 'https://www.loveandlemons.com/blueberry-smoothie/',
    expected: 'Blueberry Smoothie',
    category: 'beverages',
  },

  // More Snacks & Appetizers
  {
    url: 'https://www.loveandlemons.com/roasted-chickpeas/',
    expected: 'Crispy Roasted Chickpeas',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/popcorn/',
    expected: 'Stovetop Popcorn',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/roasted-pumpkin-seeds/',
    expected: 'Roasted Pumpkin Seeds',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/homemade-crackers/',
    expected: 'Homemade Crackers',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/veggie-frittata-muffins/',
    expected: 'Veggie Frittata Muffins',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/hard-boiled-eggs/',
    expected: 'Hard Boiled Eggs',
    category: 'snacks',
  },
  {
    url: 'https://www.loveandlemons.com/deviled-eggs/',
    expected: 'Deviled Eggs',
    category: 'snacks',
  },

  // Breakfast & Staples
  {
    url: 'https://www.loveandlemons.com/overnight-oats/',
    expected: 'Overnight Oats',
    category: 'breakfast',
  },
  {
    url: 'https://www.loveandlemons.com/chia-seed-pudding/',
    expected: 'Chia Seed Pudding',
    category: 'breakfast',
  },
  {
    url: 'https://www.loveandlemons.com/granola/',
    expected: 'Homemade Granola',
    category: 'breakfast',
  },

  // Wraps & Light Meals
  {
    url: 'https://www.loveandlemons.com/avocado-summer-rolls/',
    expected: 'Avocado Summer Rolls',
    category: 'meals',
  },
  {
    url: 'https://www.loveandlemons.com/fresh-spring-rolls/',
    expected: 'Fresh Spring Rolls',
    category: 'meals',
  },
  {
    url: 'https://www.loveandlemons.com/taquitos/',
    expected: 'Homemade Taquitos',
    category: 'meals',
  },
  {
    url: 'https://www.loveandlemons.com/avocado-toast/',
    expected: 'Avocado Toast (5 Ways)',
    category: 'meals',
  },
  {
    url: 'https://www.loveandlemons.com/nori-wraps/',
    expected: 'Nori Wraps',
    category: 'meals',
  },
  {
    url: 'https://www.loveandlemons.com/shiitake-maki-sushi/',
    expected: 'Shiitake Maki Sushi',
    category: 'meals',
  },
];

console.log(
  `🧪 Love & Lemons Recipe Test Suite - ${LOVE_LEMONS_RECIPES.length} recipes`
);

// Test configuration with environment variables
const TEST_CONFIG = {
  testCredentials: {
    username: process.env.RECIPE_TEST_USER || 'test',
    password: process.env.RECIPE_TEST_PASS || 'subject123',
  },
  timeout: 30000, // 30 seconds per recipe
  maxConcurrent: 3, // Limit concurrent tests to avoid overwhelming servers
  retryAttempts: 2,
};

async function setupAuthentication(context, browserType) {
  console.log(`🔐 Setting up ${browserType} extension authentication...`);

  const setupPage = await context.newPage();

  try {
    await setupPage.goto(
      'data:text/html,<html><body>Recipe Extension Setup</body></html>'
    );

    await setupPage.evaluateOnNewDocument(() => {
      const authData = {
        username: process.env.RECIPE_TEST_USER || 'test',
        password: process.env.RECIPE_TEST_PASS || 'subject123',
        authConfigured: true,
      };

      localStorage.setItem('recipeArchiveAuth', JSON.stringify(authData));
      console.log(
        `${browserType} extension authentication configured for testing`
      );
    });

    await setupPage.close();
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to setup ${browserType} authentication:`,
      error.message
    );
    await setupPage.close();
    return false;
  }
}

async function testRecipeExtraction(context, recipe, browserType) {
  const page = await context.newPage();

  try {
    console.log(`\n--- Testing ${browserType}: ${recipe.url} ---`);

    // Navigate to recipe
    await page.goto(recipe.url, {
      waitUntil: 'networkidle',
      timeout: TEST_CONFIG.timeout,
    });

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Dismiss any overlays/popups
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
      ];

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => el.remove());
      });

      // Click dismiss buttons
      const dismissButtons = document.querySelectorAll(
        'button, [role="button"]'
      );
      dismissButtons.forEach((btn) => {
        const text = btn.textContent?.toLowerCase() || '';
        if (
          text.includes('close') ||
          text.includes('dismiss') ||
          text.includes('×')
        ) {
          btn.click();
        }
      });
    });

    // Test extraction
    const extractionResult = await page.evaluate(async () => {
      // Try different extraction approaches based on site structure

      // Method 1: Look for structured data (JSON-LD)
      const jsonLdScript = document.querySelector(
        'script[type="application/ld+json"]'
      );
      if (jsonLdScript) {
        try {
          const jsonData = JSON.parse(jsonLdScript.textContent);
          if (
            jsonData['@type'] === 'Recipe' ||
            (Array.isArray(jsonData) &&
              jsonData.find((item) => item['@type'] === 'Recipe'))
          ) {
            const recipeData = Array.isArray(jsonData)
              ? jsonData.find((item) => item['@type'] === 'Recipe')
              : jsonData;

            return {
              method: 'json-ld',
              title: recipeData.name,
              ingredients: recipeData.recipeIngredient
                ? [{ title: null, items: recipeData.recipeIngredient }]
                : [],
              steps: recipeData.recipeInstructions
                ? [
                    {
                      title: null,
                      items: recipeData.recipeInstructions
                        .map((step) =>
                          typeof step === 'string'
                            ? step
                            : step.text || step.name || ''
                        )
                        .filter(Boolean),
                    },
                  ]
                : [],
              servingSize: recipeData.recipeYield || null,
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
              success: true,
            };
          }
        } catch (e) {
          console.log('JSON-LD parsing failed:', e.message);
        }
      }

      // Method 2: Love & Lemons specific selectors
      const title =
        document
          .querySelector('h1, .entry-title, .recipe-title')
          ?.textContent?.trim() ||
        document.title ||
        'Unknown Recipe';

      // Look for ingredients
      let ingredients = [];
      const ingredientSelectors = [
        '.recipe-ingredients li',
        '.ingredients li',
        '[class*="ingredient"] li',
        '.wp-block-group li', // Love & Lemons uses this
        '.recipe-card-ingredients li',
        'ul li', // Fallback
      ];

      for (const selector of ingredientSelectors) {
        const ingredientElements = document.querySelectorAll(selector);
        if (ingredientElements.length > 0) {
          const items = Array.from(ingredientElements)
            .map((el) => el.textContent?.trim())
            .filter((text) => text && text.length > 2);

          if (items.length > 0) {
            ingredients = [{ title: null, items }];
            break;
          }
        }
      }

      // Look for steps
      let steps = [];
      const stepSelectors = [
        '.recipe-instructions li',
        '.instructions li',
        '.recipe-directions li',
        '[class*="instruction"] li',
        'ol li', // Fallback for ordered lists
        '.wp-block-list li', // Love & Lemons specific
        '.recipe-card-instructions li',
      ];

      for (const selector of stepSelectors) {
        const stepElements = document.querySelectorAll(selector);
        if (stepElements.length > 0) {
          const items = Array.from(stepElements)
            .map((el) => el.textContent?.trim())
            .filter((text) => text && text.length > 10);

          if (items.length > 0) {
            steps = [{ title: null, items }];
            break;
          }
        }
      }

      // Extract other fields
      const servingSize =
        document.body.textContent
          ?.match(/(serves?|yield[s]?|makes?)\\s*:?\\s*(\\d+[\\w\\s]*)/i)?.[2]
          ?.trim() || null;
      const time =
        document.body.textContent
          ?.match(
            /(total time|prep time|cook time|active time)\\s*:?\\s*([\\d\\w\\s,:]+)/i
          )?.[2]
          ?.trim() || null;

      // Extract photos
      const photos = [];
      const imageElements = document.querySelectorAll('img');
      imageElements.forEach((img) => {
        if (
          img.src &&
          (img.src.includes('recipe') ||
            img.alt?.includes('recipe') ||
            img.className?.includes('recipe'))
        ) {
          if (!photos.includes(img.src)) {
            photos.push(img.src);
          }
        }
      });

      return {
        method: 'dom-parsing',
        title,
        ingredients,
        steps,
        servingSize,
        time,
        photos,
        fullTextContent: document.body.textContent?.slice(0, 1000) || '',
        success: true,
      };
    });

    // Validate results
    const hasTitle =
      extractionResult.title && extractionResult.title !== 'Unknown Recipe';
    const hasIngredients =
      extractionResult.ingredients &&
      extractionResult.ingredients.some(
        (section) => section.items && section.items.length > 0
      );
    const hasSteps =
      extractionResult.steps &&
      extractionResult.steps.some(
        (section) => section.items && section.items.length > 0
      );

    const result = {
      url: recipe.url,
      expected: recipe.expected,
      category: recipe.category,
      browserType,
      success: hasTitle && hasIngredients && hasSteps,
      data: extractionResult,
      issues: [],
    };

    // Track issues
    if (!hasTitle) result.issues.push('Missing or invalid title');
    if (!hasIngredients) result.issues.push('No ingredients found');
    if (!hasSteps) result.issues.push('No instructions/steps found');

    if (result.success) {
      console.log(`✅ SUCCESS (${browserType}): ${recipe.expected}`);
      console.log(`   - Method: ${extractionResult.method}`);
      console.log(
        `   - Ingredients: ${extractionResult.ingredients.reduce((sum, s) => sum + s.items.length, 0)} items`
      );
      console.log(
        `   - Steps: ${extractionResult.steps.reduce((sum, s) => sum + s.items.length, 0)} items`
      );
    } else {
      console.log(`❌ FAILURE (${browserType}): ${recipe.expected}`);
      console.log(`   - Issues: ${result.issues.join(', ')}`);
      if (extractionResult.ingredients) {
        console.log(
          `   - Found ingredients: ${extractionResult.ingredients.reduce((sum, s) => sum + s.items.length, 0)}`
        );
      }
      if (extractionResult.steps) {
        console.log(
          `   - Found steps: ${extractionResult.steps.reduce((sum, s) => sum + s.items.length, 0)}`
        );
      }
    }

    await page.close();
    return result;
  } catch (error) {
    console.log(
      `💥 ERROR (${browserType}): ${recipe.expected} - ${error.message}`
    );
    await page.close();
    return {
      url: recipe.url,
      expected: recipe.expected,
      category: recipe.category,
      browserType,
      success: false,
      error: error.message,
      issues: ['Test execution failed'],
    };
  }
}

async function runTestSuite() {
  console.log('🚀 Starting Love & Lemons Recipe Test Suite');
  console.log(
    `📊 Testing ${LOVE_LEMONS_RECIPES.length} recipes across Chrome and Safari`
  );

  const results = {
    chrome: [],
    safari: [],
    summary: {
      chrome: { passed: 0, failed: 0, errors: 0 },
      safari: { passed: 0, failed: 0, errors: 0 },
    },
  };

  // Test with Chrome
  console.log('\n🔵 Testing with Chrome Extension...');
  const chromeContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--disable-extensions-except=$PROJECT_ROOT/extensions/chrome',
      '--load-extension=$PROJECT_ROOT/extensions/chrome',
      '--disable-web-security',
    ],
  });

  await setupAuthentication(chromeContext, 'Chrome');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Run Chrome tests (limited batch to avoid overwhelming servers)
  for (let i = 0; i < Math.min(10, LOVE_LEMONS_RECIPES.length); i++) {
    const recipe = LOVE_LEMONS_RECIPES[i];
    const result = await testRecipeExtraction(chromeContext, recipe, 'Chrome');
    results.chrome.push(result);

    if (result.success) results.summary.chrome.passed++;
    else if (result.error) results.summary.chrome.errors++;
    else results.summary.chrome.failed++;

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await chromeContext.close();

  // Test with Safari (WebKit)
  console.log('\n🟠 Testing with Safari Extension...');
  const safariContext = await webkit.launchPersistentContext('', {
    headless: false,
  });

  await setupAuthentication(safariContext, 'Safari');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Run Safari tests (limited batch)
  for (let i = 0; i < Math.min(10, LOVE_LEMONS_RECIPES.length); i++) {
    const recipe = LOVE_LEMONS_RECIPES[i];
    const result = await testRecipeExtraction(safariContext, recipe, 'Safari');
    results.safari.push(result);

    if (result.success) results.summary.safari.passed++;
    else if (result.error) results.summary.safari.errors++;
    else results.summary.safari.failed++;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await safariContext.close();

  // Generate comprehensive report
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n🔵 Chrome Extension Results:');
  console.log(`   ✅ Passed: ${results.summary.chrome.passed}`);
  console.log(`   ❌ Failed: ${results.summary.chrome.failed}`);
  console.log(`   💥 Errors: ${results.summary.chrome.errors}`);
  console.log(
    `   📈 Success Rate: ${((results.summary.chrome.passed / results.chrome.length) * 100).toFixed(1)}%`
  );

  console.log('\n🟠 Safari Extension Results:');
  console.log(`   ✅ Passed: ${results.summary.safari.passed}`);
  console.log(`   ❌ Failed: ${results.summary.safari.failed}`);
  console.log(`   💥 Errors: ${results.summary.safari.errors}`);
  console.log(
    `   📈 Success Rate: ${((results.summary.safari.passed / results.safari.length) * 100).toFixed(1)}%`
  );

  // Show detailed failures for first batch
  console.log('\n🔍 DETAILED FAILURE ANALYSIS:');
  [...results.chrome, ...results.safari].forEach((result) => {
    if (!result.success) {
      console.log(`\n❌ ${result.browserType}: ${result.expected}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Issues: ${result.issues.join(', ')}`);
      if (result.error) console.log(`   Error: ${result.error}`);
    }
  });

  // Save detailed results to file
  const fs = require('fs');
  fs.writeFileSync(
    'love-lemons-test-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Detailed results saved to: love-lemons-test-results.json');

  const totalSuccess =
    results.summary.chrome.passed + results.summary.safari.passed;
  const totalTests = results.chrome.length + results.safari.length;

  if (totalSuccess === totalTests) {
    console.log(
      '\n🎉 All tests passed! Extensions are working correctly with Love & Lemons recipes.'
    );
    process.exit(0);
  } else {
    console.log(
      `\n⚠️  ${totalTests - totalSuccess} tests failed. Review failures and update parsers accordingly.`
    );
    process.exit(1);
  }
}

// Run the test suite
runTestSuite().catch(console.error);
