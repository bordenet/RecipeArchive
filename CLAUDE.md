# RecipeArchive Project Guide

## 🚀 Status: FULLY OPERATIONAL + COMPREHENSIVE MOBILE APPS ✅

### IMMEDIATE DEVELOPMENT PRIORITIES (September 1, 2025)

#### CRITICAL ACTIONS REQUIRED:

1. **✅ Ingredient Section Headers**: FIXED - Parser now preserves "For the crust", "For the filling" section distinctions with proper Flutter UI display
2. **Unit Conversion Bug**: Fix unit toggle not converting ingredients like "1/2 teaspoon granulated sugar" and "1 tablespoon water" - regex misses fraction + unit patterns
3. **Failed Parse Workflow**: Create workflow plan for failed web extension parses through backend to Flutter/Dart apps
4. **OpenAI Content Normalization**: Create plan for OpenAI integration at ingestion to normalize/canonicalize content, casing, units, recipe titles via structured prompts before S3 storage
5. **Admin Multi-Tenant Management**: Create plan for Flutter web app admin role with tenant dropdown and full tenant provisioning. System Admin vs Test User roles.
6. **PRD Extensions**: Extend `/docs/requirements` PRD documents with these feature requirements (focus on WHAT/WHY)

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

_Ready for production deployment:_

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

### 🚨 CRITICAL BUGS - FIX IMMEDIATELY

#### Unit Conversion Issues (September 1, 2025)

- **"undefined" Values Bug**: Unit conversion displaying "undefined undefined" text in Flutter ingredients list
  - **Example Recipe**: https://food52.com/recipes/kylie-sakaida-avocado-bean-toast
  - **Symptoms**: "undefined" appears where converted measurements should display
  - **Root Cause**: Null handling in UnitsConverter.convertIngredient() method
  - **Status**: IN PROGRESS - Enhanced null checking and replaceRange logic implemented

- **Simple Fractions Skipped**: Imperial/metric toggle skips simple fractions like "1/2 teaspoon", "1 tablespoon"
  - **Working**: Mixed fractions like "1 3/4 cups" convert correctly
  - **Not Working**: Simple fractions "1/2 tsp", "2/3 cups", "1 tablespoon"
  - **Root Cause**: Regex pattern not capturing all fraction formats consistently
  - **Files Affected**: `lib/utils/units_converter.dart`
  - **Status**: IN PROGRESS - Improved parsing and conversion logic

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

## 📱 Web App Terminology & UX Standards

### Official UI Component Definitions

These terms are consistent with Amazon.com retail website patterns and must be used across ALL project documentation:

1. **Landing Page**: The initial page displayed when opening the web app, regardless of authentication state. This serves as the entry point to the application.

2. **Gallery** or **Carousel Page**: The authenticated user's main recipe browsing experience. Displays a scrollable list of recipes organized by configurable criteria:
   - **TYPE**: breakfast | brunch | lunch | dinner | drink | dessert
   - **DATE**: sorted by acquisition date from web extensions
   - **Custom Pivots**: additional organizational schemes (TBD)
   - **Design Pattern**: Netflix/Amazon Prime Video style scrollable carousels with drop-down controls

3. **Action Bar**: The green horizontal navigation bar positioned at the top of the Gallery/Carousel page. Contains:
   - Search functionality
   - Administrative controls (when applicable)
   - Tenant switching for admin users (e.g., mattbordenet@hotmail.com ↔ susan.cameron42@gmail.com)
   - Carousel organization controls (TYPE/DATE dropdowns)

4. **Badges**: Interactive overlay controls positioned atop recipe items, including:
   - Hyperlink navigation icons
   - Delete/remove buttons
   - Edit mode indicators
   - Status indicators

5. **Details Page**: The single-recipe view displayed when clicking on a specific recipe from the Gallery/Carousel. Contains:
   - Full recipe content (ingredients, instructions, images)
   - Editing capabilities
   - Units conversion toggle (metric ↔ imperial)
   - Serving size adjustments
   - Original source links

### UX Implementation Standards

- **Responsive Design**: All components must work across desktop, tablet, and mobile viewports
- **Accessibility**: WCAG 2.1 AA compliance for all interactive elements
- **Performance**: Lazy loading for recipe images and content
- **Consistency**: Material Design 3 theming across all components

