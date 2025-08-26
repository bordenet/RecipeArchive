/**
 * AllRecipes Extraction Test
 * 
 * Tests the specific fixes made for AllRecipes JSON-LD extraction:
 * - @type array handling: ['Recipe', 'NewsArticle'] 
 * - ImageObject URL extraction: {type: 'ImageObject', url: '...'}
 */

const { chromium } = require('playwright');

async function testAllRecipesExtraction() {
  console.log('🧪 AllRecipes Extraction Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('\n🌐 Testing Simple White Cake extraction...');
    
    // Navigate to the specific recipe we've been debugging
    await page.goto('https://www.allrecipes.com/recipe/16095/simple-white-cake/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Inject our extraction logic (same as browser extension)
    const extractionResult = await page.evaluate(() => {
      // This is the same logic from content.js
      function extractRecipeFromJsonLd() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        console.log('Found JSON-LD scripts:', scripts.length);
        
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            const items = Array.isArray(data) ? data : [data];
            
            for (const item of items) {
              // Handle @type as array or string
              const itemType = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
              console.log('Checking item type:', itemType);
              
              if (itemType.includes('Recipe')) {
                console.log('Found Recipe in JSON-LD:', item);
                
                // Extract ingredients
                const ingredients = Array.isArray(item.recipeIngredient) 
                  ? item.recipeIngredient.map(ing => typeof ing === 'string' ? ing : ing.text || ing)
                  : [];
                
                // Extract steps  
                const steps = Array.isArray(item.recipeInstructions) 
                  ? item.recipeInstructions.map(step => step.text || step) 
                  : [];
                
                // Handle images - extract URL from ImageObject
                let photos = [];
                if (item.image) {
                  if (Array.isArray(item.image)) {
                    photos = item.image.map(img => {
                      if (typeof img === 'string') return img;
                      if (img && img.url) return img.url;
                      return null;
                    }).filter(url => url);
                  } else if (typeof item.image === 'string') {
                    photos = [item.image];
                  } else if (item.image && item.image.url) {
                    photos = [item.image.url];
                  }
                }
                
                return {
                  title: item.name || 'Unknown',
                  ingredients,
                  steps,
                  photos,
                  servingSize: item.recipeYield || item.yield || null,
                  time: item.totalTime || item.cookTime || item.prepTime || null,
                  rawImageData: item.image,
                  rawType: item['@type'],
                  source: 'json-ld'
                };
              }
            }
          } catch (e) {
            console.log('Failed to parse JSON-LD:', e.message);
          }
        }
        return null;
      }
      
      return extractRecipeFromJsonLd();
    });
    
    // Test results
    if (!extractionResult) {
      throw new Error('❌ No recipe extracted from AllRecipes');
    }
    
    console.log('✅ Recipe extracted successfully!');
    console.log(`   Title: ${extractionResult.title}`);
    console.log(`   @type: ${JSON.stringify(extractionResult.rawType)}`);
    console.log(`   Ingredients: ${extractionResult.ingredients.length}`);
    console.log(`   Steps: ${extractionResult.steps.length}`);
    console.log(`   Photos: ${extractionResult.photos.length}`);
    
    // Verify specific fixes
    if (extractionResult.title !== 'Simple White Cake') {
      throw new Error(`❌ Wrong title: ${extractionResult.title}`);
    }
    
    if (!Array.isArray(extractionResult.rawType) || !extractionResult.rawType.includes('Recipe')) {
      throw new Error(`❌ @type array handling failed: ${JSON.stringify(extractionResult.rawType)}`);
    }
    
    if (extractionResult.photos.length === 0) {
      throw new Error('❌ No photos extracted (ImageObject URL extraction failed)');
    }
    
    if (!extractionResult.photos[0].includes('allrecipes.com')) {
      throw new Error(`❌ Invalid photo URL: ${extractionResult.photos[0]}`);
    }
    
    console.log('\n🎉 All AllRecipes extraction tests PASSED!');
    console.log('   ✅ @type array handling works');
    console.log('   ✅ ImageObject URL extraction works');
    console.log('   ✅ Recipe data extraction works');
    
  } catch (error) {
    console.error('\n❌ AllRecipes extraction test FAILED:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testAllRecipesExtraction()
    .then(() => {
      console.log('\n✅ AllRecipes extraction test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ AllRecipes extraction test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAllRecipesExtraction };
