// Listen for messages from popup

function extractFullTextContent() {
  // Extract all readable text content from the page for LLM analysis
  // This helps infer missing fields like prep/cook times from instructions

  // Use a faster approach that avoids expensive getComputedStyle calls
  // by using element traversal and basic tag filtering
  const textNodes = [];
  
  function extractTextFromElement(element) {
    // Skip non-visible elements by tag type (faster than computed style)
    const tagName = element.tagName?.toLowerCase();
    if (!tagName) {return;}
    
    if (
      tagName === 'script' ||
      tagName === 'style' ||
      tagName === 'noscript' ||
      tagName === 'meta' ||
      tagName === 'link' ||
      tagName === 'head'
    ) {
      return;
    }

    // Skip elements with explicit hidden attributes
    if (
      element.hidden ||
      element.style.display === 'none' ||
      element.style.visibility === 'hidden'
    ) {
      return;
    }

    // Process text nodes directly
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.trim();
        if (text.length > 0) {
          textNodes.push(text);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Recursively process child elements
        extractTextFromElement(node);
      }
    }
  }

  // Start extraction from body
  if (document.body) {
    extractTextFromElement(document.body);
  }

  // Join all text with spaces, normalize whitespace
  let fullText = textNodes.join(' ');

  // Normalize whitespace: collapse multiple spaces, normalize line breaks
  fullText = fullText
    .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
    .replace(/\n\s*\n/g, '\n') // Normalize line breaks
    .trim();

  return fullText;
}

function extractRecipeFromJsonLd() {
  // Try to extract recipe from JSON-LD structured data first
  console.log('Chrome Extension: Extracting from JSON-LD...');
  const jsonLdScripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  console.log(`Chrome Extension: Found ${jsonLdScripts.length} JSON-LD scripts`);

  for (const script of jsonLdScripts) {
    try {
      const jsonData = JSON.parse(script.textContent);
      console.log('Chrome Extension: Raw JSON-LD data:', jsonData);
      const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];

      for (const item of recipes) {
        console.log('Chrome Extension: Checking item type:', item['@type']);
        
        // Check for nested Recipe in @graph
        if (item['@graph']) {
          console.log('Chrome Extension: Found @graph, checking nested items');
          for (const graphItem of item['@graph']) {
            const graphItemType = Array.isArray(graphItem['@type']) ? graphItem['@type'] : [graphItem['@type']];
            if (graphItemType.includes('Recipe')) {
              console.log('Chrome Extension: Found nested Recipe in @graph:', graphItem);
              // Process nested recipe using the same logic below
              item = graphItem; // Replace item with the nested recipe
              break;
            }
          }
        }
        
        // Check if @type includes 'Recipe' (handle both string and array)
        const itemType = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (itemType.includes('Recipe')) {
          console.log('Chrome Extension: Found JSON-LD Recipe data:', item);

          // Extract ingredients
          const ingredients = item.recipeIngredient
            ? [{ title: null, items: item.recipeIngredient }]
            : [];
          console.log('Chrome Extension: Extracted ingredients:', ingredients);

          // Extract steps
          let steps = [];
          if (item.recipeInstructions) {
            const stepItems = item.recipeInstructions
              .map((instruction) => {
                if (typeof instruction === 'string') {return instruction;}
                if (instruction.text) {return instruction.text;}
                if (instruction.name) {return instruction.name;}
                return '';
              })
              .filter(Boolean);

            if (stepItems.length > 0) {
              steps = [{ title: null, items: stepItems }];
            }
          }
          console.log('Chrome Extension: Extracted steps:', steps);

          // Handle images - they can be strings, ImageObjects, or arrays
          let photos = [];
          if (item.image) {
            if (Array.isArray(item.image)) {
              photos = item.image.map(img => {
                if (typeof img === 'string') {return img;}
                if (img && img.url) {return img.url;}
                return null;
              }).filter(url => url);
            } else if (typeof item.image === 'string') {
              photos = [item.image];
            } else if (item.image && item.image.url) {
              photos = [item.image.url];
            }
          }

          const recipe = {
            title: item.name || document.title,
            ingredients,
            steps,
            servingSize: item.recipeYield || item.yield || null,
            time: item.totalTime || item.cookTime || item.prepTime || null,
            photos,
            attributionUrl: window.location.href,
            fullPageArchive: document.documentElement.outerHTML,
            fullTextContent: extractFullTextContent(),
            extractedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            source: 'json-ld',
          };
          
          console.log('Chrome Extension: Final JSON-LD recipe:', recipe);
          return recipe;
        }
      }
    } catch (e) {
      console.log('Failed to parse JSON-LD:', e.message);
    }
  }

  return null;
}

