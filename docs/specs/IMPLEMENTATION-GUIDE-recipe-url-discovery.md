# Recipe URL Discovery Tool - Implementation Guide for Google Gemini

## CRITICAL: Read This First

**You are implementing a Go CLI tool to discover and validate recipe URLs for E2E testing.**

**DO NOT:**
- Create new parsers or modify existing parsers
- Change the test suite structure beyond updating URLs
- Modify any TypeScript/JavaScript parser code
- Add new dependencies without approval
- Make architectural changes to the parser system

**DO:**
- Follow Go best practices and error handling patterns used in existing tools
- Use the existing parser infrastructure for validation
- Create a standalone CLI tool that can be run independently
- Write comprehensive error messages and logging
- Test thoroughly with multiple sites before submitting

## Project Context

### Current Problem
The E2E parser test suite at `tests/e2e/parser-regression-suite.test.js` contains hardcoded recipe URLs that frequently become stale:
- Recipe pages get deleted (404s)
- URLs change due to site redesigns
- Domains get sold or shut down

**Current Test Results:** 7/13 tests passing (54%)
**Goal:** Achieve 100% test pass rate with fresh, working URLs

### Project Structure
```
RecipeArchive/
├── parsers/                    # TypeScript parsers (DO NOT MODIFY)
│   ├── types.ts               # Recipe interface definition
│   ├── base-parser.ts         # Base parser class
│   ├── parser-registry.ts     # Parser registry
│   └── sites/                 # Site-specific parsers
│       ├── allrecipes.ts
│       ├── food52.ts
│       ├── epicurious.ts
│       └── ... (15 total parsers)
├── extensions/chrome/
│   └── typescript-parser-bundle.js  # Compiled parser bundle
├── tests/e2e/
│   └── parser-regression-suite.test.js  # Test suite to update
├── tools/
│   ├── content-ops/           # Existing Go tool (reference)
│   ├── recipe-tracer/         # Existing Go tool (reference)
│   └── recipe-url-discovery/  # NEW TOOL - YOU CREATE THIS
│       ├── main.go
│       ├── config.yaml
│       ├── discoverers/
│       ├── validators/
│       └── cache/
└── .env                       # AWS credentials (already exists)
```

### Supported Recipe Sites (15 total)
1. allrecipes.com - **PASSING** ✅
2. serious-eats.com (seriouseats.com) - **PASSING** ✅
3. cooking.nytimes.com - **PASSING** ✅
4. loveandlemons.com - **PASSING** ✅
5. alexandracooks.com - **PASSING** ✅
6. damndelicious.net - **PASSING** ✅
7. smittenkitchen.com - **PASSING** ✅
8. epicurious.com - **FAILING** ❌ (404, needs new URL)
9. food52.com - **FAILING** ❌ (parser bug, not URL issue)
10. foodnetwork.com - **FAILING** ❌ (parser bug, not URL issue)
11. foodandwine.com - **FAILING** ❌ (parser bug, not URL issue)
12. lemonsandzest.com - **FAILING** ❌ (parser bug, not URL issue)
13. washingtonpost.com - **FAILING** ❌ (HTTP/2 blocking)

**Note:** anthony-kitchen was removed (domain sold). Only focus on the 13 active sites.

## Recipe Data Contract (CRITICAL)

Your tool must validate that discovered URLs return recipes matching this TypeScript interface:

```typescript
interface Recipe {
  // REQUIRED FIELDS (must be present and non-empty)
  title: string;              // Max 200 chars
  source: string;             // Valid URL
  ingredients: Ingredient[];  // Non-empty array
  instructions: Instruction[]; // Non-empty array

  // OPTIONAL FIELDS
  author?: string;
  imageUrl?: string;
  prepTime?: string;          // ISO 8601 duration or human-readable
  cookTime?: string;
  totalTime?: string;
  servings?: string;          // NOT a number, it's a string!
  notes?: string[];
  tags?: string[];
}

interface Ingredient {
  text: string;  // e.g., "2 cups all-purpose flour"
}

interface Instruction {
  stepNumber: number;  // 1-indexed
  text: string;        // e.g., "Preheat oven to 350°F"
}
```

