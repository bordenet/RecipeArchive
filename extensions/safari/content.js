// RecipeArchive Safari Extension Content Script
// Safe initialization with error handling

console.log("🎯 RecipeArchive Safari content script starting...");

// Safari Web Extensions: Prevent duplicate injection but always ensure message listeners
if (typeof window.RecipeArchiveContentScript !== "undefined") {
  console.log("🎯 RecipeArchive content script already loaded, but ensuring message listeners...");
  // Reset listener flag to allow re-registration with new comprehensive approach
  window.RecipeArchiveMessageListenerAdded = false;
  // Still set up message listeners in case they were lost
  initializeContentScript();
} else {
  window.RecipeArchiveContentScript = true;
  console.log("🎯 RecipeArchive content script starting initialization...");
  
  // Wrap everything in error handling
  try {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeContentScript);
    } else {
      initializeContentScript();
    }
  } catch (error) {
    console.error("❌ RecipeArchive content script initialization error:", error);
  }
}

function initializeContentScript() {
  try {
    console.log("✅ RecipeArchive Safari content script initialized");
    
    // Prevent multiple message listeners
    if (window.RecipeArchiveMessageListenerAdded) {
      console.log("🔧 Message listeners already added, skipping");
      return;
    }
    
    // Safari Web Extensions: Register message listeners - try multiple approaches
    let messageHandlerRegistered = false;
    
    // Approach 1: Try browser.runtime (standard Safari Web Extensions)
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
      console.log("🔧 Registering browser.runtime message listener");
      browser.runtime.onMessage.addListener(handleMessage);
      messageHandlerRegistered = true;
    }
    
    // Approach 2: Try chrome.runtime (compatibility mode)
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      console.log("🔧 Registering chrome.runtime message listener");
      chrome.runtime.onMessage.addListener(handleMessage);
      messageHandlerRegistered = true;
    }
    
    // Approach 3: Try window.browser (explicit global)
    if (typeof window.browser !== "undefined" && window.browser.runtime && window.browser.runtime.onMessage) {
      console.log("🔧 Registering window.browser.runtime message listener");
      window.browser.runtime.onMessage.addListener(handleMessage);
      messageHandlerRegistered = true;
    }
    
    // Approach 4: Try window.chrome (explicit global)
    if (typeof window.chrome !== "undefined" && window.chrome.runtime && window.chrome.runtime.onMessage) {
      console.log("🔧 Registering window.chrome.runtime message listener");
      window.chrome.runtime.onMessage.addListener(handleMessage);
      messageHandlerRegistered = true;
    }
    
    if (!messageHandlerRegistered) {
      console.error("❌ No runtime API available for message handling!");
      return;
    }
    
    // Approach 5: Safari Web Extensions fallback - custom event listener
    console.log("🔧 Adding custom event listener for Safari fallback");
    window.addEventListener("RecipeArchiveMessage", function(event) {
      console.log("📨 Custom event received:", event.detail);
      handleMessage(event.detail.request, event.detail.sender, event.detail.sendResponse);
    });
    
    // Mark that listeners have been added
    window.RecipeArchiveMessageListenerAdded = true;
    console.log("✅ RecipeArchive message listener registered");
    console.log("🔧 Using browser API available:", typeof browser !== "undefined");
    console.log("🔧 Using chrome API available:", typeof chrome !== "undefined");
    
  } catch (error) {
    console.error("❌ RecipeArchive initialization error:", error);
  }
}

function handleMessage(request, sender, sendResponse) {
  try {
    console.log("📨 RecipeArchive received message:", request);
    console.log("📨 Message sender:", sender);
    console.log("📨 SendResponse function:", typeof sendResponse);
    
    if (request.action === "ping") {
      const response = { 
        status: "pong", 
        url: window.location.href,
        title: document.title 
      };
      console.log("📨 Ping response being sent:", response);
      
      // Safari Web Extensions: call sendResponse synchronously and return true
      setTimeout(() => sendResponse(response), 0);
      return true;
    }
    
    if (request.action === "captureRecipe") {
      console.log("🍳 Starting recipe capture...");
      
      try {
        // Try to extract recipe data based on site
        const recipeData = extractRecipeFromPage();
        
        let response;
        if (recipeData && recipeData.ingredients && recipeData.ingredients.length > 0) {
          console.log("✅ Recipe extracted:", recipeData);
          response = { status: "success", data: recipeData };
        } else {
          console.log("⚠️ No recipe data found, sending basic info");
          const basicRecipe = {
            title: document.title || "Unknown Recipe",
            url: window.location.href,
            timestamp: new Date().toISOString(),
            ingredients: [],
            steps: [],
            source: "no-recipe-found"
          };
          response = { status: "success", data: basicRecipe };
        }
        
        console.log("📨 Capture response being sent:", response);
        setTimeout(() => sendResponse(response), 0);
        return true;
        
      } catch (extractError) {
        console.error("❌ Recipe extraction error:", extractError);
        const errorRecipe = {
          title: document.title || "Unknown Recipe",
          url: window.location.href,
          timestamp: new Date().toISOString(),
          ingredients: [],
          steps: [],
          source: "extraction-error",
          error: extractError.message
        };
        const errorResponse = { status: "success", data: errorRecipe };
        
        console.log("📨 Error response being sent:", errorResponse);
        setTimeout(() => sendResponse(errorResponse), 0);
        return true;
      }
    }
    
    const unknownResponse = { status: "unknown_action", action: request.action };
    console.log("❓ Unknown action response:", unknownResponse);
    setTimeout(() => sendResponse(unknownResponse), 0);
    return true;
    
  } catch (error) {
    console.error("❌ RecipeArchive message handling error:", error);
    const errorResponse = { status: "error", error: error.message };
    setTimeout(() => sendResponse(errorResponse), 0);
    return true;
  }
}

