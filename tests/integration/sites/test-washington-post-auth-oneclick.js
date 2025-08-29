/* eslint-env node, browser */
/* eslint-env node, browser */
/**
 * Washington Post One-Time Authorization
 * Uses the magic link URL to authorize access
 */

const { chromium } = require('playwright');

async function authorizeWashingtonPost() {
  console.log('🔗 Washington Post One-Time Authorization');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const authUrl =
    'https://www.washingtonpost.com/subscribe/signin/ml?nonce=mlcnt30e2e411ada340bfab3d8f440580ed13&providerName=Washington+Post&next_url=https%253A%252F%252Fwww.washingtonpost.com&utm_source=email&utm_medium=ret-transactional-email&utm_campaign=magic-link-failed-login&email=sue.cameron42@gmail.com&case=pw';

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Step 1: Using one-time authorization URL...');
    await page.goto(authUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('⏱️  Waiting for authorization to complete...');
    await page.waitForTimeout(10000);

    // Check if authorization was successful
    const currentUrl = page.url();
    const pageTitle = await page.title();

    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`📄 Page Title: ${pageTitle}`);

    // Check for login success indicators
    const isAuthorized = await page.evaluate(() => {
      const body = document.body.textContent.toLowerCase();
      const indicators = ['sign out', 'my account', 'profile', 'subscriber'];
      return indicators.some((indicator) => body.includes(indicator));
    });

    console.log(
      `🔐 Authorization success: ${isAuthorized ? '✅ YES' : '❌ NO'}`
    );

    if (isAuthorized) {
      console.log('\n🎉 SUCCESS! Authorization completed.');

      // Test accessing a recipe page
      console.log('🍽️  Testing recipe access...');
      await page.goto('https://www.washingtonpost.com/food/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.waitForTimeout(3000);

      const hasRecipeAccess = await page.evaluate(() => {
        const body = document.body.textContent.toLowerCase();
        return !body.includes('subscribe') && body.includes('recipe');
      });

      console.log(
        `🍽️  Recipe content access: ${hasRecipeAccess ? '✅ YES' : '❌ LIMITED'}`
      );

      if (hasRecipeAccess) {
        console.log('\n✅ Ready to test Washington Post recipe extraction!');
      } else {
        console.log(
          '\n⚠️  May still have limited access - but authorization completed.'
        );
      }
    } else {
      console.log('\n❌ Authorization may not have completed successfully.');
    }

    console.log('\n⏸️  Keeping browser open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('❌ Error during authorization:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the authorization
authorizeWashingtonPost().catch(console.error);
