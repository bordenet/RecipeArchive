// Safari RecipeArchive Extension - Content Script
// Minimal, self-contained version to avoid loading conflicts

console.log('RecipeArchive Safari: Content script loaded on', window.location.href);

// Cross-browser compatibility
const extensionAPI = (function() {
  if (typeof browser !== 'undefined') {return browser;}
  if (typeof chrome !== 'undefined') {return chrome;}
  return null;
})();

// Listen for messages from popup
if (extensionAPI && extensionAPI.runtime && extensionAPI.runtime.onMessage) {
  extensionAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureRecipe') {
      console.log('RecipeArchive Safari: Capture recipe requested');

      try {
        const recipe = extractRecipe();
        console.log('RecipeArchive Safari: Recipe extracted:', recipe);
        sendResponse({ success: true, recipe: recipe });
      } catch (error) {
        console.error('RecipeArchive Safari: Extract error:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    return true; // Keep message channel open for async response
  });
}

function extractRecipe() {
  const url = window.location.href;
  console.log('RecipeArchive Safari: Extracting recipe from:', url);

  // Try JSON-LD first (works for most modern recipe sites)
  const jsonLdRecipe = extractFromJsonLd();
  if (jsonLdRecipe) {
    console.log('RecipeArchive Safari: Found recipe via JSON-LD');
    return jsonLdRecipe;
  }

  // Site-specific extractors
  if (url.includes('allrecipes.com')) {
    return extractAllRecipes();
  }

  // Generic fallback
  return extractGeneric();
}

function extractFromJsonLd() {
  console.log('RecipeArchive Safari: Searching for JSON-LD recipe data...');

  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  console.log(`RecipeArchive Safari: Found ${ scripts.length } JSON-LD scripts`);

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Handle @type as array or string (AllRecipes uses ['Recipe', 'NewsArticle'])
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];

        if (types.includes('Recipe')) {
          console.log('RecipeArchive Safari: Found Recipe in JSON-LD');

          // Extract ingredients
          const ingredients = item.recipeIngredient ? [{
            title: null,
            items: item.recipeIngredient
          }] : [];

          // Extract instructions
          let steps = [];
          if (item.recipeInstructions) {
            const stepTexts = item.recipeInstructions.map(instruction => {
              if (typeof instruction === 'string') {return instruction;}
              if (instruction.text) {return instruction.text;}
              if (instruction.name) {return instruction.name;}
              return '';
            }).filter(Boolean);

            if (stepTexts.length > 0) {
              steps = [{ title: null, items: stepTexts }];
            }
          }

          // Extract images
          let photos = [];
          if (item.image) {
            if (Array.isArray(item.image)) {
              photos = item.image.map(img => {
                if (typeof img === 'string') {return img;}
                if (img && img.url) {return img.url;}
                return null;
              }).filter(Boolean);
            } else if (typeof item.image === 'string') {
              photos = [item.image];
            } else if (item.image && item.image.url) {
              photos = [item.image.url];
            }
          }

          // Validation check
          if (ingredients.length > 0 && steps.length > 0) {
            return {
              title: item.name || document.title,
              ingredients,
              steps,
              servingSize: item.recipeYield || item.yield || null,
              time: item.totalTime || item.cookTime || item.prepTime || null,
              photos,
              attributionUrl: window.location.href,
              fullPageArchive: document.documentElement.outerHTML,
              extractedAt: new Date().toISOString(),
              userAgent: navigator.userAgent,
              source: 'json-ld'
            };
          }
        }
      }
    } catch (e) {
      console.log('RecipeArchive Safari: JSON-LD parse error:', e.message);
    }
  }

  return null;
}

function extractAllRecipes() {
  console.log('RecipeArchive Safari: Using AllRecipes-specific extraction');

  // AllRecipes has excellent JSON-LD, so if we're here, JSON-LD extraction failed
  // Try manual extraction as fallback

  const title = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : document.title;

  // Try various ingredient selectors
  let ingredients = [];
  const ingredientSelectors = [
    '.recipe-ingredient',
    '.ingredients-item-name',
    '.recipe-ingredients li',
    '[data-ingredient]'
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map(el => el.textContent ? el.textContent.trim() : '')
        .filter(text => text && text.length > 2);

      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  // Try various instruction selectors
  let steps = [];
  const stepSelectors = [
    '.recipe-instruction',
    '.instructions-section-item',
    '.recipe-instructions li',
    '.directions li'
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map(el => el.textContent ? el.textContent.trim() : '')
        .filter(text => text && text.length > 10);

      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  if (ingredients.length > 0 && steps.length > 0) {
    return {
      title,
      ingredients,
      steps,
      servingSize: null,
      time: null,
      photos: [],
      attributionUrl: window.location.href,
      fullPageArchive: document.documentElement.outerHTML,
      extractedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      source: 'allrecipes-manual'
    };
  }

  return null;
}

function extractGeneric() {
  console.log('RecipeArchive Safari: Using generic extraction');

  const title = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : document.title;

  // Look for common ingredient patterns
  let ingredients = [];
  const ingredientSelectors = [
    '[class*="ingredient"] li',
    '[class*="recipe"] [class*="ingredient"]',
    '.ingredients li',
    'ul li'
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length >= 3 && elements.length <= 50) { // Reasonable ingredient count
      const items = Array.from(elements)
        .map(el => el.textContent ? el.textContent.trim() : '')
        .filter(text => text && text.length > 2 && text.length < 200);

      if (items.length >= 3) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  // Look for common instruction patterns
  let steps = [];
  const stepSelectors = [
    '[class*="instruction"] li',
    '[class*="recipe"] [class*="step"]',
    '.instructions li',
    '[class*="direction"] li',
    'ol li'
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length >= 2 && elements.length <= 20) { // Reasonable step count
      const items = Array.from(elements)
        .map(el => el.textContent ? el.textContent.trim() : '')
        .filter(text => text && text.length > 20 && text.length < 1000);

      if (items.length >= 2) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  if (ingredients.length > 0 && steps.length > 0) {
    return {
      title,
      ingredients,
      steps,
      servingSize: null,
      time: null,
      photos: [],
      attributionUrl: window.location.href,
      fullPageArchive: document.documentElement.outerHTML,
      extractedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      source: 'generic'
    };
  }

  throw new Error('No recipe found on this page.');
}
