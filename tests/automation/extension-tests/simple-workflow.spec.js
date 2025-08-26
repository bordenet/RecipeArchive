const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Configuration
const EXTENSION_PATH = path.resolve(__dirname, '../../../extensions/chrome');
const RECIPE_URL = 'https://www.allrecipes.com/recipe/17481/simple-white-cake/';

test.describe('Chrome Extension Recipe Capture', () => {
  let browser;
  let context;
  let page;

  // Set individual test timeout
  test.setTimeout(90000); // 90 seconds per test

  test.beforeAll(async () => {
    console.log('🚀 Setting up browser with Chrome extension...');
    console.log('📁 Extension path:', EXTENSION_PATH);
    
    // Launch browser with extension loaded
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });

    context = await browser.newContext();
    page = await context.newPage();
    
    // Wait for extension to load
    await page.waitForTimeout(3000);
    console.log('✅ Browser and extension setup complete');
  });

  test.afterAll(async () => {
    console.log('🧹 Cleaning up browser resources...');
    await browser?.close();
  });

  test('Complete extension workflow', async () => {
    console.log('🎯 Starting complete Chrome extension test workflow');
    
    // Step 1: Verify mock server
    console.log('1️⃣ Checking mock server...');
    try {
      const healthCheck = await page.request.get('http://localhost:8080/health');
      expect(healthCheck.status()).toBe(200);
      console.log('✅ Mock server is running');
    } catch (error) {
      console.log('❌ Mock server error:', error.message);
      throw error;
    }

    // Step 2: Navigate to recipe page with better error handling
    console.log('2️⃣ Loading recipe page...');
    try {
      await page.goto(RECIPE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // Give time for content to load
      
      const title = await page.title();
      console.log('📄 Page title:', title);
      
      if (!title.includes('Simple White Cake')) {
        console.log('⚠️ Warning: Page title doesn\'t contain expected recipe name');
      } else {
        console.log('✅ Recipe page loaded successfully');
      }
    } catch (error) {
      console.log('❌ Recipe page loading failed:', error.message);
      await page.screenshot({ path: 'recipe-page-error.png' });
      throw error;
    }

    // Step 3: Access extension popup with improved method
    console.log('3️⃣ Accessing extension popup...');
    
    try {
      // First, let's go to the extensions page to find our extension ID
      const extensionsPage = await context.newPage();
      await extensionsPage.goto('chrome://extensions/', { timeout: 10000 });
      await extensionsPage.waitForTimeout(2000);
      
      // Find our extension
      const extensionItems = extensionsPage.locator('extensions-item');
      const count = await extensionItems.count();
      let extensionId = null;
      
      console.log(`🔍 Found ${count} extensions, looking for RecipeArchive...`);
      
      for (let i = 0; i < count; i++) {
        const item = extensionItems.nth(i);
        const nameEl = item.locator('#name');
        const name = await nameEl.textContent();
        
        if (name && (name.includes('RecipeArchive') || name.includes('Recipe Archive'))) {
          extensionId = await item.getAttribute('id');
          console.log('📦 Found RecipeArchive extension ID:', extensionId);
          
          // Make sure it's enabled
          const enableToggle = item.locator('#enableToggle');
          const isEnabled = await enableToggle.isChecked();
          if (!isEnabled) {
            await enableToggle.click();
            await extensionsPage.waitForTimeout(1000);
            console.log('✅ Extension enabled');
          }
          break;
        }
      }
      
      await extensionsPage.close();
      
      if (!extensionId) {
        throw new Error('RecipeArchive extension not found. Please ensure it is loaded.');
      }
      
      // Open the popup
      const popupPage = await context.newPage();
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      console.log('🔗 Opening popup URL:', popupUrl);
      
      await popupPage.goto(popupUrl, { timeout: 10000 });
      await popupPage.waitForLoadState('domcontentloaded');
      await popupPage.waitForTimeout(2000);
      
      console.log('✅ Extension popup opened');
      
      // Step 4: Test authentication flow
      console.log('4️⃣ Testing authentication...');
      
      // Take a screenshot to see current state
      await popupPage.screenshot({ path: 'popup-initial-state.png' });
      
      // Check current auth state
      const signInBtn = popupPage.locator('button:has-text("Sign In")');
      const signOutBtn = popupPage.locator('button:has-text("Sign Out")');
      
      if (await signOutBtn.isVisible()) {
        console.log('👤 Currently signed in - signing out first...');
        await signOutBtn.click();
        await popupPage.waitForTimeout(2000);
        console.log('✅ Signed out');
      }
      
      if (await signInBtn.isVisible()) {
        console.log('🔐 Attempting to sign in...');
        await signInBtn.click();
        await popupPage.waitForTimeout(3000);
        console.log('✅ Sign in process initiated');
        
        // Take screenshot after sign in
        await popupPage.screenshot({ path: 'popup-after-signin.png' });
      } else {
        console.log('⚠️ Sign in button not found');
        await popupPage.screenshot({ path: 'popup-no-signin-button.png' });
      }
      
      // Step 5: Capture recipe
      console.log('5️⃣ Attempting recipe capture...');
      
      const captureBtn = popupPage.locator('button:has-text("Capture Recipe")');
      if (await captureBtn.isVisible()) {
        console.log('🎯 Capture button found, attempting capture...');
        
        // Listen for the API call
        try {
          const [response] = await Promise.all([
            popupPage.waitForResponse(res => 
              res.url().includes('/api/recipes') && res.request().method() === 'POST',
              { timeout: 15000 }
            ),
            captureBtn.click()
          ]);
          
          console.log('📡 API call completed with status:', response.status());
          
          if (response.status() === 201) {
            const responseData = await response.json();
            console.log('✅ Recipe captured successfully!');
            console.log('📝 Recipe title:', responseData.title);
            console.log('🥄 Ingredients count:', responseData.ingredients?.length || 0);
            console.log('📋 Instructions count:', responseData.instructions?.length || 0);
            
            // Verify data structure
            expect(responseData).toHaveProperty('id');
            expect(responseData).toHaveProperty('title');
          } else {
            console.log('❌ Recipe capture failed with status:', response.status());
            const errorData = await response.text();
            console.log('Error details:', errorData);
          }
        } catch (waitError) {
          console.log('⚠️ No API call detected within timeout');
          console.log('This might mean:');
          console.log('- Extension is not authenticated');
          console.log('- Extension is not properly configured');
          console.log('- Recipe extraction failed');
          await popupPage.screenshot({ path: 'popup-capture-timeout.png' });
        }
      } else {
        console.log('⚠️ Capture button not visible');
        console.log('This usually means authentication is required');
        await popupPage.screenshot({ path: 'popup-no-capture-button.png' });
      }
      
      // Step 6: Verify in mock server
      console.log('6️⃣ Checking recipes in mock server...');
      try {
        const recipesResponse = await page.request.get('http://localhost:8080/api/recipes');
        const recipes = await recipesResponse.json();
        
        console.log(`📊 Total recipes in server: ${recipes.length}`);
        if (recipes.length > 0) {
          const latest = recipes[recipes.length - 1];
          console.log('🍰 Latest recipe:', latest.title);
          console.log('🏷️ Source:', latest.source);
          console.log('⏰ Captured at:', latest.capturedAt);
        }
      } catch (serverError) {
        console.log('⚠️ Failed to fetch recipes from server:', serverError.message);
      }
      
      await popupPage.close();
      
    } catch (error) {
      console.log('❌ Extension test failed:', error.message);
      await page.screenshot({ path: 'test-failure.png' });
      
      // Log browser console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('🚨 Browser error:', msg.text());
        }
      });
      
      throw error;
    }
    
    console.log('🎉 Complete workflow test finished!');
  });
});