function extractRecipeGeneric() {
  // Generic extraction for various recipe sites
  const site = window.location.hostname;

  // Site-specific extraction
  if (site.includes('loveandlemons.com')) {
    return extractLoveLemonsRecipe();
  } else if (site.includes('smittenkitchen.com')) {
    return extractSmittenKitchenRecipe();
  } else if (site.includes('food52.com')) {
    return extractFood52Recipe();
  } else if (site.includes('foodnetwork.com')) {
    return extractFoodNetworkRecipe();
  } else if (site.includes('allrecipes.com')) {
    return extractAllRecipesRecipe();
  } else if (site.includes('epicurious.com')) {
    return extractEpicuriousRecipe();
  } else if (site.includes('washingtonpost.com')) {
    return extractWashingtonPostRecipe();
  }

  // Fallback to generic parsing
  return extractRecipeGenericFallback();
}

function extractLoveLemonsRecipe() {
  console.log('Extracting Love & Lemons recipe...');

  // First try JSON-LD
  const jsonLdResult = extractRecipeFromJsonLd();
  if (jsonLdResult) {return jsonLdResult;}

  // Manual extraction for Love & Lemons
  const title =
    document.querySelector('h1')?.textContent?.trim() || document.title;

  // Ingredients from entry-content ul li (filter out navigation items)
  let ingredients = [];
  const ingredientElements = document.querySelectorAll('.entry-content ul li');
  const ingredientItems = Array.from(ingredientElements)
    .map((li) => li.textContent?.trim())
    .filter(
      (text) =>
        text &&
        !text.includes('RECIPES') &&
        !text.includes('ABOUT') &&
        !text.includes('NEWSLETTER') &&
        !text.includes('Easy Cookie Recipes') && // Filter out related recipe links
        !text.includes('Or any of these') &&
        !text.includes('Follow me on') &&
        !text.includes('Email') &&
        !text.includes('Instagram') &&
        text.length > 5 &&
        text.length < 200 && // Ingredients shouldn't be too long
        !/^[A-Z\s]+$/.test(text) && // Not all caps navigation
        !/\d+\s+(Easy|Cookie|Recipe)/.test(text) // No "17 Easy Cookie Recipes" type content
    );

  if (ingredientItems.length > 0) {
    ingredients = [{ title: null, items: ingredientItems }];
  }

  // Steps from entry-content ol li
  let steps = [];
  const stepElements = document.querySelectorAll('.entry-content ol li');
  const stepItems = Array.from(stepElements)
    .map((li) => li.textContent?.trim())
    .filter((text) => text && text.length > 20); // Steps should be substantial

  if (stepItems.length > 0) {
    steps = [{ title: null, items: stepItems }];
  }

  // Extract other data
  const servingSize =
    document.body.textContent
      ?.match(/(serves?|yield[s]?|makes?)\s*:?\s*(\d+[\w\s]*)/i)?.[2]
      ?.trim() || null;
  const time =
    document.body.textContent
      ?.match(
        /(total time|prep time|cook time|active time)\s*:?\s*([\d\w\s,:]+)/i
      )?.[2]
      ?.trim() || null;

  // Photos
  const photos = [];
  document.querySelectorAll('img').forEach((img) => {
    if (
      img.src &&
      (img.className?.includes('recipe') ||
        img.alt?.includes('recipe') ||
        img.src.includes('recipe'))
    ) {
      if (!photos.includes(img.src)) {photos.push(img.src);}
    }
  });

  return {
    title,
    ingredients,
    steps,
    servingSize,
    time,
    photos,
    attributionUrl: window.location.href,
    fullPageArchive: document.documentElement.outerHTML,
    fullTextContent: extractFullTextContent(),
    extractedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    source: 'love-lemons-manual',
  };
}

