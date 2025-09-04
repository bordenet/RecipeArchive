# RecipeArchive Project Guide

## 🚀 Status: FULLY OPERATIONAL ✅

**Production System**: Chrome/Safari extensions + AWS backend + Flutter web app  
**Recipe Count**: 14 recipes across 13+ supported sites  
**CloudFront Deployment**: https://d1jcaphz4458q7.cloudfront.net

### Quick Start
```bash
git clone https://github.com/bordenet/RecipeArchive
./validate-monorepo.sh                               # Validates all components  
cd recipe_archive_fresh && flutter run -d chrome     # Run Flutter app
cd tools/recipe-report && go run main.go             # Generate recipe report (uses .env)
```

## 🚀 FLUTTER WEB DEPLOYMENT (AUTOMATED)

**CRITICAL**: Always use automated deployment scripts to avoid CloudFront cache issues!

### Automated Deployment Scripts
```bash
cd recipe_archive_fresh

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

## 🎯 CURRENT PRIORITIES (September 3, 2025)

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
2. **Servings Scaling**: ✅ WORKING - Functions correctly when servings data exists
3. **"Unknown" Display**: ✅ WORKING - Correctly shows when legacy data missing
4. **String Escaping**: ✅ FIXED - OpenAI prompt escaping issues resolved in both normalizers

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
- **Flutter App** (`recipe_archive_fresh/`): Web interface with CloudFront deployment

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
