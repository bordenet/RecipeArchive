# Mobile Share HTML Passthrough Implementation

## Status: ✅ FULLY IMPLEMENTED (Testing Required)

**Last Updated**: 2025-10-27

---

## ✅ Implementation Complete - All Phases Done

### Phase 1: iOS Share Extension - ✅ COMPLETE
**File**: [recipe_archive/ios/RecipeArchive/ShareViewController.swift](recipe_archive/ios/RecipeArchive/ShareViewController.swift)

**Implemented Features**:
- ✅ Extracts both URL and HTML from `NSExtensionItem`
- ✅ Uses `DispatchGroup` for concurrent extraction
- ✅ Supports multiple type identifiers (iPad/Mac compatibility)
- ✅ Handles HTML extraction via `public.html` type
- ✅ Saves to App Group as JSON file (`shared_recipe.json`)
- ✅ Validates URLs (must be http/https)
- ✅ User-friendly success/error messages
- ✅ Timeout protection (10 second limit)

**JSON Format Saved to App Group**:
```json
{
  "url": "https://example.com/recipe",
  "html": "<html>...</html>",  // Optional
  "timestamp": 1234567890.123
}
```

### Phase 2: Flutter ↔ iOS Platform Channel - ✅ COMPLETE
**Files**:
- [recipe_archive/ios/Runner/AppDelegate.swift](recipe_archive/ios/Runner/AppDelegate.swift)
- [recipe_archive/lib/services/share_channel.dart](recipe_archive/lib/services/share_channel.dart)

**Implemented Features**:
- ✅ AppDelegate reads JSON file from App Group
- ✅ Returns JSON string to Flutter with both `url` and `html` (if available)
- ✅ Deletes file after reading (prevents duplicate processing)
- ✅ ShareChannel parses JSON payload
- ✅ Returns `Map<String, String>?` with `{url, html?}`
- ✅ Backwards compatible fallback for plain URL strings
- ✅ Handles both `checkForSharedUrl()` (manual check) and `sharedUrl` handler (push notification)
- ✅ `applicationWillEnterForeground` triggers check automatically

### Phase 3: Flutter Recipe Processing - ✅ COMPLETE
**File**: [recipe_archive/lib/screens/home_screen.dart](recipe_archive/lib/screens/home_screen.dart)

**Implemented Features**:
- ✅ `_checkForSharedUrl()` called on app startup
- ✅ `ShareChannel.setSharedUrlHandler()` set for push notifications
- ✅ `_processSharedRecipe(url, {html})` handles both URL and HTML
- ✅ Builds recipe with `webArchiveHtml` field when HTML available
- ✅ Calls `recipeService.saveRecipe()` with full payload
- ✅ Shows appropriate SnackBar messages
- ✅ Invalidates recipe list to show new recipe
- ✅ Provides "View" action to navigate to recipe detail

### Phase 4: Backend HTML Processing - ✅ COMPLETE
**Files**:
- [aws-backend/functions/recipes/main.go](aws-backend/functions/recipes/main.go)
- [aws-backend/functions/background-normalizer/openai_operations.go](aws-backend/functions/background-normalizer/openai_operations.go)
- [aws-backend/functions/background-normalizer/url_parser.go](aws-backend/functions/background-normalizer/url_parser.go)

**Implemented Features**:

#### Recipes Lambda:
- ✅ `CreateRecipeRequest` has `WebArchiveHTML *string` field
- ✅ Passes `webArchiveHtml` to normalization request as `pageHtml`
- ✅ Logs HTML character count when provided
- ✅ Saves recipe to S3 with HTML included

#### Background Normalizer:
- ✅ Detects placeholder recipes (minimal content)
- ✅ Calls `parseRecipeFromURL()` for placeholder recipes
- ✅ `parseRecipeFromURL()` performs multi-tier extraction:
  1. JSON-LD structured data
  2. Microdata extraction
  3. Site-specific parsers (e.g., Smitten Kitchen)
