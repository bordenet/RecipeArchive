const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Chrome Args Testing', () => {
  test('Test different Chrome argument formats', async () => {
    console.log('🔍 Testing different Chrome argument formats...');
    
    const extensionPath = path.resolve(__dirname, '../../../extensions/chrome');
    console.log('📁 Extension path:', extensionPath);
    
    // Test method 1: Standard load-extension
    console.log('\n🧪 Test 1: Standard --load-extension');
    let context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        '--no-first-run'
      ]
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    let page = await context.newPage();
    await page.goto('chrome://extensions/');
    let extensionCount = await page.locator('extensions-item').count();
    console.log('📦 Extensions found (method 1):', extensionCount);
    await page.close();
    await context.close();
    
    // Test method 2: Disable all extensions except ours
    console.log('\n🧪 Test 2: Disable others, load ours');
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run'
      ]
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    page = await context.newPage();
    await page.goto('chrome://extensions/');
    extensionCount = await page.locator('extensions-item').count();
    console.log('📦 Extensions found (method 2):', extensionCount);
    await page.close();
    await context.close();
    
    // Test method 3: User data directory approach
    console.log('\n🧪 Test 3: Fresh user data directory');
    const userDataDir = '/tmp/chrome-test-profile';
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--disable-default-apps'
      ]
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    page = await context.newPage();
    await page.goto('chrome://extensions/');
    extensionCount = await page.locator('extensions-item').count();
    console.log('📦 Extensions found (method 3):', extensionCount);
    
    // Enable developer mode and take screenshot
    try {
      const devModeToggle = page.locator('#devMode input');
      if (await devModeToggle.isVisible()) {
        if (!(await devModeToggle.isChecked())) {
          await devModeToggle.click();
          await page.waitForTimeout(1000);
          console.log('✅ Developer mode enabled');
        }
      }
    } catch (error) {
      console.log('⚠️ Dev mode error:', error.message);
    }
    
    await page.screenshot({ path: 'chrome-args-test.png', fullPage: true });
    console.log('📸 Screenshot saved');
    
    await page.close();
    await context.close();
    
    console.log('✅ Chrome args testing complete');
  });
});
