// Monorepo Parser Validation Runner
// Validates all site parsers against a set of real recipe URLs and blocks release if any fail contract

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const { exit } = require('process');

// --- CONFIG ---
const SITES = [
// ...expanded SITES array below...
    // Food52
    {
      name: 'food52',
      parserPath: path.resolve(__dirname, '../../parsers/sites/food52.ts'),
      urls: [
        'https://food52.com/recipes/confit-red-pepper-and-tomato-sauce-with-pasta',
        'https://food52.com/recipes/8578-short-rib-ragu',
        'https://food52.com/recipes/83215-lemon-raspberry-layer-cake-recipe',
        'https://food52.com/recipes/79815-pink-champagne-cake-recipe',
        'https://food52.com/recipes/38653-nea-s-swedish-princess-cake-prinsesstarta'
      ]
    },
    // Smitten Kitchen
    {
      name: 'smitten-kitchen',
      parserPath: path.resolve(__dirname, '../../parsers/sites/smitten-kitchen.ts'),
      urls: [
        'https://smittenkitchen.com/2014/04/the-perfect-margarita/',
        'https://smittenkitchen.com/2023/10/glazed-apple-cider-doughnut-cake/',
        'https://smittenkitchen.com/2018/09/big-apple-crumb-cake/',
        'https://smittenkitchen.com/2021/07/cannellini-aglio-e-olio/',
        'https://smittenkitchen.com/2021/07/zucchini-butter-spaghetti/'
      ]
    },
    // Food Network
    {
      name: 'food-network',
      parserPath: path.resolve(__dirname, '../../parsers/sites/food-network.ts'),
      urls: [
        'https://www.foodnetwork.com/recipes/alton-brown/margarita-recipe-1949048',
        'https://www.foodnetwork.com/recipes/giada-de-laurentiis/chicken-cacciatore-recipe-1943033',
        'https://www.foodnetwork.com/recipes/giada-de-laurentiis/lasagna-rolls-recipe-1943265',
        'https://www.foodnetwork.com/recipes/giada-de-laurentiis/chicken-piccata-recipe-1942429',
        'https://www.foodnetwork.com/recipes/giada-de-laurentiis/lemon-ricotta-cookies-with-lemon-glaze-recipe-1950642'
      ]
    },
    // Epicurious
    {
      name: 'epicurious',
      parserPath: path.resolve(__dirname, '../../parsers/sites/epicurious.ts'),
      urls: [
        'https://www.epicurious.com/recipes/food/views/3-ingredient-peanut-butter-cookies',
        'https://www.epicurious.com/recipes/food/views/salmon-nicoise-109010',
        'https://www.epicurious.com/recipes/food/views/white-chocolate-cranberry-and-macadamia-nut-cookies-236823',
        'https://www.epicurious.com/recipes/food/views/mini-chicken-pot-pies-with-bacon-and-marjoram-240130',
        'https://www.epicurious.com/recipes/food/views/irish-soda-bread-106278'
      ]
    },
    // NYT Cooking
    {
      name: 'nyt-cooking',
      parserPath: path.resolve(__dirname, '../../parsers/sites/nyt-cooking.ts'),
      urls: [
        'https://cooking.nytimes.com/recipes/1016153-classic-margarita',
        'https://cooking.nytimes.com/recipes/1020221-samin-nosrats-house-dressing',
        'https://cooking.nytimes.com/recipes/1020222-creamy-lemon-miso-dressing',
        'https://cooking.nytimes.com/recipes/1020223-creamy-sesame-ginger-dressing'
      ]
    },
    // Allrecipes
    {
      name: 'allrecipes',
      parserPath: path.resolve(__dirname, '../../parsers/sites/allrecipes.ts'),
      urls: [
        'https://www.allrecipes.com/recipe/17481/simple-white-cake/',
        'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/',
        'https://www.allrecipes.com/recipe/214963/moms-chicken-pot-pie/',
        'https://www.allrecipes.com/recipe/220985/scott-hibbs-amazing-whisky-grilled-baby-back-ribs/',
        'https://www.allrecipes.com/recipe/278881/garlic-brown-sugar-chicken-thighs/',
        'https://www.allrecipes.com/recipe/280951/black-pepper-beef-and-cabbage-stir-fry/'
      ]
    },
    // Love and Lemons
    {
      name: 'loveandlemons',
      parserPath: path.resolve(__dirname, '../../parsers/sites/loveandlemons.ts'),
      urls: [
        'https://www.loveandlemons.com/margarita-recipe/',
        'https://www.loveandlemons.com/black-bean-burgers/',
        'https://www.loveandlemons.com/shakshuka-recipe/',
        'https://www.loveandlemons.com/lentil-soup/',
        'https://www.loveandlemons.com/frittata-recipe/',
        'https://www.loveandlemons.com/baked-potato/'
      ]
    },
    // Washington Post
    {
      name: 'washington-post',
      parserPath: path.resolve(__dirname, '../../parsers/sites/washington-post.ts'),
      urls: [
        'https://www.washingtonpost.com/food/2025/06/28/30-minute-summer-meals/',
        'https://www.washingtonpost.com/food/2025/06/07/blueberry-recipes-muffins-cake-salad/',
        'https://www.washingtonpost.com/food/2025/04/05/30-minute-pasta-recipes-spring/'
      ]
    },
    // Food & Wine
    {
      name: 'food-and-wine',
      parserPath: path.resolve(__dirname, '../../parsers/sites/food-and-wine.ts'),
      urls: [
        'https://www.foodandwine.com/recipes/creamy-udon-with-umami-butter',
        'https://www.foodandwine.com/recipes/dr-pepper-braised-pot-roast',
        'https://www.foodandwine.com/recipes/slow-cooker-chicken-pho',
        'https://www.foodandwine.com/recipes/chicken-korma',
        'https://www.foodandwine.com/recipes/ricotta-gnocchi'
      ]
    },
    // Damn Delicious
    {
      name: 'damn-delicious',
      parserPath: path.resolve(__dirname, '../../parsers/sites/damn-delicious.ts'),
      urls: [
        'https://damndelicious.net/2014/03/29/spaghetti-carbonara/',
        'https://damndelicious.net/2014/09/10/easy-shrimp-broccoli-stir-fry/',
        'https://damndelicious.net/2014/04/09/pf-changs-chicken-lettuce-wraps/',
        'https://damndelicious.net/2013/07/07/garlic-butter-shrimp-pasta/',
        'https://damndelicious.net/2013/05/20/easy-lemon-chicken/'
      ]
    },
    // Serious Eats
    {
      name: 'serious-eats',
      parserPath: path.resolve(__dirname, '../../parsers/sites/serious-eats.ts'),
      urls: [
        'https://www.seriouseats.com/mazatlan-ceviche-de-sierra-sinaloan-mackerel-ceviche-recipe-8383273',
        'https://www.seriouseats.com/rhode-island-style-stuffed-quahog-clams-stuffies-recipe-8363750',
        'https://www.seriouseats.com/buffalo-chicken-salad-recipe-8383267',
        'https://www.seriouseats.com/how-to-make-chai-8363658',
        'https://www.seriouseats.com/tahdig-persian-crunchy-rice-recipe-8383636'
      ]
    }
  ];