function extractSmittenKitchenRecipe() {
  // Helper to extract sections (e.g., Cake, Topping)
  function extractSections(container, sectionSelector, itemSelector) {
    const sections = [];
    container.querySelectorAll(sectionSelector).forEach((section) => {
      let title = section.querySelector('h3, h4, .section-title');
      title = title ? title.textContent.trim() : null;
      const items = Array.from(section.querySelectorAll(itemSelector))
        .map((li) => li.textContent.trim())
        .filter(Boolean);
      if (items.length > 0) {
        sections.push({ title, items });
      }
    });
    return sections;
  }

  // Try JSON-LD first
  const jsonLdResult = extractRecipeFromJsonLd();
  if (jsonLdResult && jsonLdResult.ingredients.length > 0 && jsonLdResult.steps.length > 0) {
    return jsonLdResult;
  }

  // Ingredients sections - try multiple selectors for Smitten Kitchen  
  const ingredientsSelectors = [
    'div.jetpack-recipe-ingredients', // Old format
    '.recipe-ingredients', // Common class
    '[data-recipe-ingredients]', // Data attribute
    '.ingredients', // Simple class
    'div:contains("Ingredients") + ul', // Adjacent to heading
    'h3:contains("Ingredients") ~ ul', // Following heading
  ];
  
  let ingredientsSections = [];
  let ingredientsContainer = null;
  
  // Try each selector until we find ingredients
  for (const selector of ingredientsSelectors) {
    try {
      ingredientsContainer = document.querySelector(selector);
      if (ingredientsContainer) {
        console.log(`Found ingredients with selector: ${selector}`);
        break;
      }
    } catch (_e) {
      // Invalid selector, continue
    }
  }
  
  if (ingredientsContainer) {
    // Try to find sub-sections (Cake, Topping)
    ingredientsSections = extractSections(ingredientsContainer, 'ul', 'li');
    // Fallback: single section
    if (ingredientsSections.length === 0) {
      const items = Array.from(ingredientsContainer.querySelectorAll('ul li, li'))
        .map((li) => li.textContent.trim())
        .filter(Boolean);
      if (items.length > 0) {ingredientsSections.push({ title: null, items });}
    }
  } else {
    // Fallback: look for ingredients in narrative format
    const listItems = Array.from(document.querySelectorAll('li'))
      .map(li => li.textContent.trim())
      .filter(text => text && 
        (text.match(/\d+\s*(cup|tablespoon|teaspoon|tsp|tbsp|pound|lb|ounce|oz|clove|slice)/i) ||
         text.match(/\d+\/\d+/) || // fractions
         text.includes('salt') || text.includes('pepper') || text.includes('oil') ||
         text.match(/\d+\s*(large|medium|small|fresh|dried)/i)
        )
      );
      
    if (listItems.length > 0) {
      ingredientsSections.push({ title: null, items: listItems });
    }
  }

  // Steps sections - try multiple selectors for Smitten Kitchen
  const stepsSelectors = [
    'div.jetpack-recipe-directions', // Old format
    '.recipe-instructions', // Common class
    '.recipe-directions', // Alternative class
    '[data-recipe-instructions]', // Data attribute
    '.instructions', // Simple class
    'div:contains("Instructions") + ol', // Adjacent to heading
    'h3:contains("Instructions") ~ ol', // Following heading
    'div:contains("Directions") + ol', // Adjacent to heading
    'h3:contains("Directions") ~ ol', // Following heading
  ];
  
  let stepsSections = [];
  let stepsContainer = null;
  
  // Try each selector until we find steps
  for (const selector of stepsSelectors) {
    try {
      stepsContainer = document.querySelector(selector);
      if (stepsContainer) {
        console.log(`Found steps with selector: ${selector}`);
        break;
      }
    } catch (_e) {
      // Invalid selector, continue
    }
  }
  
  if (stepsContainer) {
    stepsSections = extractSections(stepsContainer, 'ol', 'li');
    if (stepsSections.length === 0) {
      const items = Array.from(stepsContainer.querySelectorAll('ol li, li'))
        .map((li) => li.textContent.trim())
        .filter(Boolean);
      if (items.length > 0) {stepsSections.push({ title: null, items });}
    }
  } else {
    // Fallback: extract step-like content from paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 50 && 
        (text.match(/\b(heat|cook|bake|mix|stir|add|pour|place|remove|let|allow|until|for \d+)/i) ||
         text.match(/\b(preheat|oven|temperature|degrees|minutes)\b/i)
        )
      );
      
    if (paragraphs.length > 0) {
      stepsSections.push({ title: null, items: paragraphs });
    }
  }

  // Serving size
  let servingSize = null;
  const servingMatch = document.body.innerText.match(
    /(serves|yield[s]?|makes)\s*:?\s*(\d+[\w\s]*)/i
  );
  if (servingMatch) {servingSize = servingMatch[2].trim();}

  // Time (active + inactive)
  let time = null;
  const timeMatch = document.body.innerText.match(
    /(total time|prep time|active time|inactive time|cook time)\s*:?\s*([\d\w\s,:]+)/i
  );
  if (timeMatch) {time = timeMatch[2].trim();}

  // Photos (image URLs)
  const photos = [];
  const recipeImages = document.querySelectorAll(
    'div.jetpack-recipe img, .entry-content img'
  );
  recipeImages.forEach((img) => {
    if (img.src && !photos.includes(img.src)) {photos.push(img.src);}
  });

  // Attribution URL
  const attributionUrl = window.location.href;

  // Full page web archive (HTML)
  const fullPageArchive = document.documentElement.outerHTML;

  // Full text content for LLM analysis
  // Extract all readable text from the page, cleaned and normalized
  const fullTextContent = extractFullTextContent();

  // Get page title for better recipe identification
  const pageTitle =
    document.title ||
    document.querySelector('h1')?.textContent?.trim() ||
    'Untitled Recipe';

  // Build payload - IMPORTANT: Must match Safari extension structure exactly
  const payload = {
    title: pageTitle,
    ingredients: ingredientsSections, // [{title, items}]
    steps: stepsSections, // [{title, items}]
    servingSize,
    time,
    photos,
    attributionUrl,
    fullPageArchive,
    fullTextContent, // Complete text content for LLM inference
    extractedAt: new Date().toISOString(),
    userAgent: navigator.userAgent, // Helpful for debugging browser differences
    source: 'smitten-kitchen-manual',
  };

  // Debug: log payload
  console.log('RecipeArchive: Extracted payload:', payload);
  return payload;
}

