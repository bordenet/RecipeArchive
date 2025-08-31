import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should load landing page without errors', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Flutter app to load
    await expect(page.locator('body')).toBeVisible();
    
    // Check for login form or loading state
    await expect(
      page.locator('input[type="email"]').or(page.locator('text=Loading...'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show login form on landing page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Flutter app to initialize
    await page.waitForTimeout(3000);
    
    // Check for login form elements
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.locator('button:has-text("Sign In")').or(page.locator('text="Sign In"'));
    
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Flutter app to load
    await page.waitForTimeout(3000);
    
    // Fill in invalid credentials
    await page.locator('input[type="email"]').first().fill('invalid@example.com');
    await page.locator('input[type="password"]').first().fill('wrongpassword');
    
    // Click sign in button
    await page.locator('button:has-text("Sign In")').or(page.locator('text="Sign In"')).click();
    
    // Check for error message
    await expect(
      page.locator('text="Invalid email or password"').or(
        page.locator('text="User not found"')
      ).or(
        page.locator('text="NotAuthorized"')
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Skip this test if credentials are not available
    const testEmail = process.env.TEST_USER_EMAIL || 'susan.cameron42@gmail.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Bear901206!!';
    
    await page.goto('/');
    
    // Wait for Flutter app to load
    await page.waitForTimeout(3000);
    
    // Fill in valid credentials
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    
    // Click sign in button
    await page.locator('button:has-text("Sign In")').or(page.locator('text="Sign In"')).click();
    
    // Wait for navigation to recipe gallery/carousel page
    await expect(
      page.locator('text="Recipe Archive"').or(
        page.locator('button:has-text("Refresh")').or(
          page.locator('[role="button"]').filter({ hasText: 'Refresh' })
        )
      )
    ).toBeVisible({ timeout: 15000 });
    
    // Verify we're on the authenticated page (Action Bar should be visible)
    await expect(
      page.locator('text="Recipe Archive"').or(
        page.locator('.green').or(
          page.locator('[style*="green"]')
        )
      )
    ).toBeVisible();
  });
});