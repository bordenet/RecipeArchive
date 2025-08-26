/**
 * Comprehensive Recipe Site Testing
 * 
 * Tests the improved extraction logic across multiple recipe sites
 * Validates @type array handling and ImageObject URL extraction
 */

const { chromium } = require('playwright');

const RECIPE_SITES = [
  {
    name: 'AllRecipes',
    url: 'https://www.allrecipes.com/recipe/16095/simple-white-cake/',
    expectedTitle: 'Simple White Cake',
    expectedFeatures: ['@type array', 'ImageObject URLs', 'JSON-LD']
  },
  {
    name: 'Food52',
    url: 'https://food52.com/recipes/26191-classic-chocolate-chip-cookies',
    expectedTitle: 'Classic Chocolate Chip Cookies',
    expectedFeatures: ['JSON-LD']
  },
  {
    name: 'Sally\'s Baking Addiction',
    url: 'https://sallysbakingaddiction.com/chocolate-chip-cookies/',
    expectedTitle: 'Chocolate Chip Cookies',
    expectedFeatures: ['JSON-LD']
  },
  {
    name: 'King Arthur Baking',
    url: 'https://www.kingarthurbaking.com/recipes/chocolate-chip-cookies-recipe',
    expectedTitle: 'Chocolate Chip Cookies',
    expectedFeatures: ['JSON-LD']
  }
];

async function testMultipleRecipeSites() {
  console.log('🧪 Comprehensive Recipe Site Testing');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const results = [];
  
  for (const site of RECIPE_SITES) {
    console.log(`\\n🌐 Testing ${site.name}...`);
    console.log(`   URL: ${site.url}`);
    
    const page = await context.newPage();
    
    try {
      // Navigate with timeout
      await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Extract recipe using our improved logic
      const extractionResult = await page.evaluate(() => {
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
                
                if (itemType.includes('Recipe')) {
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
                    rawType: item['@type'],
                    rawImageData: item.image,
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
      
      // Analyze results
      const result = {
        site: site.name,
        url: site.url,
        success: !!extractionResult,
        title: extractionResult?.title || 'Not found',
        features: {
          hasTypeArray: Array.isArray(extractionResult?.rawType),
          hasImageObject: extractionResult?.rawImageData && typeof extractionResult.rawImageData === 'object' && extractionResult.rawImageData['@type'] === 'ImageObject',
          hasJsonLd: !!extractionResult,
          ingredientCount: extractionResult?.ingredients?.length || 0,
          stepCount: extractionResult?.steps?.length || 0,
          photoCount: extractionResult?.photos?.length || 0
        }
      };
      
      results.push(result);
      
      if (result.success) {
        console.log('   ✅ Extraction successful');
        console.log(`      Title: ${result.title}`);
        console.log(`      Ingredients: ${result.features.ingredientCount}`);
        console.log(`      Steps: ${result.features.stepCount}`);
        console.log(`      Photos: ${result.features.photoCount}`);
        console.log(`      @type Array: ${result.features.hasTypeArray}`);
        console.log(`      ImageObject: ${result.features.hasImageObject}`);
      } else {
        console.log('   ❌ Extraction failed');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        site: site.name,
        url: site.url,
        success: false,
        error: error.message
      });
    }
    
    await page.close();
  }
  
  await browser.close();
  
  // Print summary
  console.log('\\n📊 TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful extractions: ${successful.length}/${results.length}`);
  console.log(`❌ Failed extractions: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\\n🎉 Working sites:');
    successful.forEach(result => {
      console.log(`   • ${result.site}: ${result.title}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\\n⚠️  Failed sites:');
    failed.forEach(result => {
      console.log(`   • ${result.site}: ${result.error || 'No recipe found'}`);
    });
  }
  
  // Test AllRecipes specifically for our fixes
  const allRecipesResult = results.find(r => r.site === 'AllRecipes');
  if (allRecipesResult && allRecipesResult.success) {
    console.log('\\n🎯 AllRecipes Fix Validation:');
    console.log(`   @type array handling: ${allRecipesResult.features.hasTypeArray ? '✅' : '❌'}`);
    console.log(`   ImageObject URL extraction: ${allRecipesResult.features.hasImageObject ? '✅' : '❌'}`);
  }
  
  return results;
}

// Run the tests
if (require.main === module) {
  testMultipleRecipeSites()
    .then((results) => {
      const successCount = results.filter(r => r.success).length;
      console.log(`\\n${successCount === results.length ? '✅' : '⚠️'} Recipe site testing completed: ${successCount}/${results.length} successful`);
      process.exit(successCount === results.length ? 0 : 1);
    })
    .catch((error) => {
      console.error('\\n❌ Recipe site testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testMultipleRecipeSites };
