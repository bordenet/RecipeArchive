# RecipeArchive Project Guide

## 🚀 Status: FULLY OPERATIONAL ✅

**Production System**: Chrome/Safari extensions + AWS backend + Flutter web app
**Recipe Count**: 14 recipes across 12+ supported sites
**CloudFront Deployment**: https://d1jcaphz4458q7.cloudfront.net

### Quick Start
```bash
git clone https://github.com/bordenet/RecipeArchive
./validate-monorepo.sh                               # Validates all components  
cd recipe_archive_fresh && flutter run -d chrome     # Run Flutter app
cd tools/recipe-report && go run main.go             # Generate recipe report (uses .env)
```

## 🎯 IMMEDIATE PRIORITIES (September 2, 2025)

### 🚨 CRITICAL SESSION DISCOVERIES

#### ✅ S3 IMAGE PIPELINE FIXED
- **Root Cause Found**: Lambda was generating 1-year pre-signed URLs, but S3 max is 1 week (604800 seconds)
- **Solution Applied**: Made recipe images publicly accessible with bucket policy, Lambda now returns direct S3 URLs
- **Status**: S3 URLs work (verified: HTTP 200 OK for test images)
- **Issue**: Recipes in database missing `mainPhotoUrl` field entirely

#### ✅ FLUTTER WEB APP IMAGES NOW WORKING
- **Root Cause Found**: S3 bucket missing CORS configuration for cross-origin image requests
- **Solution Applied**: Added CORS policy allowing GET/HEAD from any origin (`Access-Control-Allow-Origin: *`)
- **Status**: Images now load properly in web app (verified: HTTP 200 with CORS headers)
- **Note**: Recipe data contains valid `mainPhotoUrl` fields with accessible S3 URLs

#### ✅ SOURCE URL REGRESSION FIXED
- **Problem**: Extensions sending popup.html URL instead of recipe URL
- **Fix**: Removed `window.location.href` fallbacks, now use `recipeData.source` and pass `tab.url` through function chain
- **Status**: Both Chrome and Safari extensions fixed and packaged

### ✅ MAJOR FIXES COMPLETED (September 2, 2025)
1. **✅ Recipe Images**: CORS configuration added to S3 - **IMAGES NOW DISPLAY IN WEB APP**
2. **✅ DELETE Operations**: Updated Lambda to perform hard S3 deletion instead of soft delete 
3. **✅ Lambda Deployment**: Fixed packaging and deployed updated functions
4. **✅ Recipe Overwrite**: Confirmed working correctly - no `isDeleted:true` bug exists

### Remaining Issues
1. **Unit Conversion Broken**: Simple fractions like "1/2 teaspoon" not converting - regex needs enhancement  
2. **Flutter Linting**: 30 analysis issues need cleanup (non-critical)

### UX Improvements
4. **Web App Mobile**: Fails to load on mobile Chrome - only works with "desktop site" request
5. **Gallery Density**: Recipe tiles too large on tablet/desktop - reduce height 20%, fit 6 per row
6. **Serving Size Logic**: Change to whole number multipliers only (1,2,4,8,16) and auto-update ingredient quantities
7. **Gallery Website Names**: Show "Food52" or "Smitten Kitchen" on tiles instead of "Unknown", link to original URL

### Parser Issues  
8. **Food52 Parser Broken**: "Kylie's Avocado Bean Toasts" generates "undefined" entries, breaking unit conversion
9. **Missing Original URLs**: Some Food52 recipes missing sourceUrl field in details pages

### Features
10. **Extension Distribution**: S3-hosted .zip downloads with semantic versioning, accessible from web app
11. **Failed Parse Workflow**: Backend handling for extension parsing failures
12. **OpenAI Content Normalization**: Recipe enhancement at ingestion (titles, times, descriptions)

## ⚠️ CRITICAL REMINDERS

- **ALWAYS lint after building**: Run `npm run lint` and fix ALL errors before committing
- **ALWAYS validate before pushing**: Run `./validate-monorepo.sh` and fix failures 
- **NO celebrations in commits**: Focus on what needs to be done next, not what was accomplished
- **Test image pipeline end-to-end**: Extension → S3 upload → Flutter display
- **Keep CLAUDE.md focused**: Remove redundancies, archive completed items

## 🏗️ Architecture

### Components
- **Extensions** (`extensions/`): Chrome/Safari with TypeScript parsers + AWS Cognito auth
- **Parsers** (`parsers/`): Registry system for 12+ recipe sites  
- **AWS Backend** (`aws-backend/`): Lambda + S3 + Cognito serverless infrastructure
- **Flutter App** (`recipe_archive_fresh/`): Web interface with CloudFront deployment

### Production Infrastructure  
- **Cognito**: User Pool `us-west-2_qJ1i9RhxD`
- **S3**: Recipe storage `recipearchive-storage-dev-990537043943`
- **Lambda**: `RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w`
- **CloudFront**: Flutter web app distribution

### Supported Sites
Smitten Kitchen, Food Network, NYT Cooking, Washington Post, Love & Lemons, Food52, AllRecipes, Epicurious, Serious Eats, Alexandra's Kitchen, Food & Wine, Damn Delicious

## 🔧 Development Standards

- **Security**: Environment variables only, no hardcoded credentials  
- **Quality**: Contract validation, timeout protection, comprehensive error handling
- **Testing**: TruffleHog scans, monorepo validation, fixture-based regression tests
- **API Documentation**: Update `docs/api/openapi.yaml` for ANY API changes

## 🚨 RECENT FIXES (September 2, 2025)

### ✅ Major Issues Resolved
- **Parser System**: Fixed TypeScript parser loading and data transformation regressions
- **Image Upload**: Fixed stack overflow error for large images (>200KB) with chunked processing  
- **Food52 Parser**: Fixed false 404 detection breaking legitimate recipe pages
- **Image Display**: Fixed missing mainPhotoUrl field preventing Flutter image display

### 🔍 Testing Coverage
- **Integration Tests**: Parser registry API validation with real HTML fixtures
- **Regression Prevention**: Tests catch missing methods and bundle loading failures
- **Monorepo Validation**: Automated linting, security scans, and build verification

_See README.md and docs/ for detailed architecture and requirements._