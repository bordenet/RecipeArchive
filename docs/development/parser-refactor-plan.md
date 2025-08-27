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
  // Required Fields - Must be present and valid for AWS backend acceptance
  title: string;           // Required, max 200 chars
  sourceUrl: string;       // Required, valid URL format
  ingredients: string[];   // Required, non-empty list with valid ingredient names
  instructions: string[];  // Required, non-empty list with valid steps
  
  // Optional Fields - Should be included when available but not required for validation
  author?: string;         // Recommended for attribution
  imageUrl?: string;      // URL to recipe image
  prepTime?: string;      // ISO 8601 duration preferred
  cookTime?: string;      // ISO 8601 duration preferred
  totalTime?: string;     // ISO 8601 duration preferred
  servings?: string;      // Number or descriptive text
  notes?: string[];       // Additional recipe notes/tips
  tags?: string[];        // Recipe categories/keywords
}

interface ValidationResult {
  isValid: boolean;
  missingFields: string[];   // Required fields that are missing
  invalidFields: string[];   // Fields that fail validation rules
  warnings: string[];        // Non-critical issues to report
  
  // Field-specific validation details
  fieldErrors: {
    [key: string]: {
      code: string;          // Error code (e.g., 'MISSING', 'TOO_LONG', 'INVALID_FORMAT')
      message: string;       // Human-readable error message
      value?: any;          // The invalid value (for debugging)
    }
  };
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

1. Required Field Validation
   - Title validation
     - Present and non-empty
     - Max length 200 characters
     - Sanitized of HTML/dangerous content
   
   - Source URL validation
     - Present and non-empty
     - Valid URL format
     - Resolves to supported domain
   
   - Ingredients validation
     - Non-empty array
     - Each ingredient has required components
     - No malformed quantities/units
     - No HTML/dangerous content
   
   - Instructions validation
     - Non-empty array
     - Each step is meaningful (min length)
     - Proper step ordering
     - No HTML/dangerous content

2. Data Integrity Tests
   - Malformed JSON handling
   - Empty/null field handling
   - Special character sanitization
   - HTML entity conversion
   - Multi-language content support
   - UTF-8 encoding validation

3. Security Validation
   - XSS prevention
   - URL sanitization
   - Size limit enforcement
   - Content type validation
   - Input fuzzing tests

4. Edge Cases
   - Minimum valid recipe (only required fields)
   - Maximum field lengths
   - Empty containers ([], {}, "")
   - Whitespace-only content
   - Invalid UTF-8 sequences
   - Control characters
   - Long Unicode strings

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

### 1. Validation Coverage
- 100% validation of AWS backend requirements
- All required fields tested:
  - title (presence, max length, content)
  - sourceUrl (presence, format, resolution)
  - ingredients (structure, content, sanitization)
  - instructions (structure, content, sanitization)
- No uncaught validation errors in production

### 2. Test Coverage
- Unit tests for each validation rule
- Integration tests for complete validation flow
- Regression tests for known edge cases
- Security tests for all sanitization rules
- Performance tests for large recipes

### 3. Error Reporting
- Detailed error messages for each validation failure
- Stack traces preserved for debugging
- Error aggregation for pattern analysis
- User-friendly error summaries
- Error rate monitoring

### 4. Automation
- Pre-commit validation hooks
- Continuous integration checks
- Automated test data updates
- Parser success rate monitoring
- Regular validation against live sites

### 5. Performance
- Validation completes in <100ms
- No memory leaks in validation logic
- Efficient handling of large recipes
- Reasonable error recovery time
- Low false positive rate (<0.1%)

## Questions for Review
1. Should we maintain backward compatibility with existing parser interfaces?
2. How do we handle sites that frequently change their markup?
3. Should we implement a parser scoring system for multiple matches?
4. How do we handle authentication-required recipes?
5. What's our strategy for sites blocking automated access?
