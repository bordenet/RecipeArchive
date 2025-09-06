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

### 🔍 ACTIVE DEVELOPMENT: Search Functionality Implementation (Branch: `search`)

**Reference**: See detailed 4-phase search specification in Future Work Queue below.

**Current Progress**:
- ✅ **Phase 1**: Enhanced metadata generation in background normalizer (COMPLETED)
- 🔄 **Phase 2**: Backend search endpoint implementation (IN PROGRESS)
- ⏸️ **Phase 3**: Advanced Flutter search UI (PENDING)  
- ⏸️ **Phase 4**: Search analytics and optimization (PENDING)

**Latest Changes**:
- Added SearchMetadata struct with 8 comprehensive search fields to background normalizer
- Enhanced OpenAI prompt with 50+ search metadata categories (semantic tags, primary ingredients, cooking methods, etc.)
- Background normalizer builds successfully with new search metadata generation

---

*System is now fully operational with comprehensive fixes deployed. See individual component README.md files for detailed setup instructions.*