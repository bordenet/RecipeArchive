/**
 * Test Safari extension fix for Smitten Kitchen focaccia page
 * Verify that the recipe extraction now works correctly
 */

const { chromium } = require('playwright');

async function testSafariFocacciaFix() {
  console.log('🧪 Testing Safari extension fix for Smitten Kitchen focaccia page...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the focaccia page that was failing
    const testUrl = 'https://smittenkitchen.com/2025/07/focaccia-with-zucchini-and-potatoes/';
    console.log(`📍 Navigating to: ${testUrl}`);
    
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
    
    // Wait for page to load completely
    await page.waitForTimeout(3000);
    
    // Inject our fixed Safari content script
    const contentScript = require('fs').readFileSync(
      '/Users/matt/GitHub/RecipeArchive/extensions/safari/content.js', 
      'utf8'
    );
    
    await page.addScriptTag({ content: contentScript });
    
    // Test the extraction
    const result = await page.evaluate(() => {
      // Simulate the Safari extension flow
      try {
        const data = extractRecipeGeneric();
        const extractionFailed = isExtractionFailed(data);
        
        return {
          success: !extractionFailed,
          data: data,
          hasTitle: !!data.title,
          hasIngredients: data.ingredients && data.ingredients.some(s => s.items && s.items.length > 0),
          hasSteps: data.steps && data.steps.some(s => s.items && s.items.length > 0),
          ingredientCount: data.ingredients?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0,
          stepCount: data.steps?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0,
          source: data.source
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Extraction Results:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Title Found: ${result.hasTitle}`);
    console.log(`🥘 Ingredients Found: ${result.hasIngredients} (${result.ingredientCount} items)`);
    console.log(`📋 Steps Found: ${result.hasSteps} (${result.stepCount} items)`);
    console.log(`🔧 Source: ${result.source}`);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    }
    
    // Test should pass if we found a title and either ingredients or steps
    const testPassed = result.success && result.hasTitle && (result.hasIngredients || result.hasSteps);
    
    if (testPassed) {
      console.log('🎉 TEST PASSED: Safari extension now correctly extracts the focaccia recipe!');
      
      // Show sample of extracted data
      if (result.data.ingredients && result.data.ingredients.length > 0) {
        console.log('\n📋 Sample Ingredients:');
        result.data.ingredients[0].items.slice(0, 3).forEach((ingredient, i) => {
          console.log(`  ${i + 1}. ${ingredient}`);
        });
      }
      
      if (result.data.steps && result.data.steps.length > 0) {
        console.log('\n📝 Sample Steps:');
        result.data.steps[0].items.slice(0, 2).forEach((step, i) => {
          console.log(`  ${i + 1}. ${step.substring(0, 80)}...`);
        });
      }
    } else {
      console.log('❌ TEST FAILED: Safari extension still not extracting the recipe correctly');
    }
    
    return testPassed;
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testSafariFocacciaFix()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });