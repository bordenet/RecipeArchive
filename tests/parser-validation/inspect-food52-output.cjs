// Targeted output inspection for Food52 parser
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { default: Food52Parser } = require('../../parsers/dist/sites/food52.js');

const fixturePath = path.resolve(__dirname, '../fixtures/html-samples/food52-Confit-Red-Pepper-and-Tomato-Pasta-Sauce-Recipe.html');
const html = fs.readFileSync(fixturePath, 'utf8');
const url = 'https://food52.com/recipes/confit-red-pepper-and-tomato-sauce-with-pasta';

(async () => {
  const parser = new Food52Parser();
  const result = await parser.parse(html, url);
  console.log('Parsed Food52 result:', JSON.stringify(result, null, 2));
})();