**Validation Rules:**
- `title`: Required, 1-200 characters
- `source`: Required, must match the tested URL
- `ingredients`: Required, minimum count varies by site (see config)
- `instructions`: Required, minimum count varies by site (see config)
- `stepNumber`: Must be sequential starting from 1
- All string fields: Must be non-empty after trimming

## Implementation Phases

### Phase 1: Project Setup (30 minutes)

**1.1 Create Directory Structure**
```bash
cd tools
mkdir -p recipe-url-discovery/{discoverers,validators,cache}
cd recipe-url-discovery
go mod init github.com/yourusername/recipe-url-discovery
```

**1.2 Create config.yaml**
```yaml
# Configuration for recipe URL discovery
# DO NOT modify minIngredients/minInstructions without consulting test suite

sites:
  allrecipes:
    domain: allrecipes.com
    sitemapUrl: https://www.allrecipes.com/sitemap.xml
    parserName: AllRecipesParser
    minIngredients: 6
    minInstructions: 3
    currentTestUrl: https://www.allrecipes.com/recipe/21014/good-old-fashioned-pancakes/
    status: passing

  epicurious:
    domain: epicurious.com
    sitemapUrl: https://www.epicurious.com/sitemap.xml
    parserName: EpicuriousParser
    minIngredients: 4
    minInstructions: 2
    currentTestUrl: https://www.epicurious.com/recipes/food/views/pasta-with-no-cook-tomato-sauce-and-fresh-mozzarella
    status: failing
    issue: URL returns 404

  food52:
    domain: food52.com
    sitemapUrl: https://food52.com/sitemap.xml
    parserName: Food52Parser
    minIngredients: 8
    minInstructions: 4
    currentTestUrl: https://food52.com/recipes/confit-red-pepper-and-tomato-sauce-with-pasta
    status: failing
    issue: Parser extracts title but 0 ingredients

  foodnetwork:
    domain: foodnetwork.com
    sitemapUrl: https://www.foodnetwork.com/sitemap.xml
    parserName: FoodNetworkParser
    minIngredients: 5
    minInstructions: 5
    currentTestUrl: https://www.foodnetwork.com/recipes/alton-brown/good-eats-roast-turkey-recipe-1950271
    status: failing
    issue: Parser extracts title but 0 ingredients

  seriouseats:
    domain: seriouseats.com
    sitemapUrl: https://www.seriouseats.com/sitemap.xml
    parserName: SeriousEatsParser
    minIngredients: 10
    minInstructions: 4
    currentTestUrl: https://www.seriouseats.com/the-best-black-bean-burger-recipe
    status: passing

  smittenkitchen:
    domain: smittenkitchen.com
    sitemapUrl: https://smittenkitchen.com/sitemap.xml
    parserName: SmittenKitchenParser
    minIngredients: 8
    minInstructions: 5
    currentTestUrl: https://smittenkitchen.com/2016/06/the-consummate-chocolate-chip-cookie-revisited/
    status: passing

  nytcooking:
    domain: cooking.nytimes.com
    sitemapUrl: https://cooking.nytimes.com/sitemap.xml
    parserName: NYTCookingParser
    minIngredients: 8
    minInstructions: 4
    currentTestUrl: https://cooking.nytimes.com/recipes/1015819-chocolate-chip-cookies
    status: passing

  damndelicious:
    domain: damndelicious.net
    sitemapUrl: https://damndelicious.net/sitemap.xml
    parserName: DamnDeliciousParser
    minIngredients: 8
    minInstructions: 3
    currentTestUrl: https://damndelicious.net/2013/07/07/korean-beef-bowl/
    status: passing

  foodandwine:
    domain: foodandwine.com
    sitemapUrl: https://www.foodandwine.com/sitemap.xml
    parserName: FoodAndWineParser
    minIngredients: 6
    minInstructions: 4
    currentTestUrl: https://www.foodandwine.com/recipes/classic-french-onion-soup
    status: failing
    issue: Empty title extraction

  alexandraskitchen:
    domain: alexandracooks.com
    sitemapUrl: https://alexandracooks.com/sitemap.xml
    parserName: AlexandrasKitchenParser
    minIngredients: 3
    minInstructions: 5
    currentTestUrl: https://alexandracooks.com/2017/10/24/artisan-sourdough-made-simple-sourdough-bread-demystified-a-beginners-guide-to-sourdough-baking/
    status: passing

  loveandlemons:
    domain: loveandlemons.com
    sitemapUrl: https://www.loveandlemons.com/sitemap.xml
    parserName: LoveAndLemonsParser
    minIngredients: 6
    minInstructions: 3
    currentTestUrl: https://www.loveandlemons.com/hummus-recipe/
    status: passing

  lemonsandzest:
    domain: lemonsandzest.com
    sitemapUrl: https://lemonsandzest.com/sitemap.xml
    parserName: LemonsAndZestParser
    minIngredients: 10
    minInstructions: 6
    currentTestUrl: https://lemonsandzest.com/best-chocolate-cake/
    status: failing
    issue: Empty title extraction

  washingtonpost:
    domain: washingtonpost.com
    sitemapUrl: https://www.washingtonpost.com/sitemap.xml
    parserName: WashingtonPostParser
    minIngredients: 6
    minInstructions: 4
    currentTestUrl: https://www.washingtonpost.com/recipes/classic-tomato-soup/
    status: failing
    issue: HTTP/2 protocol error (site blocking)

# Quality scoring weights
qualityScoring:
  hasTitle: 10
  hasIngredients: 20
  hasInstructions: 20
  hasImage: 10
  hasTimings: 10
  ingredientCountWeight: 2  # 2 points per ingredient, max 10
  instructionCountWeight: 2  # 2 points per instruction, max 10
  minQualityScore: 70       # URLs must score >= 70 to be candidates

# Rate limiting (be respectful!)
rateLimiting:
  requestsPerSecond: 1
  delayBetweenSites: 5000  # milliseconds
  respectRobotsTxt: true
  userAgent: "RecipeArchive-URLDiscovery/1.0 (Educational Project)"
```