## 🚀 DEPLOYMENT REQUIREMENTS

### CloudFront Production Updates

**MANDATORY**: ALWAYS push Flutter web app updates to CloudFront distribution when pushing changes to GitHub:

1. Build Flutter web app: `flutter build web --release`
2. Deploy to S3: `aws s3 sync build/web/ s3://recipearchive-web-app-prod-990537043943/ --delete`
3. Invalidate cache: `aws cloudfront create-invalidation --distribution-id E1D19F7SLOJM5H --paths "/*"`

**Production URL**: https://d1jcaphz4458q7.cloudfront.net
**S3 Fallback**: http://recipearchive-web-app-prod-990537043943.s3-website-us-west-2.amazonaws.com/

## ✅ MAJOR FIXES COMPLETED (September 1, 2025)

### ✅ Ingredient Section Headers Implementation

- **Parser Enhancement**: Modified Smitten Kitchen parser to detect `<h5>` section headers within `.jetpack-recipe-ingredients`
- **Section Preservation**: Headers like "For the crust (pâte brisée)" and "For the filling" now stored as `## HeaderText` in ingredients
- **Flutter UI Display**: Section headers display with uppercase styling, bold text, and horizontal line separator
- **Scaling Logic**: Section headers properly excluded from serving size scaling calculations
- **Files Modified**: `smitten-kitchen.ts`, `recipe_detail_screen.dart`, `recipe.dart`

### Unit Conversion & Scaling Fixes ✅

