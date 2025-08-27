// RecipeArchive Safari Extension Background Script
// Routes messages between popup and content scripts

console.log("=' RecipeArchive Safari background script loaded");

// Handle messages from popup and route to content script
if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log("=' Background received message:", request, "from:", sender);
    
    try {
      // Get the active tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      
      if (!tabs || tabs.length === 0) {
        console.error("L No active tab found");
        sendResponse({ status: "error", error: "No active tab found" });
        return;
      }
      
      const activeTab = tabs[0];
      console.log("=' Sending message to tab:", activeTab.id, "message:", request);
      
      // Route the message to the content script
      try {
        const response = await browser.tabs.sendMessage(activeTab.id, request);
        console.log("=' Content script response:", response);
        sendResponse(response);
      } catch (error) {
        console.error("L Error sending to content script:", error);
        sendResponse({ status: "error", error: error.message });
      }
      
    } catch (error) {
      console.error("L Background script error:", error);
      sendResponse({ status: "error", error: error.message });
    }
    
    return true; // Indicate we will respond asynchronously
  });
}