**1.3 Create main.go skeleton**
```go
package main

import (
    "flag"
    "fmt"
    "os"
)

func main() {
    // CLI flags
    discoverAll := flag.Bool("discover-all", false, "Discover recipes for all sites")
    site := flag.String("site", "", "Discover recipes for specific site")
    validateCatalog := flag.Bool("validate-catalog", false, "Validate existing test URLs")
    updateTests := flag.Bool("update-tests", false, "Update E2E test catalog with best URLs")

    flag.Parse()

    if *discoverAll {
        fmt.Println("🔍 Discovering recipes for all sites...")
        // TODO: Implement
    } else if *site != "" {
        fmt.Printf("🔍 Discovering recipes for %s...\n", *site)
        // TODO: Implement
    } else if *validateCatalog {
        fmt.Println("✅ Validating existing test catalog...")
        // TODO: Implement
    } else if *updateTests {
        fmt.Println("📝 Updating E2E test catalog...")
        // TODO: Implement
    } else {
        flag.Usage()
        os.Exit(1)
    }
}
```

### Phase 2: URL Discovery (2 hours)

**2.1 Create discoverers/sitemap.go**

```go
package discoverers

import (
    "encoding/xml"
    "fmt"
    "io"
    "net/http"
    "time"
)

// SitemapURL represents a URL from a sitemap
type SitemapURL struct {
    Loc        string    `xml:"loc"`
    LastMod    string    `xml:"lastmod"`
    ChangeFreq string    `xml:"changefreq"`
    Priority   float64   `xml:"priority"`
}

// Sitemap represents the root sitemap structure
type Sitemap struct {
    XMLName xml.Name     `xml:"urlset"`
    URLs    []SitemapURL `xml:"url"`
}

// SitemapDiscoverer fetches URLs from sitemap.xml files
type SitemapDiscoverer struct {
    userAgent string
    client    *http.Client
}

// NewSitemapDiscoverer creates a new sitemap discoverer
func NewSitemapDiscoverer(userAgent string) *SitemapDiscoverer {
    return &SitemapDiscoverer{
        userAgent: userAgent,
        client: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

// DiscoverURLs fetches and parses a sitemap, returning recipe URLs
func (d *SitemapDiscoverer) DiscoverURLs(sitemapURL string, domain string) ([]string, error) {
    req, err := http.NewRequest("GET", sitemapURL, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    req.Header.Set("User-Agent", d.userAgent)

    resp, err := d.client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch sitemap: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("sitemap returned status %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("failed to read sitemap body: %w", err)
    }

    var sitemap Sitemap
    if err := xml.Unmarshal(body, &sitemap); err != nil {
        return nil, fmt.Errorf("failed to parse sitemap XML: %w", err)
    }

    // Filter for recipe URLs (heuristic: contains "recipe" in path)
    var recipeURLs []string
    for _, url := range sitemap.URLs {
        if containsRecipeIndicator(url.Loc) {
            recipeURLs = append(recipeURLs, url.Loc)
        }
    }

    return recipeURLs, nil
}

// containsRecipeIndicator checks if URL likely points to a recipe
func containsRecipeIndicator(url string) bool {
    // Common patterns in recipe URLs
    indicators := []string{
        "/recipe/",
        "/recipes/",
        "-recipe",
        "/dish/",
        "/food/",
    }

    for _, indicator := range indicators {
        if contains(url, indicator) {
            return true
        }
    }

    return false
}

func contains(s, substr string) bool {
    // Simple substring check (or use strings.Contains)
    // Implementation left as exercise
    return false // TODO: Implement
}
```

