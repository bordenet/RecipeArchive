# Recipe URL Discovery Tool

Automated discovery and validation of recipe URLs for maintaining the E2E parser test suite.

## Purpose

This tool helps maintain the health of the E2E parser test suite by:
- Finding fresh, working recipe URLs when old ones break (404s, moved content)
- Validating that discovered URLs meet test requirements
- Automatically updating the test catalog with best URLs

## Quick Start

```bash
# From tools/recipe-url-discovery directory

# Validate existing test URLs (check for 404s, parser failures)
./recipe-url-discovery --validate-catalog

# Discover new URLs for a specific failing site
./recipe-url-discovery --site epicurious --max-urls 20

# Discover URLs for all failing sites
./recipe-url-discovery --discover-all --max-urls 20

# Update test catalog with discovered URLs
./recipe-url-discovery --update-tests
```

## Prerequisites

1. **Node.js and dependencies** (from repository root):
   ```bash
   npm install
   ```

2. **Playwright browsers** (from repository root):
   ```bash
   npx playwright install chromium
   ```

3. **Go 1.21+** (for building the tool):
   ```bash
   go version  # Should be 1.21 or higher
   ```

## Installation

```bash
# Build the tool
cd tools/recipe-url-discovery
go build

# The binary is now available as ./recipe-url-discovery
```

## Commands

### Validate Existing Catalog

Check all current test URLs to see which ones are broken:

```bash
./recipe-url-discovery --validate-catalog
```

Output shows which sites pass/fail:
```
✅ Validating existing test catalog URLs...
Validating allrecipes: https://www.allrecipes.com/...
  ✅ Valid!
Validating epicurious: https://www.epicurious.com/...
  ❌ Invalid: 404 Not Found
```

### Discover URLs for a Specific Site

Find replacement URLs for a failing site:

```bash
# Discover URLs for epicurious (limit to 10 for speed)
./recipe-url-discovery --site epicurious --max-urls 10

# Discover more URLs for thorough search
./recipe-url-discovery --site epicurious --max-urls 50
```

The tool will:
1. Fetch the site's sitemap.xml
2. Filter for recipe URLs
3. Test each URL with the TypeScript parser
4. Validate against minimum requirements (ingredients, instructions)
5. Score each URL for quality
6. Cache the best URL found

Output shows progress:
```
🔍 Discovering recipes for epicurious...
📡 Fetching sitemap from https://www.epicurious.com/sitemap.xml...
Found 1000 potential recipe URLs
Limiting to 10 URLs for testing
Testing 1/10: https://www.epicurious.com/...
  ✅ Valid! Score: 85, Ingredients: 8, Instructions: 6
Testing 2/10: https://www.epicurious.com/...
  ❌ Invalid: Insufficient ingredients: 2 < 4

🎯 Best URL found:
  URL: https://www.epicurious.com/recipes/...
  Title: Classic Tomato Soup
  Quality Score: 85/100
  Ingredients: 8
  Instructions: 6
```

### Discover for All Sites

Run discovery for all sites configured in config.yaml:

```bash
# WARNING: This takes a long time! (10-20 minutes)
./recipe-url-discovery --discover-all --max-urls 20
```

### Update Test Catalog

After discovering good URLs, update the E2E test file:

```bash
# IMPORTANT: Creates a backup first!
./recipe-url-discovery --update-tests
```

This will:
1. Read cached discoveries from `cache/*.json`
2. Update `tests/e2e/parser-regression-suite.test.js`
3. Only update sites marked as "failing" in config
4. Preserve all other test content (minIngredients, etc.)

## Configuration

Edit `config.yaml` to:
- Add/remove sites
- Adjust minimum requirements per site
- Update sitemap URLs
- Configure rate limiting

Example site config:
```yaml
epicurious:
  domain: epicurious.com
  sitemapUrl: https://www.epicurious.com/sitemap.xml
  parserName: EpicuriousParser
  minIngredients: 4      # Must have at least 4 ingredients
  minInstructions: 2     # Must have at least 2 instructions
  currentTestUrl: https://www.epicurious.com/...
  status: failing        # or "passing"
  issue: URL returns 404 # Optional description
```

## How It Works

### Discovery Process

1. **Sitemap Crawling**: Fetches sitemap.xml and filters for recipe URLs
2. **URL Filtering**: Looks for paths containing `/recipe/`, `/recipes/`, etc.
3. **Parser Validation**: Uses the same TypeScript parser as E2E tests
4. **Quality Scoring**: Scores URLs based on completeness (0-100 scale)
5. **Caching**: Saves best results to `cache/*.json`

