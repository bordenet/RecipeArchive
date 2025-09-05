# RecipeArchive Project Guide

## 🎯 Current Status (September 5, 2025)

**✅ FULLY OPERATIONAL**: Complete end-to-end recipe management system with major fixes deployed  
**📊 Recipe Storage**: 23 unique recipes (cleaned from 40+ duplicates)  
**🧪 Testing**: Enhanced Flutter app with improved ingredient scaling and JSON parsing  
**🌐 Production**: https://d1jcaphz4458q7.cloudfront.net  
**🎯 Code Quality**: Major data compatibility and parsing issues resolved

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

## 🎆 Recent Achievements (September 5, 2025)

### ✨ Technical Fixes Deployed
- **📋 JSON Data Compatibility**: Custom unmarshaling handles string/integer conversion
- **🧹 S3 Storage Cleanup**: Removed 17 orphaned recipe files (40 → 23 active recipes)
- **🧪 Ingredient Scaling**: Enhanced regex supports embedded numbers in text
- **🔧 Lambda Deployment**: Updated recipes function with enhanced JSON handling
- **🚀 Extension Fixes**: Consistent token usage deployed to production

### ⚙️ System Improvements
- **📈 Data Access**: All stored recipes now accessible (was 9/40, now 23/23)
- **🤖 Automated Cleanup**: Recipe duplication management tools working
- **🔍 Enhanced Parsing**: Backward compatible field name mapping
- **🚫 Clean Architecture**: Removed redundant code, fixed Go build issues

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

*System is now fully operational with comprehensive fixes deployed. See individual component README.md files for detailed setup instructions.*