**CRITICAL INSTRUCTIONS for Sitemap Discovery:**
1. Always respect rate limits (1 req/sec)
2. Handle sitemap index files (sitemaps that point to other sitemaps)
3. Support gzipped sitemaps (.xml.gz)
4. Parse lastmod dates to prioritize recent recipes
5. Limit to max 1000 URLs per site to avoid memory issues
6. Add retry logic with exponential backoff for failed requests

### Phase 3: Recipe Validation (2-3 hours)

**3.1 Create validators/recipe_validator.go**

This is the MOST CRITICAL component. You must validate recipes using the existing TypeScript parser.

```go
package validators

import (
    "context"
    "encoding/json"
    "fmt"
    "os/exec"
    "time"
)

// Recipe matches the TypeScript Recipe interface
type Recipe struct {
    Title        string        `json:"title"`
    Source       string        `json:"source"`
    Ingredients  []Ingredient  `json:"ingredients"`
    Instructions []Instruction `json:"instructions"`
    Author       string        `json:"author,omitempty"`
    ImageURL     string        `json:"imageUrl,omitempty"`
    PrepTime     string        `json:"prepTime,omitempty"`
    CookTime     string        `json:"cookTime,omitempty"`
    TotalTime    string        `json:"totalTime,omitempty"`
    Servings     string        `json:"servings,omitempty"`
    Notes        []string      `json:"notes,omitempty"`
    Tags         []string      `json:"tags,omitempty"`
}

type Ingredient struct {
    Text string `json:"text"`
}

type Instruction struct {
    StepNumber int    `json:"stepNumber"`
    Text       string `json:"text"`
}

// ValidationResult contains the validation outcome
type ValidationResult struct {
    URL           string
    IsValid       bool
    QualityScore  int
    Recipe        *Recipe
    ErrorMessage  string
    ValidationErrors []string
}

// RecipeValidator validates recipe URLs using the TypeScript parser
type RecipeValidator struct {
    parserBundlePath string
}

// NewRecipeValidator creates a new recipe validator
func NewRecipeValidator(parserBundlePath string) *RecipeValidator {
    return &RecipeValidator{
        parserBundlePath: parserBundlePath,
    }
}

// ValidateURL fetches and validates a recipe URL
func (v *RecipeValidator) ValidateURL(url string, minIngredients, minInstructions int) (*ValidationResult, error) {
    // Step 1: Use Node.js + Playwright to fetch page and run parser
    // This matches exactly how the E2E tests work

    ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
    defer cancel()

    // Create a temporary Node.js script that:
    // 1. Launches Playwright browser
    // 2. Navigates to URL
    // 3. Injects parser bundle
    // 4. Runs TypeScriptParser.extractRecipeFromPage()
    // 5. Outputs JSON to stdout

    script := fmt.Sprintf(`
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'RecipeArchive-URLDiscovery/1.0 (Educational Project)'
    });
    const page = await context.newPage();

    try {
        await page.goto('%s', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Inject parser bundle
        const parserBundle = fs.readFileSync('%s', 'utf-8');
        await page.addScriptTag({ content: parserBundle });
        await page.waitForTimeout(2000);

        // Run parser
        const result = await page.evaluate(() => {
            if (window.TypeScriptParser && window.TypeScriptParser.extractRecipeFromPage) {
                return window.TypeScriptParser.extractRecipeFromPage();
            }
            return { error: 'Parser not loaded' };
        });

        console.log(JSON.stringify(result));
    } catch (error) {
        console.log(JSON.stringify({ error: error.message }));
    } finally {
        await browser.close();
    }
})();
`, url, v.parserBundlePath)

    // Write script to temp file and execute with Node.js
    cmd := exec.CommandContext(ctx, "node", "-e", script)
    output, err := cmd.Output()
    if err != nil {
        return &ValidationResult{
            URL:          url,
            IsValid:      false,
            ErrorMessage: fmt.Sprintf("Failed to run parser: %v", err),
        }, nil
    }

    // Parse result
    var recipe Recipe
    if err := json.Unmarshal(output, &recipe); err != nil {
        return &ValidationResult{
            URL:          url,
            IsValid:      false,
            ErrorMessage: fmt.Sprintf("Failed to parse recipe JSON: %v", err),
        }, nil
    }

    // Validate recipe
    result := v.validateRecipe(&recipe, url, minIngredients, minInstructions)
    return result, nil
}

func (v *RecipeValidator) validateRecipe(recipe *Recipe, url string, minIngredients, minInstructions int) *ValidationResult {
    result := &ValidationResult{
        URL:    url,
        Recipe: recipe,
    }

    // Required field validation
    if recipe.Title == "" || len(recipe.Title) > 200 {
        result.ValidationErrors = append(result.ValidationErrors, "Invalid title")
    }

    if recipe.Source != url {
        result.ValidationErrors = append(result.ValidationErrors,
            fmt.Sprintf("Source mismatch: expected %s, got %s", url, recipe.Source))
    }

    if len(recipe.Ingredients) < minIngredients {
        result.ValidationErrors = append(result.ValidationErrors,
            fmt.Sprintf("Insufficient ingredients: %d < %d", len(recipe.Ingredients), minIngredients))
    }

    if len(recipe.Instructions) < minInstructions {
        result.ValidationErrors = append(result.ValidationErrors,
            fmt.Sprintf("Insufficient instructions: %d < %d", len(recipe.Instructions), minInstructions))
    }

    // Validate instruction step numbers
    for i, instruction := range recipe.Instructions {
        expectedStep := i + 1
        if instruction.StepNumber != expectedStep {
            result.ValidationErrors = append(result.ValidationErrors,
                fmt.Sprintf("Invalid step number: step %d has stepNumber %d", expectedStep, instruction.StepNumber))
        }
        if instruction.Text == "" {
            result.ValidationErrors = append(result.ValidationErrors,
                fmt.Sprintf("Empty instruction text at step %d", expectedStep))
        }
    }

    // Validate ingredients
    for i, ingredient := range recipe.Ingredients {
        if ingredient.Text == "" {
            result.ValidationErrors = append(result.ValidationErrors,
                fmt.Sprintf("Empty ingredient text at index %d", i))
        }
    }

    // Calculate quality score
    score := 0
    if recipe.Title != "" { score += 10 }
    if len(recipe.Ingredients) > 0 { score += 20 }
    if len(recipe.Instructions) > 0 { score += 20 }
    if recipe.ImageURL != "" { score += 10 }
    if recipe.PrepTime != "" || recipe.CookTime != "" || recipe.TotalTime != "" { score += 10 }

    // Bonus for quantity
    ingredientBonus := min(len(recipe.Ingredients), 10) * 2
    instructionBonus := min(len(recipe.Instructions), 10) * 2
    score += ingredientBonus + instructionBonus

    result.QualityScore = score
    result.IsValid = len(result.ValidationErrors) == 0 && score >= 70

    if !result.IsValid && len(result.ValidationErrors) > 0 {
        result.ErrorMessage = result.ValidationErrors[0]
    }

    return result
}

func min(a, b int) int {
    if a < b {
        return a
    }
    return b
}
```