const CACHE_DIR = '/tmp/recipearchive-cache';
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

// --- CONTRACT FIELDS ---
const REQUIRED_FIELDS = ['title', 'ingredients', 'instructions'];

// --- UTILS ---
function cachePath(site, url) {
  // Special case for Food52 confit pepper recipe
  if (site === 'food52' && url.includes('confit-red-pepper-and-tomato-sauce-with-pasta')) {
    return path.join(path.resolve(__dirname, '../testdata'), 'food52_confit_pepper.html');
  }
  // Special case for Epicurious peanut butter cookies
  if (site === 'epicurious' && url.includes('3-ingredient-peanut-butter-cookies')) {
    return path.join(path.resolve(__dirname, '../testdata'), 'epicurious_peanut_butter_cookies.html');
  }
  // Special case for AllRecipes Simple White Cake
  if (site === 'allrecipes' && url.includes('17481/simple-white-cake')) {
    return path.join(path.resolve(__dirname, '../testdata'), 'allrecipes_white_cake.html');
  }
  const safe = url.replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(CACHE_DIR, `${site}_${safe}.html`);
}

async function fetchAndCache(url, outPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // Wait for content
  const html = await page.content();
  fs.writeFileSync(outPath, html);
  await browser.close();
}

function validateContract(result) {
  for (const field of REQUIRED_FIELDS) {
    if (!result[field] || (Array.isArray(result[field]) && result[field].length === 0)) {
      return false;
    }
  }
  return true;
}

