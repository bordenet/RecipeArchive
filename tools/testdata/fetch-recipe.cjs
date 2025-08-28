const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

async function fetchRecipe(url, outPath) {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response || !response.ok()) {
      throw new Error(`Failed to fetch: ${url} (status: ${response ? response.status() : 'no response'})`);
    }
    // Check for 404 or error page by looking for known error markers
    const html = await page.content();
    if (html.includes('Page Not Found') || html.includes('404Template')) {
      throw new Error('Fetched a 404 page, not a recipe.');
    }
    fs.writeFileSync(outPath, html);
    console.log(`Saved HTML to ${outPath}`);
  } catch (err) {
    console.error(`Error fetching recipe: ${err.message}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const [url, outPath] = process.argv.slice(2);
  if (!url || !outPath) {
    console.error('Usage: node fetch-recipe.cjs <url> <output-path>');
    process.exit(1);
  }
  fetchRecipe(url, outPath);
}
