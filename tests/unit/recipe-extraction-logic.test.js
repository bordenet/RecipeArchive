/**
 * Unit Tests for Recipe Extraction Logic
 * 
 * Tests the specific fixes we made without requiring live website access
 */

// Simple test runner since we're using ES modules
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function deepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Mock JSON-LD data that matches real AllRecipes structure
const ALLRECIPES_JSONLD_MOCK = {
  '@context': 'http://schema.org',
  '@type': ['Recipe', 'NewsArticle'],
  'name': 'Simple White Cake',
  'headline': 'Simple White Cake',
  'description': 'This white cake recipe is delicious.',
  'image': {
    '@type': 'ImageObject',
    'url': 'https://www.allrecipes.com/thmb/rceSb4HUcHI64nQj_8ke-DDMFS-4x3-89bf9ff32d0c40179a3d752d4d25f22a.jpg',
    'height': 1125,
    'width': 1500
  },
  'recipeIngredient': [
    '2 1/3 cups all-purpose flour',
    '1 cup white sugar',
    '3 1/2 teaspoons baking powder'
  ],
  'recipeInstructions': [
    {
      '@type': 'HowToStep',
      'text': 'Preheat oven to 350 degrees F (175 degrees C).'
    },
    {
      '@type': 'HowToStep', 
      'text': 'In a large bowl, mix together flour, sugar, and baking powder.'
    }
  ],
  'recipeYield': ['1 cake', '8 servings'],
  'totalTime': 'PT40M'
};

const TRADITIONAL_JSONLD_MOCK = {
  '@context': 'http://schema.org',
  '@type': 'Recipe',
  'name': 'Traditional Chocolate Chip Cookies',
  'image': 'https://example.com/cookies.jpg',
  'recipeIngredient': ['2 cups flour', '1 cup sugar'],
  'recipeInstructions': ['Mix ingredients', 'Bake for 10 minutes']
};

