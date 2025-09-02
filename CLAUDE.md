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

### 🔥 NEXT TASKS - Ready to Tackle  
1. **Failed Parse Workflow**: Backend diagnostic data processing and improvement
2. **OpenAI Content Enhancement**: Recipe normalization at ingestion time

### ✅ MAJOR FIXES COMPLETED TODAY
1. **✅ Gallery UI Overhaul**: 6-column desktop layout + clickable website names + 20% height reduction
2. **✅ Smart Serving Size**: Whole number multipliers (1x, 2x, 4x, 8x, 16x) with auto-ingredient scaling
3. **✅ Unit Conversion System**: Full unicode vulgar fractions support (½, ⅓, ¼, ¾) + mixed fractions (1½, 2¾) + can units
4. **✅ Food52 Parser Fix**: JSON-LD parsing error resolved with undefined sanitization in base parser
5. **✅ Node.js Build System**: Proper linking + pre-commit hooks working + parser bundle rebuild system  
6. **✅ Flutter Analysis**: Fixed const map errors and null comparison warnings - now 0 errors/warnings
7. **✅ Recipe Images**: CORS configuration added to S3 - **IMAGES NOW DISPLAY IN WEB APP**
8. **✅ DELETE Operations**: Updated Lambda to perform hard S3 deletion instead of soft delete 
9. **✅ Diagnostics Endpoint**: Created `/v1/diagnostics` Lambda to handle extension error reporting
10. **✅ Source URL Regression**: Extensions now correctly send recipe URLs instead of popup.html
11. **✅ Extension Distribution**: Complete S3-hosted .zip downloads with semantic versioning + Flutter web UI

### 📊 Session Impact
- **11 major fixes completed** in comprehensive Flutter/backend improvements
- **Gallery UX dramatically enhanced** with 6-column density and website names  
- **Serving size workflow simplified** with smart multiplier system
- **Extension distribution system** fully implemented with version tracking
- **All critical infrastructure** now stable and operational


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