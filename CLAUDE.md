# RecipeArchive Project Guide

## 🎯 Current Status (September 6, 2025)

**✅ CORE SYSTEM**: Fully operational recipe management with advanced search capabilities  
**🔍 SEARCH BACKEND**: Production-ready OpenAI-powered search (Phase 1-2 COMPLETE, 16/16 tests passing)  
**🌐 Production**: https://d1jcaphz4458q7.cloudfront.net  
**📦 Branch**: `search` - Ready for Phase 3 Flutter UI implementation

## 🎯 NEXT PRIORITIES

**🚀 Phase 3: Advanced Flutter Search UI** (Ready to implement)
- Flutter search screen with comprehensive filters  
- Advanced search service integration
- Responsive UI with expandable filter sections

**👋 New User Onboarding UX** (High Priority)
- Static placeholder content for empty recipe archives
- Extension installation guide with recipe site links
- Dynamic hiding when first recipe added

**📊 Phase 4: Search Analytics** (Future)
- Search performance metrics and optimization

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

## 🔍 Advanced Search System (Production Ready)

### Architecture Overview
**✅ COMPLETED**: Comprehensive OpenAI-powered search with cost-efficient AWS architecture  
**📊 Implementation Status**: **Phases 1-2 COMPLETE** (16/16 validation tests passing)  
**💰 Cost Optimization**: In-Lambda memory search - **NO EXTERNAL SEARCH SERVICES** = significant AWS cost savings

### Core Features
- **🎯 Intelligent Search**: OpenAI-powered metadata generation with 9 comprehensive search fields
- **📱 Cross-Platform**: Backend ready for Flutter, web, and mobile apps
- **💾 Cost-Efficient**: In-memory Lambda filtering instead of expensive ElasticSearch/OpenSearch
- **🔄 Background Processing**: SQS-based async normalization pipeline
- **🔄 Backward Compatible**: Works with both normalized and legacy recipes

### Search Capabilities
| **Filter Type** | **Parameters** | **Examples** |
|-----------------|----------------|-------------|
| **Text Search** | `q` | Search across title, ingredients, instructions |
| **Time Filters** | `minPrepTime`, `maxPrepTime`, `minCookTime`, `maxCookTime`, `minTotalTime`, `maxTotalTime` | Recipes under 30 minutes |
| **Servings** | `minServings`, `maxServings` | 2-6 servings |
| **Meal Types** | `mealType` | breakfast, lunch, brunch, dinner, snack, dessert, appetizer, drink |
| **Semantic Tags** | `semanticTags` | italian, comfort-food, weeknight, healthy |
| **Ingredients** | `primaryIngredients` | chicken, tomatoes, pasta, vegetables |
| **Cooking Methods** | `cookingMethods` | baked, sautéed, grilled, slow-cooked |
| **Dietary** | `dietaryTags` | vegetarian, gluten-free, dairy-free, low-carb |
| **Flavor Profile** | `flavorProfile` | savory, sweet, spicy, herbed |
| **Equipment** | `equipment` | oven, slow-cooker, grill, instant-pot |
| **Complexity** | `complexity` | beginner, intermediate, advanced |
| **Time Category** | `timeCategory` | quick-15min, medium-30min, long-60min |

### API Endpoints
```bash
# Search recipes with filters
GET /v1/recipes/search?q=pasta&mealType=dinner&maxTotalTime=30&cookingMethods=baked

# Advanced filtering examples
GET /v1/recipes/search?primaryIngredients=chicken&dietaryTags=gluten-free&complexity=beginner
GET /v1/recipes/search?semanticTags=comfort-food&minServings=4&flavorProfile=savory
```

### SearchMetadata Structure
```json
{
  "semanticTags": ["italian", "comfort-food", "weeknight"],
  "primaryIngredients": ["chicken", "tomatoes", "pasta"], 
  "cookingMethods": ["baked", "sautéed"],
  "dietaryTags": ["gluten-free", "dairy-free"],
  "flavorProfile": ["savory", "herbed"],
  "equipment": ["oven", "large-pot"],
  "timeCategory": "medium-30min",
  "complexity": "intermediate", 
  "mealType": "dinner"
}
```