### Quality Scoring

URLs are scored out of 100 points:
- Has title: 10 points
- Has ingredients: 20 points
- Has instructions: 20 points
- Has image: 10 points
- Has timing info: 10 points
- Ingredient count: 2 points each (max 10)
- Instruction count: 2 points each (max 10)

Minimum acceptable score: 70/100

### Parser Validation

The tool validates URLs using **the exact same method** as E2E tests:
1. Launches headless Chromium via Playwright
2. Navigates to the recipe URL
3. Injects `extensions/chrome/typescript-parser-bundle.js`
4. Calls `window.TypeScriptParser.extractRecipeFromPage()`
5. Validates the returned Recipe object

This ensures discovered URLs will work in the actual test suite.

## Cache Files

Discovered URLs are cached in `cache/*.json`:

```json
{
  "URL": "https://www.epicurious.com/recipes/...",
  "IsValid": true,
  "QualityScore": 85,
  "Recipe": {
    "title": "Classic Tomato Soup",
    "source": "https://www.epicurious.com/recipes/...",
    "ingredients": [...],
    "instructions": [...]
  },
  "ErrorMessage": "",
  "ValidationErrors": []
}
```

Cache files persist across runs and are used by `--update-tests`.

## Rate Limiting

The tool respects websites:
- 1 request per second (configurable in config.yaml)
- 5 second delay between sites when using `--discover-all`
- Respects robots.txt
- Uses descriptive User-Agent header

## Troubleshooting

### "Playwright not found"

```bash
# Install Playwright browsers
cd ../../  # Go to repository root
npx playwright install chromium
```

### "Failed to parse recipe JSON"

The URL might not have recipe structured data. The tool will skip it and try the next URL.

### "No valid URLs found"

Try increasing `--max-urls` to test more URLs:
```bash
./recipe-url-discovery --site epicurious --max-urls 100
```

### "Module not found"

Make sure Node.js dependencies are installed:
```bash
cd ../../  # Go to repository root
npm install
```

## Development

### Project Structure

```
tools/recipe-url-discovery/
├── main.go                    # CLI entry point
├── config.yaml                # Site configurations
├── discoverers/
│   └── sitemap.go            # Sitemap XML parser
├── validators/
│   └── recipe_validator.go   # URL validation via Playwright
├── updater/
│   └── catalog_updater.go    # Test file updater
├── cache/                     # Cached discoveries (gitignored)
│   ├── epicurious.json
│   └── food52.json
└── README.md                  # This file
```

### Building

```bash
go build                       # Creates ./recipe-url-discovery binary
go build -o custom-name        # Custom binary name
```

### Testing

```bash
# Quick test with one site
./recipe-url-discovery --site allrecipes --max-urls 3

# Validate all current URLs
./recipe-url-discovery --validate-catalog

# Test discovery without updating
./recipe-url-discovery --site epicurious --max-urls 5
# Check cache/epicurious.json to see results
```

## Maintenance

### Adding a New Site

1. Add site config to `config.yaml`:
   ```yaml
   newsite:
     domain: example.com
     sitemapUrl: https://example.com/sitemap.xml
     parserName: ExampleParser
     minIngredients: 5
     minInstructions: 3
     currentTestUrl: https://example.com/recipe/test
     status: passing
   ```

2. Add the site to `tests/e2e/parser-regression-suite.test.js`

3. Run discovery:
   ```bash
   ./recipe-url-discovery --site newsite --max-urls 20
   ```

### Updating a Site's Requirements

1. Edit `config.yaml` to change `minIngredients` or `minInstructions`
2. Also update the test file manually to match
3. Re-run validation:
   ```bash
   ./recipe-url-discovery --validate-catalog
   ```

## Future Enhancements

- [ ] Support for RSS/Atom feeds (in addition to sitemaps)
- [ ] Wayback Machine integration for archival recipes
- [ ] Parallel URL validation (currently sequential)
- [ ] Web UI for browsing discovered recipes
- [ ] Automatic PR creation with updated URLs
- [ ] Historical tracking of URL changes over time

## See Also

- [IMPLEMENTATION-GUIDE-recipe-url-discovery.md](../../docs/specs/IMPLEMENTATION-GUIDE-recipe-url-discovery.md) - Detailed implementation guide
- [recipe-url-discovery-tool.md](../../docs/specs/recipe-url-discovery-tool.md) - Original specification
- [parser-regression-suite.test.js](../../tests/e2e/parser-regression-suite.test.js) - E2E test suite
