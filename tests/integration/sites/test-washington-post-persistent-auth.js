/* eslint-env node, browser */
/* eslint-env node, browser */
/**
 * Washington Post Persistent Authentication
 *
 * This approach:
 * 1. Saves authentication cookies after first successful login
 * 2. Reuses saved cookies for subsequent test runs
 * 3. Only requires manual login once, then cookies persist
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'wapost-auth-cookies.json');

async function saveAuthCookies(context) {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log('💾 Authentication cookies saved');
}

async function loadAuthCookies(context) {
  if (fs.existsSync(COOKIES_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await context.addCookies(cookies);
    console.log('🔄 Loaded saved authentication cookies');
    return true;
  }
  return false;
}

async function isLoggedIn(page) {
  return await page.evaluate(() => {
    const body = document.body.textContent.toLowerCase();
    const indicators = ['sign out', 'my account', 'profile', 'subscriber'];
    return indicators.some((indicator) => body.includes(indicator));
  });
}

async function testPersistentAuth() {
  console.log('🔐 Washington Post Persistent Authentication Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
    // Try to load existing cookies first
    // eslint-disable-next-line no-unused-vars
    const cookiesLoaded = await loadAuthCookies(context);

    // Go to Washington Post homepage
    await page.goto('https://www.washingtonpost.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Check if already logged in
    const alreadyLoggedIn = await isLoggedIn(page);

    if (alreadyLoggedIn) {
      console.log('✅ Already authenticated with saved cookies!');
    } else {
      console.log('🔑 Need to authenticate. Opening login flow...');
      console.log('📍 Please manually log in using your subscription.');
      console.log(
        '📍 After successful login, I will save the cookies for future use.'
      );

      // Navigate to login page
      await page.goto('https://www.washingtonpost.com/subscribe/signin/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      console.log('⏱️  Waiting 60 seconds for manual login...');
      console.log(
        '   Please complete the login process in the browser window.'
      );

      // Wait for manual login
      let loginSuccess = false;
      let attempts = 0;
      const maxAttempts = 12; // 60 seconds / 5 second intervals

      while (!loginSuccess && attempts < maxAttempts) {
        await page.waitForTimeout(5000);
        attempts++;

        loginSuccess = await isLoggedIn(page);
        if (loginSuccess) {
          console.log('✅ Login detected!');
          break;
        } else {
          console.log(`⏱️  Waiting... (${attempts}/${maxAttempts})`);
        }
      }

      if (loginSuccess) {
        // Save cookies for future use
        await saveAuthCookies(context);
        console.log('🎉 Authentication successful and cookies saved!');
      } else {
        console.log('❌ Login timeout. Please try again.');
        return;
      }
    }

    // Test accessing recipe content
    console.log('\n🍽️  Testing recipe content access...');
    await page.goto('https://www.washingtonpost.com/food/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    const hasRecipeAccess = await page.evaluate(() => {
      const body = document.body.textContent.toLowerCase();
      const hasRecipes = body.includes('recipe');
      const hasPaywall =
        body.includes('subscribe now') || body.includes('sign up');
      return hasRecipes && !hasPaywall;
    });

    console.log(
      `🍽️  Recipe access: ${hasRecipeAccess ? '✅ FULL ACCESS' : '⚠️  LIMITED'}`
    );

    // Test on a specific recipe URL if available
    console.log('\n🧪 Testing specific recipe access...');
    const testRecipeUrls = [
      'https://www.washingtonpost.com/food/2025/06/28/30-minute-summer-meals/',
      'https://www.washingtonpost.com/food/2025/06/07/blueberry-recipes-muffins-cake-salad/',
    ];

    for (const url of testRecipeUrls) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const pageAccess = await page.evaluate(() => {
        const body = document.body.textContent.toLowerCase();
        const hasContent = body.length > 5000;
        const hasPaywallBlock =
          body.includes('get unlimited access') ||
          body.includes('subscribe to continue reading');
        return { hasContent, hasPaywallBlock };
      });

      console.log(
        `   📄 ${url.split('/').pop()}: Content=${pageAccess.hasContent ? '✅' : '❌'}, Paywall=${pageAccess.hasPaywallBlock ? '🚫' : '✅'}`
      );
    }

    console.log('\n✅ Persistent authentication setup complete!');
    console.log(
      '💡 Future test runs will use saved cookies and skip manual login.'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    await browser.close();
  }
}

testPersistentAuth().catch(console.error);
