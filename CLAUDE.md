# RecipeArchive Project Guide

## 🎯 Current Status (September 6, 2025)

**✅ FULLY OPERATIONAL**: Complete end-to-end recipe management system with major fixes deployed  
**📊 Recipe Storage**: 23 unique recipes (cleaned from 40+ duplicates)  
**🧪 Testing**: Enhanced Flutter app with improved ingredient scaling and JSON parsing  
**🌐 Production**: https://d1jcaphz4458q7.cloudfront.net  
**🎯 Code Quality**: Major data compatibility and parsing issues resolved  
**🔍 Search Design**: Comprehensive OpenAI-powered search functionality specification completed

## Quick Start

```bash
git clone https://github.com/bordenet/RecipeArchive
./validate-monorepo.sh                               # Validates all components
cd recipe_archive && flutter run -d chrome          # Run Flutter app locally
cd tools/recipe-report && go run main.go            # Generate recipe report (uses .env)
```

## 🚨 Critical Procedures

### Validation & Deployment
- **ALWAYS** run `./validate-monorepo.sh` before GitHub pushes
- **NEVER** bypass Husky checks - these are critical quality gates
- Use automated Flutter deployment: `./deploy.sh` or `./quick-deploy.sh`
- Lambda deployments: Use direct AWS CLI when CDK fails to detect changes

### AWS Lambda Deployment
```bash
cd aws-backend/functions/[function-name]
GOOS=linux GOARCH=amd64 go build -o bootstrap main.go  # Use 'bootstrap' not 'main'
zip deployment-package.zip bootstrap
aws lambda update-function-code --function-name [NAME] --zip-file fileb://deployment-package.zip --region us-west-2
```

## 🏗️ Architecture

### Production Infrastructure
- **Cognito**: User Pool `us-west-2_qJ1i9RhxD`
- **S3 Storage**: `recipearchive-storage-dev-990537043943`
- **Lambda**: `RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w`
- **API Gateway**: `https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod`
- **CloudFront**: Flutter web app distribution

### Multi-Tenant S3 Structure
**✅ Properly Partitioned**: `recipes/{userID}/{recipeID}.json`
- Complete user isolation via JWT validation
- Path-based access control prevents cross-user data access

### Supported Recipe Sites
Smitten Kitchen, Food Network, NYT Cooking, Washington Post, Love & Lemons, Food52, AllRecipes, Epicurious, Serious Eats, Alexandra's Kitchen, Food & Wine, Damn Delicious

## 🔧 Common Tools Reference

| Task | Command |
|------|---------|
| Recipe Report | `cd tools/recipe-report && go run main.go` |
| Test Single Recipe | `S3_STORAGE_BUCKET=recipearchive-storage-dev-990537043943 ./aws-backend/functions/test-tools/test-tools -action=list-recipes -user-id=d80153c0-90b1-7090-85be-28e9c4e458f7` |
| Flutter Deploy | `cd recipe_archive && ./deploy.sh` |
| Lambda Functions | `aws lambda list-functions --region us-west-2 --query 'Functions[?contains(FunctionName, \\`RecipesFunction\\`)].FunctionName' --output table` |
| CloudFront Invalidation | `aws cloudfront create-invalidation --distribution-id E1D19F7SLOJM5H --paths "/*"` |
| Clean Duplicates | `S3_STORAGE_BUCKET=recipearchive-storage-dev-990537043943 ./aws-backend/functions/test-tools/test-tools -action=cleanup-duplicates -user-id=d80153c0-90b1-7090-85be-28e9c4e458f7` |

## ✅ MAJOR ISSUES RESOLVED (September 5, 2025)

### 🎯 "Disappearing Recipes" Bug - FIXED
- **Root Cause**: JSON data format incompatibility between stored data and Go struct expectations
- **Problem**: 40 recipe files in S3, but only 9 readable due to string vs integer parsing failures  
- **Solution**: Enhanced `models.Recipe` with custom JSON unmarshaling supporting both formats
- **Result**: All 23 recipes (post-cleanup) now accessible to Flutter app

### 🔧 Ingredient Scaling Bug - FIXED
- **Problem**: "flesh of 1 ripe avocado" wouldn't scale when adjusting servings
- **Root Cause**: Regex only matched numbers at beginning of ingredient text
- **Solution**: Enhanced regex to handle embedded numbers like "flesh of 1 ripe avocado"
- **Result**: All ingredients with numbers now scale correctly

