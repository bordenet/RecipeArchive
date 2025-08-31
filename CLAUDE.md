# RecipeArchive Project Guide

## 🚀 Status: FULLY OPERATIONAL + COMPREHENSIVE MOBILE APPS ✅

### IMMEDIATE DEVELOPMENT PRIORITIES (August 30, 2025)
#### CRITICAL ACTIONS REQUIRED:
1. **Documentation Cleanup**: Take THOROUGH pass through README.md, remove redundancies, remove ALL React.js and Swift references from ALL docs
2. **Failed Parse Workflow**: Create workflow plan for failed web extension parses through backend to Flutter/Dart apps  
3. **OpenAI Content Normalization**: Create plan for OpenAI integration at ingestion to normalize/canonicalize content, casing, units, recipe titles via structured prompts before S3 storage
4. **Admin Multi-Tenant Management**: Create plan for Flutter web app admin role with tenant dropdown and full tenant provisioning
   - System Admin: mattbordenet@hotmail.com
   - Test User: susan.cameron42@gmail.com / Bear901206!!
5. **PRD Extensions**: Extend `/docs/requirements` PRD documents with these feature requirements (focus on WHAT/WHY)

### Deployed Components (August 2025)
- **Browser Extensions**: Chrome/Safari with TypeScript parsers + AWS Cognito auth ✅ WORKING
- **AWS Backend**: Lambda + S3 + Cognito (URL-based deduplication) ✅ OPERATIONAL
- **Parser System**: 12+ sites via registry (`parsers/sites/site-registry.ts`) ✅ ACTIVE
- **Flutter Web App**: Production API integration with persistent auth ✅ DEPLOYED
- **Mobile Apps**: Native iOS, iPad, Android with comprehensive editing capabilities ✅ COMPLETE
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

### Major Features Added ✅
- **Browser Extension Authentication**: Fixed Cognito ResourceNotFoundException by adding host_permissions and auto-configuration
- **Flutter App Authentication Persistence**: Removed localhost detection, now connects to production API for persistent login
- **Recipe Display**: Flutter app now shows all 13+ recipes from AWS backend instead of mock data  
- **Recipe Report CLI**: Added .env file support for default credentials (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`)
- **UI Improvements**: Added refresh button to Flutter app and original recipe URLs in description section
- **Auto-Login Developer Experience**: Added environment variable support (`AUTO_LOGIN=true`) for seamless development
- **Delete Functionality**: Added delete buttons to both recipe detail content and AppBar banner with confirmation dialogs
- **Comprehensive Testing**: Created widget tests for home screen, recipe details, and login screen functionality
- **Validation Integration**: Updated `validate-monorepo.sh` to run Flutter tests and analysis
- **Code Quality**: Comprehensive linting fixes across Flutter and browser extensions
- **CloudFront Deployment Plan**: Complete infrastructure plan for Flutter web app deployment via CDN

### Developer Experience Enhancements 🛠️
- **Environment Variables**: Set `AUTO_LOGIN=true` in `.env` for automatic login during development
- **Test Coverage**: Full widget test suite for UI components including:
  - Refresh button functionality
  - Original URL display and clickability  
  - Delete button operations with confirmations
  - Login screen validation and auto-population
  - Error handling and loading states
- **Linting Integration**: Continuous code quality checks in CI/CD pipeline

### Code Quality & Linting 📊
- **Flutter Analysis**: Reduced from 90 to 23 lint issues (75% improvement)
  - Fixed deprecated `withOpacity` calls (replaced with `withValues`)
  - Removed `avoid_print` warnings by commenting debug statements
  - Fixed import conflicts between Recipe model classes
  - Removed unused imports and variables
- **ESLint Configuration**: Fixed browser extension parsing errors
  - Updated configuration for mixed JS/TS files
  - Reduced ESLint errors from 26 to 6 critical issues
- **Validation Integration**: Added linting steps to `validate-monorepo.sh`
  - Flutter analysis with `flutter analyze`
  - Browser extension linting with `npm run lint`

### CloudFront Deployment Strategy ☁️
- **Cost-Effective Setup**: ~$1-3/month total AWS costs
- **GitHub Actions CI/CD**: Automated deployment on code changes
- **Custom Domain Support**: Route 53 integration for professional domains
- **Global CDN**: CloudFront distribution for optimal performance
- **Security**: Private S3 bucket with CloudFront-only access

### Current Recipe Count: 13 Recipes ✅
Successfully stored across Food Network, Food52, Epicurious, Smitten Kitchen, and others via browser extension capture.

### Production Deployment Roadmap 🚀
*Ready for production deployment:*
1. **CloudFront Setup**: Implement S3 + CloudFront infrastructure for Flutter web app
2. **Custom Domain**: Configure Route 53 hosted zone and SSL certificate
3. **GitHub Actions**: Set up automated deployment pipeline
4. **Environment Configuration**: Production vs development API endpoints
5. **Performance Monitoring**: CloudWatch metrics and alerts

### Code Quality Status 🎯
- **Flutter Analysis**: 23 remaining issues (mostly BuildContext warnings - acceptable)
- **ESLint Status**: 6 remaining issues (TypeScript require() imports - acceptable)
- **Test Coverage**: Full widget test suite with mocking
- **CI/CD Validation**: All linting integrated into `validate-monorepo.sh`
3. **Performance Testing**: Verify auto-login works with `AUTO_LOGIN=true` in `.env`
4. **Documentation**: Update README with new testing and auto-login features
5. **Production Deploy**: Test complete workflow from extension → AWS → Flutter display

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
