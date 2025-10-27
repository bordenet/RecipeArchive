# Remaining Tasks: Backend Validation (B) and End-to-End Testing (C)

## Context

This document captures the remaining work after completing:
- ✅ **Task A**: iOS Share Extension debug logging cleanup (COMPLETE)
- ✅ **Task D**: Monitoring & Alerting plan created for Gemini (COMPLETE)

**Tasks remaining**: B (Backend Validation) → C (End-to-End Testing)

**Source**: PROJECT_STATUS.md critical issues

---

## Task B: Backend Validation to Prevent Garbage Data

### Priority: HIGH
### Estimated Time: 2-3 hours
### Impact: Prevents broken recipes from persisting to S3

### Current Problems (from PROJECT_STATUS.md lines 47-83)

**❌ Backend recipe submission has zero validation**
- Accepts recipes with empty arrays (`ingredients: []`, `instructions: []`)
- No content quality checks
- Broken recipes persist to S3

**❌ Background normalizer blindly processes garbage**
- No validation before expensive OpenAI call
- Cache returns poisoned results for broken recipes (NOTE: Cache disabled as of 2025-10-06)
- Logs show "✅ success" when recipes have 0 ingredients/0 instructions

**❌ CloudWatch logs provide false success indicators**
- "✅ success" messages everywhere despite broken recipes
- No error-level logging for quality failures
- Impossible to distinguish real problems from successful processing

### Implementation Plan

#### Phase 1: Recipes Lambda Validation

**File**: `/aws-backend/functions/recipes/main.go`

**Goal**: Reject recipes with zero content before saving to S3

**Steps**:

1. Find the recipe submission handler (likely in `handlePost` or similar)

2. Add validation function:
```go
// ValidateRecipeQuality checks if recipe has minimum content
func ValidateRecipeQuality(recipe *Recipe) error {
    ingredientCount := len(recipe.Ingredients)
    instructionCount := len(recipe.Instructions)

    // Reject completely empty recipes
    if ingredientCount == 0 && instructionCount == 0 {
        return fmt.Errorf("recipe has no content: 0 ingredients and 0 instructions")
    }

    // Warn about suspicious recipes (missing one or the other)
    if ingredientCount == 0 {
        log.Printf("WARNING: Recipe has 0 ingredients but %d instructions: %s", instructionCount, recipe.URL)
    }
    if instructionCount == 0 {
        log.Printf("WARNING: Recipe has 0 instructions but %d ingredients: %s", ingredientCount, recipe.URL)
    }

    return nil
}
```

3. Add validation before S3 save:
```go
// In handlePost or wherever recipes are saved
if err := ValidateRecipeQuality(recipe); err != nil {
    log.Printf("ERROR: Recipe validation failed: %v", err)
    return events.APIGatewayProxyResponse{
        StatusCode: 400,
        Headers: corsHeaders,
        Body: fmt.Sprintf(`{"error": "Recipe validation failed: %s"}`, err.Error()),
    }, nil
}
```

4. Update error response to be helpful:
```go
Body: `{
    "error": {
        "code": "INVALID_RECIPE_CONTENT",
        "message": "Recipe has no ingredients or instructions. Please check the recipe URL and try again.",
        "details": "The parser may not support this website, or the recipe format is incompatible."
    }
}`
```

**Testing**:
```bash
# Test with empty recipe
curl -X POST https://YOUR_API/recipes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://test.com",
    "title": "Test Recipe",
    "ingredients": [],
    "instructions": [],
    "domain": "test.com"
  }'

# Should return 400 Bad Request with helpful error message
```

#### Phase 2: Background Normalizer Validation

**File**: `/aws-backend/functions/background-normalizer/main.go`

**Goal**: Skip OpenAI normalization for garbage recipes, log ERROR instead of INFO

**Steps**:

1. Find where recipes are read from S3 for normalization

