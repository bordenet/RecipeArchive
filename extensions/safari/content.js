// RecipeArchive Chrome Extension Content Script
// Safe initialization with error handling

// Prevent duplicate injection
if (typeof window.RecipeArchiveContentScript !== "undefined") {
  console.log("🎯 RecipeArchive content script already loaded, skipping");
} else {
  window.RecipeArchiveContentScript = true;
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
}

function initializeContentScript() {
  try {
    console.log("✅ RecipeArchive content script initialized");
    
    // Remove any existing listeners to prevent duplicates
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      // Chrome doesn't have a removeListener method, so we just ensure we don't add duplicates
    }
    
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
          
          // Simple recipe extraction for testing
          const basicRecipe = {
            title: document.title || "Unknown Recipe",
            url: window.location.href,
            timestamp: new Date().toISOString(),
            ingredients: ["Test ingredient 1", "Test ingredient 2"],
            steps: ["Test step 1", "Test step 2"],
            source: "basic-test"
          };
          
          console.log("✅ Basic recipe extracted:", basicRecipe);
          sendResponse({ status: "success", data: basicRecipe });
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
