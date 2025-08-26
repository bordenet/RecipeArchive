#!/usr/bin/env node

const { chromium } = require('playwright');

async function analyzeLoveLemonsStructure() {
  console.log('🔍 Analyzing Love & Lemons site structure...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Test with one recipe
    await page.goto('https://www.loveandlemons.com/vegan-sugar-cookies/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('✅ Page loaded successfully');

    // Wait for content
    await page.waitForTimeout(5000);

    // Analyze structure
    const analysis = await page.evaluate(() => {
      const results = {
        title: null,
        selectors_found: [],
        ingredients_selectors: [],
        steps_selectors: [],
        json_ld: null,
        microdata: null,
      };

      // Check for title
      const titleSelectors = [
        'h1',
        '.entry-title',
        '.recipe-title',
        '.post-title',
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
      const jsonLdScript = document.querySelector(
        'script[type="application/ld+json"]'
      );
      if (jsonLdScript) {
        try {
          const jsonData = JSON.parse(jsonLdScript.textContent);
          results.json_ld = jsonData;
          results.selectors_found.push('JSON-LD found');
        } catch (e) {
          results.selectors_found.push('JSON-LD exists but parsing failed');
        }
      }

      // Check various ingredient selectors
      const ingredientSelectors = [
        '.recipe-ingredients li',
        '.ingredients li',
        '.wp-block-list li',
        '.recipe-card-ingredients li',
        'ul li',
        '[class*="ingredient"] li',
        '.entry-content ul li',
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

      // Check various step selectors
      const stepSelectors = [
        '.recipe-instructions li',
        '.instructions li',
        '.recipe-directions li',
        '.wp-block-list li',
        'ol li',
        '.recipe-card-instructions li',
        '.entry-content ol li',
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

      return results;
    });

    console.log('\n📊 ANALYSIS RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log(`\n📝 Title: ${analysis.title}`);
    console.log(`\n🔍 Selectors Found: ${analysis.selectors_found.join(', ')}`);

    console.log('\n🥗 INGREDIENT SELECTORS:');
    analysis.ingredients_selectors.forEach((ing) => {
      console.log(`   ${ing.selector} (${ing.count} items)`);
      console.log(`   Sample: ${ing.sample.join(' | ')}`);
    });

    console.log('\n📋 STEP SELECTORS:');
    analysis.steps_selectors.forEach((step) => {
      console.log(`   ${step.selector} (${step.count} items)`);
      console.log(`   Sample: ${step.sample[0] || 'N/A'}`);
    });

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
        }
      }
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await browser.close();
  }
}

analyzeLoveLemonsStructure().catch(console.error);