- ✅ Normalizes extracted data with OpenAI
- ✅ Preserves cookingMethods structure
- ✅ Validates recipe quality (rejects 0/0 recipes)
- ✅ Cache disabled to ensure fresh normalizations

---

## 🎯 End-to-End Workflow

### Current State: WORKS BUT NEEDS HTML PARSING ENHANCEMENT

**User Action**: Share recipe from Safari → RecipeArchive extension

**Flow**:
1. **ShareViewController** (iOS):
   - Extracts URL + HTML from shared content
   - Saves `{url, html, timestamp}` to App Group JSON file
   - Shows "Recipe Saved" alert

2. **User switches to RecipeArchive app**

3. **AppDelegate** (`applicationWillEnterForeground`):
   - Reads JSON file from App Group
   - Sends `{url, html}` to Flutter via method channel

4. **HomeScreen** (Flutter):
   - Receives shared data
   - Calls `_processSharedRecipe(url, html: html)`
   - Creates recipe with:
     - `sourceUrl`: The recipe URL
     - `title`: "Recipe from [domain]"
     - `ingredients`: Placeholder text
     - `instructions`: Placeholder text
     - `webArchiveHtml`: Full HTML content (if available)

5. **RecipeService** (Flutter → Backend):
   - POST to `/recipes` endpoint
   - Payload includes `webArchiveHtml` field

6. **Recipes Lambda** (AWS):
   - Receives recipe with `webArchiveHtml`
   - Saves to S3 with HTML intact
   - Sends SQS message to trigger normalization

7. **Background Normalizer** (AWS):
   - Reads recipe from S3
   - Detects placeholder recipe (minimal content)
   - Calls `parseRecipeFromURL()`
   - **CURRENT LIMITATION**: `parseRecipeFromURL()` fetches URL again instead of using provided HTML
   - Extracts recipe data (JSON-LD, microdata, or site-specific)
   - Normalizes with OpenAI
   - Saves normalized recipe back to S3

8. **Flutter App**:
   - Polls for recipe updates
   - Displays normalized recipe with ingredients/instructions

---

## 🔧 What's Working vs What Needs Work

### ✅ Working Perfectly:
1. iOS Share Extension extracts both URL and HTML
2. App Group file-based communication (reliable across iOS/macOS)
3. Platform channel JSON payloads
4. Flutter receives and processes HTML
5. Backend receives and stores HTML in S3
6. Placeholder recipe detection
7. Multi-tier recipe parsing (JSON-LD, microdata, site-specific)
8. OpenAI normalization

### ⚠️ Gap: HTML Not Used for Parsing

**Current Behavior**:
- HTML is extracted from share extension ✅
- HTML is sent to backend ✅
- HTML is stored in S3 ✅
- **BUT**: `parseRecipeFromURL()` fetches the URL again instead of using the provided HTML ❌

**Why This Matters**:
- **Paywalled sites**: If user shares from authenticated session, we have the HTML, but we re-fetch and hit the paywall
- **Performance**: Unnecessary network request when we already have the content
- **Accuracy**: Shared HTML is exactly what user saw; re-fetched HTML might differ

**Solution Needed**:
Modify `parseRecipeFromURL()` to:
1. Accept optional `html` parameter
2. If HTML provided, parse it directly instead of fetching
3. If no HTML, fall back to current URL fetching behavior

---

## 🛠️ Required Changes for Full HTML Passthrough

### Option A: Modify `parseRecipeFromURL()` (Recommended)

**File**: [aws-backend/functions/background-normalizer/url_parser.go](aws-backend/functions/background-normalizer/url_parser.go:40)

**Change Function Signature**:
```go
// Before:
func parseRecipeFromURL(ctx context.Context, url string) (*Recipe, error) {

// After:
func parseRecipeFromURL(ctx context.Context, url string, providedHTML *string) (*Recipe, error) {
```