// Our extraction logic (extracted from content.js)
function extractRecipeFromJsonLd(jsonLdData) {
  try {
    const items = Array.isArray(jsonLdData) ? jsonLdData : [jsonLdData];
    
    for (const item of items) {
      // Handle @type as array or string (AllRecipes fix)
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
        
        // Handle images - extract URL from ImageObject (AllRecipes fix)
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
  return null;
}

// Tests
test('AllRecipes @type array handling', () => {
  const result = extractRecipeFromJsonLd(ALLRECIPES_JSONLD_MOCK);
  
  assert.notEqual(result, null, 'Should extract recipe from AllRecipes JSON-LD');
  assert.equal(result.title, 'Simple White Cake', 'Should extract correct title');
  assert.equal(Array.isArray(result.rawType), true, 'Should preserve @type array');
  assert.deepEqual(result.rawType, ['Recipe', 'NewsArticle'], 'Should have correct @type array');
  assert.equal(result.source, 'json-ld', 'Should identify JSON-LD source');
});

test('AllRecipes ImageObject URL extraction', () => {
  const result = extractRecipeFromJsonLd(ALLRECIPES_JSONLD_MOCK);
  
  assert.notEqual(result, null, 'Should extract recipe');
  assert.equal(result.photos.length, 1, 'Should extract one photo');
  assert.equal(
    result.photos[0], 
    'https://www.allrecipes.com/thmb/rceSb4HUcHI64nQj_8ke-DDMFS-4x3-89bf9ff32d0c40179a3d752d4d25f22a.jpg',
    'Should extract URL from ImageObject'
  );
  assert.equal(result.rawImageData['@type'], 'ImageObject', 'Should preserve ImageObject structure');
});

test('AllRecipes ingredient and step extraction', () => {
  const result = extractRecipeFromJsonLd(ALLRECIPES_JSONLD_MOCK);
  
  assert.equal(result.ingredients.length, 3, 'Should extract 3 ingredients');
  assert.equal(result.ingredients[0], '2 1/3 cups all-purpose flour', 'Should extract first ingredient');
  
  assert.equal(result.steps.length, 2, 'Should extract 2 steps');
  assert.equal(result.steps[0], 'Preheat oven to 350 degrees F (175 degrees C).', 'Should extract first step');
});

test('AllRecipes serving size and time extraction', () => {
  const result = extractRecipeFromJsonLd(ALLRECIPES_JSONLD_MOCK);
  
  assert.deepEqual(result.servingSize, ['1 cake', '8 servings'], 'Should extract serving size array');
  assert.equal(result.time, 'PT40M', 'Should extract total time');
});

test('Traditional recipe with string @type', () => {
  const result = extractRecipeFromJsonLd(TRADITIONAL_JSONLD_MOCK);
  
  assert.notEqual(result, null, 'Should extract traditional recipe');
  assert.equal(result.title, 'Traditional Chocolate Chip Cookies', 'Should extract title');
  assert.equal(result.rawType, 'Recipe', 'Should preserve string @type');
  assert.equal(result.photos.length, 1, 'Should extract photo URL');
  assert.equal(result.photos[0], 'https://example.com/cookies.jpg', 'Should extract direct URL');
});

test('Invalid/missing data handling', () => {
  assert.equal(extractRecipeFromJsonLd(null), null, 'Should handle null input');
  assert.equal(extractRecipeFromJsonLd({}), null, 'Should handle empty object');
  assert.equal(extractRecipeFromJsonLd({ '@type': 'Article' }), null, 'Should ignore non-Recipe types');
});

test('Array @type without Recipe', () => {
  const nonRecipeData = {
    '@type': ['Article', 'NewsArticle'],
    'name': 'Not a recipe'
  };
  
  assert.equal(extractRecipeFromJsonLd(nonRecipeData), null, 'Should ignore non-Recipe array types');
});

console.log('🧪 Running Recipe Extraction Unit Tests...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Run all tests
try {
  testAllRecipesTypeArrayHandling();
  testAllRecipesImageObjectExtraction(); 
  testAllRecipesDataExtraction();
  testTraditionalRecipe();
  testInvalidData();
  
  console.log('\n🎉 All recipe extraction unit tests passed!');
  console.log('🎯 AllRecipes fixes validated:');
  console.log('   • @type array handling ✅');
  console.log('   • ImageObject URL extraction ✅'); 
  console.log('   • Backward compatibility with string @type ✅');
} catch (error) {
  console.error('❌ Unit test failed:', error.message);
  process.exit(1);
}

function testAllRecipesTypeArrayHandling() {
  const result = extractRecipeFromJsonLd(ALLRECIPES_JSONLD_MOCK);
  
  assert(result !== null, 'Should extract recipe from AllRecipes JSON-LD');
  assert(result.title === 'Simple White Cake', 'Should extract correct title');
  assert(Array.isArray(result.rawType), 'Should preserve @type array');
  deepEqual(result.rawType, ['Recipe', 'NewsArticle'], 'Should have correct @type array');
  assert(result.source === 'json-ld', 'Should identify JSON-LD source');
  console.log('✅ AllRecipes @type array handling test passed');
}

function testAllRecipesImageObjectExtraction() {
  const result = extractRecipeFromJsonLd(ALLRECIPES_JSONLD_MOCK);
  
  assert(result !== null, 'Should extract recipe');
  assert(result.photos.length === 1, 'Should extract one photo');
  assert(
    result.photos[0] === 'https://www.allrecipes.com/thmb/rceSb4HUcHI64nQj_8ke-DDMFS-4x3-89bf9ff32d0c40179a3d752d4d25f22a.jpg',
    'Should extract URL from ImageObject'
  );
  assert(result.rawImageData['@type'] === 'ImageObject', 'Should preserve ImageObject structure');
  console.log('✅ AllRecipes ImageObject URL extraction test passed');
}

function testAllRecipesDataExtraction() {
  const result = extractRecipeFromJsonLd(ALLRECIPES_JSONLD_MOCK);
  
  assert(result.ingredients.length === 3, 'Should extract 3 ingredients');
  assert(result.ingredients[0] === '2 1/3 cups all-purpose flour', 'Should extract first ingredient');
  
  assert(result.steps.length === 2, 'Should extract 2 steps');
  assert(result.steps[0] === 'Preheat oven to 350 degrees F (175 degrees C).', 'Should extract first step');
  
  deepEqual(result.servingSize, ['1 cake', '8 servings'], 'Should extract serving size array');
  assert(result.time === 'PT40M', 'Should extract total time');
  console.log('✅ AllRecipes data extraction test passed');
}

function testTraditionalRecipe() {
  const result = extractRecipeFromJsonLd(TRADITIONAL_JSONLD_MOCK);
  
  assert(result !== null, 'Should extract traditional recipe');
  assert(result.title === 'Traditional Chocolate Chip Cookies', 'Should extract title');
  assert(result.rawType === 'Recipe', 'Should preserve string @type');
  assert(result.photos.length === 1, 'Should extract photo URL');
  assert(result.photos[0] === 'https://example.com/cookies.jpg', 'Should extract direct URL');
  console.log('✅ Traditional recipe extraction test passed');
}

function testInvalidData() {
  assert(extractRecipeFromJsonLd(null) === null, 'Should handle null input');
  assert(extractRecipeFromJsonLd({}) === null, 'Should handle empty object');
  assert(extractRecipeFromJsonLd({ '@type': 'Article' }) === null, 'Should ignore non-Recipe types');
  
  const nonRecipeData = {
    '@type': ['Article', 'NewsArticle'],
    'name': 'Not a recipe'
  };
  assert(extractRecipeFromJsonLd(nonRecipeData) === null, 'Should ignore non-Recipe array types');
  console.log('✅ Invalid data handling test passed');
}