function extractFood52Recipe() {
  console.log('Extracting Food52 recipe...');

  // Try JSON-LD first
  const jsonLdResult = extractRecipeFromJsonLd();
  if (
    jsonLdResult &&
    jsonLdResult.ingredients.length > 0 &&
    jsonLdResult.steps.length > 0
  ) {
    return jsonLdResult;
  }

  // Food52 manual extraction
  const title =
    document.querySelector('h1')?.textContent?.trim() ||
    document.querySelector('.recipe-title')?.textContent?.trim() ||
    document
      .querySelector('[data-testid="recipe-title"]')
      ?.textContent?.trim() ||
    document.title;

  let ingredients = [];
  // Food52 uses various selectors for ingredients
  const ingredientSelectors = [
    '.recipe-list--ingredients li',
    '.recipe-ingredients li',
    '[data-testid="ingredients"] li',
    '[data-testid*="ingredient"] li',
    'ul[data-testid*="ingredient"] li',
    '.ingredients li',
    '[class*="ingredient"] li',
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 2);

      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  let steps = [];
  // Food52 uses various selectors for instructions
  const stepSelectors = [
    '.recipe-list--instructions li',
    '.recipe-instructions li',
    '[data-testid="instructions"] li',
    '[data-testid*="instruction"] li',
    'ol[data-testid*="instruction"] li',
    '.instructions li',
    '[class*="instruction"] li',
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 10);

      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  return createRecipePayload(title, ingredients, steps, 'food52-manual');
}

function extractFoodNetworkRecipe() {
  console.log('Extracting Food Network recipe...');

  // Try JSON-LD first
  const jsonLdResult = extractRecipeFromJsonLd();
  if (
    jsonLdResult &&
    jsonLdResult.ingredients.length > 0 &&
    jsonLdResult.steps.length > 0
  ) {
    return jsonLdResult;
  }

  // Food Network manual extraction
  const title =
    document.querySelector('h1')?.textContent?.trim() ||
    document
      .querySelector('.o-AssetTitle__a-HeadlineText')
      ?.textContent?.trim() ||
    document.querySelector('.recipe-title')?.textContent?.trim() ||
    document.title;

  let ingredients = [];
  // Food Network uses specific component classes
  const ingredientSelectors = [
    '.o-Ingredients__a-ListItem',
    '.o-RecipeInfo__a-Ingredient',
    '.recipe-ingredients li',
    '.ingredients-item',
    '.ingredients li',
    '[class*="ingredient"] li',
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 2);

      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  let steps = [];
  // Food Network instruction selectors
  const stepSelectors = [
    '.o-Method__m-Step',
    '.o-RecipeInfo__a-Description li',
    '.recipe-instructions li',
    '.directions-item',
    '.instructions li',
    '[class*="instruction"] li',
    '.recipe-directions li',
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 10);

      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  return createRecipePayload(title, ingredients, steps, 'foodnetwork-manual');
}

function extractAllRecipesRecipe() {
  console.log('Chrome Extension: Extracting AllRecipes recipe...');

  // Try JSON-LD first (AllRecipes has excellent JSON-LD support)
  const jsonLdResult = extractRecipeFromJsonLd();
  console.log('Chrome Extension: JSON-LD result:', jsonLdResult);
  
  if (
    jsonLdResult &&
    jsonLdResult.ingredients.length > 0 &&
    jsonLdResult.steps.length > 0
  ) {
    console.log('Chrome Extension: Using JSON-LD result');
    return jsonLdResult;
  }

  // AllRecipes manual extraction as fallback
  const title =
    document.querySelector('h1')?.textContent?.trim() ||
    document.querySelector('.recipe-summary__h1')?.textContent?.trim() ||
    document.querySelector('.recipe-title')?.textContent?.trim() ||
    document.title;

  let ingredients = [];
  // AllRecipes uses various ingredient selectors
  const ingredientSelectors = [
    '.recipe-ingredient',
    '.ingredients-item-name',
    '.recipe-ingredients li',
    '.ingredients li',
    '[data-ingredient]',
    '[class*="ingredient"] li',
    '.recipe-card-ingredients li',
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 2);

      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  let steps = [];
  // AllRecipes instruction selectors
  const stepSelectors = [
    '.recipe-instruction',
    '.instructions-section-item',
    '.recipe-instructions li',
    '.directions li',
    '.instructions li',
    '[class*="instruction"] li',
    '.recipe-directions li',
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 10);

      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  return createRecipePayload(title, ingredients, steps, 'allrecipes-manual');
}

