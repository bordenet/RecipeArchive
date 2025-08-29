// Contract validation test for Serious Eats parser using static fixture
const fs = require('fs');
const path = require('path');
const { SeriousEatsParser } = require('../../parsers/sites/serious-eats');

const FIXTURE_PATH = path.join(__dirname, '../fixtures/html-samples/serious-eats-sample.html');
const fixtureHtml = fs.readFileSync(FIXTURE_PATH, 'utf8');

(async () => {
  const parser = new SeriousEatsParser();
  try {
    const recipe = await parser.parse(fixtureHtml, FIXTURE_PATH);
    console.log('Parsed Recipe:', recipe);
    // Contract checks
    if (!recipe.title || !recipe.ingredients?.length || !recipe.instructions?.length) {
      throw new Error('Contract validation failed: Missing required fields');
    }
    console.log('✅ Contract validation passed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Contract validation failed:', err.message);
    process.exit(1);
  }
})();
