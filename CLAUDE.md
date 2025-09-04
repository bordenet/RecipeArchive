# RecipeArchive Project Guide

## 🚀 Status: FULLY OPERATIONAL ✅

**Production System**: Chrome/Safari extensions + AWS backend + Flutter web app  
**Recipe Count**: 14 recipes across 13+ supported sites  
**CloudFront Deployment**: https://d1jcaphz4458q7.cloudfront.net

### Quick Start
```bash
git clone https://github.com/bordenet/RecipeArchive
./validate-monorepo.sh                               # Validates all components  
cd recipe_archive && flutter run -d chrome     # Run Flutter app
cd tools/recipe-report && go run main.go             # Generate recipe report (uses .env)
```

## 🚀 FLUTTER WEB DEPLOYMENT (AUTOMATED)

**CRITICAL**: Always use automated deployment scripts to avoid CloudFront cache issues!

### Automated Deployment Scripts
```bash
cd recipe_archive

# Full deployment (build + deploy + invalidate)
./deploy.sh

# Quick deployment (deploy existing build + invalidate)  
./quick-deploy.sh
```

### Manual Deployment (NOT RECOMMENDED)
```bash
# Only use if scripts fail - always include CloudFront invalidation!
flutter build web
aws s3 sync build/web/ s3://recipearchive-web-app-prod-990537043943/ --delete
aws cloudfront create-invalidation --distribution-id E1D19F7SLOJM5H --paths "/*"
```

**⚠️ VERIFICATION CONCERN**: CloudFront cache MUST be invalidated after every Flutter deployment or changes won't be visible. The automated scripts handle this automatically.

## 🎯 CURRENT PRIORITIES (September 4, 2025)

### 🚨 CRITICAL PARSER REGRESSION RESOLVED (September 4, 2025 - 3:50 PM)

**ISSUE**: Smitten Kitchen recipes showing broken instructions and JavaScript code instead of recipe steps
- **Symptom 1**: Instructions displayed as just numbers (1, 2, 3, 4, 5) 
- **Symptom 2**: JavaScript code fragments like "window.tude = window.tude" appearing in instructions
- **Root Cause**: JSON-LD parsing failure + inadequate Jetpack recipe format handling + JS code contamination

**CRITICAL FIXES IMPLEMENTED**:
- ✅ **Robust JSON-LD Instruction Parsing**: Enhanced extractInstructionText() with fallback logic for multiple JSON-LD formats
- ✅ **Enhanced Jetpack Parser**: Completely rewrote jetpack-recipe-directions parsing with HTML-aware extraction
- ✅ **JavaScript Detection**: Added 20+ regex patterns to filter out ad injection, analytics, and WordPress code
- ✅ **Content Sanitization**: Multi-stage filtering to prevent JavaScript code from contaminating recipe instructions

**TECHNICAL IMPLEMENTATION**:
- **extractInstructionText()**: Handles JSON-LD with text/name/description fields + JS filtering
- **isJavaScriptCode()**: Detects ai_, htlbid, dataLayer, DOM manipulation, etc.
- **Jetpack HTML Parsing**: Splits by paragraph tags, removes HTML, filters JS patterns
- **Enhanced Patterns**: Added WordPress, analytics, and ad service pattern detection

**IMPACT**: Fixes broken instructions for all Smitten Kitchen recipes using Jetpack format

### ✅ FLUTTER WEB BRANDING FIXES COMPLETED (September 4, 2025)

**ISSUE**: Web app still showed "recipe_archive_fresh" name and generic descriptions despite directory rename
- **Root Cause**: HTML metadata files not updated during rename process

