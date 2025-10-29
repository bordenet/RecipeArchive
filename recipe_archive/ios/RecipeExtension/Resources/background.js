// Background service worker
// Handles communication between content scripts and native app

console.log('RecipeArchive background script loaded');

// Listen for extension installation
browser.runtime.onInstalled.addListener((details) => {
  console.log('RecipeArchive extension installed:', details.reason);

  if (details.reason === 'install') {
    // First install - show welcome page
    console.log('First install detected');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Listen for messages from content scripts or popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  // Handle different message types
  if (message.action === 'saveToNative') {
    // Forward recipe data to native app
    saveToNativeApp(message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Async response
  }

  return false;
});

// Save recipe data to native app via App Group
async function saveToNativeApp(data) {
  try {
    // Send message to native handler (SafariWebExtensionHandler.swift)
    const response = await browser.runtime.sendNativeMessage({
      action: 'saveRecipe',
      url: data.url,
      html: data.html,
      title: data.title,
      recipeSchema: data.recipeSchema,
      timestamp: Date.now()
    });

    console.log('Recipe data sent to native handler:', response);
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Native handler failed');
    }

    return response;
  } catch (error) {
    console.error('Failed to send to native handler:', error);
    throw error;
  }
}

// Monitor storage changes
browser.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', areaName, Object.keys(changes));
});
