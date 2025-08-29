/* eslint-env node, browser */
/* eslint-env node, browser */

const { chromium } = require('playwright');

// Complete Food52 recipe test suite - 62 recipes from their best cookies collection
const FOOD52_RECIPES = [
  {
    url: 'https://food52.com/recipes/78143-chocolate-chip-cookies',
    expected: 'Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/80083-banana-bread-chocolate-chunk-cookies',
    expected: 'Banana Bread Chocolate Chunk Cookies',
  },
  {
    url: 'https://food52.com/recipes/76189-wrinkly-chocolate-chip-cookies',
    expected: 'Wrinkly Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/31738-ovenly-s-secretly-vegan-salted-chocolate-chip-cookies',
    expected: 'Secretly Vegan Salted Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/86992-chewy-chocolate-chip-cookies-with-rainbow-fennel-seeds',
    expected: 'Chewy Chocolate Chip Cookies with Rainbow Fennel Seeds',
  },
  {
    url: 'https://food52.com/recipes/34243-aunt-lolly-s-oatmeal-chocolate-chip-cookies',
    expected: 'Aunt Lolly\'s Oatmeal Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/74748-buttermilk-chocolate-chip-cookies',
    expected: 'Buttermilk Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/75068-caramelized-applesauce-chocolate-chip-cookies',
    expected: 'Caramelized Applesauce Chocolate Chip Cookies',
  },
  {
    url: 'https://food52.com/recipes/32365-spritz-butter-christmas-cookies',
    expected: 'Spritz Butter Christmas Cookies',
  },
  {
    url: 'https://food52.com/recipes/22155-gingerbread-cookies',
    expected: 'Gingerbread Cookies',
  },
  {
    url: 'https://food52.com/recipes/59039-holiday-crinkle-cookies',
    expected: 'Holiday Crinkle Cookies',
  },
  {
    url: 'https://food52.com/recipes/17272-russian-tea-cakes',
    expected: 'Russian Tea Cakes',
  },
  {
    url: 'https://food52.com/recipes/34589-dominique-ansels-linzer-cookies',
    expected: 'Dominique Ansel\'s Linzer Cookies',
  },
  {
    url: 'https://food52.com/recipes/17978-italian-rainbow-cookies',
    expected: 'Italian Rainbow Cookies',
  },
  {
    url: 'https://food52.com/recipes/16345-danish-butter-cookies',
    expected: 'Danish Butter Cookies',
  },
  {
    url: 'https://food52.com/recipes/32257-rose-levy-beranbaums-molasses-sugar-butter-cookies',
    expected: 'Rose Levy Beranbaum\'s Molasses Sugar Butter Cookies',
  },
  {
    url: 'https://food52.com/recipes/34295-vegan-dark-chocolate-gingerbread-thumbprint-cookies',
    expected: 'Vegan Dark Chocolate Gingerbread Thumbprint Cookies',
  },
  {
    url: 'https://food52.com/recipes/34340-chai-spice-snickerdoodles',
    expected: 'Chai Spice Snickerdoodles',
  },
  {
    url: 'https://food52.com/recipes/34336-soft-puffy-snickerdoodles',
    expected: 'Soft Puffy Snickerdoodles',
  },
  {
    url: 'https://food52.com/recipes/75955-bien-cuits-masala-pecan-sandies',
    expected: 'Bien Cuit\'s Masala Pecan Sandies',
  },
  // Adding first 20 for initial testing - will expand based on results
];

