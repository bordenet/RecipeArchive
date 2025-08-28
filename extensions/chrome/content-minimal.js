// Minimal content script for testing
/* global chrome */
console.log("🎯 RecipeArchive content script loaded");

// Simple message listener
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("📨 Content script received message:", request);
  
  if (request.action === "ping") {
    sendResponse({ status: "pong", url: window.location.href });
  }
  
  return true; // Indicate async response
});

console.log("✅ Content script setup complete");
