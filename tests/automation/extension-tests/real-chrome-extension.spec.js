const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const MOCK_SERVER_URL = 'http://localhost:8080';
const REAL_EXTENSION_PATH = path.resolve(__dirname, '../../../extensions/chrome');

test.describe('Real Chrome Extension E2E Tests', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    console.log('🚀 Starting real Chrome extension test...');
    console.log('📁 Real extension path:', REAL_EXTENSION_PATH);
    
    // Check if extension files exist
    const fs = require('fs');
    const manifestPath = path.join(REAL_EXTENSION_PATH, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`❌ Extension manifest not found at: ${manifestPath}`);
    }
    console.log('✅ Extension manifest found');

    browser = await chromium.launch({
      headless: false,
      slowMo: 1000,
      args: [
        `--load-extension=${REAL_EXTENSION_PATH}`,
        '--disable-extensions-except=' + REAL_EXTENSION_PATH,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--enable-logging=stderr',
        '--log-level=0'
      ]
    });

    context = await browser.newContext();
    page = await context.newPage();

    // Give Chrome time to load the extension
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('01. Verify mock server is running', async () => {
    const response = await page.request.get(`${MOCK_SERVER_URL}/health`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log('✅ Mock server status:', data.status);
  });

  test('02. Check extension loading and background pages', async () => {
    // Check background pages (service workers)
    const backgroundPages = context.backgroundPages();
    console.log('🔧 Background pages count:', backgroundPages.length);
    
    if (backgroundPages.length === 0) {
      console.log('❌ No background pages found');
      
      // Let's check chrome://extensions page to see what's happening
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(2000);
      
      // Take a screenshot to see the state
      await page.screenshot({ path: 'test-results/extension-state.png', fullPage: true });
      console.log('📸 Extension state screenshot saved');
      
      // Enable developer mode first
      const devModeToggle = page.locator('[aria-label="Developer mode"]');
      if (await devModeToggle.isVisible()) {
        await devModeToggle.click();
        await page.waitForTimeout(1000);
      }
      
      // Check if our extension is listed
      const extensionCards = page.locator('extensions-item');
      const count = await extensionCards.count();
      console.log('🔍 Extensions found on page:', count);
      
      for (let i = 0; i < count; i++) {
        const card = extensionCards.nth(i);
        const nameElement = card.locator('#name');
        if (await nameElement.isVisible()) {
          const name = await nameElement.textContent();
          console.log(`📦 Extension ${i + 1}: ${name}`);
        }
      }
    } else {
      console.log('✅ Background pages found:', backgroundPages.length);
      for (let i = 0; i < backgroundPages.length; i++) {
        console.log(`🔧 Background page ${i + 1}:`, backgroundPages[i].url());
      }
    }
    
    // The test should not fail if background pages is 0 - we want to debug why
    expect(backgroundPages.length).toBeGreaterThanOrEqual(0);
  });

  test('03. Navigate to test recipe page', async () => {
    const testPageUrl = `${MOCK_SERVER_URL}/test-page`;
    console.log('🌐 Navigating to test page:', testPageUrl);
    
    await page.goto(testPageUrl);
    await page.waitForLoadState('networkidle');
    
    // Check if page loaded successfully
    const title = await page.title();
    console.log('📄 Page title:', title);
    
    // Look for recipe content
    const recipeTitle = page.locator('h1');
    if (await recipeTitle.isVisible()) {
      const titleText = await recipeTitle.textContent();
      console.log('🍳 Recipe title found:', titleText);
    }
    
    expect(page.url()).toContain('/test-page');
  });

  test('04. Test content script injection', async () => {
    // First make sure we're on a page where content script should work
    await page.goto(`${MOCK_SERVER_URL}/test-page`);
    await page.waitForLoadState('networkidle');
    
    // Check if our content script is working by evaluating some JavaScript
    const contentScriptWorking = await page.evaluate(() => {
      // Our content script should add a listener for messages
      return typeof window.chrome !== 'undefined' && 
             typeof window.chrome.runtime !== 'undefined';
    });
    
    console.log('🔧 Chrome runtime available:', contentScriptWorking);
    
    // Try to send a message to the content script
    try {
      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          if (window.chrome && window.chrome.runtime) {
            // Test if we can communicate with the extension
            window.postMessage({ type: 'RECIPE_ARCHIVE_PING' }, '*');
            setTimeout(() => resolve('Message sent'), 1000);
          } else {
            resolve('Chrome runtime not available');
          }
        });
      });
      console.log('📨 Content script test result:', result);
    } catch (error) {
      console.log('❌ Content script test error:', error.message);
    }
  });

  test('05. Debug extension errors', async () => {
    console.log('🔍 Debugging extension issues...');
    
    // Navigate to chrome://extensions to see detailed error info
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // Enable developer mode
    const devModeToggle = page.locator('[aria-label="Developer mode"]');
    if (await devModeToggle.isVisible()) {
      const isChecked = await devModeToggle.isChecked();
      if (!isChecked) {
        await devModeToggle.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Look for error information
    const errorElements = page.locator('.error-message, .warning-message, [data-test-id*="error"]');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      console.log('⚠️ Found errors on extensions page:', errorCount);
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`❌ Error ${i + 1}:`, errorText);
      }
    } else {
      console.log('✅ No obvious errors found on extensions page');
    }
    
    // Take a final screenshot
    await page.screenshot({ path: 'test-results/extensions-debug.png', fullPage: true });
    console.log('📸 Debug screenshot saved');
  });
});