**CRITICAL VALIDATION REQUIREMENTS:**
1. MUST use Playwright to fetch pages (same as E2E tests)
2. MUST inject `extensions/chrome/typescript-parser-bundle.js`
3. MUST call `window.TypeScriptParser.extractRecipeFromPage()`
4. MUST validate against EXACT same rules as E2E tests
5. DO NOT write your own parser - use the existing bundle!

### Phase 4: Test Catalog Update (1 hour)

**4.1 Create updater/catalog_updater.go**

```go
package updater

import (
    "bufio"
    "fmt"
    "os"
    "regexp"
    "strings"
)

// CatalogUpdater updates the E2E test catalog with new URLs
type CatalogUpdater struct {
    testFilePath string
}

// NewCatalogUpdater creates a new catalog updater
func NewCatalogUpdater(testFilePath string) *CatalogUpdater {
    return &CatalogUpdater{
        testFilePath: testFilePath,
    }
}

// UpdateURL updates a specific site's URL in the test catalog
func (u *CatalogUpdater) UpdateURL(siteName, oldURL, newURL string) error {
    // Read file
    file, err := os.Open(u.testFilePath)
    if err != nil {
        return fmt.Errorf("failed to open test file: %w", err)
    }
    defer file.Close()

    var lines []string
    scanner := bufio.NewScanner(file)
    inSiteBlock := false

    urlPattern := regexp.MustCompile(`url: "(.+)"`)

    for scanner.Scan() {
        line := scanner.Text()

        // Detect site block start
        if strings.Contains(line, fmt.Sprintf(`site: "%s"`, siteName)) {
            inSiteBlock = true
        }

        // Update URL if in correct site block
        if inSiteBlock && urlPattern.MatchString(line) {
            line = urlPattern.ReplaceAllString(line, fmt.Sprintf(`url: "%s"`, newURL))
            inSiteBlock = false
        }

        lines = append(lines, line)
    }

    if err := scanner.Err(); err != nil {
        return fmt.Errorf("failed to read test file: %w", err)
    }

    // Write back to file
    content := strings.Join(lines, "\n")
    if err := os.WriteFile(u.testFilePath, []byte(content), 0644); err != nil {
        return fmt.Errorf("failed to write test file: %w", err)
    }

    fmt.Printf("✅ Updated %s: %s -> %s\n", siteName, oldURL, newURL)
    return nil
}

// UpdateMultipleURLs updates multiple sites at once
func (u *CatalogUpdater) UpdateMultipleURLs(updates map[string]string) error {
    for siteName, newURL := range updates {
        // Note: We don't have oldURL here, so we need to find it differently
        // This is a simplified version - you'll need to enhance this
        if err := u.UpdateURL(siteName, "", newURL); err != nil {
            return err
        }
    }
    return nil
}
```

