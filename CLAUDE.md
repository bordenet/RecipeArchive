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
1. **Gallery UI Improvements**: Recipe tiles too large on desktop/tablet - reduce height 20%, fit 6 per row
2. **Gallery Website Names**: Display "Food52" or "Smitten Kitchen" instead of "Unknown", link to original URLs
3. **Serving Size Logic**: Change to whole number multipliers (1,2,4,8,16) with auto-ingredient updates

### ✅ MAJOR FIXES COMPLETED TODAY
1. **✅ Unit Conversion System**: Full unicode vulgar fractions support (½, ⅓, ¼, ¾) + mixed fractions (1½, 2¾) + can units
2. **✅ Food52 Parser Fix**: JSON-LD parsing error resolved with undefined sanitization in base parser
3. **✅ Node.js Build System**: Proper linking + pre-commit hooks working + parser bundle rebuild system  
4. **✅ Flutter Analysis**: Fixed const map errors and null comparison warnings - now 0 errors/warnings
5. **✅ Recipe Images**: CORS configuration added to S3 - **IMAGES NOW DISPLAY IN WEB APP**
6. **✅ DELETE Operations**: Updated Lambda to perform hard S3 deletion instead of soft delete 
7. **✅ Diagnostics Endpoint**: Created `/v1/diagnostics` Lambda to handle extension error reporting
8. **✅ Source URL Regression**: Extensions now correctly send recipe URLs instead of popup.html

### Lower Priority Enhancements
1. **Extension Distribution**: S3-hosted .zip downloads with semantic versioning
2. **Failed Parse Workflow**: Backend diagnostic data processing
3. **OpenAI Content Enhancement**: Recipe normalization at ingestion time


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