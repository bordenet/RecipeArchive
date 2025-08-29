const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Persistent Context Extension Test', () => {
  test('Test extension with persistent context', async () => {
    console.log('🔍 Testing extension with persistent context...');
    
    const extensionPath = path.resolve(__dirname, '../../../extensions/chrome');
    console.log('📁 Extension path:', extensionPath);

    // Use persistent context instead of regular launch
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps'
      ]
    });

    try {
      console.log('✅ Persistent context created');
      
      // Wait for extension to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check background pages
      const backgroundPages = context.backgroundPages();
      console.log('🔧 Background pages in persistent context:', backgroundPages.length);
      
      if (backgroundPages.length > 0) {
        console.log('✅ Extension loaded in persistent context!');
        const bg = backgroundPages[0];
        
        bg.on('console', msg => {
          console.log(`🔧 BG [${msg.type()}]:`, msg.text());
        });
        
        // Try to evaluate in background
        try {
          const result = await bg.evaluate(() => {
            return {
              hasChromeRuntime: typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined',
              url: location.href
            };
          });
          console.log('🔍 Background evaluation result:', result);
        } catch (error) {
          console.log('❌ Background evaluation error:', error.message);
        }
        
        // Wait for any console messages
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log('❌ No background pages in persistent context');
        
        // Let's try to create a page and check extensions
        const page = await context.newPage();
        
        try {
          await page.goto('chrome://extensions/');
          console.log('📄 Extensions page loaded in persistent context');
          
          // Take a screenshot to see what's there
          await page.screenshot({ path: 'persistent-extensions.png' });
          console.log('📸 Extensions page screenshot saved');
          
        } catch (error) {
          console.log('❌ Extensions page error in persistent context:', error.message);
        }
        
        await page.close();
      }
      
    } finally {
      await context.close();
      console.log('✅ Persistent context test complete');
    }
  });
});