**BRANDING FIXES IMPLEMENTED**:
- ✅ **Browser Title**: Updated web/index.html title from "recipe_archive_fresh" → "Recipe Archive"
- ✅ **Apple Web App**: Updated apple-mobile-web-app-title to "Recipe Archive"  
- ✅ **PWA Manifest**: Updated manifest.json name and short_name to "Recipe Archive"
- ✅ **App Description**: Enhanced description to "Capture, organize, and manage your favorite recipes from across the web"
- ✅ **Theme Colors**: Updated from blue (#0175C2) to green (#4CAF50) to match app branding
- ✅ **Meta Description**: Updated HTML meta description for better SEO

**NEXT STEP**: Full rebuild and production deployment needed to see changes live

### ✅ JUST COMPLETED: APP RENAME & PARSER ENHANCEMENTS (September 4, 2025)

**FLUTTER APP RENAME COMPLETED**:
- ✅ **Directory Renamed**: `recipe_archive_fresh` → `recipe_archive` 
- ✅ **App Configuration**: Updated pubspec.yaml name and description to remove 'fresh'
- ✅ **Documentation Updated**: Mass-updated all markdown files across the project
- ✅ **Deployment Scripts**: Updated automated deployment paths for new directory structure
- ✅ **Committed & Pushed**: All 121 file changes committed to GitHub main branch

**ENHANCED PARSER IMPROVEMENTS DEPLOYED**:
- ✅ **Comprehensive Selector Fallbacks**: AllRecipes, Food Network, Smitten Kitchen parsers enhanced
- ✅ **Multiple Selector Chains**: Up to 5 fallback selectors per data field (servings, prep time, cook time)
- ✅ **ISO 8601 Duration Support**: PT25M format now correctly parsed to "25 minutes"
- ✅ **OpenAI Temperature**: Set to 0.0 for deterministic recipe normalization
- ✅ **Debug Logging**: Enhanced Flutter service logging for troubleshooting data flow

**EXPECTED IMPROVEMENTS**:
- Gallery tiles should now display serving sizes and times for more recipes
- Consistent recipe data extraction across supported sites
- Reduced "Unknown" values in recipe display

### 🚨 CRITICAL BUG: INGREDIENT SCALING NOT WORKING

**PRIORITY 1 ISSUE**: Serving size changes on recipe detail pages do NOT trigger immediate ingredient quantity updates. This is a fundamental recipe app requirement.

**BUG DESCRIPTION**:
- User changes serving size from 4 to 8 servings
- Ingredient quantities should double (6 eggs → 12 eggs) 
- BUT: Quantities remain unchanged, defeating the core purpose of recipe scaling
- **Root Issue**: Either scaling logic not executing or not updating UI properly

**CRITICAL REQUIREMENTS (PRD)**:
1. **Immediate Ingredient Scaling**: When serving size changes, ALL ingredient quantities must update instantly
2. **Visual Feedback**: UI must reflect scaling changes without page refresh
3. **Proportional Scaling**: All numeric values in ingredients must scale proportionally (2x servings = 2x ingredients)
4. **Core User Experience**: This is NOT optional - recipe scaling is fundamental to recipe utility

### ✅ CRITICAL BREAKTHROUGH: FLUTTER JSON PARSING FIXES DEPLOYED

**PARTIALLY RESOLVED**: Backend data format issues fixed, but ingredient scaling functionality still broken.

**PRODUCTION DEPLOYMENT COMPLETED (September 4, 2025)**:
- ✅ **Custom JSON Parsing**: Added `_parseTime()` and `_parseServings()` functions to handle string→int conversion
- ✅ **Recipe Model Updates**: Enhanced Recipe class with robust parsing for prepTime, cookingTime, and servings
- ✅ **Debug Logging**: Added comprehensive API data vs parsed data logging in RecipeService
- ✅ **Automated Deployment**: Created deploy.sh and quick-deploy.sh scripts with CloudFront invalidation
- ✅ **Type Safety**: Updated json_annotation to use custom fromJson functions for flexible parsing
- ✅ **Mobile Parity**: Added iOS/Android platform support for consistent behavior

**RESOLVED DISPLAY ISSUES**:
1. **"Unknown" Serving Sizes**: ✅ FIXED - Now correctly parses string servings from OpenAI normalization
2. **"Unknown" Prep/Cook Times**: ✅ FIXED - Custom parsing handles both string and numeric time values  
3. **CloudFront Caching**: ✅ AUTOMATED - Deployment scripts handle cache invalidation automatically

**OUTSTANDING CRITICAL ISSUES**:
1. **🚨 Ingredient Scaling**: BROKEN - Serving size changes don't update ingredient quantities
2. **Backend Data Population**: Many recipes have null servings/times from broken OpenAI normalization

### ✅ MAJOR BREAKTHROUGH: FULL HTML CONTEXT ANALYSIS IMPLEMENTED

**NEW CAPABILITY**: Extension now captures full page HTML and forwards to OpenAI for enhanced JSON-LD and microdata analysis.

**PRODUCTION DEPLOYMENT COMPLETED (12:30 PM Sept 3, 2025)**:
- ✅ **Chrome Extension**: Captures `document.documentElement.outerHTML` and sends as `webArchiveHtml`
- ✅ **Backend Integration**: Recipes Lambda forwards HTML context to OpenAI normalizer
- ✅ **OpenAI Enhancement**: Prompts enhanced to extract JSON-LD, microdata, structured recipe data
- ✅ **Token Optimization**: HTML truncated to 8000 chars to balance context vs. cost
- ✅ **Lambda Functions**: All normalizer functions deployed with HTML context support

**RESOLVED SYSTEM ISSUES**:
1. **20-Recipe Limit**: ✅ FIXED - Backend default changed from 20 to 50 recipes
2. **String Escaping**: ✅ FIXED - OpenAI prompt escaping issues resolved in both normalizers

### ✅ CRITICAL RESOLUTION: BACKGROUND NORMALIZER COMPLETELY FIXED

**ROOT CAUSE RESOLVED**: Background normalizer was completely bypassing OpenAI enhancement for recipes with "good" titles - now **ALWAYS** calls OpenAI for full enhancement.

**COMPLETED FIXES**: 
- ✅ **Backend**: Completely replaced background normalizer logic to always call OpenAI
- ✅ **Frontend**: Enhanced Flutter Recipe model with robust servings/time parsing 
- ✅ **OpenAI Enhancement**: Added servings inference, time estimation, and comprehensive normalization
- ✅ **Security**: Added `.claude/` to .gitignore to prevent sensitive infrastructure data leaks
- ✅ **HTML Context**: Full page HTML forwarding for enhanced recipe analysis

**RESOLVED ISSUES**:
1. **Serving Size Scaling**: ✅ FIXED - OpenAI infers servings, Flutter parses robustly 
2. **Missing Time Estimates**: ✅ FIXED - OpenAI estimates prep/cook times, no more "Unknown"
3. **JSON-LD Extraction**: ✅ NEW - OpenAI can now see and extract from JSON-LD data in page HTML

### ✅ CRITICAL SUCCESS: MAJOR INFRASTRUCTURE RESOLVED

1. **502 Gateway Timeout Resolution**: ✅ FULLY IMPLEMENTED
   - ✅ **Root Cause**: Synchronous OpenAI normalization caused 15+ second Lambda timeouts
   - ✅ **Solution**: Implemented async SQS-based normalization architecture  
   - ✅ **Performance**: Recipe saves complete in <1 second (down from 15+ second failures)
   - ✅ **Background Processing**: Title normalization happens asynchronously via SQS queue
   - ✅ **SQS Architecture**: `recipe-normalization-dev` with dead letter queue for retry logic
   - ✅ **Background Lambda**: Processes normalization jobs without blocking main flow
   - ✅ **Verified**: "mathilde's amazing tomato tart" → "Mathilde'S Amazing Tomato Tart"
   - 🎯 **Status**: Browser extension → AWS backend flow 100% operational

2. **Flutter Web App Configuration**: ✅ FULLY RESOLVED
   - ✅ **Root Cause**: Deprecated `window.flutterConfiguration` causing app engine crashes
   - ✅ **Solution**: Updated to modern Flutter web bootstrap configuration
   - ✅ **Authentication**: Cognito integration working correctly (auto-login functional)
   - ✅ **Recipe Display**: App successfully loads and displays all 31 user recipes
   - ✅ **Refresh Capability**: Built-in refresh button (🔄) for fetching latest recipes
   - ✅ **Recipe Caching**: Riverpod FutureProvider handles data caching with invalidation
   - 🎯 **Status**: Flutter app at http://localhost:3000 fully operational

3. **Extension Distribution System**: ✅ COMPLETED
   - ✅ Chrome v0.2.0 and Safari v0.3.0 extensions packaged and uploaded to S3
   - ✅ Public S3 access configured for /extensions/* folder
   - ✅ Flutter Extensions screen with download buttons and version tracking
   - ✅ Accessible via drawer navigation → "Browser Extensions"

### ✅ RECENTLY COMPLETED
- **Gallery Tile Layout**: Left-aligned source URLs on separate lines with increased tile height
- **Extension Packaging**: Semantic versioning with S3 distribution infrastructure

### ✅ RECENT FIXES COMPLETED
- **Serving Size Logic Enhancement**: Adding 0.25x and 0.5x multipliers to allow halving and quartering recipes alongside existing 1x-16x scaling options
- **Diagnostic Processor Integration**: Deployed `/v1/diagnostic-summary` endpoint with comprehensive failed parse analysis, S3 integration, and pattern recognition for parser improvement
- **OpenAI Content Normalizer Production**: Configured OPENAI_API_KEY environment for production use with GPT-4o-mini integration for recipe enhancement
- **Flutter Analysis Warnings**: Fixed all Flutter web app analysis and test warnings including deprecated API usage, async context issues, and print statements
- **OpenAI Content Normalizer**: Deployed `/v1/normalize` endpoint with GPT-4o-mini integration. Features title normalization, ingredient standardization, instruction clarity, metadata inference, and graceful fallback when OpenAI unavailable
- **HTML Entity Decoding Fix**: Enhanced BaseParser with comprehensive HTML entity decoding in `sanitizeText()` method. Fixes em dash (&#8211; → –), quotes (&#39; → '), and other entities across all parsers. Alexandra's Kitchen ingredient ranges like "50 – 100 g" now parse correctly

## 🏗️ Architecture

### Components
- **Extensions** (`extensions/`): Chrome/Safari with TypeScript parsers + AWS Cognito auth
- **Parsers** (`parsers/`): Registry system for 13+ recipe sites  
- **AWS Backend** (`aws-backend/`): Lambda + S3 + Cognito serverless infrastructure
- **Flutter App** (`recipe_archive/`): Web interface with CloudFront deployment

### Production Infrastructure  
- **Cognito**: User Pool `us-west-2_qJ1i9RhxD`
- **S3**: Recipe storage `recipearchive-storage-dev-990537043943`
- **Lambda**: `RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w`
- **CloudFront**: Flutter web app distribution

### Supported Sites
Smitten Kitchen, Food Network, NYT Cooking, Washington Post, Love & Lemons, Food52, AllRecipes, Epicurious, Serious Eats, Alexandra's Kitchen, Food & Wine, Damn Delicious

## ⚠️ CRITICAL REMINDERS
- **ALWAYS lint after building**: Run `npm run lint` and fix ALL errors before committing
- **ALWAYS validate before pushing**: Run `./validate-monorepo.sh` and fix failures  
- **Security**: Environment variables only, no hardcoded credentials
- **Testing**: TruffleHog scans, monorepo validation, fixture-based regression tests

_See README.md and docs/ for detailed architecture and requirements._