async function run() {
  let failures = [];
  // Use ts-node to support TypeScript parsers
  for (const site of SITES) {
  // Use compiled JS output for parser imports
    const parserModule = await import(site.parserPath.replace('/parsers/sites/', '/parsers/dist/sites/').replace('.ts', '.js'));
    let parser;
    // Try to detect export type
    const pascalExportName = site.name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase()) + 'Parser';
    const camelExportName = site.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Parser';
    if (typeof parserModule[pascalExportName] === 'function') {
      parser = new parserModule[pascalExportName]();
    } else if (typeof parserModule[camelExportName] === 'function') {
      parser = new parserModule[camelExportName]();
    } else if (typeof parserModule.default === 'function') {
      parser = new parserModule.default();
    } else if (typeof parserModule.default === 'object' && typeof parserModule.default.parse === 'function') {
      parser = parserModule.default;
    } else if (typeof parserModule === 'function') {
      parser = parserModule;
    } else {
      console.error(`Could not resolve parser export for ${site.parserPath}`);
      console.error('Available exports:', Object.keys(parserModule));
      if (parserModule.default) {
        console.warn('Falling back to default export.');
        parser = typeof parserModule.default === 'function' ? new parserModule.default() : parserModule.default;
      } else {
        throw new Error(`Could not resolve parser export for ${site.parserPath}`);
      }
    }
    for (const url of site.urls) {
      const cache = cachePath(site.name, url);
      let html;
      if (fs.existsSync(cache)) {
        html = fs.readFileSync(cache, 'utf8');
        console.log(`[CACHE] ${site.name}: ${url}`);
      } else {
        console.log(`[FETCH] ${site.name}: ${url}`);
        await fetchAndCache(url, cache);
        html = fs.readFileSync(cache, 'utf8');
      }
      let result;
      if (typeof parser.parse === 'function') {
        result = await parser.parse(html, url);
      } else if (typeof parser === 'function') {
        const $ = cheerio.load(html);
        result = parser($);
      } else {
        throw new Error(`Parser for ${site.name} is not callable.`);
      }
      if (!validateContract(result)) {
        failures.push({ site: site.name, url, result });
        console.error(`[FAIL] ${site.name}: ${url}`);
      } else {
        console.log(`[PASS] ${site.name}: ${url}`);
      }
    }
  }
  // Summary
  if (failures.length > 0) {
    console.error(`\nValidation failed for ${failures.length} URLs:`);
    failures.forEach(f => {
      console.error(`- ${f.site}: ${f.url}`);
      REQUIRED_FIELDS.forEach(field => {
        if (!f.result[field] || (Array.isArray(f.result[field]) && f.result[field].length === 0)) {
          console.error(`  Missing: ${field}`);
        }
      });
    });
    exit(1);
  } else {
    console.log('\nAll parsers passed contract validation!');
    exit(0);
  }
}

run();
