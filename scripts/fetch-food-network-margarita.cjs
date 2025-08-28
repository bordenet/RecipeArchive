const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const url = 'https://www.foodnetwork.com/recipes/alton-brown/margarita-recipe-1949048';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.o-Recipe');
  const html = await page.content();
  const outPath = '/tmp/food-network-margarita.html';
  fs.writeFileSync(outPath, html);
  console.log(`Saved HTML to ${outPath}`);
  await browser.close();
})();