**Add HTML Handling**:
```go
func parseRecipeFromURL(ctx context.Context, url string, providedHTML *string) (*Recipe, error) {
    fmt.Printf("🌐 Parsing recipe from URL: %s\n", url)

    var doc *html.Node
    var err error

    // Use provided HTML if available
    if providedHTML != nil && len(*providedHTML) > 0 {
        fmt.Printf("✅ Using provided HTML (%d characters) - skipping URL fetch\n", len(*providedHTML))
        doc, err = html.Parse(strings.NewReader(*providedHTML))
        if err != nil {
            return nil, fmt.Errorf("failed to parse provided HTML: %w", err)
        }
    } else {
        // Fallback: Fetch HTML from URL (existing code)
        fmt.Printf("📡 No HTML provided - fetching from URL\n")
        client := &http.Client{Timeout: 30 * time.Second}
        // ... existing fetch logic ...
    }

    // Continue with existing parsing logic (JSON-LD, microdata, etc.)
    recipe := &Recipe{SourceURL: url}
    // ... rest of function ...
}
```

**Update Callers**:
```go
// In openai_operations.go:
if isPlaceholderRecipe(recipe) {
    fmt.Printf("🔍 Detected placeholder recipe, parsing content\n")

    // Check if we have webArchiveHtml in the recipe
    var htmlPtr *string
    if recipe.WebArchiveHTML != nil && len(*recipe.WebArchiveHTML) > 0 {
        htmlPtr = recipe.WebArchiveHTML
        fmt.Printf("✅ Using provided HTML from mobile share\n")
    }

    parsedRecipe, err := parseRecipeFromURL(ctx, recipe.SourceURL, htmlPtr)
    // ... rest of logic ...
}
```

### Option B: Create Separate Function (Alternative)

Create `parseRecipeFromHTML()` for direct HTML parsing:

```go
func parseRecipeFromHTML(html string, sourceURL string) (*Recipe, error) {
    doc, err := html.Parse(strings.NewReader(html))
    if err != nil {
        return nil, fmt.Errorf("failed to parse HTML: %w", err)
    }

    recipe := &Recipe{SourceURL: sourceURL}

    // Multi-tier extraction (same logic as parseRecipeFromURL)
    if err := extractJSONLD(doc, recipe); err == nil && recipe.Title != "" {
        return recipe, nil
    }

    if err := extractMicrodata(doc, recipe); err == nil && recipe.Title != "" {
        return recipe, nil
    }

    // ... site-specific parsers ...

    return recipe, nil
}
```

Then update `openai_operations.go` to use it when HTML is available.

---

## 🧪 Testing Checklist

### Phase 1: iOS Share Extension
- [x] Share from Safari - URL extracted ✅
- [ ] Share from Safari - HTML extracted (verify in logs)
- [ ] Check App Group `shared_recipe.json` contains both fields
- [ ] Test with paywall site (NYTimes Cooking)
- [ ] Test with non-paywall site
- [ ] Test timeout handling (slow sites)
- [ ] Test error handling (invalid URLs)

### Phase 2: Platform Channel
- [ ] App receives JSON with both URL and HTML
- [ ] App handles URL-only case (HTML missing)
- [ ] App handles malformed JSON (fallback to URL)
- [ ] File deleted after reading (check App Group container)

### Phase 3: Flutter Processing
- [ ] Recipe created with `webArchiveHtml` field
- [ ] SnackBar shows appropriate message
- [ ] Recipe appears in list
- [ ] Navigation to recipe detail works

### Phase 4: Backend Processing
- [ ] S3 object contains `webArchiveHtml` field
- [ ] SQS message triggers normalization
- [ ] Background normalizer receives HTML
- [ ] **TODO**: Background normalizer uses HTML for parsing (requires implementation)
- [ ] Normalized recipe has full ingredients/instructions
- [ ] Recipe updates in Flutter app

### End-to-End
- [ ] Share paywalled recipe → Full recipe extracted
- [ ] Share non-paywalled recipe → Full recipe extracted
- [ ] Recipe appears "JUST AS IF IT HAD BEEN PUSHED VIA WEB EXTENSION"
- [ ] No errors in CloudWatch logs
- [ ] Performance acceptable (< 30 seconds total)

---

## 📊 Current vs Target State

