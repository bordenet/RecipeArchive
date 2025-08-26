const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Debug Analysis', () => {
  test('Debug extension loading with detailed analysis', async () => {
    console.log('🔍 Starting detailed extension debug analysis...');
    
    const extensionPath = path.resolve('/Users/Matt.Bordenet/GitHub/RecipeArchive/extensions/chrome');
    console.log('📁 Extension path:', extensionPath);

    // Launch browser with extension and developer mode
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps'
      ],
      devtools: true
    });

    try {
      console.log('🌐 Browser launched with extension');
      
      // Wait a moment for extension to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check background page
      const backgroundPages = browser.backgroundPages();
      console.log('🔧 Background pages found:', backgroundPages.length);
      
      if (backgroundPages.length > 0) {
        const backgroundPage = backgroundPages[0];
        console.log('✅ Background page exists');
        
        // Listen for console messages
        backgroundPage.on('console', msg => {
          console.log('🗣️ Background console:', msg.type(), msg.text());
        });
        
        // Listen for errors
        backgroundPage.on('pageerror', err => {
          console.log('❌ Background error:', err.message);
        });
        
        // Wait for any initial errors
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('❌ No background pages found');
        
        // Let's check extensions page for error details
        const page = await browser.newPage();
        
        try {
          await page.goto('chrome://extensions/', { waitUntil: 'load' });
          console.log('📄 Extensions page loaded');
          
          // Enable developer mode
          const devModeToggle = await page.locator('#devMode').first();
          if (await devModeToggle.isVisible()) {
            const isChecked = await devModeToggle.isChecked();
            if (!isChecked) {
              await devModeToggle.click();
              console.log('🔧 Developer mode enabled');
            }
          }
          
          // Look for extension errors
          const errorElements = await page.locator('[role="alert"], .error-message, .extension-error').all();
          if (errorElements.length > 0) {
            console.log('⚠️ Found error elements:', errorElements.length);
            for (let i = 0; i < errorElements.length; i++) {
              const text = await errorElements[i].textContent();
              console.log(`❌ Error ${i + 1}:`, text);
            }
          }
          
          // Check if our extension is listed
          const extensionCards = await page.locator('extensions-item').all();
          console.log('📦 Extension cards found:', extensionCards.length);
          
          for (let i = 0; i < extensionCards.length; i++) {
            const card = extensionCards[i];
            const name = await card.locator('.name').textContent().catch(() => 'Unknown');
            const errors = await card.locator('.error-message, [role="alert"]').all();
            console.log(`📦 Extension ${i + 1}: ${name} (${errors.length} errors)`);
            
            if (errors.length > 0) {
              for (let j = 0; j < errors.length; j++) {
                const errorText = await errors[j].textContent();
                console.log(`  ❌ Error: ${errorText}`);
              }
            }
          }
          
        } catch (error) {
          console.log('❌ Error checking extensions page:', error.message);
        }
      }
      
    } catch (error) {
      console.log('❌ Debug error:', error.message);
    } finally {
      await browser.close();
      console.log('✅ Debug analysis complete');
    }
  });
});