2. Add validation BEFORE calling OpenAI:
```go
func processRecipe(ctx context.Context, recipe *Recipe) error {
    ingredientCount := len(recipe.Ingredients)
    instructionCount := len(recipe.Instructions)

    // CRITICAL: Don't waste OpenAI credits on garbage
    if ingredientCount == 0 && instructionCount == 0 {
        // Log ERROR not INFO
        log.Printf("ERROR: Rejecting garbage recipe (0/0): %s", recipe.URL)

        // Could mark in S3 metadata or move to failed bucket
        markRecipeAsFailed(ctx, recipe, "no_content")

        return fmt.Errorf("recipe has no content")
    }

    // Warn but proceed for recipes missing one or the other
    if ingredientCount == 0 {
        log.Printf("WARNING: Recipe has 0 ingredients, attempting normalization: %s", recipe.URL)
    }
    if instructionCount == 0 {
        log.Printf("WARNING: Recipe has 0 instructions, attempting normalization: %s", recipe.URL)
    }

    // Proceed with OpenAI normalization...
    return normalizeWithOpenAI(ctx, recipe)
}
```

3. Fix success logging to be truthful:
```go
// BEFORE (lying):
log.Printf("✅ Successfully normalized recipe: %s", recipe.URL)

// AFTER (truthful):
normalized, err := normalizeWithOpenAI(ctx, recipe)
if err != nil {
    log.Printf("ERROR: Normalization failed for %s: %v", recipe.URL, err)
    return err
}

// Check quality of normalized result
if len(normalized.Ingredients) == 0 && len(normalized.Instructions) == 0 {
    log.Printf("ERROR: Normalization produced empty recipe: %s", recipe.URL)
    return fmt.Errorf("normalization failed: empty result")
}

log.Printf("✅ Successfully normalized recipe: %s (ingredients: %d, instructions: %d)",
    recipe.URL, len(normalized.Ingredients), len(normalized.Instructions))
```

4. Add helper function to mark failed recipes:
```go
func markRecipeAsFailed(ctx context.Context, recipe *Recipe, reason string) {
    // Option 1: Add metadata to existing S3 object
    _, err := s3Client.CopyObject(ctx, &s3.CopyObjectInput{
        Bucket:     aws.String(os.Getenv("S3_RECIPE_STORAGE_BUCKET")),
        Key:        aws.String(recipe.S3Key),
        CopySource: aws.String(fmt.Sprintf("%s/%s", os.Getenv("S3_RECIPE_STORAGE_BUCKET"), recipe.S3Key)),
        Metadata: map[string]string{
            "normalization-status": "failed",
            "failure-reason":       reason,
            "failed-at":           time.Now().UTC().Format(time.RFC3339),
        },
        MetadataDirective: types.MetadataDirectiveReplace,
    })

    if err != nil {
        log.Printf("WARNING: Failed to mark recipe as failed: %v", err)
    }

    // Option 2: Move to failed bucket (if you want to separate failures)
    // ... copy to S3_FAILED_PARSING_BUCKET then delete from storage bucket
}
```

**Testing**:
```bash
# Create test recipe in S3 with 0/0
aws s3 cp test-empty-recipe.json s3://recipe-storage-{id}/recipes/test/empty.json

# Trigger SQS message to process it
aws sqs send-message \
  --queue-url https://sqs.us-west-2.amazonaws.com/{account}/recipe-processing \
  --message-body '{"recipeId":"test/empty"}'

# Check CloudWatch logs - should see ERROR not "✅ success"
aws logs tail /aws/lambda/background-normalizer --follow
```

#### Phase 3: Update Extension Error Reporting

**Files**:
- `/extensions/safari/scripts/content.js`
- `/extensions/chrome/src/content.js`

**Goal**: Ensure extensions report EMPTY_RECIPE errors properly

**Current State**: Extensions already report empty recipes to diagnostics endpoint (verified in v0.7.0)

**Verification Needed**:
```javascript
// In content.js, verify this logic exists:
if (recipeData.ingredients.length === 0 && recipeData.instructions.length === 0) {
    diagnostics.recordError({
        errorType: 'EMPTY_RECIPE',
        url: window.location.href,
        message: 'Recipe extraction returned no ingredients or instructions',
        recipeData: recipeData
    });

    // Don't submit empty recipe to backend
    return { success: false, error: 'No recipe content found' };
}
```

If missing, add this check before submitting to backend.

### Success Criteria

✅ **Recipes Lambda:**
- [ ] Rejects recipes with `ingredients.length === 0 && instructions.length === 0`
- [ ] Returns 400 status with helpful error message
- [ ] Logs ERROR for rejected recipes
- [ ] Does NOT save garbage to S3

