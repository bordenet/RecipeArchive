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
async function extractRecipeFromPage() {
  const url = window.location.href;
  console.log("🔍 Extracting recipe from:", url);
  
  // PRIMARY: TypeScript parser system (decoupled, maintainable, handles JSON-LD internally)
  if (window.TypeScriptParser) {
    console.log("🎯 Using TypeScript parser system");
    try {
      const result = await window.TypeScriptParser.extractRecipeFromPage();
      
      // TypeScript parser handles all cases:
      // - Site-specific parsing for supported sites
      // - JSON-LD extraction for all sites  
      // - Clear messaging when no recipe is found
      console.log("✅ TypeScript parser completed:", result.source);
      return result;
      
    } catch (error) {
      console.error("❌ TypeScript parser failed:", error);
      // Return error state rather than trying unreliable fallbacks
      return {
        title: document.title || "Unknown Recipe",
        url: window.location.href,
        timestamp: new Date().toISOString(),
        ingredients: [],
        steps: [],
        source: "parser-system-error",
        error: error.message
      };
    }
  }
  
  // If TypeScript parser system isn't available, that's a critical error
  console.error("❌ TypeScript parser system not loaded");
  return {
    title: document.title || "Unknown Recipe", 
    url: window.location.href,
    timestamp: new Date().toISOString(),
    ingredients: [],
    steps: [],
    source: "parser-system-missing"
  };
}

// All recipe extraction logic now handled by the decoupled TypeScript parser system
// Located in extensions/shared/parsers/ for maintainability and testing
