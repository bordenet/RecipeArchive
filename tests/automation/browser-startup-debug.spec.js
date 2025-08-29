const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Browser Startup Debug', () => {
  test('Debug browser startup with extension', async () => {
    console.log('🔍 Debugging browser startup process...');
    
    const extensionPath = path.resolve(__dirname, '../../extensions/chrome');
    console.log('📁 Extension path:', extensionPath);

    let browser;
    let context;
    
    try {
      console.log('🚀 Launching browser...');
      
      // Try different launch approaches
      browser = await chromium.launch({
        headless: false,
        devtools: false,
        args: [
          `--load-extension=${extensionPath}`,
          '--disable-extensions-except=' + extensionPath,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      console.log('✅ Browser launched');
      
      // Create a new context
      context = await browser.newContext();
      console.log('✅ Context created');
      
      // Wait a bit for extension to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check background pages
      const backgroundPages = context.backgroundPages();
      console.log('🔧 Background pages found:', backgroundPages.length);
      
      // Try to create a regular page
      const page = await context.newPage();
      console.log('📄 Regular page created');
      
      // Try to navigate to a simple page
      await page.goto('https://example.com');
      console.log('🌐 Navigation successful');
      
      // Check if we can access chrome://extensions
      try {
        const extensionsPage = await context.newPage();
        await extensionsPage.goto('chrome://extensions/');
        console.log('⚙️ Extensions page accessible');
        
        // Enable developer mode
        await extensionsPage.locator('#devMode').check();
        console.log('🔧 Developer mode enabled');
        
        // Take a screenshot
        await extensionsPage.screenshot({ path: 'extensions-debug.png' });
        console.log('📸 Screenshot saved');
        
        await extensionsPage.close();
      } catch (error) {
        console.log('❌ Extensions page error:', error.message);
      }
      
      await page.close();
      console.log('✅ Test completed successfully');
      
    } catch (error) {
      console.log('❌ Browser startup error:', error.message);
      console.log('🔍 Error stack:', error.stack);
    } finally {
      if (context) {
        try {
          await context.close();
          console.log('✅ Context closed');
        } catch (e) {
          console.log('⚠️ Context close error:', e.message);
        }
      }
      
      if (browser) {
        try {
          await browser.close();
          console.log('✅ Browser closed');
        } catch (e) {
          console.log('⚠️ Browser close error:', e.message);
        }
      }
    }
  });
});
