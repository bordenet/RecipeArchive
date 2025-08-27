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
    
    // Simple message listener for testing - Safari uses browser API
    const runtimeAPI = (typeof browser !== "undefined") ? browser.runtime : chrome.runtime;
    
    runtimeAPI.onMessage.addListener(function messageListener(request, sender, sendResponse) {
      try {
        console.log("📨 RecipeArchive received message:", request);
        
        if (request.action === "ping") {
          const response = { 
            status: "pong", 
            url: window.location.href,
            title: document.title 
          };
          console.log("📨 Ping response:", response);
          
          // Safari needs explicit response handling
          if (typeof browser !== "undefined") {
            // Safari - return a Promise
            return Promise.resolve(response);
          } else {
            // Chrome - use callback
            sendResponse(response);
            return true;
          }
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
          
          const response = { status: "success", data: basicRecipe };
          console.log("✅ Basic recipe extracted:", response);
          
          // Safari needs explicit response handling
          if (typeof browser !== "undefined") {
            // Safari - return a Promise
            return Promise.resolve(response);
          } else {
            // Chrome - use callback
            sendResponse(response);
            return true;
          }
        }
        
        const unknownResponse = { status: "unknown_action", action: request.action };
        
        if (typeof browser !== "undefined") {
          return Promise.resolve(unknownResponse);
        } else {
          sendResponse(unknownResponse);
          return true;
        }
        
      } catch (error) {
        console.error("❌ RecipeArchive message handling error:", error);
        const errorResponse = { status: "error", error: error.message };
        
        if (typeof browser !== "undefined") {
          return Promise.resolve(errorResponse);
        } else {
          sendResponse(errorResponse);
          return true;
        }
      }
    });
    
    console.log("✅ RecipeArchive message listener registered");
    
  } catch (error) {
    console.error("❌ RecipeArchive initialization error:", error);
  }
}

console.log("🎯 RecipeArchive content script loaded");