✅ **Background Normalizer:**
- [ ] Validates before calling OpenAI
- [ ] Logs ERROR (not INFO) for garbage recipes
- [ ] Marks failed recipes in S3 metadata
- [ ] Success logs include actual counts: `"✅ ... (ingredients: 5, instructions: 8)"`

✅ **Extensions:**
- [ ] Report EMPTY_RECIPE to diagnostics endpoint
- [ ] Do not submit empty recipes to backend
- [ ] Show user-friendly error message

### Files to Modify

- `/aws-backend/functions/recipes/main.go` - Add validation
- `/aws-backend/functions/background-normalizer/main.go` - Add validation + fix logging
- `/extensions/safari/scripts/content.js` - Verify error reporting (likely already done)
- `/extensions/chrome/src/content.js` - Verify error reporting (likely already done)

---

## Task C: End-to-End Parser Validation Tests

### Priority: MEDIUM
### Estimated Time: 3-4 hours
### Impact: Prevents parser regressions, catches breakage before users

### Current Problems (from PROJECT_STATUS.md lines 70-73)

**❌ No end-to-end validation test suite**
- Parser changes not tested against actual websites
- No regression testing for known-good recipes
- Breakage discovered by users, not tests

### Implementation Plan

#### Phase 1: Test Infrastructure

**Goal**: Create automated test suite that validates parsers against real recipe websites

**Directory Structure**:
```
/tests/e2e-parser-validation/
├── package.json
├── test-recipes.json          # Known-good recipes with expected results
├── run-validation.js          # Test runner
├── parsers/                   # Copy of parser logic (or import from main)
│   ├── recipe-parser.js
│   └── sites/
└── reports/
    └── validation-report.html # Generated test results
```

**test-recipes.json** format:
```json
{
  "recipes": [
    {
      "url": "https://www.allrecipes.com/recipe/example",
      "domain": "allrecipes.com",
      "expectedMinIngredients": 5,
      "expectedMinInstructions": 3,
      "expectedTitle": "Example Recipe Title",
      "tags": ["popular", "regression-test"],
      "lastValidated": "2025-10-27",
      "notes": "Baseline recipe for Allrecipes parser"
    },
    {
      "url": "https://www.foodnetwork.com/recipes/example",
      "domain": "foodnetwork.com",
      "expectedMinIngredients": 8,
      "expectedMinInstructions": 5,
      "tags": ["regression-test"],
      "notes": "Food Network parser validation"
    }
  ]
}
```

#### Phase 2: Test Runner Implementation

**File**: `/tests/e2e-parser-validation/run-validation.js`

```javascript
const fs = require('fs');
const path = require('path');
const { parseRecipe } = require('./parsers/recipe-parser');

// Load test recipes
const testData = JSON.parse(fs.readFileSync('./test-recipes.json', 'utf8'));

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
  timestamp: new Date().toISOString(),
  totalTests: testData.recipes.length
};

async function validateRecipe(testRecipe) {
  console.log(`\n🧪 Testing: ${testRecipe.url}`);

  try {
    // Fetch the recipe HTML
    const response = await fetch(testRecipe.url);
    const html = await response.text();

    // Parse using our parser
    const parsed = parseRecipe(html, testRecipe.url);

    // Validate results
    const issues = [];

    // Check ingredient count
    if (parsed.ingredients.length < testRecipe.expectedMinIngredients) {
      issues.push(`Too few ingredients: got ${parsed.ingredients.length}, expected >= ${testRecipe.expectedMinIngredients}`);
    }

    // Check instruction count
    if (parsed.instructions.length < testRecipe.expectedMinInstructions) {
      issues.push(`Too few instructions: got ${parsed.instructions.length}, expected >= ${testRecipe.expectedMinInstructions}`);
    }

    // Check for completely empty recipe
    if (parsed.ingredients.length === 0 && parsed.instructions.length === 0) {
      issues.push('CRITICAL: Recipe is completely empty (0/0)');
    }

    // Check title if expected
    if (testRecipe.expectedTitle && !parsed.title.includes(testRecipe.expectedTitle)) {
      issues.push(`Title mismatch: got "${parsed.title}", expected to contain "${testRecipe.expectedTitle}"`);
    }

    // Record result
    if (issues.length === 0) {
      console.log(`✅ PASSED`);
      results.passed.push({
        url: testRecipe.url,
        ingredients: parsed.ingredients.length,
        instructions: parsed.instructions.length,
        title: parsed.title
      });
    } else {
      console.log(`❌ FAILED:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
      results.failed.push({
        url: testRecipe.url,
        issues: issues,
        actual: {
          ingredients: parsed.ingredients.length,
          instructions: parsed.instructions.length,
          title: parsed.title
        }
      });
    }

  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    results.failed.push({
      url: testRecipe.url,
      issues: [`Exception: ${error.message}`]
    });
  }
}

