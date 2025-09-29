// Save a fully rendered HTML fixture using Playwright (CommonJS)
const { chromium } = require('playwright');
const fs = require('fs');

async function saveRenderedHTML(url, outputPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('body');
  const html = await page.content();
  fs.writeFileSync(outputPath, html);
  await browser.close();
  console.log(`Saved rendered HTML to ${outputPath}`);
}

// Usage: node save-rendered-fixture.cjs <url> <outputPath>
if (require.main === module) {
  const [url, outputPath] = process.argv.slice(2);
  if (!url || !outputPath) {
    console.error('Usage: node save-rendered-fixture.cjs <url> <outputPath>');
    process.exit(1);
  }
  saveRenderedHTML(url, outputPath);
}