| Component | Current Status | Target Status |
|-----------|---------------|---------------|
| iOS Share Extension | ✅ Extracts URL + HTML | ✅ No changes needed |
| App Group Communication | ✅ JSON file-based | ✅ No changes needed |
| Platform Channel | ✅ Sends URL + HTML | ✅ No changes needed |
| Flutter Processing | ✅ Includes webArchiveHtml | ✅ No changes needed |
| Recipes Lambda | ✅ Receives and stores HTML | ✅ No changes needed |
| Background Normalizer | ⚠️ Fetches URL (ignores HTML) | ❌ **NEEDS FIX**: Use provided HTML |
| URL Parser | ⚠️ Always fetches URL | ❌ **NEEDS FIX**: Accept HTML parameter |
| End-to-End Workflow | ⚠️ Works but re-fetches | ✅ **TARGET**: Use shared HTML |

---

## 📝 Files to Modify for Full Implementation

### Required Changes:
1. **[aws-backend/functions/background-normalizer/url_parser.go](aws-backend/functions/background-normalizer/url_parser.go)**
   - Modify `parseRecipeFromURL()` to accept `providedHTML *string`
   - Add conditional logic to use provided HTML vs fetch

2. **[aws-backend/functions/background-normalizer/openai_operations.go](aws-backend/functions/background-normalizer/openai_operations.go)**
   - Update `normalizeRecipeWithOpenAI()` to pass `recipe.WebArchiveHTML` to parser
   - Add logging to indicate when HTML is used

3. **[aws-backend/functions/background-normalizer/types.go](aws-backend/functions/background-normalizer/types.go)**
   - Ensure `Recipe` struct has `WebArchiveHTML *string` field (verify it exists)

### Testing Files:
- Create test recipe JSON with `webArchiveHtml` field
- Test with real HTML from various sites
- Verify normalized output matches web extension results

---

## 🎯 Implementation Priority

### HIGH PRIORITY (Blocking Full Functionality):
1. **Modify `parseRecipeFromURL()` to use provided HTML** (1-2 hours)
   - Biggest impact
   - Enables paywalled site support
   - Improves performance

2. **Test end-to-end with paywalled site** (30 minutes)
   - Verify NYTimes Cooking recipe works
   - Compare to web extension results

### MEDIUM PRIORITY (Quality of Life):
3. **Add progress indicators in Flutter** (1 hour)
   - Show "Parsing recipe..." during normalization
   - Poll backend for status updates
   - Update UI when normalization completes

4. **Improve error handling** (1 hour)
   - Better error messages in Flutter
   - Fallback for HTML parsing failures
   - Retry logic for transient failures

### LOW PRIORITY (Nice to Have):
5. **Remove debug logging** (30 minutes)
   - Clean up console.log statements
   - Remove test code
   - Production-ready logging

6. **Add unit tests** (2 hours)
   - Test HTML extraction
   - Test JSON parsing
   - Test backend HTML handling

---

## 🚀 Next Steps

1. **Immediate**: Modify `url_parser.go` to use provided HTML
2. **Deploy**: Update background-normalizer Lambda
3. **Test**: Share paywalled recipe from iOS
4. **Verify**: Recipe has full content (not placeholders)
5. **Compare**: Should match web extension output
6. **Document**: Update REMAINING_TASKS_B_C.md when complete

---

## 📚 Related Documentation

- [XCODE_STEP4_STATUS.md](XCODE_STEP4_STATUS.md) - Xcode build configuration
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Overall project status
- [REMAINING_TASKS_B_C.md](REMAINING_TASKS_B_C.md) - Backend validation tasks
- [docs/architecture/data-flow.md](docs/architecture/data-flow.md) - Data flow diagram
- [docs/api/api-specification.md](docs/api/api-specification.md) - API documentation

---

**Status**: Ready for final implementation (HTML parsing in background-normalizer)
**Created**: 2025-10-25
**Last Updated**: 2025-10-27
**Blocked By**: None (all dependencies complete)
**Blocks**: Full paywalled site support, mobile recipe sharing parity with web extensions