function extractEpicuriousRecipe() {
  console.log('Extracting Epicurious recipe...');

  // Try JSON-LD first
  const jsonLdResult = extractRecipeFromJsonLd();
  if (
    jsonLdResult &&
    jsonLdResult.ingredients.length > 0 &&
    jsonLdResult.steps.length > 0
  ) {
    return jsonLdResult;
  }

  // Epicurious manual extraction
  const title =
    document.querySelector('h1')?.textContent?.trim() ||
    document.querySelector('.recipe-title')?.textContent?.trim() ||
    document.title;

  let ingredients = [];
  // Epicurious ingredient selectors
  const ingredientSelectors = [
    '.ingredient',
    '.ingredients li',
    '.recipe-ingredients li',
    '[data-testid="ingredients"] li',
    '[class*="ingredient"] li',
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 2);

      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  let steps = [];
  // Epicurious instruction selectors
  const stepSelectors = [
    '.preparation-step',
    '.instructions li',
    '.recipe-instructions li',
    '[data-testid="instructions"] li',
    '[class*="instruction"] li',
    '.recipe-directions li',
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 10);

      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  return createRecipePayload(title, ingredients, steps, 'epicurious-manual');
}

function extractWashingtonPostRecipe() {
  console.log('Extracting Washington Post recipe...');

  // Try JSON-LD first
  const jsonLdResult = extractRecipeFromJsonLd();
  if (
    jsonLdResult &&
    jsonLdResult.ingredients.length > 0 &&
    jsonLdResult.steps.length > 0
  ) {
    return jsonLdResult;
  }

  // Washington Post manual extraction
  const title =
    document.querySelector('h1')?.textContent?.trim() ||
    document.querySelector('.headline')?.textContent?.trim() ||
    document.querySelector('[data-qa="headline"]')?.textContent?.trim() ||
    document.title;

  let ingredients = [];
  // Washington Post ingredient selectors
  const ingredientSelectors = [
    '.recipe-ingredients li',
    '.ingredients li',
    '[data-testid="ingredients"] li',
    '.ingredient-list li',
    '[class*="ingredient"] li',
    '.wprecipe-ingredients li',
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 2);

      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  let steps = [];
  // Washington Post instruction selectors
  const stepSelectors = [
    '.recipe-instructions li',
    '.instructions li',
    '[data-testid="instructions"] li',
    '.directions li',
    '[class*="instruction"] li',
    '.wprecipe-instructions li',
    '.recipe-directions li',
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 15);

      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  return createRecipePayload(
    title,
    ingredients,
    steps,
    'washingtonpost-manual'
  );
}

function createRecipePayload(title, ingredients, steps, source) {
  // Extract other common data
  const servingSize =
    document.body.textContent
      ?.match(/(serves?|yield[s]?|makes?)\s*:?\s*(\d+[\w\s]*)/i)?.[2]
      ?.trim() || null;
  const time =
    document.body.textContent
      ?.match(
        /(total time|prep time|cook time|active time)\s*:?\s*([\d\w\s,:]+)/i
      )?.[2]
      ?.trim() || null;

  // Extract photos
  const photos = [];
  document.querySelectorAll('img').forEach((img) => {
    if (
      img.src &&
      (img.className?.includes('recipe') ||
        img.alt?.includes('recipe') ||
        img.src.includes('recipe'))
    ) {
      if (!photos.includes(img.src)) {photos.push(img.src);}
    }
  });

  return {
    title,
    ingredients,
    steps,
    servingSize,
    time,
    photos,
    attributionUrl: window.location.href,
    fullPageArchive: document.documentElement.outerHTML,
    fullTextContent: extractFullTextContent(),
    extractedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    source,
  };
}

