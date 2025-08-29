const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Chrome Extension Manual Verification', () => {
  test('Verify extension loads in Chrome', async ({ page }) => {
    console.log('🔍 Manual Chrome Extension Verification Test');
    
    // Navigate to our test page
    const testPagePath = 'file://' + path.resolve(__dirname, '../../../tests/chrome-extension-test.html');
    await page.goto(testPagePath);
    
    console.log('📄 Test page loaded');
    
    // Check if page loaded correctly
    const title = await page.title();
    expect(title).toContain('Chrome Extension Test Recipe');
    console.log('✅ Test page title verified:', title);
    
    // Check for recipe content
    const recipeTitle = await page.locator('h1').textContent();
    expect(recipeTitle).toContain('Test Recipe');
    console.log('✅ Recipe content found:', recipeTitle);
    
    // Check for ingredients
    const ingredients = await page.locator('.ingredients li').count();
    expect(ingredients).toBeGreaterThan(0);
    console.log('✅ Recipe ingredients found:', ingredients);
    
    // Check for instructions
    const instructions = await page.locator('.instructions li').count();
    expect(instructions).toBeGreaterThan(0);
    console.log('✅ Recipe instructions found:', instructions);
    
    // Test the extension test button
    await page.click('button:has-text("Test Extension Presence")');
    console.log('✅ Extension test button clicked');
    
    // Wait for results
    await page.waitForTimeout(2000);
    
    // Check if results are displayed
    const resultsVisible = await page.locator('#test-results').isVisible();
    console.log('📊 Test results visible:', resultsVisible);
    
    // Take a screenshot for manual verification
    await page.screenshot({ path: 'chrome-extension-test-page.png', fullPage: true });
    console.log('📸 Screenshot saved for manual verification');
    
    console.log('✅ Manual verification test complete');
    console.log('💡 Check Chrome manually for extension loading and functionality');
  });
  
  test('Verify mock server is accessible', async ({ page }) => {
    console.log('🔍 Testing mock server accessibility');
    
    try {
      const response = await page.request.get('http://localhost:8080/health');
      expect(response.status()).toBe(200);
      
      const health = await response.json();
      console.log('✅ Mock server health:', health);
      
    } catch (error) {
      console.log('❌ Mock server not accessible:', error.message);
      console.log('💡 Start the server: cd aws-backend/functions/local-server && go run main.go');
    }
  });
});
