// Background script for RecipeArchive Chrome Extension
console.log('🚀 RecipeArchive extension background script loaded');

// Basic extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  console.log('✅ Extension installed/updated:', details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Extension startup');
});

// Handle extension icon clicks (optional - popup should handle this)
chrome.action.onClicked.addListener((tab) => {
  console.log('🖱️ Extension icon clicked on tab:', tab.url);
});

// Basic message handling for communication with content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request);
  
  // Echo back for testing
  sendResponse({ 
    status: 'background_received', 
    timestamp: Date.now(),
    originalMessage: request 
  });
  
  return true; // Keep message channel open for async response
});

console.log('🎯 Background script initialization complete');