function extractRecipeGenericFallback() {
  console.log('Using generic recipe extraction fallback...');

  const title =
    document.querySelector('h1')?.textContent?.trim() || document.title;

  // Try common ingredient selectors
  let ingredients = [];
  const ingredientSelectors = [
    '.recipe-ingredients li',
    '.ingredients li',
    '[data-ingredient] li',
    '.ingredient-list li',
    'ul li', // Last resort
  ];

  for (const selector of ingredientSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 3);

      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }

  // Try common step selectors
  let steps = [];
  const stepSelectors = [
    '.recipe-instructions li',
    '.instructions li',
    '.recipe-directions li',
    '[data-instruction] li',
    'ol li',
  ];

  for (const selector of stepSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const items = Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 10);

      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }

  // Extract other fields
  const servingSize =
    document.body.textContent
      ?.match(/(serves?|yield[s]?|makes?)\s*:?\s*(\d+[\w\s]*)/i)?.[2]
      ?.trim() || null;
  const time =
    document.body.textContent
      ?.match(
        /(total time|prep time|cook time|active time)\s*:?\s*([\d\w\s,:]+)/i
      )?.[2]
      ?.trim() || null;

  const photos = [];
  document.querySelectorAll('img').forEach((img) => {
    if (
      img.src &&
      (img.className?.includes('recipe') || img.alt?.includes('recipe'))
    ) {
      if (!photos.includes(img.src)) {photos.push(img.src);}
    }
  });

  return {
    title,
    ingredients,
    steps,
    servingSize,
    time,
    photos,
    attributionUrl: window.location.href,
    fullPageArchive: document.documentElement.outerHTML,
    fullTextContent: extractFullTextContent(),
    extractedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    source: 'generic-fallback',
  };
}

chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
  try {
    if (request.action === 'captureRecipe') {
      console.log('RecipeArchive: Received captureRecipe message');

      // Use generic extraction that detects site and routes appropriately
      const data = extractRecipeGeneric();

      // Check if extraction failed and auto-trigger diagnostics
      const extractionFailed = isExtractionFailed(data);

      if (extractionFailed) {
        console.log(
          'RecipeArchive: Extraction failed - auto-capturing diagnostics...'
        );

        // Check if user has enabled diagnostic mode or if auto-diagnostics is enabled
        chrome.storage.local.get(
          ['diagnosticMode', 'autoDiagnostics'],
          (settings) => {
            const shouldCaptureDiagnostics =
              settings.diagnosticMode || settings.autoDiagnostics !== false;

            if (shouldCaptureDiagnostics) {
              // Capture diagnostic data automatically
              const diagnosticData = captureDiagnosticData();

              // Send to AWS automatically (fire and forget)
              sendAutoDiagnosticData(diagnosticData, window.location.href)
                .then(() =>
                  console.log('RecipeArchive: Auto-diagnostic data sent to AWS')
                )
                .catch((err) =>
                  console.error('RecipeArchive: Auto-diagnostic failed:', err)
                );

              // Include diagnostic info in response
              sendResponse({
                status: 'extraction_failed',
                data,
                autoDiagnosticSent: true,
                diagnosticData: diagnosticData,
              });
            } else {
              sendResponse({
                status: 'extraction_failed',
                data,
                autoDiagnosticSent: false,
                message:
                  'Enable diagnostic mode to automatically improve parsers',
              });
            }
          }
        );
      } else {
        sendResponse({ status: 'success', data });
      }
    } else if (request.action === 'captureDiagnostics') {
      console.log('RecipeArchive: Received captureDiagnostics message');

      // Manual diagnostic capture
      const diagnosticData = captureDiagnosticData();
      sendResponse({ status: 'success', data: diagnosticData });
    }
  } catch (err) {
    console.error('RecipeArchive: Error processing message', err);

    // On any extraction error, try to capture diagnostics
    try {
      const diagnosticData = captureDiagnosticData();
      sendResponse({
        status: 'error',
        error: err.message,
        autoDiagnosticSent: true,
        diagnosticData: diagnosticData,
      });

      // Send diagnostic data for critical errors
      sendAutoDiagnosticData(diagnosticData, window.location.href).catch(
        (diagErr) =>
          console.error(
            'RecipeArchive: Critical error diagnostic failed:',
            diagErr
          )
      );
    } catch (_diagErr) {
      sendResponse({ status: 'error', error: err.message });
    }
  }
  // Return true to indicate async response (Chrome MV3 best practice)
  return true;
});

function isExtractionFailed(data) {
  // Define extraction failure criteria
  const hasTitle =
    data.title && data.title.length > 0 && !data.title.includes('404');
  const hasIngredients =
    data.ingredients &&
    data.ingredients.some((s) => s.items && s.items.length > 0);
  const hasSteps =
    data.steps && data.steps.some((s) => s.items && s.items.length > 0);

  // Consider extraction failed if missing core recipe components
  return !hasTitle || !hasIngredients || !hasSteps;
}

async function sendAutoDiagnosticData(diagnosticData, url) {
  // TODO: Replace with actual AWS endpoint when backend is ready

  try {
    const payload = {
      url: url,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      platform: 'chrome',
      triggerType: 'automatic_failure',
      diagnosticData: diagnosticData,
    };

    // For now, log to console - will implement AWS endpoint later
    console.log('🚨 Auto-diagnostic data prepared for AWS:', payload);
    console.log(
      '🔍 Extraction failure analysis:',
      diagnosticData.extractionResult?.analysis
    );

    // Future AWS implementation:
    /*
		const response = await fetch(AWS_DIAGNOSTIC_ENDPOINT, {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + await getAuthToken()
			},
			body: JSON.stringify(payload)
		});
		
		if (!response.ok) {
			throw new Error(`AWS API error: ${response.status}`);
		}
		*/

    console.log('✅ Auto-diagnostic data ready for AWS processing');
  } catch (error) {
    console.error('Failed to send auto-diagnostic data:', error);
    throw error;
  }
}