**CRITICAL UPDATE REQUIREMENTS:**
1. MUST preserve existing test file formatting
2. MUST update ONLY the URL field for the specified site
3. MUST NOT modify minIngredients or minInstructions
4. MUST create a backup before updating (.bak file)
5. MUST validate the updated file can still be parsed by Node.js

### Phase 5: Integration & CLI (1 hour)

**5.1 Complete main.go**

```go
package main

import (
    "flag"
    "fmt"
    "log"
    "os"
    "path/filepath"

    "github.com/yourusername/recipe-url-discovery/discoverers"
    "github.com/yourusername/recipe-url-discovery/validators"
    "github.com/yourusername/recipe-url-discovery/updater"
)

func main() {
    // CLI flags
    discoverAll := flag.Bool("discover-all", false, "Discover recipes for all sites")
    site := flag.String("site", "", "Discover recipes for specific site (e.g., 'epicurious')")
    validateCatalog := flag.Bool("validate-catalog", false, "Validate existing test URLs")
    updateTests := flag.Bool("update-tests", false, "Update E2E test catalog with best URLs")
    maxURLs := flag.Int("max-urls", 50, "Maximum URLs to test per site")

    flag.Parse()

    // Get project root (tool is in tools/recipe-url-discovery)
    projectRoot, err := filepath.Abs("../..")
    if err != nil {
        log.Fatalf("Failed to get project root: %v", err)
    }

    parserBundlePath := filepath.Join(projectRoot, "extensions/chrome/typescript-parser-bundle.js")
    testFilePath := filepath.Join(projectRoot, "tests/e2e/parser-regression-suite.test.js")
    configPath := filepath.Join(".", "config.yaml")

    // Load config
    config, err := loadConfig(configPath)
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    // Create components
    discoverer := discoverers.NewSitemapDiscoverer(config.RateLimiting.UserAgent)
    validator := validators.NewRecipeValidator(parserBundlePath)
    catalogUpdater := updater.NewCatalogUpdater(testFilePath)

    if *validateCatalog {
        fmt.Println("✅ Validating existing test catalog URLs...")
        validateExistingCatalog(config, validator)
    } else if *site != "" {
        fmt.Printf("🔍 Discovering recipes for %s...\n", *site)
        discoverForSite(*site, config, discoverer, validator, *maxURLs)
    } else if *discoverAll {
        fmt.Println("🔍 Discovering recipes for all sites...")
        discoverAllSites(config, discoverer, validator, *maxURLs)
    } else if *updateTests {
        fmt.Println("📝 Updating E2E test catalog...")
        updateTestCatalog(config, catalogUpdater)
    } else {
        flag.Usage()
        os.Exit(1)
    }
}

func discoverForSite(siteName string, config *Config, discoverer *discoverers.SitemapDiscoverer,
                     validator *validators.RecipeValidator, maxURLs int) {
    siteConfig, ok := config.Sites[siteName]
    if !ok {
        log.Fatalf("Site %s not found in config", siteName)
    }

    fmt.Printf("📡 Fetching sitemap from %s...\n", siteConfig.SitemapURL)
    urls, err := discoverer.DiscoverURLs(siteConfig.SitemapURL, siteConfig.Domain)
    if err != nil {
        log.Fatalf("Failed to discover URLs: %v", err)
    }

    fmt.Printf("Found %d potential recipe URLs\n", len(urls))

    if len(urls) > maxURLs {
        urls = urls[:maxURLs]
        fmt.Printf("Limiting to %d URLs for testing\n", maxURLs)
    }

    // Validate each URL
    var bestResult *validators.ValidationResult
    for i, url := range urls {
        fmt.Printf("Testing %d/%d: %s\n", i+1, len(urls), url)

        result, err := validator.ValidateURL(url, siteConfig.MinIngredients, siteConfig.MinInstructions)
        if err != nil {
            fmt.Printf("  ❌ Error: %v\n", err)
            continue
        }

        if result.IsValid {
            fmt.Printf("  ✅ Valid! Score: %d, Ingredients: %d, Instructions: %d\n",
                result.QualityScore,
                len(result.Recipe.Ingredients),
                len(result.Recipe.Instructions))

            if bestResult == nil || result.QualityScore > bestResult.QualityScore {
                bestResult = result
            }
        } else {
            fmt.Printf("  ❌ Invalid: %s\n", result.ErrorMessage)
        }
    }

    if bestResult != nil {
        fmt.Printf("\n🎯 Best URL found:\n")
        fmt.Printf("  URL: %s\n", bestResult.URL)
        fmt.Printf("  Title: %s\n", bestResult.Recipe.Title)
        fmt.Printf("  Quality Score: %d/100\n", bestResult.QualityScore)
        fmt.Printf("  Ingredients: %d\n", len(bestResult.Recipe.Ingredients))
        fmt.Printf("  Instructions: %d\n", len(bestResult.Recipe.Instructions))

        // Save to cache
        saveToCacheFile(siteName, bestResult)
    } else {
        fmt.Printf("\n❌ No valid URLs found for %s\n", siteName)
    }
}

// TODO: Implement other functions
// - discoverAllSites()
// - validateExistingCatalog()
// - updateTestCatalog()
// - loadConfig()
// - saveToCacheFile()
```