### Cost Optimization Features
- **In-Lambda Search**: No ElasticSearch/OpenSearch costs (saves $100+/month)
- **S3 Storage Limits**: SearchMetadata fields capped at 3-5 items each
- **Minimal Storage**: Search metadata adds <200 bytes per recipe
- **Background Processing**: Async OpenAI normalization via SQS
- **Memory Efficient**: All filtering done in 256MB Lambda function

### Testing & Validation
```bash
# Run comprehensive search tests (16 scenarios)
./tests/search-validation.sh

# Individual search test examples
./tests/search-integration.sh  # End-to-end pipeline testing
```

**✅ Test Results**: 16/16 search tests passing including:
- Basic search functionality
- Advanced metadata filtering (meal type, total time, semantic tags)
- Sorting and pagination
- Backward compatibility
- Cost optimization validation

### Implementation Phases
- ✅ **Phase 1**: Enhanced OpenAI metadata generation (9 search fields)
- ✅ **Phase 2**: Production backend search endpoint with cost-efficient filtering  
- 🟡 **Phase 3**: Advanced Flutter search UI with filters and suggestions
- ⏳ **Phase 4**: Search analytics and optimization

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

### 🔍 COMPLETED: Advanced Search Functionality (Branch: `search`)

**📊 Implementation Status**: **Phases 1-2 COMPLETE** with comprehensive cost-efficient AWS architecture

**✅ Completed Phases**:
- ✅ **Phase 1**: Enhanced OpenAI metadata generation in background normalizer with 8 search fields
- ✅ **Phase 2**: Production-ready backend search endpoint with cost-efficient in-Lambda filtering 
- 🔄 **Phase 3**: Advanced Flutter search UI implementation (IN PROGRESS)
- ⏸️ **Phase 4**: Search analytics and optimization (PENDING)

**🚀 Production Deployment**:
- ✅ SearchMetadata struct with semantic tags, ingredients, cooking methods, dietary tags, flavor profiles, equipment, time categories, complexity
- ✅ Cost-efficient `/v1/recipes/search` endpoint with comprehensive query parameter support
- ✅ In-Lambda memory search (no external search services = lower AWS costs)
- ✅ Comprehensive validation: **14/14 search tests** and **9/9 integration tests** passing
- ✅ Integrated into validate-monorepo.sh tooling
- ✅ Backward compatibility with legacy recipes
- ✅ Multi-field sorting and cursor-based pagination

**💰 Cost Optimization Achieved**:
- In-memory Lambda filtering instead of ElasticSearch/OpenSearch
- SearchMetadata size limits to minimize S3 storage costs
- Efficient query processing with graceful degradation

### 🎯 NEW USER ONBOARDING UX (Priority for Tomorrow)

**Goal**: Create engaging first-time user experience for empty recipe archives

**Implementation Requirements**:
1. **Static Placeholder Content** - Display when user has zero recipes:
   - Welcome message explaining Recipe Archive purpose
   - Clear instructions for installing browser extensions
   - Step-by-step guide for capturing recipes from web
   
2. **Supported Recipe Sites** - Hyperlinked list for easy discovery:
   - [Smitten Kitchen](https://smittenkitchen.com)
   - [Food52](https://food52.com) 
   - [NYT Cooking](https://cooking.nytimes.com)
   - [Food Network](https://foodnetwork.com)
   - [Washington Post](https://washingtonpost.com/food)
   - [Love & Lemons](https://loveandlemons.com)
   - [AllRecipes](https://allrecipes.com)
   - [Epicurious](https://epicurious.com)
   - [Serious Eats](https://seriouseats.com)
   - [Alexandra's Kitchen](https://alexandrascooking.com)
   - [Food & Wine](https://foodandwine.com)
   - [Damn Delicious](https://damndelicious.net)

3. **Dynamic Hiding Logic** - Automatically hide placeholder content when first recipe is ingested

4. **Test Data Reset** - Purge all recipes from mattbordenet@hotmail.com tenant for UX validation

**Files to Modify**:
- `recipe_archive/lib/screens/home_screen.dart` - Add conditional placeholder content
- `recipe_archive/lib/widgets/onboarding_content.dart` - Create new onboarding widget
- Extension links and setup instructions

**Expected Outcome**: New users immediately understand how to start building their recipe archive with clear guidance and clickable recipe sites.

---

*System is now fully operational with comprehensive fixes deployed. See individual component README.md files for detailed setup instructions.*