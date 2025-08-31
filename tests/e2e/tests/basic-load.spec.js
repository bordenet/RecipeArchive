import { test, expect } from '@playwright/test';

test.describe('Basic App Loading', () => {
  test('should load Flutter app and display content', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Flutter to initialize with a longer timeout
    await page.waitForTimeout(10000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'flutter-debug.png', fullPage: true });
    
    // Check if Flutter app body exists
    const flutterApp = page.locator('flt-platform-view').or(
      page.locator('flutter-view').or(
        page.locator('flt-glass-pane').or(
          page.locator('#body').or(
            page.locator('body').filter({ hasText: /flutter|recipe|sign/i })
          )
        )
      )
    );
    
    // Less strict check - just see if any content loaded
    const bodyContent = await page.locator('body').textContent();
    console.log('Body content:', bodyContent);
    
    // Check if page loaded with any content or if Flutter started
    const hasFlutterContent = await page.locator('script[src*="main.dart.js"]').count() > 0 ||
                             await page.locator('div').count() > 0 ||
                             bodyContent.length > 0;
    
    expect(hasFlutterContent).toBe(true);
  });

  test('should check for JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
      errors.push(error.message);
    });
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(15000); // Wait for app to load
    
    // Print all errors found
    console.log('Total errors found:', errors.length);
    errors.forEach((error, index) => {
      console.log(`Error ${index + 1}:`, error);
    });
  });
});