function captureDiagnosticData() {
  console.log('RecipeArchive: Starting comprehensive diagnostic capture...');

  const site = window.location.hostname;
  const startTime = Date.now();

  // 1. Page Structure Analysis
  const pageAnalysis = {
    url: window.location.href,
    hostname: site,
    title: document.title,
    timestamp: new Date().toISOString(),

    // Basic page metrics
    metrics: {
      totalElements: document.querySelectorAll('*').length,
      textLength: document.body.textContent.length,
      headings: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length,
      },
      lists: {
        ul: document.querySelectorAll('ul').length,
        ol: document.querySelectorAll('ol').length,
        li: document.querySelectorAll('li').length,
      },
      images: document.querySelectorAll('img').length,
      links: document.querySelectorAll('a').length,
    },

    // Recipe-specific indicators
    recipeIndicators: {
      jsonLdScripts: document.querySelectorAll(
        'script[type="application/ld+json"]'
      ).length,
      recipeKeywords: countRecipeKeywords(),
      potentialIngredientContainers: analyzePotentialContainers('ingredient'),
      potentialStepContainers: analyzePotentialContainers('instruction'),
      timeIndicators: findTimeIndicators(),
      servingIndicators: findServingIndicators(),
    },

    // DOM structure samples
    domStructure: {
      headingTexts: Array.from(document.querySelectorAll('h1, h2, h3'))
        .slice(0, 10)
        .map((h) => ({
          tag: h.tagName.toLowerCase(),
          text: h.textContent.trim().slice(0, 100),
        })),

      allClassNames: Array.from(
        new Set(
          Array.from(document.querySelectorAll('*[class]'))
            .map((el) => {
              const className = el.className;
              // Handle SVG elements and ensure className is a string
              if (typeof className === 'string') {
                return className.split(' ');
              } else if (className && className.baseVal) {
                // SVG elements have className.baseVal
                return className.baseVal.split(' ');
              }
              return [];
            })
            .flat()
            .filter(
              (cls) =>
                cls.includes('recipe') ||
                cls.includes('ingredient') ||
                cls.includes('instruction') ||
                cls.includes('step')
            )
        )
      ).slice(0, 20),

      allIds: Array.from(document.querySelectorAll('*[id]'))
        .map((el) => el.id)
        .filter(
          (id) =>
            id.includes('recipe') ||
            id.includes('ingredient') ||
            id.includes('instruction') ||
            id.includes('step')
        )
        .slice(0, 10),
    },
  };

  // 2. Attempt Recipe Extraction
  let extractionResult;
  try {
    extractionResult = {
      success: true,
      data: extractRecipeGeneric(),
      extractionTime: Date.now() - startTime,
    };

    // Analyze extraction success
    extractionResult.analysis = {
      foundTitle:
        Boolean(extractionResult.data.title) && extractionResult.data.title.length > 0,
      foundIngredients:
        extractionResult.data.ingredients &&
        extractionResult.data.ingredients.some(
          (s) => s.items && s.items.length > 0
        ),
      foundSteps:
        extractionResult.data.steps &&
        extractionResult.data.steps.some((s) => s.items && s.items.length > 0),
      ingredientCount:
        extractionResult.data.ingredients?.reduce(
          (sum, s) => sum + (s.items?.length || 0),
          0
        ) || 0,
      stepCount:
        extractionResult.data.steps?.reduce(
          (sum, s) => sum + (s.items?.length || 0),
          0
        ) || 0,
      source: extractionResult.data.source,
    };
  } catch (error) {
    extractionResult = {
      success: false,
      error: error.message,
      extractionTime: Date.now() - startTime,
    };
  }

  // 3. JSON-LD Analysis
  const jsonLdAnalysis = analyzeJsonLdData();

  // 4. Shadow DOM Analysis (if accessible)
  const shadowDomAnalysis = analyzeShadowDom();

  const diagnosticData = {
    pageAnalysis,
    extractionResult,
    jsonLdAnalysis,
    shadowDomAnalysis,
    captureTime: Date.now() - startTime,
    userAgent: navigator.userAgent,
  };

  console.log('RecipeArchive: Diagnostic capture complete', diagnosticData);
  return diagnosticData;
}

