# Parser Refactor Design & Test Plan

## Current Pain Points
1. Website-specific parsers tightly coupled with extension logic
2. Inconsistent validation coverage
3. Unknown state of existing test cases
4. Manual testing required for parser updates
5. Unclear boundaries between parsing and extension responsibilities

## Proposed Architecture

### 1. Parser Module Structure
```
extensions/
└── shared/
    └── parsers/
        ├── base-parser.ts           # Abstract base class with common utilities
        ├── types.ts                 # TypeScript interfaces for all parser types
        ├── validation.ts           # Shared validation logic
        ├── sites/                  # One file per supported site
        │   ├── smitten-kitchen.ts
        │   ├── serious-eats.ts
        │   └── ...
        └── tests/
            ├── fixtures/           # HTML snapshots for testing
            ├── validation.test.ts  # Validation logic tests
            └── sites/             # Site-specific parser tests
```

### 2. Mandatory Fields Interface
```typescript
interface Recipe {
  title: string;          // Required
  url: string;           // Required
  author: string;        // Required
  ingredients: string[]; // Required
  instructions: string[];// Required
  imageUrl?: string;    // Optional
  prepTime?: string;    // Optional
  cookTime?: string;    // Optional
  totalTime?: string;   // Optional
  servings?: string;    // Optional
  notes?: string[];     // Optional
}

interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
}
```

### 3. Base Parser Class
```typescript
abstract class BaseParser {
  abstract readonly siteName: string;
  abstract canParse(url: string): boolean;
  abstract parse(html: string, url: string): Promise<Recipe>;
  
  // Shared utilities
  protected extractJsonLd(html: string): any;
  protected sanitizeString(str: string): string;
  protected validateRecipe(recipe: Recipe): ValidationResult;
  protected extractTimeFromString(str: string): string | null;
}
```

## Test Plan

### 1. Automated Test Pipeline
- Pre-commit hook for running parser tests
- GitHub Action for continuous validation
- Regular refresh of test fixtures from live sites

### 2. Test Categories

#### A. Unit Tests (per site)
- JSON-LD extraction
- Structured data parsing
- Fallback parsing methods
- Field sanitization
- Time format handling

#### B. Integration Tests
- Complete parse-to-validation flow
- Cross-parser utilities
- Error handling
- Character encoding edge cases

#### C. Regression Tests
Using live snapshots from:
1. smittenkitchen.com
   - Latest recipe: double-chocolate-zucchini-bread
   - Archive recipes (one per year back to 2020)
2. seriouseats.com
   - Latest 5 recipes
   - Historical recipes with known structure changes

#### D. Validation Tests
- Missing required fields
- Malformed data
- Empty/null handling
- Special character handling
- Multi-language content

### 3. Test Fixtures

#### A. Live URL Testing
```bash
#!/bin/bash
# test-parsers.sh
URLS=(
  "https://smittenkitchen.com/2025/08/double-chocolate-zucchini-bread/"
  # Add more URLs here
)

for url in "${URLS[@]}"; do
  # Fetch page
  curl -s "$url" > "test-data/$(date +%s).html"
  # Run parser
  npm run test:parser "$url"
done
```

#### B. Snapshot Testing
- Store HTML snapshots in Git LFS
- Version control snapshot metadata
- Regular updates via automated process

### 4. Validation Coverage

#### Required for Each Site Parser
1. Mandatory Field Tests
   - Title extraction
   - Author attribution
   - Ingredient list completeness
   - Instruction step validation
   - URL canonicalization

2. Edge Cases
   - Multi-page recipes
   - Printer-friendly versions
   - AMP versions
   - Mobile layouts
   - International variants

## Implementation Plan

### Phase 1: Infrastructure
1. Create parser module structure
2. Set up test infrastructure
3. Implement base parser class
4. Add validation framework

### Phase 2: Migration
1. Create site-specific parsers
2. Migrate existing logic
3. Add comprehensive tests
4. Validate against live sites

### Phase 3: Extension Integration
1. Update extension to use new parser module
2. Add error handling and fallbacks
3. Implement parser selection logic
4. Add telemetry for parser success/failure

## Success Metrics
1. 100% extraction of mandatory fields
2. All existing test cases passing
3. No manual intervention needed for parser updates
4. Clear error reporting for failed parses
5. Automated validation of new recipe URLs

## Questions for Review
1. Should we maintain backward compatibility with existing parser interfaces?
2. How do we handle sites that frequently change their markup?
3. Should we implement a parser scoring system for multiple matches?
4. How do we handle authentication-required recipes?
5. What's our strategy for sites blocking automated access?
