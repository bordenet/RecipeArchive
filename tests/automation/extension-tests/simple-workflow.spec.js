const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Configuration
const EXTENSION_PATH = path.resolve(__dirname, '../../../extensions/chrome');
const RECIPE_URL = 'https://www.allrecipes.com/recipe/17481/simple-white-cake/';

test.describe('Chrome Extension Recipe Capture', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Launch browser with extension loaded
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
    await browser?.close();
  });

  test('Complete extension workflow', async () => {
    console.log('🎯 Starting complete Chrome extension test workflow');
    
    // Step 1: Verify mock server
    console.log('1️⃣ Checking mock server...');
    const healthCheck = await page.request.get('http://localhost:8080/health');
    expect(healthCheck.status()).toBe(200);
    console.log('✅ Mock server is running');

    // Step 2: Navigate to recipe page
    console.log('2️⃣ Loading recipe page...');
    await page.goto(RECIPE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give time for recipe data to load
    
    const title = await page.title();
    expect(title).toContain('Simple White Cake');
    console.log('✅ Recipe page loaded:', title);

    // Step 3: Access extension popup
    console.log('3️⃣ Accessing extension popup...');
    
    // Get all pages (including extension pages)
    const pages = await context.pages();
    console.log(`Current pages: ${pages.length}`);
    
    // Try to open extension popup by ID (we'll need to find the extension ID)
    try {
      // First, let's go to the extensions page to find our extension ID
      const extensionsPage = await context.newPage();
      await extensionsPage.goto('chrome://extensions/');
      await extensionsPage.waitForTimeout(2000);
      
      // Find our extension
      const extensionItems = extensionsPage.locator('extensions-item');
      const count = await extensionItems.count();
      let extensionId = null;
      
      for (let i = 0; i < count; i++) {
        const item = extensionItems.nth(i);
        const nameEl = item.locator('#name');
        const name = await nameEl.textContent();
        if (name && name.includes('RecipeArchive')) {
          extensionId = await item.getAttribute('id');
          console.log('📦 Found extension ID:', extensionId);
          break;
        }
      }
      
      await extensionsPage.close();
      
      if (!extensionId) {
        throw new Error('Extension not found - may need manual loading');
      }
      
      // Open the popup
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForLoadState('domcontentloaded');
      await popupPage.waitForTimeout(2000);
      
      console.log('✅ Extension popup opened');
      
      // Step 4: Test authentication flow
      console.log('4️⃣ Testing authentication...');
      
      // Check current auth state
      const signInBtn = popupPage.locator('button:has-text("Sign In")');
      const signOutBtn = popupPage.locator('button:has-text("Sign Out")');
      
      if (await signOutBtn.isVisible()) {
        console.log('👤 Currently signed in - signing out first...');
        await signOutBtn.click();
        await popupPage.waitForTimeout(1000);
      }
      
      if (await signInBtn.isVisible()) {
        console.log('🔐 Signing in...');
        await signInBtn.click();
        await popupPage.waitForTimeout(3000);
        console.log('✅ Sign in completed');
      }
      
      // Step 5: Capture recipe
      console.log('5️⃣ Capturing recipe...');
      
      const captureBtn = popupPage.locator('button:has-text("Capture Recipe")');
      if (await captureBtn.isVisible()) {
        // Listen for the API call
        const [response] = await Promise.all([
          popupPage.waitForResponse(res => 
            res.url().includes('/api/recipes') && res.request().method() === 'POST',
            { timeout: 10000 }
          ),
          captureBtn.click()
        ]);
        
        console.log('📡 API call made:', response.status());
        
        if (response.status() === 201) {
          const responseData = await response.json();
          console.log('✅ Recipe captured successfully!');
          console.log('📝 Recipe title:', responseData.title);
          console.log('🥄 Ingredients count:', responseData.ingredients?.length || 0);
          console.log('📋 Instructions count:', responseData.instructions?.length || 0);
          
          // Verify data structure
          expect(responseData).toHaveProperty('id');
          expect(responseData).toHaveProperty('title');
          expect(responseData.title).toContain('White Cake');
        } else {
          console.log('❌ Recipe capture failed with status:', response.status());
          const errorData = await response.text();
          console.log('Error details:', errorData);
        }
      } else {
        console.log('⚠️ Capture button not visible');
        await popupPage.screenshot({ path: 'popup-state.png' });
      }
      
      // Step 6: Verify in mock server
      console.log('6️⃣ Verifying data in mock server...');
      const recipesResponse = await page.request.get('http://localhost:8080/api/recipes');
      const recipes = await recipesResponse.json();
      
      console.log(`📊 Total recipes in server: ${recipes.length}`);
      if (recipes.length > 0) {
        const latest = recipes[recipes.length - 1];
        console.log('🍰 Latest recipe:', latest.title);
        console.log('🏷️ Source:', latest.source);
        console.log('⏰ Captured at:', latest.capturedAt);
      }
      
      await popupPage.close();
      
    } catch (error) {
      console.log('❌ Extension test failed:', error.message);
      await page.screenshot({ path: 'test-failure.png' });
      throw error;
    }
    
    console.log('🎉 Complete workflow test finished!');
  });
});