### Phase 6: Testing & Validation (1 hour)

**6.1 Manual Testing Checklist**

Before submitting your implementation:

```bash
# 1. Test single site discovery
cd tools/recipe-url-discovery
go run main.go --site epicurious --max-urls 10

# Expected output:
# - Fetches sitemap successfully
# - Tests up to 10 URLs
# - Shows validation results for each
# - Reports best URL found

# 2. Validate existing catalog
go run main.go --validate-catalog

# Expected output:
# - Tests all 13 current URLs
# - Shows pass/fail for each
# - Reports overall success rate

# 3. Test catalog update (DRY RUN FIRST!)
# Make a backup of the test file first!
cp ../../tests/e2e/parser-regression-suite.test.js ../../tests/e2e/parser-regression-suite.test.js.backup

go run main.go --update-tests

# Expected output:
# - Reads current test file
# - Updates URLs for failing sites
# - Preserves all other content
# - Creates .bak backup

# 4. Verify updated tests work
cd ../../
npm run test:e2e

# Expected: More tests should pass now!
```

**6.2 Integration Test**

Create `test_integration.sh`:
```bash
#!/bin/bash
set -e

echo "🧪 Running integration tests for recipe-url-discovery..."

# Test 1: Discover URLs for epicurious
echo "Test 1: Discover URLs for epicurious"
go run main.go --site epicurious --max-urls 5
echo "✅ Test 1 passed"

# Test 2: Validate one known-good URL
echo "Test 2: Validate known-good URL (allrecipes)"
# TODO: Add validation test

# Test 3: Check catalog update doesn't break file
echo "Test 3: Catalog update safety"
cp ../../tests/e2e/parser-regression-suite.test.js /tmp/test-backup.js
go run main.go --update-tests
diff ../../tests/e2e/parser-regression-suite.test.js /tmp/test-backup.js || true
echo "✅ Test 3 passed"

echo "✅ All integration tests passed!"
```

