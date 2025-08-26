const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Test configuration
const EXTENSION_PATH = path.resolve(__dirname, '../../../extensions/chrome');
const TEST_RECIPE_URL = 'https://www.allrecipes.com/recipe/17481/simple-white-cake/';
const MOCK_SERVER_URL = 'http://localhost:8080';

test.describe('Chrome Extension E2E Tests', () => {
  let browser;
  let context;
  let page;
  let extensionId;

  test.beforeAll(async () => {
    // Verify extension files exist
    const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Extension manifest not found at ${manifestPath}`);
    }

    // Launch browser with extension support
    browser = await chromium.launch({
      headless: false, // Must be false for extension testing
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    context = await browser.newContext();
    page = await context.newPage();

    // Wait a moment for extension to load
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('01. Verify mock server is running', async () => {
    const response = await page.request.get(`${MOCK_SERVER_URL}/health`);
    expect(response.status()).toBe(200);
    console.log('✅ Mock server is running');
  });

  test('02. Load and configure Chrome extension', async () => {
    // Navigate to extensions page
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(1000);

    // Enable Developer mode if not already enabled
    const devModeToggle = page.locator('#devMode');
    const isDevModeEnabled = await devModeToggle.isChecked();
    if (!isDevModeEnabled) {
      await devModeToggle.click();
      await page.waitForTimeout(500);
    }

    // Look for our extension
    const extensionCards = page.locator('extensions-item');
    const count = await extensionCards.count();
    
    let foundExtension = false;
    for (let i = 0; i < count; i++) {
      const card = extensionCards.nth(i);
      const nameElement = card.locator('#name');
      const name = await nameElement.textContent();
      
      if (name && name.includes('RecipeArchive')) {
        foundExtension = true;
        console.log('✅ RecipeArchive extension found');
        
        // Get extension ID for later use
        const cardId = await card.getAttribute('id');
        extensionId = cardId;
        
        // Ensure extension is enabled
        const toggleButton = card.locator('#enableToggle');
        const isEnabled = await toggleButton.isChecked();
        if (!isEnabled) {
          await toggleButton.click();
          await page.waitForTimeout(500);
        }
        break;
      }
    }

    if (!foundExtension) {
      // If extension not found, try to load it manually
      console.log('⚠️ Extension not found, attempting to load manually...');
      
      const loadUnpackedButton = page.locator('text=Load unpacked');
      if (await loadUnpackedButton.isVisible()) {
        await loadUnpackedButton.click();
        
        // This would open file dialog - in real automation, we'd need to handle this
        // For now, we'll assume the extension is already loaded
        console.log('🚨 Manual intervention needed: Please load the extension manually');
        throw new Error('Extension not auto-loaded. Manual loading required.');
      }
    }

    expect(foundExtension).toBe(true);
  });

  test('03. Navigate to recipe page and wait for load', async () => {
    await page.goto(TEST_RECIPE_URL);
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify we're on the right page
    const pageTitle = await page.title();
    expect(pageTitle).toContain('Simple White Cake');
    console.log('✅ Recipe page loaded successfully');
  });

  test('04. Test extension popup and authentication flow', async () => {
    // Click on extension icon in toolbar
    // Note: This is tricky with Playwright - extension icons aren't easily accessible
    // We'll try to find the extension popup by looking for the extension context
    
    const extensions = await context.backgroundPages();
    console.log(`Found ${extensions.length} background pages`);
    
    // Try to open extension popup programmatically
    const extensionPopup = await context.newPage();
    
    try {
      // Navigate to extension popup (this requires knowing the extension ID)
      // In a real scenario, we'd extract this from the extension management page
      await extensionPopup.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Wait for popup to load
      await extensionPopup.waitForLoadState('domcontentloaded');
      await extensionPopup.waitForTimeout(1000);
      
      console.log('✅ Extension popup opened');
      
      // Test sign out functionality (if signed in)
      const signOutButton = extensionPopup.locator('text=Sign Out');
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        await extensionPopup.waitForTimeout(1000);
        console.log('✅ Signed out successfully');
      }
      
      // Test sign in functionality
      const signInButton = extensionPopup.locator('text=Sign In');
      if (await signInButton.isVisible()) {
        await signInButton.click();
        await extensionPopup.waitForTimeout(2000);
        console.log('✅ Sign in initiated');
      }
      
      // Test recipe capture
      const captureButton = extensionPopup.locator('text=Capture Recipe');
      if (await captureButton.isVisible()) {
        // Set up network monitoring to catch the API call
        const [response] = await Promise.all([
          extensionPopup.waitForResponse(response => 
            response.url().includes('/api/recipes') && response.request().method() === 'POST'
          ),
          captureButton.click()
        ]);
        
        expect(response.status()).toBe(201);
        const responseBody = await response.json();
        
        console.log('✅ Recipe captured successfully');
        console.log('📝 Response:', JSON.stringify(responseBody, null, 2));
        
        // Verify recipe data structure
        expect(responseBody).toHaveProperty('id');
        expect(responseBody).toHaveProperty('title');
        expect(responseBody).toHaveProperty('ingredients');
        expect(responseBody).toHaveProperty('instructions');
        
      } else {
        console.log('⚠️ Capture button not visible - may need authentication');
      }
      
    } catch (error) {
      console.log('⚠️ Extension popup test failed:', error.message);
      // Take screenshot for debugging
      await extensionPopup.screenshot({ path: 'extension-popup-error.png' });
      throw error;
    }
  });

  test('05. Verify recipe data in mock server', async () => {
    // Fetch recipes from mock server
    const response = await page.request.get(`${MOCK_SERVER_URL}/api/recipes`);
    expect(response.status()).toBe(200);
    
    const recipes = await response.json();
    console.log('📊 Recipes in mock server:', recipes.length);
    
    if (recipes.length > 0) {
      const latestRecipe = recipes[recipes.length - 1];
      console.log('🍰 Latest recipe:', latestRecipe.title);
      
      // Verify recipe contains expected data
      expect(latestRecipe).toHaveProperty('title');
      expect(latestRecipe).toHaveProperty('ingredients');
      expect(latestRecipe).toHaveProperty('instructions');
      expect(latestRecipe.source).toBe('chrome-extension');
    }
  });
});

// Helper test for manual debugging
test.describe('Debug Helpers', () => {
  test('Debug: List all extensions', async () => {
    const browser = await chromium.launch({
      headless: false,
      args: [`--load-extension=${EXTENSION_PATH}`]
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // List all extensions
    const extensions = page.locator('extensions-item');
    const count = await extensions.count();
    
    console.log(`Found ${count} extensions:`);
    for (let i = 0; i < count; i++) {
      const extension = extensions.nth(i);
      const name = await extension.locator('#name').textContent();
      const id = await extension.getAttribute('id');
      console.log(`- ${name} (ID: ${id})`);
    }
    
    await browser.close();
  });
});