### 🗑️ Duplicate Recipe Cleanup - COMPLETED
- **Problem**: 40+ recipe files with massive duplication (same recipes 3-7 times)
- **Action**: Ran systematic cleanup removing 17 duplicate files
- **Result**: Clean dataset of 23 unique recipes

### ⏰ Time Display Issue - RESOLVED
- **Problem**: Prep/cook times showing "Unknown" despite data in S3
- **Root Cause**: Field name mismatch (`prepTime` vs `prepTimeMinutes`)
- **Solution**: Added legacy field mapping for backward compatibility
- **Result**: Proper time display in Flutter app

### 🔐 Token Refresh Issues - DEPLOYED
- **Problem**: Chrome/Safari extensions using inconsistent token types after refresh
- **Solution**: Standardized on `idToken` usage across all API calls
- **Status**: Fixed extensions deployed to production S3

## 📊 Current System Health

### ✅ Components Working
- **Lambda Functions**: All 23 recipes now readable with enhanced JSON parsing
- **Flutter Web App**: Enhanced ingredient scaling and time display
- **Extensions**: Token refresh issues resolved and deployed
- **S3 Storage**: Cleaned from 40+ duplicates to 23 unique recipes
- **API Gateway**: Properly routing and authenticating requests

### ⚠️ Known Limitations
- **Flutter Web Build**: Shows Wasm compatibility warnings (not errors, app still works)
- **Recipe Scaling**: Some ingredients like "a handful of sprouts" remain static (expected behavior)
- **Extension Token Refresh**: Properly implemented but may show brief login prompts
- **🚨 Epicurious Paywall**: JavaScript-enforced paywall bypasses initial parsing, creates empty recipes in backend

## 🎆 Recent Achievements (September 6, 2025)

### 🔧 Major System Fixes & Enhancements
- **⏰ Background Normalizer Overhaul**: Fixed critical JSON parsing with FlexInt compatibility for string/numeric fields
- **📊 Recipe Time Display Fix**: Resolved incorrect time calculations - recipes now show accurate total times (Braised Beef: 270min vs previous 35min)
- **🧬 Advanced Ingredient Scaling**: Enhanced regex patterns handle descriptive text ("flesh of 1 ripe avocado") with visual feedback
- **🚀 Extension Race Condition Resolution**: Eliminated popup delays with 10-attempt retry logic for both Chrome and Safari
- **✅ Validation Script Improvements**: Fixed daily Go formatting issues and accurate test reporting (7/7 tests)

### 🔍 Advanced Feature Development  
- **🎯 Comprehensive Search Design**: Completed 4-phase OpenAI-powered search specification with semantic indexing
- **📚 Documentation Transformation**: Cleaned up technical PRDs, focused on user value (browser-extension.md, aws-backend.md)
- **🌟 Visual Enhancement**: Added italicized styling for unscaled ingredients providing clear user feedback
- **🛡️ Paywall Detection**: Added comprehensive Epicurious paywall detection specification to Future Work Queue

### 📈 Production Stability & Quality
- **🧪 Testing Excellence**: All Flutter tests passing (15/15) with proper quality gates
- **🗄️ Data Integrity**: 23 unique recipes maintained with clean S3 storage
- **🌐 Production Health**: https://d1jcaphz4458q7.cloudfront.net fully operational with all enhancements deployed

## 📋 Troubleshooting

### Lambda Issues
- **502 Errors**: Check Lambda uses `bootstrap` binary name (not `main`)
- **Token Validation**: Verify JWT tokens and Cognito configuration
- **Environment Variables**: Ensure all required env vars are set in Lambda config

### Extension Issues
- **Token Expiration**: Extensions auto-refresh tokens via `cognitoAuth.refreshToken()`
- **CORS Errors**: Check API Gateway configuration
- **Recipe Parsing**: Check parser logs via browser developer tools

