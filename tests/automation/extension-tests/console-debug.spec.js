const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Console Debug', () => {
  test('Capture extension console messages', async () => {
    console.log('🔍 Starting extension console debug...');
    
    const extensionPath = path.resolve(__dirname, '../../../extensions/chrome');
    console.log('📁 Extension path:', extensionPath);

    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--enable-logging',
        '--v=1'
      ]
    });

    try {
      const context = await browser.newContext();
      
      // Listen for console messages from the entire context
      context.on('console', msg => {
        console.log(`🗣️ Console [${msg.type()}]:`, msg.text());
      });
      
      context.on('pageerror', err => {
        console.log('❌ Page error:', err.message);
      });
      
      // Wait a moment for extension to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check background pages after waiting
      const backgroundPages = context.backgroundPages();
      console.log('🔧 Background pages after wait:', backgroundPages.length);
      
      if (backgroundPages.length > 0) {
        const bg = backgroundPages[0];
        console.log('✅ Background page found');
        
        bg.on('console', msg => {
          console.log(`🔧 Background [${msg.type()}]:`, msg.text());
        });
        
        bg.on('pageerror', err => {
          console.log('❌ Background error:', err.message);
        });
        
        // Try to evaluate something in the background
        try {
          const result = await bg.evaluate(() => {
            return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
          });
          console.log('🔍 Chrome runtime available:', result);
        } catch (error) {
          console.log('❌ Background evaluation error:', error.message);
        }
      } else {
        console.log('❌ No background pages found - extension may not be loading');
        
        // Let's try to open Chrome DevTools to see errors
        const page = await context.newPage();
        
        // Navigate to a test page and check for extension injection
        await page.goto('https://example.com');
        console.log('📄 Test page loaded');
        
        // Check if content script was injected
        const contentScriptInjected = await page.evaluate(() => {
          return typeof window.RecipeExtension !== 'undefined';
        });
        console.log('📝 Content script injected:', contentScriptInjected);
        
        await page.close();
      }
      
      await context.close();
      
    } finally {
      await browser.close();
      console.log('✅ Console debug complete');
    }
  });
});
