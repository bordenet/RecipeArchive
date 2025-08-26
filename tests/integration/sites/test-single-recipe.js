#!/usr/bin/env node

const { chromium } = require('playwright');

async function testSingleRecipe(url, _expectedTitle) {
  console.log(`🧪 Testing single recipe: ${url}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to recipe
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('✅ Page loaded');

    // Wait for content to stabilize
    await page.waitForTimeout(5000);

    // Inject our content script for testing
    const fs = require('fs');
    const contentScript = fs.readFileSync(
      './extensions/chrome/content.js',
      'utf8'
    );

    const extractionCode = `
      // Inject the extraction functions directly
      ${contentScript}
      
      // Execute extraction
      const result = extractRecipeGeneric();
      result;
    `;

    const result = await page.evaluate(extractionCode);

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
      result.ingredients[0].items.slice(0, 3).forEach((item) => {
        console.log(`   - ${item}`);
      });
    }

    if (result.steps?.length > 0 && result.steps[0].items.length > 0) {
      console.log('\n📋 Sample Steps:');
      result.steps[0].items.slice(0, 2).forEach((step, index) => {
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
        console.log('   No ingredients found. Check selectors.');
      }
      if (!hasSteps) {
        console.log('   No steps found. Check selectors.');
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

testSingleRecipe(testUrl, expectedTitle).catch(console.error);
