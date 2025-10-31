# E2E Parser Testing

**Purpose:** Automated validation of all 15 recipe site parsers to prevent parser breakage discovered by users

## Problem Statement

**P0-1 Issue:** No end-to-end test suite exists to catch parser regressions before users report them. Recipe sites frequently redesign their HTML structure, breaking our parsers without warning.

**Solution:** Comprehensive E2E test suite that validates all supported sites daily, providing immediate detection of parser breakage.

## Test Coverage

### Supported Sites (14 parsers)

| Site | Test URL | Min Ingredients | Min Instructions |
|------|----------|-----------------|------------------|
| AllRecipes | Good Old Fashioned Pancakes | 6 | 3 |
| Epicurious | Classic Basil Pesto | 4 | 2 |
| Food52 | Confit Red Pepper Tomato Sauce | 8 | 4 |
| Food Network | Good Eats Roast Turkey | 5 | 5 |
| Serious Eats | Black Bean Burger | 10 | 4 |
| Smitten Kitchen | Best Chocolate Chip Cookies | 8 | 5 |
| NYT Cooking | Chocolate Chip Cookies | 8 | 4 |
| Damn Delicious | Korean Beef Bowl | 8 | 3 |
| Food & Wine | French Onion Soup | 6 | 4 |
| Alexandra's Kitchen | Simple Sourdough Bread | 3 | 5 |
| Anthony's Kitchen | Italian Wedding Soup | 10 | 6 |
| Love and Lemons | Hummus | 6 | 3 |
| Lemons and Zest | Chocolate Cake | 10 | 6 |
| Washington Post | Tomato Soup | 6 | 4 |

**Note:** `json-ld.ts` is a generic parser, not site-specific, so it's tested indirectly through other site tests.

## Running Tests

### Local Development

```bash
# Run all E2E parser tests
npm run test:e2e

# Run tests for a specific site (using Jest's test name filtering)
npm run test:e2e -- -t "food52"

# Run with verbose output
npm run test:e2e -- --verbose

# Update test snapshots (if using snapshot testing)
npm run test:e2e -- -u
```

### CI/CD Integration

E2E tests run automatically:

1. **Daily Schedule**: 9 AM UTC (1 AM PST, 4 AM EST) via GitHub Actions
2. **On Parser Changes**: Any commit to `parsers/**` or `tests/e2e/**`
3. **Manual Trigger**: Via GitHub Actions UI

View results: https://github.com/bordenet/RecipeArchive/actions/workflows/parser-health-check.yml

## Test Architecture

### Test Flow

```
1. Launch headless Chromium browser
2. Navigate to known-good recipe URL
3. Wait for page load (DOM content loaded + 3s)
4. Extract recipe data using JSON-LD + HTML fallbacks
5. Validate against AWS backend contract
6. Assert minimum ingredient/instruction counts
7. Verify title contains expected keywords
```

### Validation Rules

**Required Fields:**
- `title`: string, ≤200 chars, contains expected keywords
- `ingredients`: array, length ≥ minIngredients, each with non-empty `text`
- `instructions`: array, length ≥ minInstructions, each with `stepNumber` and non-empty `text`
- `sourceUrl`: matches original URL

**Optional Fields (validated if present):**
- `mainPhotoUrl`: string
- `prepTimeMinutes`, `cookTimeMinutes`, `totalTimeMinutes`: number
- `servings`: number
- `yield`: string

### Parser Logic

1. **Primary: JSON-LD Extraction**
   - Search for `<script type="application/ld+json">` tags
   - Parse JSON and find `@type: "Recipe"` objects
   - Handle arrays, single objects, and `@graph` structures

2. **Fallback: HTML Parsing**
   - Use semantic selectors: `[itemprop="recipeIngredient"]`, `[itemprop="recipeInstructions"]`
   - Try common CSS classes: `.recipe-ingredient`, `.recipe-step`, etc.
   - Fallback to generic `h1` for title

## Maintenance

### Adding New Sites

1. **Add test case to catalog** in [parser-regression-suite.test.js](../../tests/e2e/parser-regression-suite.test.js):

```javascript
{
  site: "new-site",
  url: "https://example.com/recipes/sample-recipe",
  expected: "Sample Recipe Title",
  minIngredients: 6,
  minInstructions: 4,
}
```

2. **Verify test passes locally:**

```bash
npm run test:e2e -- -t "new-site"
```

3. **Update documentation** (this file and PROJECT_STATUS.md)

### Handling Parser Breakage

If a parser test fails:

1. **Check GitHub Actions artifacts** for detailed error messages
2. **Follow [Parser Regression Protocol](../runbooks/parser-regression-protocol.md)**
3. **Options:**
   - Update CSS selectors in parser
   - Add fallback selectors
   - Create new test fixture for site redesign
4. **Re-run tests** to validate fix
5. **Update test expectations** if site permanently changed structure

### Test URL Selection Criteria

Choose known-good URLs that:
- Are stable (not seasonal, not deleted)
- Have representative complexity (not trivial, not overly complex)
- Load quickly (<60s)
- Don't require authentication
- Have clear recipe structure (title, ingredients, instructions)

## SLO Targets

| Metric | Target | Current |
|--------|--------|---------|
| Parser Success Rate | 100% | TBD |
| Max Execution Time | <90s per site | TBD |
| Daily Test Runs | 1+ | 1 |
| False Positive Rate | <5% | TBD |

## Troubleshooting

### Tests timing out

- Increase timeout in [package.json](../../package.json): `--testTimeout=120000`
- Check if site is blocking automated browsers (user-agent filtering)
- Verify site is accessible from CI environment

### Tests failing intermittently

- Site may have rate limiting or CDN caching issues
- Add retry logic to test suite
- Consider using test fixtures instead of live URLs

### Tests failing after site redesign

- Update CSS selectors in parser implementation
- Add fallback selectors for robustness
- Create new test fixture if structure fundamentally changed

## Related

- [Parser Regression Protocol](../runbooks/parser-regression-protocol.md)
- [Production Incident Response](../runbooks/production-incident-response.md)
- [PROJECT_STATUS.md](../../PROJECT_STATUS.md)
