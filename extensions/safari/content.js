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
    window.addEventListener("RecipeArchiveMessage", function (event) {
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

      // Handle async operation properly for Safari
      (async () => {
        try {
          // Try to extract recipe data based on site
          console.log("🔧 About to call extractRecipeFromPage()...");
          const recipeData = await extractRecipeFromPage();
          console.log("🔧 extractRecipeFromPage() completed, recipeData:", recipeData);
          console.log("🔧 recipeData type:", typeof recipeData);
          console.log("🔧 recipeData.ingredients:", recipeData?.ingredients);
          console.log("🔧 recipeData.steps:", recipeData?.steps);
          console.log("🔧 recipeData.instructions:", recipeData?.instructions);

          // Check if we have valid recipe data - handle both flat and grouped formats
          const hasIngredients = recipeData && recipeData.ingredients && (
            (Array.isArray(recipeData.ingredients) && recipeData.ingredients.length > 0 && 
             (typeof recipeData.ingredients[0] === 'string' || 
              (recipeData.ingredients[0] && recipeData.ingredients[0].items && recipeData.ingredients[0].items.length > 0)
             )
            )
          );
          
          const hasInstructions = recipeData && (
            (recipeData.instructions && Array.isArray(recipeData.instructions) && recipeData.instructions.length > 0) ||
            (recipeData.steps && Array.isArray(recipeData.steps) && recipeData.steps.length > 0)
          );
          
          console.log("🔧 Validation results:");
          console.log("🔧   hasIngredients:", hasIngredients);
          console.log("🔧   hasInstructions:", hasInstructions);
          console.log("🔧   recipeData.title:", recipeData?.title);

          let response;
          if (recipeData && recipeData.title && (hasIngredients || hasInstructions)) {
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
    })();
    return true;
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