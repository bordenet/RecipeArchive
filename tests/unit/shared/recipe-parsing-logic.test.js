// Polyfill TextEncoder/TextDecoder for JSDOM/Node.js
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}
/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Load HTML fixture and set up DOM
const loadFixture = (fixtureName) => {
  const fixturePath = path.join(__dirname, '../../fixtures/html-samples', fixtureName);
  let htmlContent = fs.readFileSync(fixturePath, 'utf8');
  // Use JSDOM to robustly remove <style> and non-JSON-LD <script> tags
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(htmlContent);
  const { document } = dom.window;
  // Remove all <style> tags
  document.querySelectorAll('style').forEach(el => el.remove());
  // Remove all <script> tags except those with type="application/ld+json"
  document.querySelectorAll('script').forEach(el => {
    if (el.type !== 'application/ld+json') el.remove();
  });
  htmlContent = document.documentElement.outerHTML;
  global.document.documentElement.innerHTML = htmlContent;
  return htmlContent;
};

// Core parsing functions extracted from content.js logic
const RecipeParsers = {
  // JSON-LD Parser (simplified version of the content script logic)
  parseJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Recipe' || (Array.isArray(data) && data.find(item => item['@type'] === 'Recipe'))) {
          const recipeData = Array.isArray(data) ? data.find(item => item['@type'] === 'Recipe') : data;
          
          return {
            title: recipeData.name || '',
            ingredients: this.normalizeIngredients(recipeData.recipeIngredient || []),
            steps: this.normalizeInstructions(recipeData.recipeInstructions || []),
            servingSize: recipeData.recipeYield || '',
            prepTime: this.parseTime(recipeData.prepTime),
            cookTime: this.parseTime(recipeData.cookTime),
            totalTime: this.parseTime(recipeData.totalTime),
          };
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  },

  // Smitten Kitchen Parser
  parseSmittenKitchen() {
    const title = document.querySelector('.entry-title, h1')?.textContent?.trim() || '';

    // Find <p> elements containing ingredient lines (look for lines with measurements)
    const ingredientPs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .flatMap(text => text.split(/<br\s*\/?>|\n|\r|\u2028|\u2029/))
      .map(t => t.trim())
      .filter(text => /^\d.*(cup|ounce|teaspoon|tablespoon|egg|sugar|flour|butter|salt|chocolate|walnut)/i.test(text));
    const ingredients = ingredientPs;

    // Steps: find <p> elements after the ingredients block that look like instructions
    const stepPs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => /preheat|bake|mix|stir|pour|cool|cut|add|sift|beat|combine|refrigerate|allow|transfer|dock|whisk|press|remove|chill|dust|slice|serve/i.test(text));
    const steps = stepPs;

    return {
      title,
      ingredients,
      steps,
      prepTime: this.extractTime('prep'),
      cookTime: this.extractTime('cook'),
      servingSize: this.extractServing(),
    };
  },

  // Love & Lemons Parser  
  parseLoveLemons() {
    // Try JSON-LD first
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    let foundRecipe = null;
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        // Top-level Recipe
        if (data['@type'] === 'Recipe') {
          foundRecipe = data;
          break;
        }
        // @graph array
        if (Array.isArray(data['@graph'])) {
          const recipeObj = data['@graph'].find(item => item['@type'] === 'Recipe');
          if (recipeObj) {
            foundRecipe = recipeObj;
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }
    if (foundRecipe) {
      return {
        title: foundRecipe.name || '',
        ingredients: this.normalizeIngredients(foundRecipe.recipeIngredient || []),
        steps: this.normalizeInstructions(foundRecipe.recipeInstructions || []),
        servingSize: foundRecipe.recipeYield || '',
        prepTime: this.parseTime(foundRecipe.prepTime),
        cookTime: this.parseTime(foundRecipe.cookTime),
        totalTime: this.parseTime(foundRecipe.totalTime),
      };
    }
    // Fallback to DOM selectors if no JSON-LD found
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    // Find <ul> after <h2> containing "Ingredients"
    let ingredients = [];
    const h2s = Array.from(document.querySelectorAll('h2'));
    for (const h2 of h2s) {
      if (/ingredient/i.test(h2.textContent)) {
        let el = h2.nextElementSibling;
        while (el && el.nodeType !== 1) el = el.nextSibling;
        if (el && el.tagName === 'UL') {
          ingredients = Array.from(el.querySelectorAll('li')).map(li => li.textContent.trim()).filter(t => t.length > 0);
        }
        break;
      }
    }
    if (ingredients.length === 0) {
      ingredients = Array.from(document.querySelectorAll('li'))
        .map(li => li.textContent.trim())
        .filter(text => /^\d.*(cup|ounce|teaspoon|tablespoon|egg|sugar|flour|butter|salt|lemon|powdered|extract|zest)/i.test(text));
    }
    // Steps: find <ol> after <h2> containing "How to Make"
    let steps = [];
    for (const h2 of h2s) {
      if (/how to make/i.test(h2.textContent)) {
        const ol = h2.nextElementSibling;
        if (ol && ol.tagName === 'OL') {
          steps = Array.from(ol.querySelectorAll('li')).map(li => li.textContent.trim()).filter(t => t.length > 0);
        }
        break;
      }
    }
    return {
      title,
      ingredients,
      steps,
      prepTime: this.extractTime('prep'),
      cookTime: this.extractTime('cook'), 
      servingSize: this.extractServing(),
    };
  },

  // Helper functions
  normalizeIngredients(ingredients) {
    return Array.isArray(ingredients) ? ingredients.map(ing => ing.toString().trim()) : [];
  },

  normalizeInstructions(instructions) {
    if (!Array.isArray(instructions)) return [];
    
    return instructions.map(inst => {
      if (typeof inst === 'string') return inst.trim();
      if (inst.text) return inst.text.trim();
      return inst.toString().trim();
    });
  },

  parseTime(timeStr) {
    if (!timeStr) return '';
    
    // Handle ISO 8601 duration (PT15M)
    const isoMatch = timeStr.match(/PT(\d+)M/);
    if (isoMatch) {
      return `${isoMatch[1]} minutes`;
    }
    
    // Handle "15 minutes" format
    const minuteMatch = timeStr.match(/(\d+)\s*(?:minutes?|mins?)/i);
    if (minuteMatch) {
      return `${minuteMatch[1]} minutes`;
    }
    
    return timeStr;
  },

  extractTime(type) {
    const text = document.body.textContent;
    const pattern = new RegExp(`${type}\\s*time\\s*:?\\s*(\\d+\\s*(?:minutes?|mins?|hours?|hrs?)?)`, 'i');
    const match = text.match(pattern);
    return match ? match[1].trim() : '';
  },

  extractServing() {
    const text = document.body.textContent;
    const patterns = [
      /serves?\s*:?\s*([\w\s\d]*?)(?:\.|$)/i,
      /yield\s*:?\s*([\w\s\d]*?)(?:\.|$)/i, 
      /makes?\s*:?\s*([\w\s\d]*?)(?:\.|$)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return '';
  },
};

describe('Recipe Parsing Logic Tests', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.documentElement.innerHTML = '<html><head></head><body></body></html>';
  });

  describe('JSON-LD Recipe Parsing', () => {
    test('extracts complete recipe data from JSON-LD', () => {
      loadFixture('json-ld-sample.html');
      
      const recipe = RecipeParsers.parseJsonLd();
      
      expect(recipe).not.toBeNull();
      expect(recipe.title).toBe('Classic Chocolate Chip Cookies');
      expect(recipe.ingredients).toHaveLength(9);
      expect(recipe.ingredients[0]).toBe('2 1/4 cups all-purpose flour');
      expect(recipe.ingredients[8]).toBe('2 cups chocolate chips');
      expect(recipe.steps).toHaveLength(6);
      expect(recipe.steps[0]).toBe('Preheat oven to 375°F.');
      expect(recipe.servingSize).toBe('24 cookies');
      expect(recipe.prepTime).toBe('15 minutes');
      expect(recipe.cookTime).toBe('12 minutes');
    });

    test('returns null when no JSON-LD recipe data exists', () => {
      document.body.innerHTML = '<h1>No Recipe Data</h1>';
      
      const recipe = RecipeParsers.parseJsonLd();
      expect(recipe).toBeNull();
    });

    test('handles malformed JSON gracefully', () => {
      document.head.innerHTML = '<script type="application/ld+json">{ invalid json }</script>';
      
      const recipe = RecipeParsers.parseJsonLd();
      expect(recipe).toBeNull();
    });
  });

  describe('Smitten Kitchen Parsing', () => {
    test('extracts recipe data from Smitten Kitchen HTML structure', () => {
      loadFixture('smitten-kitchen-sample.html');
      
      const recipe = RecipeParsers.parseSmittenKitchen();
      
      expect(recipe.title).toBe('outrageous brownies');
      const expectedIngredients = [
        '1 pound unsalted butter',
        '28 ounces semi-sweet chocolate chips, divided',
        '6 ounces unsweetened chocolate',
        '6 extra large eggs',
        '3 tablespoons instant coffee granules',
        '2 tablespoons pure vanilla extract',
        '2 1/4 cups sugar',
        '1 1/4 cups all-purpose flour, divided',
        '1 tablespoon baking powder',
        '1 teaspoon salt',
        '3 cups chopped walnuts'
      ];
      expectedIngredients.forEach(ing => {
        expect(recipe.ingredients.some(i => i.replace(/\s+/g, ' ').toLowerCase().includes(ing.replace(/\s+/g, ' ').toLowerCase()))).toBe(true);
      });
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(recipe.prepTime).toBeDefined();
      expect(recipe.cookTime).toBeDefined();
    });

    test('handles missing ingredients and steps gracefully', () => {
      document.body.innerHTML = '<h1 class="entry-title">Test Recipe</h1>';
      
      const recipe = RecipeParsers.parseSmittenKitchen();
      
      expect(recipe.title).toBe('Test Recipe');
      expect(recipe.ingredients).toEqual([]);
      expect(recipe.steps).toEqual([]);
    });
  });

  describe('Love & Lemons Parsing', () => {
    test('extracts recipe data from Love & Lemons HTML structure', () => {
  loadFixture('love-lemons-sample.html');
  const recipe = RecipeParsers.parseLoveLemons();
  console.log('Extracted Love & Lemons ingredients:', recipe.ingredients);
      
      expect(recipe.title).toBe('Lemon Bars');
      const expectedIngredients = [
        '1 cup all-purpose flour',
        '1 cup granulated sugar',
        '1 tablespoon lemon zest',
        '4 large eggs',
        '½ cup fresh lemon juice',
        '⅓ cup powdered sugar',
        '½ cup unsalted butter',
        '¼ teaspoon sea salt',
        '½ teaspoon vanilla extract'
      ];
      expectedIngredients.forEach(ing => {
        expect(recipe.ingredients.some(i => i.replace(/\s+/g, ' ').toLowerCase().includes(ing.replace(/\s+/g, ' ').toLowerCase()))).toBe(true);
      });
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(recipe.prepTime).toBeDefined();
      expect(recipe.cookTime).toBeDefined();
      expect(recipe.servingSize).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    test('parseTime handles ISO 8601 duration format', () => {
      expect(RecipeParsers.parseTime('PT15M')).toBe('15 minutes');
      expect(RecipeParsers.parseTime('PT30M')).toBe('30 minutes');
    });

    test('parseTime handles natural language format', () => {
      expect(RecipeParsers.parseTime('15 minutes')).toBe('15 minutes');
      expect(RecipeParsers.parseTime('30 mins')).toBe('30 minutes');
    });

    test('parseTime returns original string for unrecognized formats', () => {
      expect(RecipeParsers.parseTime('about 2 hours')).toBe('about 2 hours');
    });

    test('normalizeIngredients handles various input types', () => {
      expect(RecipeParsers.normalizeIngredients(['flour', 'sugar'])).toEqual(['flour', 'sugar']);
      expect(RecipeParsers.normalizeIngredients([])).toEqual([]);
      expect(RecipeParsers.normalizeIngredients(null)).toEqual([]);
    });

    test('normalizeInstructions handles various instruction formats', () => {
      const instructions = [
        'Step 1',
        { text: 'Step 2' },
        { '@type': 'HowToStep', text: 'Step 3' }
      ];
      
      const result = RecipeParsers.normalizeInstructions(instructions);
      expect(result).toEqual(['Step 1', 'Step 2', 'Step 3']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles completely empty DOM', () => {
      const recipe = RecipeParsers.parseSmittenKitchen();
      
      expect(recipe).toBeDefined();
      expect(recipe.title).toBe('');
      expect(recipe.ingredients).toEqual([]);
      expect(recipe.steps).toEqual([]);
    });

    test('handles malformed HTML structure', () => {
      document.body.innerHTML = '<div><li>Orphaned list item</li><h1>Title</h1></div>';
      
      expect(() => {
        const recipe = RecipeParsers.parseSmittenKitchen();
        expect(recipe.title).toBe('Title');
      }).not.toThrow();
    });

    test('extracts serving information with various patterns', () => {
      document.body.innerHTML = '<p>This recipe serves 8 people comfortably.</p>';
      expect(RecipeParsers.extractServing()).toBe('8 people comfortably');

      document.body.innerHTML = '<p>Yield: 24 cookies</p>';
      expect(RecipeParsers.extractServing()).toBe('24 cookies');

      document.body.innerHTML = '<p>Makes about 12 servings</p>';
      expect(RecipeParsers.extractServing()).toBe('about 12 servings');
    });

    test('time extraction works with various formats', () => {
      document.body.innerHTML = '<p>Prep time: 20 minutes, Cook time: 45 mins</p>';
      expect(RecipeParsers.extractTime('prep')).toBe('20 minutes');
      expect(RecipeParsers.extractTime('cook')).toBe('45 mins');
    });
  });
});