function countRecipeKeywords() {
  const keywords = [
    'recipe',
    'ingredient',
    'instruction',
    'step',
    'cup',
    'tablespoon',
    'teaspoon',
    'oven',
    'bake',
    'cook',
    'prep',
    'serve',
  ];
  const bodyText = document.body.textContent.toLowerCase();
  return keywords.filter((keyword) => bodyText.includes(keyword)).length;
}

function analyzePotentialContainers(type) {
  const patterns =
    type === 'ingredient'
      ? ['ingredient', 'recipe-ingredient', 'ingredients']
      : ['instruction', 'direction', 'step', 'method', 'recipe-instruction'];

  const containers = [];

  patterns.forEach((pattern) => {
    // Class-based selectors
    document.querySelectorAll(`[class*="${pattern}"]`).forEach((el) => {
      if (el.querySelectorAll('li').length > 0) {
        containers.push({
          selector: `[class*="${pattern}"]`,
          element: el.tagName.toLowerCase(),
          itemCount: el.querySelectorAll('li').length,
          className: el.className,
          sample: Array.from(el.querySelectorAll('li'))
            .slice(0, 2)
            .map((li) => li.textContent.trim().slice(0, 50)),
        });
      }
    });

    // ID-based selectors
    document.querySelectorAll(`[id*="${pattern}"]`).forEach((el) => {
      if (el.querySelectorAll('li').length > 0) {
        containers.push({
          selector: `[id*="${pattern}"]`,
          element: el.tagName.toLowerCase(),
          itemCount: el.querySelectorAll('li').length,
          id: el.id,
          sample: Array.from(el.querySelectorAll('li'))
            .slice(0, 2)
            .map((li) => li.textContent.trim().slice(0, 50)),
        });
      }
    });

    // Data attribute selectors
    document.querySelectorAll(`[data-testid*="${pattern}"]`).forEach((el) => {
      if (el.querySelectorAll('li').length > 0) {
        containers.push({
          selector: `[data-testid*="${pattern}"]`,
          element: el.tagName.toLowerCase(),
          itemCount: el.querySelectorAll('li').length,
          testId: el.getAttribute('data-testid'),
          sample: Array.from(el.querySelectorAll('li'))
            .slice(0, 2)
            .map((li) => li.textContent.trim().slice(0, 50)),
        });
      }
    });
  });

  return containers.slice(0, 10); // Limit results
}

function findTimeIndicators() {
  const timePatterns =
    /(prep time|cook time|total time|active time|inactive time)\s*:?\s*([\d\w\s,:]+)/gi;
  const bodyText = document.body.textContent;
  const matches = Array.from(bodyText.matchAll(timePatterns));

  return matches.slice(0, 5).map((match) => ({
    type: match[1],
    value: match[2].trim(),
    context: match[0],
  }));
}

function findServingIndicators() {
  const servingPatterns =
    /(serves?|yield[s]?|makes?|portions?)\s*:?\s*(\d+[\w\s]*)/gi;
  const bodyText = document.body.textContent;
  const matches = Array.from(bodyText.matchAll(servingPatterns));

  return matches.slice(0, 3).map((match) => ({
    type: match[1],
    value: match[2].trim(),
    context: match[0],
  }));
}

function analyzeJsonLdData() {
  const jsonLdScripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  const analysis = {
    scriptCount: jsonLdScripts.length,
    recipes: [],
    otherTypes: [],
  };

  jsonLdScripts.forEach((script, index) => {
    try {
      const jsonData = JSON.parse(script.textContent);
      const items = Array.isArray(jsonData) ? jsonData : [jsonData];

      items.forEach((item) => {
        if (item['@type'] === 'Recipe') {
          analysis.recipes.push({
            scriptIndex: index,
            name: item.name || 'No name',
            hasIngredients: Boolean(item.recipeIngredient),
            hasInstructions: Boolean(item.recipeInstructions),
            ingredientCount: Array.isArray(item.recipeIngredient)
              ? item.recipeIngredient.length
              : 0,
            instructionCount: Array.isArray(item.recipeInstructions)
              ? item.recipeInstructions.length
              : 0,
          });
        } else if (item['@type']) {
          analysis.otherTypes.push({
            scriptIndex: index,
            type: item['@type'],
          });
        }
      });
    } catch (_e) {
      analysis.otherTypes.push({
        scriptIndex: index,
        error: 'JSON parsing failed',
      });
    }
  });

  return analysis;
}

function analyzeShadowDom() {
  // Basic shadow DOM detection
  const shadowHosts = Array.from(document.querySelectorAll('*')).filter(
    (el) => el.shadowRoot
  );

  return {
    shadowHostCount: shadowHosts.length,
    shadowHosts: shadowHosts.slice(0, 5).map((host) => ({
      tagName: host.tagName.toLowerCase(),
      className: host.className,
      id: host.id,
    })),
  };
}