console.log("🎯 RecipeArchive Safari content script loaded");

// Recipe extraction functions
function extractRecipeFromPage() {
  const url = window.location.href;
  console.log("🔍 Extracting recipe from:", url);
  
  // Try JSON-LD first (works for most modern recipe sites)
  const jsonLdRecipe = extractRecipeFromJsonLd();
  if (jsonLdRecipe) {
    console.log("✅ Found JSON-LD recipe data");
    return jsonLdRecipe;
  }
  
  // Site-specific extractors
  if (url.includes("foodnetwork.com")) {
    return extractFoodNetworkRecipe();
  } else if (url.includes("smittenkitchen.com")) {
    return extractSmittenKitchenRecipe();
  } else if (url.includes("loveandlemons.com")) {
    return extractLoveLemonsRecipe();
  }
  
  // Generic fallback extraction
  return extractGenericRecipe();
}

function extractRecipeFromJsonLd() {
  const jsonLdScripts = document.querySelectorAll("script[type=\"application/ld+json\"]");
  
  for (const script of jsonLdScripts) {
    try {
      const jsonData = JSON.parse(script.textContent);
      let recipeData = null;
      
      // Handle different JSON-LD structures
      if (jsonData["@type"] === "Recipe") {
        recipeData = jsonData;
      } else if (Array.isArray(jsonData)) {
        recipeData = jsonData.find(item => item && item["@type"] === "Recipe");
      } else if (jsonData["@graph"]) {
        recipeData = jsonData["@graph"].find(item => item && item["@type"] === "Recipe");
      }
      
      if (recipeData && recipeData.name) {
        const ingredients = recipeData.recipeIngredient 
          ? [{ title: null, items: recipeData.recipeIngredient }]
          : [];
        
        let steps = [];
        if (recipeData.recipeInstructions) {
          const stepItems = recipeData.recipeInstructions
            .map(instruction => {
              if (typeof instruction === "string") return instruction;
              if (instruction.text) return instruction.text;
              if (instruction.name) return instruction.name;
              return "";
            })
            .filter(Boolean);
          
          if (stepItems.length > 0) {
            steps = [{ title: null, items: stepItems }];
          }
        }
        
        return {
          title: recipeData.name,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          ingredients,
          steps,
          servingSize: recipeData.recipeYield || recipeData.yield || null,
          time: recipeData.totalTime || recipeData.cookTime || recipeData.prepTime || null,
          photos: recipeData.image ? (Array.isArray(recipeData.image) ? recipeData.image : [recipeData.image]) : [],
          source: "json-ld"
        };
      }
    } catch (e) {
      console.log("JSON-LD parsing failed:", e.message);
    }
  }
  return null;
}

