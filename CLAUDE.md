# RecipeArchive Project Guide

## 🚀 Status: FULLY OPERATIONAL SYSTEM ✅

### Deployed Components (August 2025)
- **Browser Extensions**: Chrome/Safari with TypeScript parsers + AWS Cognito auth ✅ WORKING
- **AWS Backend**: Lambda + S3 + Cognito (URL-based deduplication) ✅ OPERATIONAL
- **Parser System**: 12+ sites via registry (`parsers/sites/site-registry.ts`) ✅ ACTIVE
- **Flutter Web App**: Production API integration with persistent auth ✅ DEPLOYED  
- **Recipe Report Tool**: CLI with .env defaults for easy reporting ✅ ENHANCED
- **Security**: TruffleHog validated, environment variables only ✅ VERIFIED

### Quick Start
```bash
git clone https://github.com/bordenet/RecipeArchive
./validate-monorepo.sh                               # Validates all components
cd recipe_archive_fresh && flutter run -d chrome     # Run Flutter app
cd tools/recipe-report && go run main.go             # Generate recipe report (uses .env)
```

## 🔄 Recent Updates (August 30, 2025)

### Fixed Issues ✅
- **Browser Extension Authentication**: Fixed Cognito ResourceNotFoundException by adding host_permissions and auto-configuration
- **Flutter App Authentication Persistence**: Removed localhost detection, now connects to production API for persistent login
- **Recipe Display**: Flutter app now shows all 13+ recipes from AWS backend instead of mock data  
- **Recipe Report CLI**: Added .env file support for default credentials (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`)
- **UI Improvements**: Added refresh button to Flutter app and original recipe URLs in description section

### Current Recipe Count: 13 Recipes ✅
Successfully stored across Food Network, Food52, Epicurious, Smitten Kitchen, and others via browser extension capture.

## Architecture

### Core System
- **Extensions** (`extensions/`): Chrome/Safari with shared auth + parsers
- **Parsers** (`parsers/`): TypeScript registry system for 10+ recipe sites
- **AWS** (`aws-backend/`): Lambda + S3 + Cognito serverless infrastructure
- **Flutter** (`recipe_archive_fresh/`): Modern web interface

### Supported Sites
Smitten Kitchen, Food Network, NYT Cooking, Washington Post, Love & Lemons, Food52, AllRecipes, Epicurious, Serious Eats, Alexandra's Kitchen, Food & Wine, Damn Delicious

### Development
- **Validation**: `./validate-monorepo.sh` checks all components
- **Flutter**: Material Design UI, zero lint issues, production ready
- **Extensions**: Load Chrome from `extensions/chrome/`, Safari via Xcode
- **Parsers**: Add sites to registry, use HTML fixtures for testing

### Production Infrastructure
- **Cognito**: User Pool `us-west-2_qJ1i9RhxD`
- **S3**: Primary (`recipearchive-storage-dev-*`), Failed parsing, Temp buckets
- **Lambda**: `RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w`

## Standards
- **Security**: Environment variables only, no hardcoded credentials
- **Quality**: Contract validation, timeout protection, comprehensive error handling
- **Testing**: TruffleHog scans, monorepo validation, Flutter tests passing
- **API Documentation**: OpenAPI spec in `docs/api/` MUST be maintained with ALL API changes

## ⚠️ CRITICAL MAINTENANCE REQUIREMENTS

### OpenAPI Documentation
**MANDATORY**: The OpenAPI specification in `docs/api/openapi.yaml` MUST be updated for ANY API changes:
- New endpoints or parameters
- Request/response schema changes  
- Authentication modifications
- Error response updates

**Process**: Update OpenAPI spec BEFORE deploying API changes, validate schema, then deploy.

## 🚧 TODO: Future Enhancements

### OpenAI Integration for Recipe Enhancement
- **LLM Recipe Review**: Add OpenAI backend assistance when recipes are pushed from web extensions
  - Automatically correct title casing (e.g., "chocolate chip cookies" → "Chocolate Chip Cookies")
  - Interpolate missing fields (prep time, cook/bake time, difficulty level)
  - Perform comprehensive HTML sweep to ensure parser captured all critical data
  - Standardize ingredient formatting and measurements
  - Generate improved descriptions when missing or poor quality

### Multi-Image Support
- **Enhanced Media Storage**: Expand beyond single image per recipe
  - Support multiple process/step images
  - Ingredient photos and preparation shots
  - Final result from multiple angles
  - S3 bucket organization for image galleries
  - Flutter UI updates for image carousels
  - Bandwidth optimization for mobile users

### ✅ CORS Issue Resolved
- **Direct API Integration**: Flutter web app now connects directly to AWS API Gateway in production
  - Removed localhost detection that was forcing mock data usage
  - AWS API Gateway configured with proper CORS headers for web origins
  - Authentication tokens handle all API requests successfully
  - No proxy server needed - direct communication with backend

*See README.md and docs/ for detailed architecture and requirements.*
