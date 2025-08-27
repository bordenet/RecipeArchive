// RecipeArchive Chrome Extension Content Script
// Safe initialization with error handling

console.log("🎯 RecipeArchive content script starting...");

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

function initializeContentScript() {
  try {
    console.log("✅ RecipeArchive content script initialized");
    
    // Simple message listener for testing
    chrome.runtime.onMessage.addListener(function messageListener(request, sender, sendResponse) {
      try {
        console.log("📨 RecipeArchive received message:", request);
        
        if (request.action === "ping") {
          sendResponse({ 
            status: "pong", 
            url: window.location.href,
            title: document.title 
          });
          return true;
        }
        
        if (request.action === "captureRecipe") {
          console.log("🍳 Starting recipe capture...");
          
          try {
            // Try to extract recipe data based on site
            const recipeData = extractRecipeFromPage();
            
            if (recipeData && recipeData.ingredients && recipeData.ingredients.length > 0) {
              console.log("✅ Recipe extracted:", recipeData);
              sendResponse({ status: "success", data: recipeData });
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
              sendResponse({ status: "success", data: basicRecipe });
            }
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
            sendResponse({ status: "success", data: errorRecipe });
          }
          return true;
        }
        
        sendResponse({ status: "unknown_action", action: request.action });
        return true;
        
      } catch (error) {
        console.error("❌ RecipeArchive message handling error:", error);
        sendResponse({ status: "error", error: error.message });
        return true;
      }
    });
    
    console.log("✅ RecipeArchive message listener registered");
    
  } catch (error) {
    console.error("❌ RecipeArchive initialization error:", error);
  }
}

console.log("🎯 RecipeArchive content script loaded");

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
  
  const title = document.querySelector("h1")?.textContent?.trim() || document.title;
  
  // Extract ingredients - Food Network uses specific classes
  let ingredients = [];
  const ingredientSelectors = [
    ".o-RecipeInfo__a-Ingredients li",
    ".o-Ingredients__a-ListItem",
    "section[aria-labelledby=\"recipe-ingredients-section\"] li"
  ];
  
  for (const selector of ingredientSelectors) {
    const ingredientElements = document.querySelectorAll(selector);
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
      
      if (items.length > 0) {
        ingredients = [{ title: null, items }];
        break;
      }
    }
  }
  
  // Extract steps
  let steps = [];
  const stepSelectors = [
    ".o-Method__m-Body li",
    ".o-Method li",
    ".recipe-directions li",
    "section[aria-labelledby=\"recipe-instructions-section\"] li"
  ];
  
  for (const selector of stepSelectors) {
    const stepElements = document.querySelectorAll(selector);
    if (stepElements.length > 0) {
      const items = Array.from(stepElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 10);
      
      if (items.length > 0) {
        steps = [{ title: null, items }];
        break;
      }
    }
  }
  
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
