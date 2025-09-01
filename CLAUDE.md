# RecipeArchive Project Guide

## 🚀 Status: FULLY OPERATIONAL + COMPREHENSIVE MOBILE APPS ✅

### IMMEDIATE DEVELOPMENT PRIORITIES (September 1, 2025)

#### CRITICAL ACTIONS REQUIRED:

1. **✅ Ingredient Section Headers**: FIXED - Parser now preserves "For the crust", "For the filling" section distinctions with proper Flutter UI display 
2. **Unit Conversion Bug**: Fix unit toggle not converting ingredients like "1/2 teaspoon granulated sugar" and "1 tablespoon water" - regex misses fraction + unit patterns
3. **Failed Parse Workflow**: Create workflow plan for failed web extension parses through backend to Flutter/Dart apps
4. **OpenAI Content Normalization**: Create plan for OpenAI integration at ingestion to normalize/canonicalize content, casing, units, recipe titles via structured prompts before S3 storage
5. **Admin Multi-Tenant Management**: Create plan for Flutter web app admin role with tenant dropdown and full tenant provisioning
   - System Admin: mattbordenet@hotmail.com
   - Test User: susan.cameron42@gmail.com / Bear901206!!
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

### IMAGE PIPELINE STATUS 🖼️ IN PROGRESS

- **Extension Image Capture**: ✅ WORKING - Both Chrome/Safari download and upload images to S3
- **S3 Storage**: ✅ WORKING - Images stored with unique filenames in recipes/ folder
- **Flutter Display**: ✅ CONFIGURED - Web app has Image.network() widgets for gallery and detail views
- **Current Investigation**: Verifying complete image flow from extension → S3 → Flutter display

### AUTHENTICATION STATUS ✅ STABLE

- **Authentication Flow**: ✅ WORKING - Debug logs confirm "Sign in completed successfully"
- **Token Management**: ✅ ENHANCED - Refresh tokens prevent 60-minute session timeouts
- **Service Worker**: ✅ FIXED - Disabled for HTTP deployment to prevent secure context errors
- **CloudFront HTTPS**: ✅ DEPLOYED at https://d1jcaphz4458q7.cloudfront.net

### RECENT COMPLETED FIXES

- ✅ **Token Refresh**: Both Chrome and Safari extensions handle expired Cognito tokens automatically
- ✅ **Error Recovery**: Seamless retry logic for API calls after token refresh
- ✅ **User Experience**: No more "HTTP 401: The incoming token has expired" errors after 60 minutes
- ✅ **Image Upload**: Extensions capture and upload recipe images to S3 storage
- ✅ **Units Conversion Feature**: Smart metric/imperial toggle on recipe details
- ✅ **UI Terminology**: Standardized Landing Page, Gallery/Carousel, Action Bar, Badges, Details Page

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

### IMMEDIATE PRIORITY NEXT SESSION

0. **EXTENSION DISTRIBUTION**

Recipe Archive
Insert the following request into CLAUDE.md, ensure durable context, and then execute:

### new page in web app

In the web app, upon successful signing in, please create a dedicated page for users to access web extension .zip files. Always build the web extensions as part of flutter/dart web deployments to CloudFront and push updates to the site.

### web extension hosting mechanism

Create a dedicated S3 bucket for distribution partitioned by version number. Make this s3 bucket available to signed in users — use standard AWS cogneto like the rest of the project. Include retention policies to only retain the last four versions of the web extension zip files.

### web extension discovery

Include a link to this new web extension distribution page in the green banner of the gallery home landing page. On the new web extension distribution page, provide detailed instructions for installing each of the two web extensions (safari, chrome) for Mac, Windows, and Linux. Include the ability to download each extension from the page.

### use semantic versioning for the web extensions

Include semantic versioning for all breaking changes to the web extension builds. Include the version number in the top left corner of each web extension in small font face. Hyperlink this version string to the web app CloudFront distribution so it’s easy to navigate between the web extension and the web app. Include a back button on this new page to return to the gallery/carousel home landing page of the web app.

## planning

Before executing these steps, review and sort order an execution plan for optimal outcomes in CLAUDE.md and push the resulting plan to GitHub

1. **FIX COGNITO AUTH**: Debug ResourceNotFoundException in Chrome extension authentication

config.js:106 🔧 Recipe Archive Extension Config: Object
popup.js:49 🔧 Checking AWS configuration...
popup.js:63 🔧 Setting correct AWS configuration...
popup.js:72 ✅ AWS configuration set successfully
cognito-idp.us-west-2.amazonaws.com/:1 Failed to load resource: the server responded with a status of 400 ()
cognito-auth.js:105 Direct authentication failed: Error: ResourceNotFoundException
at ChromeCognitoAuth.\_makeRequest (cognito-auth.js:582:13)
at async ChromeCognitoAuth.\_signInWithPassword (cognito-auth.js:77:24)
at async ChromeCognitoAuth.signIn (cognito-auth.js:60:14)
at async handleSignIn (popup.js:248:24)
\_signInWithPassword @ cognito-auth.js:105
popup.js:286 ❌ Cognito authentication failed: ResourceNotFoundException
handleSignIn @ popup.js:286

2. **VERIFY AWS CONFIG**: Check if Cognito User Pool ID, Client ID, or region settings are correct
3. **TEST SAFARI**: Verify if Safari extension has same authentication issue
4. **FALLBACK PLAN**: Implement alternative authentication flow if Cognito settings changed
5. **Web App UX**: On the details page, ensure the units toggle works such that all ingredients are converted to the current units (imperial/metric). For example, if the ingredients includes "5 Cups", a click on the units button would toggle this text to "1250 mL".
6. **Web App UX2**: On the details page, the green button is very ugly. And the red delete button on the same line is also very ugly. Having icons in the top-right corner of the page is sufficient. The Edit and Delete buttons are already present, so leave them alone. Add an additional button for "view original at source" functionality with the square-with-arrow emoji/icon (which is appropriate because the original source IS an external website). Place this icon to the left of the delete / trash icon. Remove the long green button ("View Original at Source") and remove the red "Delete" button.
7. **Web App UX3**: On the details page, if I edit serving size and save the recipe, the original serving size is presented on the light green servings button. For example, if a recipe says "2 servings" and I edit the recipe to be 200 servings, when I save the recipe the page should reflect "200 servings".

### SECONDARY TASKS (AFTER AUTH FIXED)

1. **TEST IMAGE PIPELINE**: Capture new recipe with Chrome/Safari extension to verify S3 image upload works
2. **VERIFY S3 URLS**: Check that new recipes have S3 URLs instead of original site URLs
3. **FLUTTER IMAGE TEST**: Confirm images display correctly in web app gallery and detail views
4. **CloudFront CORS**: If needed, fix any remaining CORS issues for S3 image serving
5. **Test Pass**: Ensure all tests pass and that ./validate-monorepo.sh passes

_See README.md and docs/ for detailed architecture and requirements._