## Common Pitfalls & How to Avoid Them

### ❌ WRONG: Writing your own recipe parser
```go
// DON'T DO THIS!
func parseRecipe(html string) (*Recipe, error) {
    // Custom parsing logic...
    return &Recipe{}, nil
}
```

### ✅ CORRECT: Using the existing TypeScript parser
```go
// DO THIS!
func validateURL(url string) (*Recipe, error) {
    // Use Playwright + parser bundle
    // Matches E2E test environment exactly
    return runParserBundle(url)
}
```

### ❌ WRONG: Modifying test expectations
```go
// DON'T DO THIS!
minIngredients := 3  // Lowering threshold to make tests pass
```

### ✅ CORRECT: Finding URLs that meet existing expectations
```go
// DO THIS!
// Use config.yaml values - they match the test suite
minIngredients := siteConfig.MinIngredients
```

### ❌ WRONG: Aggressive crawling
```go
// DON'T DO THIS!
for _, url := range allURLs {  // No rate limiting!
    validate(url)
}
```

### ✅ CORRECT: Respectful rate limiting
```go
// DO THIS!
for i, url := range allURLs {
    if i > 0 {
        time.Sleep(time.Second)  // 1 request per second
    }
    validate(url)
}
```

## Dependencies

```bash
# Required Go packages
go get github.com/playwright-community/playwright-go
go get gopkg.in/yaml.v3

# System requirements (must be installed)
npm install -g playwright
npx playwright install chromium
```

## Success Criteria

Your implementation is complete when:

1. ✅ Tool runs without errors for `--site epicurious`
2. ✅ Tool finds at least 1 valid URL for epicurious
3. ✅ Validation matches E2E test expectations exactly
4. ✅ `--validate-catalog` shows accurate results
5. ✅ `--update-tests` successfully updates test file
6. ✅ Running `npm run test:e2e` after update shows improved pass rate
7. ✅ Code includes proper error handling and logging
8. ✅ Rate limiting prevents overwhelming servers
9. ✅ All files are properly commented

## Deliverables

1. Complete Go implementation in `tools/recipe-url-discovery/`
2. Working `config.yaml` with all 13 sites
3. Integration test script
4. Updated E2E test catalog (if `--update-tests` was run)
5. Documentation in `README.md` explaining:
   - How to build and run the tool
   - What each command does
   - How to add new sites
   - Troubleshooting common issues

## Questions to Ask Before Starting

1. Do I have Playwright installed and working?
2. Do I understand the Recipe interface structure?
3. Have I examined how the E2E tests work?
4. Do I know where the parser bundle is located?
5. Am I clear on NOT modifying existing parsers?

## Final Checklist Before Submission

- [ ] Code compiles without errors
- [ ] All linting passes (`golangci-lint run`)
- [ ] Integration tests pass
- [ ] Manual testing on 3+ sites successful
- [ ] No hardcoded paths (use config.yaml)
- [ ] Proper error messages for common failures
- [ ] Rate limiting implemented correctly
- [ ] User-Agent header set appropriately
- [ ] Cache files use proper JSON formatting
- [ ] Test file updates preserve formatting
- [ ] Backup files created before updates
- [ ] Documentation is clear and complete

Good luck! If anything is unclear, ASK before implementing. Getting the validation logic exactly right is critical.