async function aggressivePopupBlocking(page) {
  // Enhanced popup and overlay removal
  await page.addInitScript(() => {
    // Block common popup/overlay patterns as soon as DOM loads
    const blockPatterns = [
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
    ];

    const observer = new MutationObserver(() => {
      blockPatterns.forEach((pattern) => {
        const elements = document.querySelectorAll(pattern);
        elements.forEach((el) => {
          if (el && el.style) {
            el.style.display = 'none';
            el.remove();
          }
        });
      });

      // Auto-click dismiss buttons
      const dismissButtons = document.querySelectorAll(
        'button[data-dismiss], .close, .dismiss, [aria-label*="close"], [aria-label*="Close"]'
      );
      dismissButtons.forEach((btn) => {
        if (btn.offsetHeight > 0) {
          // Only click visible buttons
          btn.click();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });

  // Block specific Food52 popup requests
  await page.route('**/*newsletter*', (route) => route.abort());
  await page.route('**/*popup*', (route) => route.abort());
  await page.route('**/*modal*', (route) => route.abort());
}

async function extractFood52Recipe(page) {
  return await page.evaluate(() => {
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
            recipe = jsonData.find((item) => item['@type'] === 'Recipe');
          } else if (jsonData['@graph']) {
            recipe = jsonData['@graph'].find(
              (item) => item['@type'] === 'Recipe'
            );
          }

          if (recipe) {
            console.log('Food52: Found JSON-LD Recipe data');

            const ingredients = recipe.recipeIngredient
              ? [{ title: null, items: recipe.recipeIngredient }]
              : [];

            let steps = [];
            if (recipe.recipeInstructions) {
              const stepItems = recipe.recipeInstructions
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
              title: recipe.name || document.title,
              ingredients,
              steps,
              servingSize: recipe.recipeYield || recipe.yield || null,
              time:
                recipe.totalTime || recipe.cookTime || recipe.prepTime || null,
              photos: recipe.image
                ? Array.isArray(recipe.image)
                  ? recipe.image
                  : [recipe.image]
                : [],
              attributionUrl: window.location.href,
              source: 'json-ld',
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
        document.title;

      let ingredients = [];
      let steps = [];

      // Try various Food52 selectors for ingredients
      const ingredientSelectors = [
        '.recipe-list--ingredients li',
        '.recipe-ingredients li',
        '[data-testid="ingredients"] li',
        'ul[data-testid*="ingredient"] li',
        '.ingredients li',
        '[class*="ingredient"] li',
      ];

      for (const selector of ingredientSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const items = Array.from(elements)
            .map((el) => el.textContent?.trim())
            .filter((text) => text && text.length > 2);

          if (items.length > 0) {
            ingredients = [{ title: null, items }];
            console.log(`Food52: Found ingredients with selector: ${selector}`);
            break;
          }
        }
      }

      // Try various Food52 selectors for steps
      const stepSelectors = [
        '.recipe-list--instructions li',
        '.recipe-instructions li',
        '[data-testid="instructions"] li',
        'ol[data-testid*="instruction"] li',
        '.instructions li',
        '[class*="instruction"] li',
      ];

      for (const selector of stepSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const items = Array.from(elements)
            .map((el) => el.textContent?.trim())
            .filter((text) => text && text.length > 10);

          if (items.length > 0) {
            steps = [{ title: null, items }];
            console.log(`Food52: Found steps with selector: ${selector}`);
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
        attributionUrl: window.location.href,
        source: 'food52-manual',
      };
    }

    // Try JSON-LD first
    let result = extractRecipeFromJsonLd();
    if (result && result.ingredients.length > 0 && result.steps.length > 0) {
      return result;
    }

    // Try manual extraction
    result = extractFood52Manual();
    return result;
  });
}

async function testFood52Recipe(recipe, index) {
  console.log(
    `\n🧪 [${index + 1}/${FOOD52_RECIPES.length}] Testing: ${recipe.expected}`
  );
  console.log(`   URL: ${recipe.url}`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
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
    // Set up aggressive popup blocking
    await aggressivePopupBlocking(page);

    // Navigate to recipe
    await page.goto(recipe.url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Wait for content to load
    await page.waitForTimeout(5000);

    // Additional popup cleanup after page load
    await page.evaluate(() => {
      // Remove any remaining popups
      const popupSelectors = [
        '.modal',
        '.overlay',
        '.popup',
        '.newsletter-signup',
        '[data-modal]',
        '[data-overlay]',
        '[class*="modal"]',
        '.cookie-banner',
        '.gdpr-notice',
        '.subscription-modal',
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
    });

    // Check if we hit a 404 or access issue
    const pageStatus = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        is404:
          document.title.includes('404') ||
          window.location.href.includes('404'),
        hasContent: document.body.textContent.length > 1000,
      };
    });

    if (pageStatus.is404) {
      console.log('   ❌ 404 Error - Recipe not accessible');
      return { success: false, error: '404 Not Found', recipe };
    }

    if (!pageStatus.hasContent) {
      console.log('   ❌ Page has minimal content - possibly blocked');
      return {
        success: false,
        error: 'Minimal content - possibly blocked',
        recipe,
      };
    }

    // Extract recipe data
    const result = await extractFood52Recipe(page);

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
      issues: success ? [] : ['Missing required fields'],
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message, recipe };
  } finally {
    await browser.close();
  }
}

async function runFood52ComprehensiveTest() {
  console.log('🚀 Starting Food52 Comprehensive Recipe Test Suite');
  console.log(`📊 Testing ${FOOD52_RECIPES.length} Food52 cookie recipes`);

  const results = [];
  let successCount = 0;

  // Test first 5 recipes to start
  const testBatch = FOOD52_RECIPES.slice(0, 5);

  for (let i = 0; i < testBatch.length; i++) {
    const result = await testFood52Recipe(testBatch[i], i);
    results.push(result);

    if (result.success) successCount++;

    // Delay between tests to be respectful to Food52's servers
    if (i < testBatch.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Generate summary
  console.log('\n📊 FOOD52 TEST RESULTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log(
    `\n✅ Success Rate: ${successCount}/${testBatch.length} (${((successCount / testBatch.length) * 100).toFixed(1)}%)`
  );

  // Show results
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
    'food52-test-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\\n💾 Results saved to: food52-test-results.json');

  if (successCount === testBatch.length) {
    console.log(
      '\\n🎉 All Food52 tests passed! Ready to expand to full test suite.'
    );
  } else {
    console.log(
      `\\n⚠️  ${testBatch.length - successCount} test(s) failed. Need to improve Food52 parser.`
    );

    // Show specific issues
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.log('\\nFailure Analysis:');
      failures.forEach((f) => {
        console.log(
          `   ${f.recipe.expected}: ${f.error || f.issues?.join(', ')}`
        );
      });
    }
  }
}

// Run the Food52 test
runFood52ComprehensiveTest().catch(console.error);