async function runAllTests() {
  console.log('🧪 RecipeArchive E2E Parser Validation\n');
  console.log(`Testing ${testData.recipes.length} recipes...\n`);

  for (const recipe of testData.recipes) {
    await validateRecipe(recipe);
    // Rate limit to avoid overwhelming servers
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests:  ${results.totalTests}`);
  console.log(`✅ Passed:    ${results.passed.length}`);
  console.log(`❌ Failed:    ${results.failed.length}`);
  console.log(`⚠️  Warnings:  ${results.warnings.length}`);
  console.log(`Success Rate: ${((results.passed.length / results.totalTests) * 100).toFixed(1)}%`);

  // Save results
  fs.writeFileSync(
    './reports/validation-results.json',
    JSON.stringify(results, null, 2)
  );

  // Generate HTML report
  generateHTMLReport(results);

  // Exit with error code if tests failed
  process.exit(results.failed.length > 0 ? 1 : 0);
}

function generateHTMLReport(results) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Parser Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 5px; }
    .passed { color: green; }
    .failed { color: red; }
    .test { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
    .test.failed { border-color: #f44336; background: #ffebee; }
    .test.passed { border-color: #4caf50; background: #e8f5e9; }
  </style>
</head>
<body>
  <h1>RecipeArchive Parser Validation Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Timestamp: ${results.timestamp}</p>
    <p>Total Tests: ${results.totalTests}</p>
    <p class="passed">✅ Passed: ${results.passed.length}</p>
    <p class="failed">❌ Failed: ${results.failed.length}</p>
    <p>Success Rate: ${((results.passed.length / results.totalTests) * 100).toFixed(1)}%</p>
  </div>

  <h2>Failed Tests</h2>
  ${results.failed.map(test => `
    <div class="test failed">
      <h3>${test.url}</h3>
      <ul>
        ${test.issues.map(issue => `<li>${issue}</li>`).join('')}
      </ul>
    </div>
  `).join('')}

  <h2>Passed Tests</h2>
  ${results.passed.map(test => `
    <div class="test passed">
      <h3>${test.url}</h3>
      <p>Ingredients: ${test.ingredients} | Instructions: ${test.instructions}</p>
    </div>
  `).join('')}
</body>
</html>
  `;

  fs.writeFileSync('./reports/validation-report.html', html);
  console.log('\n📄 HTML report saved to: ./reports/validation-report.html');
}

// Run tests
runAllTests().catch(console.error);
```

#### Phase 3: Known-Good Recipe Database

**Goal**: Build a collection of validated recipes covering all supported sites

**Approach**: Start with 2-3 recipes per supported domain

**Supported Domains** (from parsers/sites/):
```
- allrecipes.com
- foodnetwork.com
- epicurious.com
- smittenkitchen.com
- seriouseats.com
- bonappetit.com
- budgetbytes.com
- cookieandkate.com
- pinchofyum.com
- thekitchn.com
- tasty.co
- minimalistbaker.com
- food52.com
- simplyrecipes.com
```

**Recipe Selection Criteria**:
- Popular/well-visited recipes (less likely to be removed)
- Representative of typical content (not outliers)
- Mix of simple and complex recipes
- Include historical recipes (pre-2015) if domain is old

#### Phase 4: CI/CD Integration

**Goal**: Run parser validation automatically on PR and push

**GitHub Actions Workflow**: `.github/workflows/parser-validation.yml`

```yaml
name: Parser Validation

on:
  pull_request:
    paths:
      - 'parsers/**'
      - 'tests/e2e-parser-validation/**'
  push:
    branches:
      - main
    paths:
      - 'parsers/**'

jobs:
  validate-parsers:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd tests/e2e-parser-validation
          npm install

      - name: Run parser validation
        run: |
          cd tests/e2e-parser-validation
          npm test

      - name: Upload validation report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: tests/e2e-parser-validation/reports/
```

#### Phase 5: Monitoring Integration

**Goal**: Alert if parser validation starts failing in production

**Approach**: Run validation suite weekly via CloudWatch Events + Lambda

**Lambda**: `/aws-backend/functions/parser-health-check/main.go`

```go
// Triggered by CloudWatch Events (weekly cron)
// Runs subset of critical recipes
// Posts results to SNS if failures detected
```

### Success Criteria

✅ **Test Infrastructure:**
- [ ] Test runner can parse and validate recipes
- [ ] JSON database of known-good recipes (minimum 30 recipes covering 14 sites)
- [ ] HTML report generation working

✅ **Coverage:**
- [ ] At least 2 recipes per supported domain
- [ ] Mix of modern and historical recipes
- [ ] Includes both simple and complex recipes

✅ **CI/CD:**
- [ ] GitHub Actions workflow runs on parser changes
- [ ] Workflow fails if validation rate < 90%
- [ ] HTML reports uploaded as artifacts

✅ **Monitoring:**
- [ ] Weekly automated validation via Lambda
- [ ] SNS alerts if validation rate drops
- [ ] Dashboard widget showing parser health

### Files to Create

**New Files:**
- `/tests/e2e-parser-validation/package.json`
- `/tests/e2e-parser-validation/test-recipes.json`
- `/tests/e2e-parser-validation/run-validation.js`
- `/tests/e2e-parser-validation/README.md`
- `/.github/workflows/parser-validation.yml`
- `/aws-backend/functions/parser-health-check/main.go` (optional, for monitoring)

**Modified Files:**
- `/parsers/recipe-parser.js` - May need exports for testing
- `/.github/workflows/` - New workflow file

---

## Execution Order

1. **Task B Phase 1** - Recipes Lambda validation (highest impact, 1 hour)
2. **Task B Phase 2** - Background Normalizer validation + logging fixes (1 hour)
3. **Task B Phase 3** - Verify extension error reporting (30 min)
4. **Task C Phase 1-2** - Build test infrastructure (2 hours)
5. **Task C Phase 3** - Populate recipe database (1 hour)
6. **Task C Phase 4** - CI/CD integration (30 min)

**Total Estimated Time**: 6-7 hours

---

## Testing Checklist

### Task B Testing
- [ ] Submit empty recipe to Recipes Lambda - should return 400
- [ ] Trigger normalizer with garbage recipe - should log ERROR and skip OpenAI
- [ ] Check CloudWatch logs - no more false "✅ success" for 0/0 recipes
- [ ] Verify extensions report EMPTY_RECIPE to diagnostics
- [ ] Confirm S3 has no new garbage recipes after changes

### Task C Testing
- [ ] Run validation suite locally - all tests pass
- [ ] Break a parser intentionally - validation catches it
- [ ] Submit PR with parser change - GitHub Actions runs validation
- [ ] View HTML report - shows clear pass/fail results
- [ ] Check weekly Lambda execution logs - validation runs automatically

---

## Documentation Needs

After completion, update:
- `/docs/architecture/data-flow.md` - Add validation step
- `/docs/api/api-specification.md` - Document 400 error responses
- `/tests/e2e-parser-validation/README.md` - How to add new test recipes
- `/CLAUDE.md` - Remove completed tasks from PROJECT_STATUS.md

---

## Dependencies

- **Task B**: None (can start immediately)
- **Task C**: Requires Node.js test environment, parser source code access

## Risks & Mitigations

**Risk**: Real recipe URLs may break (404, paywall, format changes)
**Mitigation**:
- Use archive.org snapshots as backup
- Mark flaky tests with `expectedFailureRate`
- Refresh test database quarterly

**Risk**: Validation suite may be too strict (false failures)
**Mitigation**:
- Use minimum thresholds not exact counts
- Allow ±1 variance for ingredient/instruction counts
- Tag tests as `strict` vs `lenient`

**Risk**: Backend validation may reject valid recipes with unusual formats
**Mitigation**:
- Start with strict validation (0/0 only)
- Monitor diagnostics for legitimate rejections
- Adjust thresholds based on real-world data

---

**Status**: Ready for implementation
**Created**: 2025-10-27
**Owner**: Claude Code → User handoff
