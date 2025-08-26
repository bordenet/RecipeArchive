const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Loading Diagnostics', () => {
  test('Diagnose extension loading issues', async () => {
    console.log('🔍 Diagnosing Chrome extension loading...');
    
    const EXTENSION_PATH = path.resolve(__dirname, '../../../extensions/chrome');
    console.log('📁 Extension path:', EXTENSION_PATH);
    
    // Launch browser with detailed logging
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--enable-logging',
        '--log-level=0',
        '--disable-web-security'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to a test page and wait
    await page.goto('chrome://version/');
    await page.waitForTimeout(5000);
    
    // Check console for errors
    const logs = [];
    page.on('console', msg => {
      logs.push(`${msg.type()}: ${msg.text()}`);
      console.log(`🖥️ Browser console [${msg.type()}]: ${msg.text()}`);
    });
    
    // Try to access extensions page (this might fail but we'll see why)
    try {
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(3000);
      console.log('✅ Extensions page accessible');
      
      // Take screenshot of extensions page
      await page.screenshot({ path: 'extensions-page.png' });
      
    } catch (error) {
      console.log('❌ Extensions page error:', error.message);
    }
    
    // Get all pages to see what's loaded
    const allPages = await context.pages();
    console.log(`📄 Total pages: ${allPages.length}`);
    
    for (let i = 0; i < allPages.length; i++) {
      const pageUrl = allPages[i].url();
      console.log(`   Page ${i}: ${pageUrl}`);
    }
    
    // Check background pages specifically
    const bgPages = await context.backgroundPages();
    console.log(`🔧 Background pages: ${bgPages.length}`);
    
    // Try to navigate to popup directly if we can figure out the extension ID
    try {
      // List of possible extension IDs (Chrome generates them)
      // We can try some common test patterns
      const testPage = await context.newPage();
      
      // Try to access the popup HTML file directly from file system
      const popupHtmlPath = path.join(EXTENSION_PATH, 'popup.html');
      console.log('🔗 Testing popup HTML access...');
      
      await testPage.goto(`file://${popupHtmlPath}`);
      await testPage.waitForTimeout(2000);
      
      console.log('✅ Popup HTML loads from file system');
      await testPage.screenshot({ path: 'popup-from-file.png' });
      
      // Check if JavaScript loads
      const hasConfig = await testPage.evaluate(() => {
        return typeof window.CONFIG !== 'undefined';
      });
      console.log('📦 CONFIG loaded:', hasConfig);
      
      await testPage.close();
      
    } catch (fileError) {
      console.log('❌ File access error:', fileError.message);
    }
    
    console.log('📋 Console logs captured:', logs.length);
    
    await browser.close();
    console.log('✅ Diagnostic complete');
  });
});