function extractFoodNetworkRecipe() {
  console.log("🍳 Extracting Food Network recipe...");
  
  const title = document.querySelector("h1.o-AssetTitle__a-HeadlineText, h1")?.textContent?.trim() || document.title;
  
  // Extract ingredients - Enhanced Food Network selectors
  let ingredients = [];
  const ingredientSelectors = [
    ".o-RecipeIngredients__a-Ingredient",
    ".o-Ingredients__a-Ingredient", 
    ".o-RecipeInfo__a-Ingredients li",
    ".o-Ingredients__a-ListItem",
    "[data-module=\"IngredientsList\"] li",
    ".recipe-ingredients li",
    ".o-RecipeIngredients li",
    "section[aria-labelledby=\"recipe-ingredients-section\"] li"
  ];
  
  for (const selector of ingredientSelectors) {
    console.log(`🔍 Trying ingredient selector: ${selector}`);
    const ingredientElements = document.querySelectorAll(selector);
    console.log(`🔍 Found ${ingredientElements.length} elements for ${selector}`);
    
    if (ingredientElements.length > 0) {
      const items = Array.from(ingredientElements)
        .map(el => el.textContent?.trim())
        .filter(text => 
          text && 
          text.length > 3 &&
          !text.includes("Level:") &&
          !text.includes("Total:") &&
          !text.includes("Prep:") &&
          !text.includes("Yield:") &&
          !text.includes("Nutrition Info") &&
          !text.includes("Save Recipe") &&
          !text.includes("{")
        );
      
      console.log(`🔍 Filtered to ${items.length} ingredients:`, items.slice(0, 3));
      
      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }
  
  // Extract steps - Enhanced Food Network selectors
  let steps = [];
  const stepSelectors = [
    ".o-Method__m-Step",
    ".recipe-instructions .o-Method__m-Step",
    ".o-Method__m-Body li",
    ".o-Method li",
    "[data-module=\"InstructionsList\"] li",
    ".recipe-instructions ol li",
    ".recipe-instructions li",
    ".recipe-directions li",
    "section[aria-labelledby=\"recipe-instructions-section\"] li"
  ];
  
  for (const selector of stepSelectors) {
    console.log(`🔍 Trying step selector: ${selector}`);
    const stepElements = document.querySelectorAll(selector);
    console.log(`🔍 Found ${stepElements.length} step elements for ${selector}`);
    
    if (stepElements.length > 0) {
      const items = Array.from(stepElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 10);
      
      console.log(`🔍 Filtered to ${items.length} steps:`, items.slice(0, 2));
      
      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }
  
  console.log(`🔍 Food Network extraction result: ${ingredients.length} ingredient groups, ${steps.length} step groups`);
  
  return {
    title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    ingredients,
    steps,
    source: "food-network"
  };
}

function extractSmittenKitchenRecipe() {
  console.log("🍳 Extracting Smitten Kitchen recipe...");
  
  const title = document.querySelector(".entry-title, h1")?.textContent?.trim() || document.title;
  
  // Smitten Kitchen specific selectors
  const ingredients = extractListItems([
    ".recipe-ingredients li",
    ".recipe-summary ul li"
  ]);
  
  const steps = extractListItems([
    ".recipe-instructions li",
    ".recipe-instructions ol li"
  ]);
  
  return {
    title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    ingredients: ingredients.length > 0 ? [{ title: null, items: ingredients }] : [],
    steps: steps.length > 0 ? [{ title: null, items: steps }] : [],
    source: "smitten-kitchen"
  };
}

function extractLoveLemonsRecipe() {
  console.log("🍳 Extracting Love & Lemons recipe...");
  
  const title = document.querySelector("h1")?.textContent?.trim() || document.title;
  
  // Love & Lemons specific selectors
  const ingredients = extractListItems([
    ".recipe-ingredients li",
    ".wp-block-group li",
    ".entry-content ul li"
  ], true); // Filter out navigation items
  
  const steps = extractListItems([
    ".recipe-instructions li",
    ".wp-block-list li"
  ]);
  
  return {
    title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    ingredients: ingredients.length > 0 ? [{ title: null, items: ingredients }] : [],
    steps: steps.length > 0 ? [{ title: null, items: steps }] : [],
    source: "love-lemons"
  };
}

function extractGenericRecipe() {
  console.log("🍳 Attempting generic recipe extraction...");
  
  const title = document.querySelector("h1")?.textContent?.trim() || document.title;
  
  // Generic selectors for ingredients and steps
  const ingredients = extractListItems([
    ".ingredients li",
    ".recipe-ingredients li",
    "ul li"
  ], true);
  
  const steps = extractListItems([
    ".instructions li",
    ".recipe-instructions li",
    ".directions li",
    "ol li"
  ]);
  
  return {
    title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    ingredients: ingredients.length > 0 ? [{ title: null, items: ingredients }] : [],
    steps: steps.length > 0 ? [{ title: null, items: steps }] : [],
    source: "generic"
  };
}

function extractListItems(selectors, filterNavigation = false) {
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      let items = Array.from(elements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 2);
      
      if (filterNavigation) {
        items = items.filter(text => 
          !text.includes("RECIPES") &&
          !text.includes("ABOUT") &&
          !text.includes("NEWSLETTER") &&
          !text.includes("Follow me") &&
          !text.includes("Email") &&
          !text.includes("Instagram") &&
          text.length < 200 // Exclude very long text blocks
        );
      }
      
      if (items.length > 0) {
        return items;
      }
    }
  }
  return [];
}