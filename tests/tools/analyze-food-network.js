/**
 * Tool to analyze Food Network recipe page structure for parser implementation
 * Usage: node tests/tools/analyze-food-network.js
 */

import { chromium } from 'playwright';

const TEST_URL = 'https://www.foodnetwork.com/recipes/alton-brown/margarita-recipe-1949048';

async function analyzeFoodNetworkStructure() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🧪 Analyzing Food Network Structure...');
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000); // Wait for dynamic content

    const analysis = await page.evaluate(() => {
      const results = {
        title: null,
        ingredients: [],
        directions: [],
        selectors_found: [],
        json_ld: null,
      };

      // Check for title
      const titleSelectors = [
        'h1',
        '.recipe-title',
        '.o-RecipeInfo__a-Headline',
        '[data-module="RecipeInfo"] h1',
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
        '.o-RecipeInfo__a-Ingredients li',
        '.o-Ingredients__a-ListItem',
        '.recipe-ingredients li',
        '.ingredients li',
        '[data-module="RecipeInfo"] ul li',
        '.o-RecipeInfo ul li',
        'section[aria-labelledby="recipe-ingredients-section"] li',
        '.o-RecipeInfo__m-Body ul li',
      ];

      results.ingredient_selectors = [];
      for (const selector of ingredientSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const sample = Array.from(elements)
            .slice(0, 3)
            .map((el) => el.textContent?.trim())
            .filter(Boolean);
          
          results.ingredient_selectors.push({
            selector,
            count: elements.length,
            sample,
          });
          
          // Use the first working selector for ingredients
          if (results.ingredients.length === 0) {
            results.ingredients = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter(Boolean);
          }
        }
      }

      // Check various direction selectors
      const directionSelectors = [
        '.o-Method__m-Body li',
        '.o-Method li',
        '.recipe-directions li',
        '.directions li',
        '.instructions li',
        '[data-module="Method"] li',
        '.o-RecipeInfo__a-Directions li',
        'section[aria-labelledby="recipe-instructions-section"] li',
        '.o-RecipeInfo__m-Body ol li',
      ];

      results.direction_selectors = [];
      for (const selector of directionSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const sample = Array.from(elements)
            .slice(0, 2)
            .map((el) => el.textContent?.trim())
            .filter(Boolean);
          
          results.direction_selectors.push({
            selector,
            count: elements.length,
            sample,
          });
          
          // Use the first working selector for directions
          if (results.directions.length === 0) {
            results.directions = Array.from(elements)
              .map((el) => el.textContent?.trim())
              .filter(Boolean);
          }
        }
      }

      // Look for recipe metadata
      const metaSelectors = [
        '.o-RecipeInfo__a-Description',
        '.recipe-summary',
        '.prep-time',
        '.cook-time',
        '.total-time',
        '.servings',
        '.yield',
      ];

      results.meta_selectors = [];
      for (const selector of metaSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          results.meta_selectors.push({
            selector,
            content: element.textContent?.trim(),
          });
        }
      }

      return results;
    });

    console.log('\n📊 ANALYSIS RESULTS:');
    console.log(`🎯 Title: ${analysis.title || 'NOT FOUND'}`);
    console.log(`📝 Ingredients Found: ${analysis.ingredients.length}`);
    console.log(`📋 Directions Found: ${analysis.directions.length}`);
    
    if (analysis.ingredients.length > 0) {
      console.log('\n🧄 INGREDIENTS SAMPLE:');
      analysis.ingredients.slice(0, 5).forEach((ing, i) => {
        console.log(`   ${i + 1}. ${ing}`);
      });
    }

    if (analysis.directions.length > 0) {
      console.log('\n📝 DIRECTIONS SAMPLE:');
      analysis.directions.slice(0, 3).forEach((dir, i) => {
        console.log(`   ${i + 1}. ${dir.substring(0, 100)}...`);
      });
    }

    console.log('\n📋 INGREDIENT SELECTORS:');
    analysis.ingredient_selectors.forEach((ing) => {
      console.log(`   ${ing.selector} (${ing.count} items)`);
      console.log(`   Sample: ${ing.sample[0] || 'N/A'}`);
    });

    console.log('\n📋 DIRECTION SELECTORS:');
    analysis.direction_selectors.forEach((dir) => {
      console.log(`   ${dir.selector} (${dir.count} items)`);
      console.log(`   Sample: ${dir.sample[0] || 'N/A'}`);
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

    if (analysis.meta_selectors.length > 0) {
      console.log('\n⏱️ META SELECTORS:');
      analysis.meta_selectors.forEach((meta) => {
        console.log(`   ${meta.selector}: ${meta.content}`);
      });
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the analysis
analyzeFoodNetworkStructure();
