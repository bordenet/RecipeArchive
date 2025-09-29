// Save a fully rendered HTML fixture using Playwright (CommonJS)
const { chromium } = require('playwright');
const fs = require('fs');

async function saveRenderedHTML(url, outputPath) {
  const maxRetries = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let fetchTimeout;
    try {
      // Set a 30s fetch timeout
      fetchTimeout = setTimeout(() => {
        page.close();
        throw new Error(`Fetch timeout: ${url} took longer than 30 seconds`);
      }, 30000);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      clearTimeout(fetchTimeout);
      await page.waitForSelector('body', { timeout: 30000 });
      // Check for 404 or error page
      const title = await page.title();
      if (/404|not found|error/i.test(title)) {
        throw new Error(`404 or error page detected for URL: ${url}`);
      }
      const html = await page.content();
      fs.writeFileSync(outputPath, html);
      await browser.close();
      console.log(`Saved rendered HTML to ${outputPath}`);
      return;
    } catch (err) {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      lastError = err;
      await browser.close();
      console.warn(`Attempt ${attempt} failed for ${url}: ${err.message}`);
      if (/404|not found/i.test(err.message)) {
        console.error(`URL returned 404: ${url}`);
        break;
      }
      if (attempt < maxRetries) {
        console.log(`Retrying... (${attempt + 1}/${maxRetries})`);
      }
    }
  }
  throw lastError;
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