### Flutter Issues
- **Wasm Warnings**: Expected for packages using dart:html (doesn't prevent functionality)
- **Data Loading**: Check network tab for API call failures
- **Build Errors**: Run `flutter clean && flutter pub get` to reset dependencies

### Flutter Web Deployment Warnings
- **Wasm Compatibility**: Shows warnings about dart:html and dart:ffi usage
- **Impact**: Warnings only, JavaScript compilation works fine
- **Note**: These warnings don't appear in validate-monorepo.sh because it runs `flutter analyze`, not `flutter build web`

---

## 🔮 Future Work Queue

### 🚨 HIGH PRIORITY: Epicurious Paywall Detection & Handling
**Problem**: Epicurious.com enforces JavaScript paywall after initial page load, causing extensions to capture empty/incomplete recipe data and push dead recipes to backend.

**Paywall Behavior**:
- Page appears to fully load with recipe content
- JavaScript then enforces paywall with message: *"You've read your last free article. Get unlimited access for $6 $3/month for one year—cancel anytime."*
- Recipe content gets hidden/replaced with subscription prompt
- Extensions capture incomplete data and create empty recipes in S3

**Required Implementation**:
1. **Parser Enhancement**: Detect paywall CSS classes and JavaScript-modified content
   - Look for: `PaywallModalWrapper-eXxAbG`, `PaywallBarWrapper-ebFvsu`, `consumer-marketing-unit--paywall-*`
   - Detect empty/missing critical recipe fields (ingredients, instructions)
2. **Extension UX**: Display clear paywall detection message in popup instead of success
   - "⚠️ Recipe behind paywall - subscription required to access full content"
   - Provide link to original article for user to handle subscription
3. **Backend Protection**: Prevent storage of incomplete recipes
   - Validate recipe completeness before S3 storage
   - Return appropriate error codes to extensions
4. **Testing**: Use `/tests/fixtures/html-samples/epicurious-PAYWALL-failure-edge-case.html` as test case

**Files to Modify**:
- `extensions/chrome/parsers/epicurious.js` - Add paywall detection
- `extensions/safari/RecipeArchive Extension/Resources/parsers/epicurious.js` - Sync paywall detection  
- `extensions/chrome/popup.js` - Handle paywall error response in UX
- `extensions/safari/RecipeArchive Extension/Resources/popup.js` - Sync popup handling
- `aws-backend/functions/recipes/main.go` - Add recipe validation before storage

**Expected Outcome**: Users see clear feedback about paywall instead of broken/empty recipes in their archive.

### 🔍 NEXT PRIORITY: Comprehensive Search Functionality with OpenAI Normalization

**Overview**: Implement intelligent recipe search leveraging existing OpenAI normalization to create semantic search capabilities with rich metadata indexing.

**Current State Analysis**:
- ✅ **OpenAI Integration**: Already implemented in background normalizer with sophisticated recipe analysis
- ✅ **Basic Search UI**: Flutter app has search UI calling `searchRecipes()` method
- ❌ **Backend Search**: No search logic in Lambda `/v1/recipes` endpoint (only pagination)
- ❌ **Search Indexing**: No searchable metadata beyond basic recipe fields

**Technical Architecture**:

#### Phase 1: Enhanced Metadata Generation
**Goal**: Extend OpenAI normalization to generate search-optimized metadata
```go
// Add to background-normalizer prompt:
"SEARCH METADATA GENERATION:
- Generate semantic tags (cuisine, dietary, difficulty, meal-type, season)
- Extract key ingredients list (top 5 primary ingredients)
- Categorize cooking methods (baked, fried, grilled, no-cook, etc.)  
- Identify dietary restrictions (vegetarian, vegan, gluten-free, dairy-free)
- Generate flavor profiles (spicy, sweet, savory, tangy, umami)
- Extract equipment requirements (oven, stovetop, grill, slow-cooker)
- Time categorization (quick-15min, medium-30min, long-60min+)"
```

**New Recipe Fields**:
```go
type SearchMetadata struct {
    SemanticTags      []string `json:"semanticTags"`      // ["italian", "comfort-food", "weeknight"]
    PrimaryIngredients []string `json:"primaryIngredients"` // ["chicken", "tomatoes", "pasta"]
    CookingMethods    []string `json:"cookingMethods"`     // ["baked", "sautéed"]
    DietaryTags       []string `json:"dietaryTags"`        // ["vegetarian", "gluten-free"]  
    FlavorProfile     []string `json:"flavorProfile"`      // ["savory", "herbed"]
    Equipment         []string `json:"equipment"`          // ["oven", "large-pot"]
    TimeCategory      string   `json:"timeCategory"`       // "medium-30min"
    Complexity        string   `json:"complexity"`         // "beginner", "intermediate"
}
```

#### Phase 2: Backend Search Implementation
**Goal**: Add comprehensive search endpoint with multiple query types

**Search Query Types**:
1. **Text Search**: Full-text across title, ingredients, instructions
2. **Semantic Search**: Match against OpenAI-generated tags and categories  
3. **Ingredient Search**: "recipes with chicken and garlic"
4. **Dietary Filter Search**: "gluten-free vegetarian recipes"
5. **Time-based Search**: "quick recipes under 30 minutes"
6. **Equipment Search**: "no-oven recipes" or "slow-cooker recipes"
7. **Combined Search**: Multiple criteria with AND/OR logic

**Backend Implementation** (`aws-backend/functions/recipes/main.go`):
```go
func handleSearchRecipes(ctx context.Context, userID string, queryParams map[string]string) (events.APIGatewayProxyResponse, error) {
    searchQuery := queryParams["search"]
    filters := parseSearchFilters(queryParams) // dietary, time, equipment, etc.
    
    // Multi-field search with scoring
    results := performMultiFieldSearch(allRecipes, searchQuery, filters)
    
    // Rank by relevance score
    sortedResults := rankSearchResults(results, searchQuery)
    
    return buildSearchResponse(sortedResults)
}

type SearchFilters struct {
    DietaryRestrictions []string
    MaxCookTime        *int
    RequiredEquipment  []string
    ExcludedIngredients []string
    CuisineTypes       []string
}
```

#### Phase 3: Advanced Flutter Search UI  
**Goal**: Rich search interface with filters, suggestions, and faceted search

**Search Features**:
```dart
// Enhanced search widget with:
- Auto-complete from recipe titles and ingredients
- Quick filter chips (Vegetarian, <30min, No-cook, etc.)
- Advanced filter modal (Cuisine, Time Range, Equipment)  
- Search history with saved searches
- Recipe suggestions based on incomplete queries
- "More like this" recommendations using semantic tags
```

**Search Provider Enhancement** (`recipe_archive/lib/services/recipe_service.dart`):
```dart
Future<SearchResults> advancedSearch({
  String? textQuery,
  List<String>? dietaryFilters,
  int? maxCookTime,
  List<String>? cuisineTypes,
  List<String>? requiredEquipment,
  List<String>? excludedIngredients,
}) async {
  // Build complex query parameters
  final queryParams = buildAdvancedSearchParams(...);
  return await performAdvancedSearch(queryParams);
}
```

#### Phase 4: Search Analytics & Optimization
**Goal**: Track search performance and optimize based on usage patterns

**Implementation**:
- **Search Analytics**: Track query patterns, result click-through rates
- **Query Optimization**: Most searched ingredients/cuisines inform UI suggestions
- **Performance Monitoring**: Search response times and result relevance scoring
- **A/B Testing**: Test different search ranking algorithms

**Expected Deliverables**:
1. **Enhanced OpenAI Prompt**: Generate rich search metadata for all existing recipes
2. **Backend Search Engine**: Multi-faceted search with ranking algorithms  
3. **Flutter Search UI**: Advanced search interface with filters and suggestions
4. **Search Analytics**: Usage tracking and optimization insights

**Files to Modify**:
- `aws-backend/functions/background-normalizer/main.go` - Extend OpenAI prompt for search metadata
- `aws-backend/functions/recipes/main.go` - Add comprehensive search endpoint
- `recipe_archive/lib/services/recipe_service.dart` - Enhanced search methods
- `recipe_archive/lib/screens/search_screen.dart` - Advanced search UI
- `recipe_archive/lib/models/recipe.dart` - Add SearchMetadata fields

**Success Metrics**:
- Users can find relevant recipes in <3 query attempts
- Search covers 90%+ of common cooking scenarios (ingredients, time, diet)
- Search response time <500ms for any query complexity
- 80%+ user satisfaction with search result relevance

---

*System is now fully operational with comprehensive fixes deployed. See individual component README.md files for detailed setup instructions.*