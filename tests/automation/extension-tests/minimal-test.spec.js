const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Minimal Extension Test', () => {
  test('Test minimal extension loading', async () => {
    console.log('🔍 Testing minimal extension...');
    
    const testExtensionPath = path.resolve('/Users/Matt.Bordenet/GitHub/RecipeArchive/tests/automation/test-extension');
    console.log('📁 Test extension path:', testExtensionPath);

    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${testExtensionPath}`,
        '--disable-extensions-except=' + testExtensionPath,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps'
      ]
    });

    try {
      const context = await browser.newContext();
      
      // Wait for extension to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check background pages
      const backgroundPages = context.backgroundPages();
      console.log('🔧 Test extension background pages:', backgroundPages.length);
      
      if (backgroundPages.length > 0) {
        console.log('✅ Minimal extension loaded successfully!');
        const bg = backgroundPages[0];
        
        bg.on('console', msg => {
          console.log(`🔧 Test BG [${msg.type()}]:`, msg.text());
        });
        
        // Wait for any console messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('❌ Minimal extension failed to load');
      }
      
      await context.close();
      
    } finally {
      await browser.close();
      console.log('✅ Minimal extension test complete');
    }
  });
});
