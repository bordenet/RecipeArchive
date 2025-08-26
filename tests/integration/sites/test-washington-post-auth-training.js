#!/usr/bin/env node

/**
 * Washington Post Authentication Training
 *
 * Interactive script to train Playwright authentication with Washington Post
 * Run this with credentials to perfect the login process for automated testing
 */

const { chromium } = require('playwright');

async function trainWashingtonPostAuth() {
  console.log('🚀 Washington Post Authentication Training');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get credentials from environment
  const wapostUser = process.env.WAPOST_USERNAME;
  const wapostPass = process.env.WAPOST_PASSWORD;

  if (!wapostUser || !wapostPass) {
    console.log('❌ Missing credentials!');
    console.log('Set environment variables:');
    console.log('  WAPOST_USERNAME=your-email');
    console.log('  WAPOST_PASSWORD=your-password');
    return;
  }

  console.log(`📧 Username: ${wapostUser}`);
  console.log(`🔒 Password: ${'*'.repeat(wapostPass.length)}\n`);

  const browser = await chromium.launch({
    headless: false, // Keep visible so we can see what happens
    slowMo: 1000, // Slow down for debugging
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Step 1: Going to Washington Post homepage...');
    await page.goto('https://www.washingtonpost.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Look for sign in link/button
    console.log('🔍 Step 2: Looking for sign in link...');

    // Multiple possible sign in selectors
    const signInSelectors = [
      'a:has-text("Sign in")',
      'button:has-text("Sign in")',
      '[data-qa="sign-in"]',
      '.sign-in',
      'a[href*="signin"]',
      'a[href*="login"]',
    ];

    let signInFound = false;
    for (const selector of signInSelectors) {
      try {
        const signInButton = page.locator(selector).first();
        if (await signInButton.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found sign in with selector: ${selector}`);
          await signInButton.click();
          signInFound = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!signInFound) {
      console.log('🔍 No sign in button found, trying direct login URL...');
      await page.goto('https://www.washingtonpost.com/subscribe/signin/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    await page.waitForTimeout(5000);

    console.log('📋 Step 3: Analyzing login form...');

    // Analyze the login page structure
    const loginAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        emailInputs: Array.from(
          document.querySelectorAll(
            'input[type="email"], input[name="email"], input[placeholder*="email" i]'
          )
        ).map((input) => ({
          tagName: input.tagName,
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className,
        })),
        passwordInputs: Array.from(
          document.querySelectorAll(
            'input[type="password"], input[name="password"]'
          )
        ).map((input) => ({
          tagName: input.tagName,
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className,
        })),
        submitButtons: Array.from(
          document.querySelectorAll(
            'button[type="submit"], button, input[type="submit"]'
          )
        )
          .filter((btn) => {
            const text = btn.textContent?.toLowerCase() || '';
            const type = btn.type?.toLowerCase() || '';
            return (
              type === 'submit' ||
              text.includes('sign in') ||
              text.includes('log in') ||
              text.includes('signin') ||
              text.includes('login')
            );
          })
          .map((btn) => ({
            tagName: btn.tagName,
            type: btn.type,
            textContent: btn.textContent?.trim(),
            className: btn.className,
            id: btn.id,
          })),
        forms: Array.from(document.querySelectorAll('form')).map((form) => ({
          action: form.action,
          method: form.method,
          id: form.id,
          className: form.className,
        })),
      };
    });

    console.log('📊 Login Page Analysis:');
    console.log(`   Title: ${loginAnalysis.title}`);
    console.log(`   URL: ${loginAnalysis.url}`);
    console.log(`   Email inputs found: ${loginAnalysis.emailInputs.length}`);
    console.log(
      `   Password inputs found: ${loginAnalysis.passwordInputs.length}`
    );
    console.log(
      `   Submit buttons found: ${loginAnalysis.submitButtons.length}`
    );

    if (loginAnalysis.emailInputs.length > 0) {
      console.log('   Email input details:');
      loginAnalysis.emailInputs.forEach((input, i) => {
        console.log(
          `     [${i}] type=${input.type}, name=${input.name}, id=${input.id}, placeholder="${input.placeholder}"`
        );
      });
    }

    if (loginAnalysis.passwordInputs.length > 0) {
      console.log('   Password input details:');
      loginAnalysis.passwordInputs.forEach((input, i) => {
        console.log(
          `     [${i}] type=${input.type}, name=${input.name}, id=${input.id}, placeholder="${input.placeholder}"`
        );
      });
    }

    if (loginAnalysis.submitButtons.length > 0) {
      console.log('   Submit button details:');
      loginAnalysis.submitButtons.forEach((btn, i) => {
        console.log(
          `     [${i}] text="${btn.textContent}", type=${btn.type}, id=${btn.id}`
        );
      });
    }

    console.log('\n🔐 Step 4: Attempting to fill login form...');

    // Try to fill email field
    let emailFilled = false;
    const emailSelectors = [
      'input[id="username"]', // Washington Post specific
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[id*="email" i]',
    ];

    for (const selector of emailSelectors) {
      try {
        const emailInput = page.locator(selector).first();
        if (await emailInput.isVisible({ timeout: 2000 })) {
          console.log(`📧 Filling email with selector: ${selector}`);
          await emailInput.clear();
          await emailInput.fill(wapostUser);
          emailFilled = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!emailFilled) {
      console.log('❌ Could not find email input field');
      console.log('🔍 Available input fields:');
      const allInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map((input) => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
        }));
      });
      console.log(JSON.stringify(allInputs, null, 2));
    }

    // Try to fill password field
    let passwordFilled = false;
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id="password"]',
      'input[id*="password" i]',
    ];

    for (const selector of passwordSelectors) {
      try {
        const passwordInput = page.locator(selector).first();
        if (await passwordInput.isVisible({ timeout: 2000 })) {
          console.log(`🔒 Filling password with selector: ${selector}`);
          await passwordInput.clear();
          await passwordInput.fill(wapostPass);
          passwordFilled = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!passwordFilled) {
      console.log('❌ Could not find password input field');
    }

    if (emailFilled) {
      console.log(
        '📧 Email filled. Checking if this is a two-step login process...'
      );

      // Check if we need to click "Next" first
      const nextButton = page
        .locator('button:has-text("Next"), input[value="Next"]')
        .first();
      const isNextVisible = await nextButton.isVisible().catch(() => false);

      if (isNextVisible) {
        console.log(
          '🔄 Two-step login detected. Clicking Next to proceed to password step...'
        );
        await nextButton.click();
        await page.waitForTimeout(3000);

        // Now try to fill password after Next step
        console.log('🔍 Looking for password field after Next step...');
        for (const selector of passwordSelectors) {
          try {
            const passwordInput = page.locator(selector).first();
            if (await passwordInput.isVisible({ timeout: 2000 })) {
              console.log(`🔒 Filling password with selector: ${selector}`);
              await passwordInput.clear();
              await passwordInput.fill(wapostPass);
              passwordFilled = true;
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }
      }
    }

    if (emailFilled && passwordFilled) {
      console.log('✅ Both fields filled, attempting final submit...');

      // Try to click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        '[data-qa*="submit"]',
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const submitButton = page.locator(selector).first();
          if (await submitButton.isVisible({ timeout: 2000 })) {
            console.log(`🚀 Clicking submit with selector: ${selector}`);
            await submitButton.click();
            submitted = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!submitted) {
        console.log('❌ Could not find submit button, trying Enter key...');
        await page.keyboard.press('Enter');
      }

      // Wait and check result
      console.log('⏱️  Waiting for login result...');
      await page.waitForTimeout(10000);

      const postLoginUrl = page.url();
      const isLoggedIn = await page.evaluate(() => {
        // Check for common logged-in indicators
        const body = document.body.textContent.toLowerCase();
        const indicators = ['sign out', 'my account', 'profile', 'subscriber'];
        return indicators.some((indicator) => body.includes(indicator));
      });

      console.log(`📍 Post-login URL: ${postLoginUrl}`);
      console.log(`🔐 Login success: ${isLoggedIn ? '✅ YES' : '❌ NO'}`);

      if (isLoggedIn) {
        console.log('\n🎉 SUCCESS! Login worked. Testing recipe access...');

        // Test accessing a recipe page
        await page.goto('https://www.washingtonpost.com/food/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        await page.waitForTimeout(3000);

        const hasRecipeContent = await page.evaluate(() => {
          const body = document.body.textContent.toLowerCase();
          return body.includes('recipe') && body.includes('ingredient');
        });

        console.log(
          `🍽️  Recipe content accessible: ${hasRecipeContent ? '✅ YES' : '❌ NO'}`
        );
      }
    } else {
      console.log('❌ Could not fill login form properly');
    }

    console.log('\n⏸️  Pausing for manual inspection (10 seconds)...');
    console.log('   Check the browser window to see current state...');

    // Wait 10 seconds for manual inspection
    await page.waitForTimeout(10000);
  } catch (error) {
    console.error('❌ Error during authentication training:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the authentication training
trainWashingtonPostAuth().catch(console.error);
