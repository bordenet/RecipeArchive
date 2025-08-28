const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const cheerio = require('cheerio');

const CACHE_PATH = '/tmp/food-network-margarita.html';
const URL = 'https://www.foodnetwork.com/recipes/alton-brown/margarita-recipe-1949048';
const FETCH_SCRIPT = path.resolve(__dirname, '../../scripts/fetch-food-network-margarita.cjs');

async function ensureCache() {
  if (fs.existsSync(CACHE_PATH)) {
    console.log('Using cached HTML:', CACHE_PATH);
    return fs.readFileSync(CACHE_PATH, 'utf8');
  }
  // Fetch fresh content using Playwright script
  console.log('No cache found. Fetching fresh HTML...');
  await require('child_process').spawnSync('node', [FETCH_SCRIPT], { stdio: 'inherit' });
  return fs.readFileSync(CACHE_PATH, 'utf8');
}

function runParser(html) {
  // Import the parser (assumes default export or named function)
  const { parseFoodNetworkRecipe } = require('../../parsers/sites/food-network');
  const $ = cheerio.load(html);
  const result = parseFoodNetworkRecipe($);
  return result;
}

async function main() {
  const html = await ensureCache();
  const result = runParser(html);
  if (!result || !result.ingredients || result.ingredients.length === 0) {
    console.error('Parser failed: No ingredients extracted.');
    process.exit(1);
  }
  console.log('Parser succeeded! Extracted ingredients:');
  result.ingredients.forEach((ing, i) => console.log(`${i + 1}. ${ing.text}`));
  // TODO: Move to next site/URL if needed
}

main();
