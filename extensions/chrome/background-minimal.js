console.log('🎯 Minimal background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Minimal extension installed');
});