- **Mixed Fraction Support**: Fixed regex to handle "1 3/4 cups" in both unit conversion AND serving size scaling
- **Enhanced Parsing**: Added comprehensive `_parseAmount()` and `_parseScalingAmount()` methods for fractions, mixed fractions, and decimals
- **Accurate Conversions**: "1 3/4 cups" now correctly converts to "414 ml" (1.75 × 236.588)
- **Proper Scaling**: Recipe scaling now works with mixed fractions - "1 3/4 cups" doubles to "3.5 cups", halves to "0.88 cups"
- **Production Deployment**: All fixes deployed to CloudFront (https://d1jcaphz4458q7.cloudfront.net)

### Browser Extension Authentication Fixes ✅

- **Chrome Extension**: Fixed ResourceNotFoundException by adding `ensureAWSConfiguration()` and `CONFIG.reloadConfiguration()`
- **Safari Extension**: Applied same authentication fixes with Safari-specific `SafariCognitoAuth` class
- **Configuration Race Condition**: Resolved timing issue where CONFIG loaded before localStorage values were set
- **Abstract Method Error**: Fixed "must be implemented by subclass" by using correct `ChromeCognitoAuth`/`SafariCognitoAuth` classes

### Files Modified:

- `/utils/units_converter.dart`: Enhanced regex for mixed fractions + `_parseAmount()` method
- `/models/recipe.dart`: New `_parseScalingAmount()` and `_formatScaledAmount()` methods
- `/extensions/chrome/popup.js`: Added `ensureAWSConfiguration()` + ChromeCognitoAuth fixes
- `/extensions/safari/popup.js`: Added `ensureAWSConfiguration()` + SafariCognitoAuth fixes
- `/extensions/safari/config.js`: Added `reloadConfiguration()` method

## 🚨 REMAINING WORK (September 1, 2025)

### TOKEN REFRESH IMPLEMENTATION ✅ COMPLETED

- **Chrome Extension**: ✅ FIXED - Automatic token refresh on 401 errors with fallback to re-login
- **Safari Extension**: ✅ FIXED - Automatic token refresh on 401 errors with fallback to re-login
- **User Experience**: Extensions now handle expired tokens seamlessly after 60+ minutes
- **Error Handling**: If refresh fails, users are automatically prompted to sign in again

## 🚨 CURRENT STATUS (September 1, 2025)

### ✅ MAJOR FIXES COMPLETED TODAY

- **Original Recipe URL Icon**: ✅ WORKING - Fixed JSON field mapping from `source` to `sourceUrl`
- **Unit Conversion Bugs**: ✅ PARTIALLY FIXED - Enhanced null handling and regex patterns
- **Repository Cleanup**: ✅ COMPLETED - Removed 9+ temporary debugging files and obsolete tools
- **CloudFront Deployment**: ✅ UPDATED - Latest Flutter build deployed to production
- **Technical Planning**: ✅ COMPLETED - Created comprehensive failed parse workflow and OpenAI normalization plans

### 🚨 CRITICAL ISSUES REMAINING

- **❌ SHOW-STOPPING: Recipe Images Missing** - Browser extension image pipeline not working, no `mainPhotoUrl` in stored recipes
- **❌ Unit Conversion Incomplete**: Simple fractions like "1/2 teaspoon", "1 tablespoon" not converting
- **❌ Serving Size Scaling**: Ingredient scaling not updating when serving size changes

### 🎯 CURRENT FOCUS AREAS

1. **Image Pipeline Debug**: Extension captures images but not storing `mainPhotoUrl` in recipe JSON
2. **Unit Conversion Fix**: Simple fraction regex patterns need enhancement
3. **DynamoDB Cleanup**: Remove all deprecated DynamoDB references from codebase
4. **Production Validation**: End-to-end testing of complete recipe workflow

### ✅ WORKING FEATURES

- **Authentication**: Full Cognito integration working across extensions and Flutter app
- **Recipe Parsing**: 14 recipes captured from 12+ supported sites
- **Source URL Navigation**: Original recipe links working in details pages
- **Ingredient Section Headers**: "For the crust", "For the filling" parsing and display
- **CloudFront Deployment**: Production web app at https://d1jcaphz4458q7.cloudfront.net

### AUTHENTICATION STATUS ✅ STABLE

- **Authentication Flow**: ✅ WORKING - Debug logs confirm "Sign in completed successfully"
- **Token Management**: ✅ ENHANCED - Refresh tokens prevent 60-minute session timeouts
- **Service Worker**: ✅ FIXED - Disabled for HTTP deployment to prevent secure context errors
- **CloudFront HTTPS**: ✅ DEPLOYED at https://d1jcaphz4458q7.cloudfront.net

### COMPLETED IN THIS SESSION ✅

- **Chrome Extension Token Fix**: Fixed authentication token reference in `downloadAndUploadImage` function (line 376)
- **Safari Extension Image Upload**: Added complete `downloadAndUploadImage` function (lines 1237-1296)
- **Safari Extension Token Integration**: Image upload now uses proper auth token from `recipeArchive.auth` JSON object
- **UX Alignment**: Fixed vertical alignment of version number and "sign out" text in both extensions (top: -12px)
- **Issue Diagnosis**: Identified that recipes have `mainPhotoUrl` pointing to original sites instead of S3 URLs
- **Root Cause**: Chrome extension was using `localStorage.getItem('recipeArchive.idToken')` instead of extracting token from `JSON.parse(localStorage.getItem('recipeArchive.auth'))`

### LATEST COMPLETED FIXES (Current Session) ✅

- **Chrome Extension Auth Fix**: Fixed ResourceNotFoundException by correcting class name from `ChromeCognitoAuth` to `CognitoAuth`
- **Web App UX Improvements**:
  - Replaced ugly green "View Original at Source" button with clean icon in AppBar
  - Replaced ugly red "Delete" button with existing delete icon functionality
  - Added "view original at source" icon (square-with-arrow) to AppBar action bar
- **Serving Size Fix**: Recipe detail page now correctly displays updated serving size after editing and saving
- **Units Toggle**: Confirmed working - converts ingredients between imperial and metric (e.g., "5 cups" ↔ "1,183 ml")

### STATUS: MAJOR FIXES COMPLETED 🎯

1. ✅ **Token Refresh Working**: Both Chrome and Safari extensions handle 401 expired token errors with automatic refresh and retry
2. ✅ **Image Upload Fixed**: Both extensions now have proper authentication for S3 image uploads
3. ✅ **Flutter Ready**: Web app already configured to display images from `imageUrl` field
4. ✅ **Authentication Solid**: No more 60-minute session timeouts

### ✅ RESOLVED AUTHENTICATION ISSUE

**Chrome Extension Sign-in Fixed**: ResourceNotFoundException was caused by configuration loading race condition

- **Root Cause**: `envConfig` loaded at script initialization with empty localStorage values ('CONFIGURE_ME')
- **Issue**: `ensureAWSConfiguration()` set localStorage values AFTER envConfig was already loaded
- **Result**: CognitoAuth received 'CONFIGURE_ME' as clientId instead of real AWS Client ID
- **Solution**: Added `CONFIG.reloadConfiguration()` method to refresh config after setting localStorage
- **RESOLVED**: Chrome extension authentication now working with proper AWS configuration

### IMMEDIATE PRIORITY

Address the following matters immediately. First, analyze them, second create a formal plan to address them, third, replace this section with a revised/corrected list. Ask me clarifying questions along the way to ensure we get this right.

1. **EXTENSION DISTRIBUTION**

Add new page to dart/flutter app available once users have successfully signed in. Create a dedicated page for users to download our Chrome and Safari web extension .zip files.

To support this:

- Always build the web extensions as part of flutter/dart web deployments to CloudFront to ensure the most recent web extensions are downloadable from the RecipeArchive app.
- Create a dedicated S3 bucket for web extension distribution, partition the bucket by semantic version number. Make this s3 bucket available to signed in users — use standard AWS cogneto just like the rest of the project. Include an S3 data retention policy to only retain the last four versions of the web extension zip files.
- Always release the Safari and Chrome web extensions together-- never let their versions drift. If you make a bug fix to either one, bump the version number up and re-package both and push them to the S3 distribution bucket and adjust the dart/flutter app to specify only the latest version.
- Include a link to this new web extension distribution page in the green banner of the gallery home landing page. On the new web extension distribution page, provide detailed instructions for installing each of the two web extensions (safari, chrome) for Mac, Windows, and Linux. Include the ability to download each extension from the page.

2. **FALLBACK PLAN**: Implement alternative authentication flow if Cognito settings changed
3. **Web App UX 1**: Changing the servings size is intended to directly alter ingredients list item quantities. Please make two changes: (a) change the serving size adjustment control to only enable whole number halving/quartering/doubling/quadruping in the toggle. For example, if a recipe’s default is for “4” servings, the control should allow dropping down to “2” or “1” or up to “8” or “12” or “16”. (Otherwise, the ingredients list can become impractical… like weird fractions of eggs -- ‘1/5 egg’ is ridiculous.) (b) when the quantity is adjusted, adjust the quantities in the ingredients list. Example: if the recipe calls for 1 egg, and the serving size is adjusted from “4” servings to “8” servings, the ingredients list should update to specify 2 eggs.
4. **WEB EXTENSION IMAGE UPLOAD**: The web extensions appear to be failing to push images to our back-end. Note console errors, debug, and fix both Chrome and Safari. We have GOT to get images showing up in the app again.
5. **TEST IMAGE PIPELINE**: Capture new recipe with Chrome/Safari extension to verify S3 image upload works
6. **VERIFY S3 URLS**: Check that new recipes have S3 URLs instead of original site URLs
7. **CloudFront CORS**: If needed, fix any remaining CORS issues for S3 image serving
8. **FLUTTER IMAGE TEST**: Confirm images display correctly in web app gallery and detail views
9. **Test Pass**: Ensure all tests pass and that ./validate-monorepo.sh passes
10. **WEB APP UX 2**: The current recipe widgets/tiles on the web app's gallery page are too big on tablet and desktop -- we need to improve information density. Reduce the vertical size by 20% and consider how we can scale to achieve six recipes per row.
11. **WEB APP UX 3**: The web app FAILS to load on mobile Chrome browser. It only worked after I told Chrome to request the desktop site. Why? Please fix.
12. **WEB APP UX 4**: On the details page, the uriginal URL icon in the top right interferes with the recipe title when the page is scrolled down. Move the icon just to the right of the left-hand-side's back button, intead. This should avoid overlapping content.
13. **WEB PARSERS**: The Food52 parser again appears to be broken for "Kylie's Avocado Bean Toasts". See new test/fixtures/html-samples/food52-kylies-avocado-bean-toasts.html and note that the current parser generates many "undefined" entries in the Ingredients list AND the list is so broken that unit toggles (imperial/metric) fail to do anything.
14. **CLEANUP**: This file has lots of redundancies, especially regarding TODOs and DONE items. Once you push all changes to GitHub successfully, make a thorough pass through this file (CLAUDE.md) and resolve any redundancies. Ensure all TODOs are consolidated into a single ordered list.

_See README.md and docs/ for detailed architecture and requirements._
