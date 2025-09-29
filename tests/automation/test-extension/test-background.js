console.log('🎯 Test background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Test extension installed');
});

console.log('🔧 Test background script setup complete');
