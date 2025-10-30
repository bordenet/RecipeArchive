# Runbook: Parser Regression Protocol

**Issue:** Recipe parser breakage discovered by users instead of automated tests
**Impact:** Site-specific parsing failures, user trust erosion
**P0 Priority:** High

## Detection

User reports: "Recipe from [site] not capturing correctly"

## Reproduce

```bash
# 1. Get the failing URL from user
URL="https://example.com/recipe"

# 2. Test parser directly
cd parsers
npm run test:site -- --url="$URL"

# 3. Compare with reference fixture
# Check if HTML structure changed
```

## Diagnose

```bash
# Find which parser handles the site
grep -r "example.com" parsers/src/sites/

# Check parser test fixtures
ls -la parsers/tests/fixtures/ | grep example

# Run parser with debug output
DEBUG=true npm run parse -- --url="$URL"
```

## Fix Options

### Option 1: Update Selector

If site HTML structure changed:

```typescript
// Old selector
const title = doc.querySelector('.recipe-title');

// New selector (site redesign)
const title = doc.querySelector('[data-recipe-title]');
```

### Option 2: Add Fallback Selector

```typescript
const title = doc.querySelector('.recipe-title')
  || doc.querySelector('[data-recipe-title]')
  || doc.querySelector('h1.title');
```

### Option 3: Create New Test Fixture

```bash
# Save current page HTML for regression testing
./scripts/save-rendered-fixture.cjs "$URL" "parsers/tests/fixtures/$(date +%Y%m%d)-example-recipe.html"
```

## Deploy Fix

```bash
# 1. Update parser
# 2. Add/update test fixture
# 3. Run tests
npm test

# 4. Build extensions
npm run build:extensions

# 5. Notify user to reinstall extension
```

## Prevention

**Long-term:** Implement automated E2E test suite (P0-1)

```bash
# Future: Automated daily checks
./scripts/test-parser-health.sh --all-sites
```

## Related

- [P0-1: No End-to-End Test Suite](../../PROJECT_STATUS.md#critical-issues-p0)
- [Parser Architecture](../architecture/website-parsers.md)
