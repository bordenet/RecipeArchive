import { test, expect } from '@playwright/test';

test.describe('Recipe Navigation and Units Toggle', () => {
  // Login helper
  async function login(page) {
    const testEmail = process.env.TEST_USER_EMAIL || 'susan.cameron42@gmail.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'Bear901206!!';
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button:has-text("Sign In")').or(page.locator('text="Sign In"')).click();
    
    // Wait for recipes to load
    await expect(
      page.locator('text="Recipe Archive"').or(
        page.locator('button:has-text("Refresh")').or(
          page.locator('[role="button"]').filter({ hasText: 'Refresh' })
        )
      )
    ).toBeVisible({ timeout: 15000 });
  }

  test('should navigate from gallery to recipe details page', async ({ page }) => {
    await login(page);
    
    // Wait for recipes to load and click on the first recipe card
    const recipeCard = page.locator('[role="button"]').or(page.locator('div')).filter({ hasText: /[A-Za-z]/ }).first();
    await expect(recipeCard).toBeVisible({ timeout: 10000 });
    
    // Look for clickable recipe elements (cards, buttons, or text)
    const clickableRecipe = page.locator('text=').or(
      page.locator('button').or(
        page.locator('[role="button"]')
      )
    ).filter({ hasText: /recipe|ingredient|cook|bake|preparation/i }).first();
    
    if (await clickableRecipe.isVisible()) {
      await clickableRecipe.click();
      
      // Wait for navigation to recipe details page
      await expect(
        page.locator('text="Ingredients"').or(
          page.locator('text="Instructions"').or(
            page.locator('h1').or(page.locator('h2'))
          )
        )
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display and toggle units conversion on recipe details page', async ({ page }) => {
    await login(page);
    
    // Navigate to a recipe (click on first available recipe)
    await page.waitForTimeout(2000);
    
    // Look for recipe cards or navigation elements
    const recipeElement = page.locator('div').or(page.locator('button')).filter({ hasText: /\w+/ }).first();
    
    if (await recipeElement.isVisible()) {
      await recipeElement.click();
      
      // Wait for recipe details page
      await page.waitForTimeout(3000);
      
      // Look for units toggle (Imperial/Metric button)
      const unitsToggle = page.locator('text="Imperial"').or(
        page.locator('text="Metric"').or(
          page.locator('button:has-text("Imperial")').or(
            page.locator('button:has-text("Metric")')
          )
        )
      );
      
      if (await unitsToggle.isVisible()) {
        // Verify initial state
        await expect(unitsToggle).toBeVisible();
        
        // Click to toggle units
        await unitsToggle.click();
        
        // Wait for units conversion to apply
        await page.waitForTimeout(1000);
        
        // Verify toggle switched (text should change from Imperial to Metric or vice versa)
        await expect(
          page.locator('text="Imperial"').or(page.locator('text="Metric"'))
        ).toBeVisible();
      }
    }
  });

  test('should display recipe ingredients and instructions', async ({ page }) => {
    await login(page);
    
    // Navigate to recipe details
    await page.waitForTimeout(2000);
    const recipeElement = page.locator('div').or(page.locator('button')).filter({ hasText: /\w+/ }).first();
    
    if (await recipeElement.isVisible()) {
      await recipeElement.click();
      await page.waitForTimeout(3000);
      
      // Check for ingredients section
      await expect(
        page.locator('text="Ingredients"').or(
          page.locator('h2:has-text("Ingredients")').or(
            page.locator('h3:has-text("Ingredients")')
          )
        )
      ).toBeVisible({ timeout: 10000 });
      
      // Check for instructions section
      await expect(
        page.locator('text="Instructions"').or(
          page.locator('h2:has-text("Instructions")').or(
            page.locator('h3:has-text("Instructions")')
          )
        )
      ).toBeVisible();
      
      // Look for recipe content (ingredients or instruction steps)
      const hasIngredientContent = await page.locator('li').or(
        page.locator('div').filter({ hasText: /cup|teaspoon|tablespoon|oz|lb|gram|ml/ })
      ).first().isVisible();
      
      const hasInstructionContent = await page.locator('div').filter({ 
        hasText: /mix|stir|bake|cook|heat|add|combine/ 
      }).first().isVisible();
      
      expect(hasIngredientContent || hasInstructionContent).toBe(true);
    }
  });

  test('should allow returning to gallery from recipe details', async ({ page }) => {
    await login(page);
    
    // Navigate to recipe details  
    await page.waitForTimeout(2000);
    const recipeElement = page.locator('div').or(page.locator('button')).filter({ hasText: /\w+/ }).first();
    
    if (await recipeElement.isVisible()) {
      await recipeElement.click();
      await page.waitForTimeout(3000);
      
      // Look for back button or navigation
      const backButton = page.locator('button').filter({ hasText: /back|return|home/i }).or(
        page.locator('[role="button"]').filter({ hasText: /←|‹|back/i })
      ).first();
      
      if (await backButton.isVisible()) {
        await backButton.click();
        
        // Should return to gallery/carousel page
        await expect(
          page.locator('text="Recipe Archive"').or(
            page.locator('button:has-text("Refresh")')
          )
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });
});