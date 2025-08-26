#!/usr/bin/env node

const { chromium } = require('playwright');

async function testFood52Access() {
  console.log('🔍 Testing Food52 access and structure...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  const testUrls = [
    'https://food52.com/recipes/78143-chocolate-chip-cookies',
    'https://food52.com/recipes/31738-ovenly-s-secretly-vegan-salted-chocolate-chip-cookies',
    'https://food52.com/recipes/34243-aunt-lolly-s-oatmeal-chocolate-chip-cookies',
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n🧪 Testing: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for content
      await page.waitForTimeout(5000);

      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          h1Text: document.querySelector('h1')?.textContent?.trim(),
          hasRecipeJsonLd: !!document.querySelector(
            'script[type="application/ld+json"]'
          ),
          recipeDivs: document.querySelectorAll(
            '[class*="recipe"], [data-recipe]'
          ).length,
          ingredientLists: document.querySelectorAll('ul li, ol li').length,
          bodyText: document.body.textContent?.slice(0, 200) + '...',
        };
      });

      console.log(`   Title: ${pageInfo.title}`);
      console.log(`   URL: ${pageInfo.url}`);
      console.log(`   H1: ${pageInfo.h1Text}`);
      console.log(`   Has JSON-LD: ${pageInfo.hasRecipeJsonLd}`);
      console.log(`   Recipe divs: ${pageInfo.recipeDivs}`);
      console.log(`   List items: ${pageInfo.ingredientLists}`);

      if (pageInfo.title === '404' || pageInfo.url.includes('404')) {
        console.log('   ❌ 404 Error - Recipe may not exist or be accessible');
      } else if (pageInfo.h1Text && pageInfo.h1Text.length > 0) {
        console.log('   ✅ Recipe page loaded successfully');

        // Try to extract some recipe data
        const recipeData = await page.evaluate(() => {
          // Look for JSON-LD first
          const jsonLdScripts = document.querySelectorAll(
            'script[type="application/ld+json"]'
          );
          for (const script of jsonLdScripts) {
            try {
              const data = JSON.parse(script.textContent);
              if (
                data['@type'] === 'Recipe' ||
                (Array.isArray(data) &&
                  data.find((item) => item['@type'] === 'Recipe')) ||
                (data['@graph'] &&
                  data['@graph'].find((item) => item['@type'] === 'Recipe'))
              ) {
                return {
                  source: 'json-ld',
                  found: true,
                  hasIngredients: !!data.recipeIngredient,
                };
              }
            } catch (e) {
              // Continue to next script
            }
          }

          // Look for common selectors
          const ingredientSelectors = [
            '.recipe-ingredients li',
            '.ingredients li',
            '[data-testid="ingredients"] li',
            'ul[data-testid*="ingredient"] li',
            '[class*="ingredient"] li',
          ];

          for (const selector of ingredientSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              return {
                source: `dom-${selector}`,
                found: true,
                count: elements.length,
                sample: elements[0]?.textContent?.trim(),
              };
            }
          }

          return { source: 'none', found: false };
        });

        console.log(
          `   Recipe data: ${recipeData.source} - ${recipeData.found ? 'Found' : 'Not found'}`
        );
        if (recipeData.count)
          console.log(`     Count: ${recipeData.count} items`);
        if (recipeData.sample)
          console.log(`     Sample: ${recipeData.sample.slice(0, 50)}...`);

        // If this worked, we can break and use this URL for further analysis
        if (recipeData.found) {
          console.log('   🎉 Found working Food52 recipe URL!');
          break;
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    await page.waitForTimeout(2000);
  }

  await browser.close();
}

testFood52Access().catch(console.error);
