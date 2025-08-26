const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const EXTENSION_PATH = path.resolve(__dirname, '../../../extensions/chrome');
const RECIPE_URL = 'https://www.allrecipes.com/recipe/17481/simple-white-cake/';

test.describe('Chrome Extension Direct Test', () => {
  let browser;
  let context;
  let page;
  let serverProcess;

  test.setTimeout(60000);

  test.beforeAll(async () => {
    console.log('🚀 Setting up direct extension test...');
    
    // Start server
    console.log('🔧 Starting mock server...');
    serverProcess = spawn('go', ['run', 'main.go'], {
      cwd: path.resolve(__dirname, '../../../aws-backend/functions/local-server'),
      stdio: 'pipe'
    });
    
    // Wait for server
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server timeout')), 20000);
      const checkServer = async () => {
        try {
          const response = await fetch('http://localhost:8080/health');
          if (response.ok) {
            clearTimeout(timeout);
            console.log('✅ Server ready');
            resolve();
          } else {
            setTimeout(checkServer, 1000);
          }
        } catch (error) {
          setTimeout(checkServer, 1000);
        }
      };
      checkServer();
    });

    // Launch browser with extension
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox'
      ]
    });

    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    console.log('🧹 Cleanup...');
    await browser?.close();
    serverProcess?.kill('SIGTERM');
  });

  test('Test extension popup directly', async () => {
    console.log('🎯 Testing extension popup access');
    
    // Load recipe page first
    console.log('📄 Loading recipe page...');
    await page.goto(RECIPE_URL);
    await page.waitForTimeout(3000);
    console.log('✅ Recipe page loaded');
    
    // Try to access popup directly using a known pattern
    console.log('🔍 Attempting direct popup access...');
    
    // Get the background pages (extension context)
    const backgroundPages = await context.backgroundPages();
    console.log(`Found ${backgroundPages.length} background pages`);
    
    // Try to create a new page for the popup
    const popupPage = await context.newPage();
    
    // Try common extension popup URLs
    const possibleUrls = [
      'chrome-extension://*/popup.html',
      // We'll need to find the actual extension ID
    ];
    
    // Since we can't access chrome://extensions/, let's try to find the extension ID
    // by checking the background pages or trying common patterns
    try {
      // Try to open the popup with a wildcard (this won't work but will show us the pattern)
      console.log('🔗 Testing popup access patterns...');
      
      // Actually, let's just try to invoke the extension action programmatically
      // This simulates clicking the extension icon
      
      // First, let's see if we can find any extension context
      const allPages = await context.pages();
      console.log(`Total pages: ${allPages.length}`);
      
      for (let i = 0; i < allPages.length; i++) {
        const pageUrl = allPages[i].url();
        console.log(`Page ${i}: ${pageUrl}`);
        
        if (pageUrl.includes('chrome-extension://')) {
          console.log('🎯 Found extension page!');
          
          // Try to interact with this page
          const extPage = allPages[i];
          await extPage.bringToFront();
          await extPage.waitForTimeout(2000);
          
          // Take screenshot
          await extPage.screenshot({ path: 'extension-page-found.png' });
          
          // Check if this is the popup
          const title = await extPage.title();
          console.log('Extension page title:', title);
          
          // Look for extension elements
          const buttons = await extPage.$$('button');
          console.log(`Found ${buttons.length} buttons`);
          
          for (let btn of buttons) {
            const text = await btn.textContent();
            console.log(`Button: "${text}"`);
            
            if (text && (text.includes('Sign') || text.includes('Capture'))) {
              console.log(`🎯 Found relevant button: ${text}`);
              
              if (text.includes('Capture')) {
                console.log('🎬 Attempting recipe capture...');
                
                // Monitor for API calls
                const apiPromise = extPage.waitForResponse(
                  res => res.url().includes('/api/recipes'),
                  { timeout: 10000 }
                ).catch(() => console.log('No API call detected'));
                
                await btn.click();
                await apiPromise;
              }
            }
          }
        }
      }
      
      // If no extension page found, try other approaches
      if (!allPages.some(p => p.url().includes('chrome-extension://'))) {
        console.log('⚠️ No extension pages found');
        console.log('💡 This might mean:');
        console.log('   - Extension not properly loaded');
        console.log('   - Extension popup not opened');
        console.log('   - Extension requires user interaction');
        
        // Try to trigger extension through page context
        console.log('🔄 Trying to trigger extension from page context...');
        
        // Look for any injected extension content
        const extensionElements = await page.$$('[data-extension-id]');
        console.log(`Found ${extensionElements.length} extension elements`);
        
        // Check if extension content script is loaded
        const hasExtensionScript = await page.evaluate(() => {
          // Look for any global variables that might indicate extension presence
          return window.recipeArchiveExtension !== undefined;
        });
        
        console.log('Extension script detected:', hasExtensionScript);
      }
      
    } catch (error) {
      console.log('❌ Error accessing extension:', error.message);
      await page.screenshot({ path: 'extension-access-error.png' });
    }
    
    await popupPage.close();
    console.log('✅ Extension test completed');
  });
});
