#!/usr/bin/env node

const { chromium } = require('playwright');

async function analyzeFood52Structure() {
  console.log('🔍 Analyzing Food52 site structure...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Test with a Food52 recipe
    await page.goto('https://food52.com/recipes/78143-chocolate-chip-cookies', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('✅ Page loaded successfully');

    // Wait for content
    await page.waitForTimeout(8000);

    // Handle potential popups first
    await page.evaluate(() => {
      // Remove common Food52 popups/overlays
      const popupSelectors = [
        '.modal',
        '.overlay',
        '[data-modal]',
        '[data-overlay]',
        '.newsletter-signup',
        '.email-signup',
        '.subscribe-modal',
        '.gdpr-banner',
        '.cookie-notice',
        '.privacy-notice',
        '[class*="popup"]',
        '[id*="popup"]',
        '[class*="modal"]',
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
        'button, [role="button"], .close, [class*="close"]'
      );
      dismissButtons.forEach((btn) => {
        const text = (btn.textContent || '').toLowerCase().trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

        if (
          text.includes('close') ||
          text.includes('dismiss') ||
          text === '×' ||
          text.includes('no thanks') ||
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

    // Wait after popup handling
    await page.waitForTimeout(3000);

    // Analyze structure
    const analysis = await page.evaluate(() => {
      const results = {
        title: null,
        selectors_found: [],
        ingredients_selectors: [],
        steps_selectors: [],
        json_ld: null,
        microdata: null,
        recipe_structure: {},
      };

      // Check for title
      const titleSelectors = [
        'h1',
        '.recipe-title',
        '[data-testid="recipe-title"]',
        '.recipe-header h1',
        '.recipe-name',
        '.entry-title',
      ];
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          results.title = element.textContent.trim();
          results.selectors_found.push(`title: ${selector}`);
          break;
        }
      }

      // Check for JSON-LD
      const jsonLdScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      if (jsonLdScripts.length > 0) {
        results.selectors_found.push(
          `JSON-LD scripts: ${jsonLdScripts.length}`
        );

        for (let i = 0; i < jsonLdScripts.length; i++) {
          try {
            const jsonData = JSON.parse(jsonLdScripts[i].textContent);
            if (
              jsonData['@type'] === 'Recipe' ||
              (Array.isArray(jsonData) &&
                jsonData.find((item) => item['@type'] === 'Recipe')) ||
              (jsonData['@graph'] &&
                jsonData['@graph'].find((item) => item['@type'] === 'Recipe'))
            ) {
              results.json_ld = jsonData;
              results.selectors_found.push(
                `JSON-LD Recipe found in script ${i}`
              );
              break;
            }
          } catch (e) {
            results.selectors_found.push(
              `JSON-LD parsing failed for script ${i}`
            );
          }
        }
      }

      // Check various ingredient selectors Food52 might use
      const ingredientSelectors = [
        '.recipe-ingredients li',
        '.ingredients li',
        '[data-testid="ingredients"] li',
        '.recipe-list--ingredients li',
        '[class*="ingredient"] li',
        '.recipe-card-ingredients li',
        'ul[class*="ingredient"] li',
        '[data-ingredient] li',
        '.ingredients-list li',
        'section[class*="ingredient"] li',
      ];

      for (const selector of ingredientSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const sample = Array.from(elements)
            .slice(0, 3)
            .map((el) => el.textContent?.trim())
            .filter(Boolean);
          if (sample.length > 0) {
            results.ingredients_selectors.push({
              selector,
              count: elements.length,
              sample,
            });
          }
        }
      }

      // Check various step/instruction selectors
      const stepSelectors = [
        '.recipe-instructions li',
        '.instructions li',
        '[data-testid="instructions"] li',
        '.recipe-list--instructions li',
        '[class*="instruction"] li',
        '.recipe-card-instructions li',
        'ol[class*="instruction"] li',
        '[data-instruction] li',
        '.instructions-list li',
        'section[class*="instruction"] li',
        '.recipe-directions li',
        '.method li',
      ];

      for (const selector of stepSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const sample = Array.from(elements)
            .slice(0, 2)
            .map((el) => el.textContent?.trim())
            .filter(Boolean);
          if (sample.length > 0) {
            results.steps_selectors.push({
              selector,
              count: elements.length,
              sample: sample.map((s) => s.slice(0, 100) + '...'),
            });
          }
        }
      }

      // Analyze overall recipe structure
      results.recipe_structure = {
        recipe_containers: document.querySelectorAll(
          '.recipe, [class*="recipe"], [data-recipe]'
        ).length,
        recipe_cards: document.querySelectorAll(
          '.recipe-card, [class*="recipe-card"]'
        ).length,
        food52_specific: {
          recipe_list_elements: document.querySelectorAll(
            '[class*="recipe-list"]'
          ).length,
          data_testid_elements: document.querySelectorAll(
            '[data-testid*="recipe"]'
          ).length,
          recipe_sections: document.querySelectorAll('section[class*="recipe"]')
            .length,
        },
      };

      return results;
    });

    console.log('\n📊 FOOD52 ANALYSIS RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log(`\n📝 Title: ${analysis.title}`);
    console.log(`\n🔍 Selectors Found: ${analysis.selectors_found.join(', ')}`);

    console.log('\n🥗 INGREDIENT SELECTORS:');
    if (analysis.ingredients_selectors.length === 0) {
      console.log('   ❌ No ingredient selectors found');
    } else {
      analysis.ingredients_selectors.forEach((ing) => {
        console.log(`   ✅ ${ing.selector} (${ing.count} items)`);
        console.log(`      Sample: ${ing.sample.join(' | ')}`);
      });
    }

    console.log('\n📋 STEP SELECTORS:');
    if (analysis.steps_selectors.length === 0) {
      console.log('   ❌ No step selectors found');
    } else {
      analysis.steps_selectors.forEach((step) => {
        console.log(`   ✅ ${step.selector} (${step.count} items)`);
        console.log(`      Sample: ${step.sample[0] || 'N/A'}`);
      });
    }

    console.log('\n🏗️ RECIPE STRUCTURE:');
    console.log(
      `   Recipe containers: ${analysis.recipe_structure.recipe_containers}`
    );
    console.log(`   Recipe cards: ${analysis.recipe_structure.recipe_cards}`);
    console.log('   Food52 specific elements:');
    console.log(
      `     - recipe-list elements: ${analysis.recipe_structure.food52_specific.recipe_list_elements}`
    );
    console.log(
      `     - data-testid recipe elements: ${analysis.recipe_structure.food52_specific.data_testid_elements}`
    );
    console.log(
      `     - recipe sections: ${analysis.recipe_structure.food52_specific.recipe_sections}`
    );

    if (analysis.json_ld) {
      console.log('\n📜 JSON-LD Structure:');
      if (Array.isArray(analysis.json_ld)) {
        analysis.json_ld.forEach((item, index) => {
          console.log(`   [${index}] Type: ${item['@type']}`);
          if (item['@type'] === 'Recipe') {
            console.log(`       Name: ${item.name}`);
            console.log(
              `       Ingredients: ${item.recipeIngredient?.length || 0} items`
            );
            console.log(
              `       Instructions: ${item.recipeInstructions?.length || 0} steps`
            );
          }
        });
      } else {
        console.log(`   Type: ${analysis.json_ld['@type']}`);
        if (analysis.json_ld['@type'] === 'Recipe') {
          console.log(`   Name: ${analysis.json_ld.name}`);
          console.log(
            `   Ingredients: ${analysis.json_ld.recipeIngredient?.length || 0} items`
          );
          console.log(
            `   Instructions: ${analysis.json_ld.recipeInstructions?.length || 0} steps`
          );
        } else if (analysis.json_ld['@graph']) {
          const recipe = analysis.json_ld['@graph'].find(
            (g) => g['@type'] === 'Recipe'
          );
          if (recipe) {
            console.log('   Recipe in @graph:');
            console.log(`     Name: ${recipe.name}`);
            console.log(
              `     Ingredients: ${recipe.recipeIngredient?.length || 0} items`
            );
            console.log(
              `     Instructions: ${recipe.recipeInstructions?.length || 0} steps`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await browser.close();
  }
}

analyzeFood52Structure().catch(console.error);
