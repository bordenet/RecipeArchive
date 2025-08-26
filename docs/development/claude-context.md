# RecipeArchive Project Guide

## Project Overview & Vision

**RecipeArchive** is a cross-platform recipe archiving system that captures, stores, and syncs culinary discoveries across all your devices. Think of it as your personal recipe fortress that never loses a bookmark.

**The Core Problem We're Solving**: Home cooks lose access to perfect recipes due to paywalls, site changes, ads, or complete disappearance. Browser bookmarks fail when you need them most—in the kitchen with messy hands.

**Our Solution**: One-click permanent capture of any online recipe in a clean, ad-free format that syncs everywhere and works offline.

### Platform Architecture

- 📱 **iOS Mobile App** (Swift) - Recipe browsing and capture on-the-go
- 🌐 **Web Application** (React + TypeScript) - Command center for meal planning
- 🔌 **Browser Extensions** (Chrome & Safari, TypeScript) - One-click recipe extraction
- ☁️ **AWS Backend** (Go, serverless architecture) - Scalable, cost-effective cloud infrastructure

## 📋 Product Requirements Summary

### 🎯 PRD Governance & Authority

**CRITICAL**: All project development work will **strictly abide by the PRDs** included in this project. These documents serve as the authoritative requirements specification, and their spirit must always be reflected in README.md files and implementation decisions.

**PRD Change Control**: Any modifications to requirements must be made directly in the PRD files first, then reflected in CLAUDE.md and other documentation. PRDs are the single source of truth.

### 🚨 Active Architecture Decisions

**Authentication Architecture**: `../architecture/auth-decision.md` - **PENDING APPROVAL**

- **Decision**: AWS Cognito from Day 1 across all platforms
- **Impact**: Eliminates authentication conflicts between Browser Extension and other platforms
- **Status**: ✅ **IMPLEMENTED IN ALL PRDs** - Awaiting final approval

**Recipe Data Model**: `../architecture/data-model.md` - **PENDING APPROVAL**

- **Decision**: Unified TypeScript interface with 15 core fields
- **Impact**: Eliminates data inconsistencies across all platforms
- **Status**: ✅ **IMPLEMENTED IN ALL PRDs** - Awaiting final approval

**Search Feature Clarification**: `../architecture/search-features.md` - **RESOLVED**

- **Decision**: Include "Recipe Library Search", exclude "External Recipe Discovery"
- **Impact**: Resolves critical feature scope conflict across all platforms
- **Status**: ✅ **COMPLETED** - Browser Extension PRD updated

**Performance Standards**: `../architecture/performance-standards.md` - **RESOLVED**

- **Decision**: Unified performance targets with 3-tier SLA structure
- **Impact**: Eliminates conflicting performance requirements across platforms
- **Status**: ✅ **COMPLETED** - All PRDs updated with consistent targets

### 🎯 PRD Conflicts Resolution Summary

**RESOLVED CONFLICTS** (All PRDs Updated):

1. ✅ **Authentication**: Unified AWS Cognito from day 1 across all platforms
2. ✅ **Search Features**: Clarified library search vs external discovery
3. ✅ **Performance Targets**: Standardized SLA requirements across platforms
4. ✅ **Data Model**: Referenced unified recipe schema in all PRDs

**PENDING APPROVAL**:

- Authentication architecture final decision
- Recipe data model final approval for implementation

### ☁️ AWS Infrastructure Setup

<<<<<<< HEAD
**Status**: **✅ DEPLOYED & OPTIMIZED FOR FREE TIER** 🎉

**Deployed Infrastructure** (Account: `[ACCOUNT-ID]`, Region: `us-west-2`):

- ✅ **AWS CDK Stack**: `RecipeArchive-dev` - Complete infrastructure as code
- ✅ **Cognito User Pool**: `us-west-2_qJ1i9RhxD` - Email-based authentication
- ✅ **Cognito Client**: `5grdn7qhf1el0ioqb6hkelr29s` - App client configuration
- ✅ **DynamoDB Table**: `recipeArchive-recipes-dev` - Pay-per-request billing (Free Tier)
- ✅ **S3 Bucket**: `recipearchive-storage-dev-[ACCOUNT-ID]` - Lifecycle managed storage
- ✅ **API Gateway**: `https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/` - RESTful API
- ✅ **IAM Roles**: Least-privilege access for Lambda functions
- ✅ **Security**: Encryption at rest and in transit, no hardcoded secrets

**Free Tier Optimizations**:

- 🆓 **DynamoDB**: Pay-per-request mode, no provisioned capacity
- 🆓 **S3**: 90-day lifecycle expiration, versioning disabled for dev
- 🆓 **Monitoring**: CloudWatch alarms for ANY charges (should stay $0)
- 🆓 **Budget**: $1 monthly budget with alerts at $0.01 actual, $0.50 forecasted
- 🆓 **SNS**: Email notifications for billing alerts

**Cost Monitoring Tools**:

- ✅ **Free Tier Script**: `../../scripts/setup-aws-billing-controls.sh` - Automated cost monitoring
- ✅ **Environment Config**: `aws-backend/.env` - Deployed resource IDs
- ✅ **Documentation**: `../setup/aws-setup.md` - Complete setup guide for multiple machines

**Multi-Machine Setup**:

1. Run `../../scripts/setup-macos.sh` on new machine
2. Configure AWS CLI: `aws configure` (same credentials)
3. Verify: `aws sts get-caller-identity`
4. # Deploy if needed: `cd aws-backend/infrastructure && npx cdk deploy`
   **Status**: **READY FOR DEPLOYMENT** 🚀

**Infrastructure Created**:

- ✅ **AWS CDK Stack**: Complete infrastructure as code (`aws-backend/infrastructure/`)
- ✅ **Cognito User Pool**: Email-based authentication with 1hr/30day token expiration
- ✅ **DynamoDB Table**: Recipe storage with GSI for search functionality
- ✅ **S3 Bucket**: Photo and web archive storage with lifecycle management
- ✅ **API Gateway**: RESTful API with CORS and rate limiting
- ✅ **IAM Roles**: Least-privilege access for Lambda functions
- ✅ **Security**: Encryption at rest and in transit, no hardcoded secrets

**Deployment Tools**:

- ✅ **Setup Script**: `../../scripts/deploy-aws.sh` - Automated deployment with validation
- ✅ **Environment Template**: `.env.template` - Secure credential management
- ✅ **Security**: Enhanced `.gitignore` to prevent credential leaks

**Next Steps**:

1. Run `../../scripts/deploy-aws.sh` to deploy AWS infrastructure
2. Create admin user (mattbordenet@hotmail.com) in Cognito
3. Note infrastructure outputs for Lambda function development
4. Begin implementing CRUD API Lambda functions
   > > > > > > > origin/main

### Critical PRD Documents

This project is guided by **four comprehensive PRD documents** that define the complete product vision, user requirements, and technical specifications:

#### 1. **Browser Extension PRD** (`../requirements/browser-extension.md`)

**Core Mission**: One-click recipe capture with 95% accuracy in <3 seconds

**Key Requirements**:

- **Target Sites**: Washington Post, Food & Wine, NYT Cooking, Smitten Kitchen, Love & Lemons, Damn Delicious, Serious Eats
- **Data Extraction**: Title, ingredients, instructions, main photo, source URL, prep/cook time, servings, full page archive
- **Performance**: <3 second extraction, <500ms popup load, 95% success rate
- **Beta Goals**: 50+ users, 80% 24hr activation rate, 5+ recipes/user/week
- **Authentication**: Basic auth for MVP, AWS Cognito post-beta
- **Offline**: 50 recipe local cache with background sync

#### 2. **AWS Backend PRD** (`../requirements/aws-backend.md`)

**Core Mission**: Secure, scalable, cost-effective recipe storage and sync

**Key Requirements**:

- **Architecture**: Serverless (Lambda, DynamoDB, S3, API Gateway)
- **Data Storage**: Recipe metadata in DynamoDB, photos/archives in S3
- **Performance**: <300ms API response times, 99.9% uptime
- **Security**: JWT via Cognito, encrypted data at rest and in transit
- **Multi-tenant Ready**: User ID isolation, future organization support
- **Rate Limiting**: Configurable limits to prevent cost overruns

#### 3. **Website PRD** (`../requirements/website.md`)

**Core Mission**: Clean, responsive web interface for recipe management

**Key Requirements**:

- **Features**: Browse, search, filter recipes; CRUD operations; meal prep view
- **Performance**: <1s load times, mobile-responsive design
- **Authentication**: AWS Cognito integration with secure session management
- **Sync**: Real-time data sync with AWS backend, local caching
- **Accessibility**: WCAG 2.1 compliance, intuitive navigation

#### 4. **iOS App PRD** (`../requirements/ios-app.md`)

**Core Mission**: Native iOS experience with offline-first design

**Key Requirements**:

- **Platform**: iPhone and iPad support with size-optimized layouts
- **Features**: Full recipe CRUD, offline access, automatic sync
- **Performance**: <1s load times, responsive interactions
- **Accessibility**: VoiceOver support, Dynamic Type compatibility
- **Sync**: Local caching with background sync to AWS backend

### Success Metrics Across All Platforms

- **Quality**: 95% extraction success rate, <5% error rate
- **Engagement**: 5-10+ recipes saved per user per week
- **Retention**: 80%+ user retention at 30 days
- **Performance**: Sub-second response times across all platforms
- **Beta Success**: 50+ active users with high satisfaction scores

### Explicitly Out of Scope (MVP)

- Social features, sharing, comments
- Meal planning and calendar features
- Shopping list generation
- Recipe recommendations or discovery
- Nutritional analysis
- Manual copy/paste fallback (TODO for post-MVP)
- Multi-page recipe support

### Target User & Beta Strategy

**Primary User**: "The Intentional Home Cook" - actively seeks and prepares web recipes 3-5 times per week

**Beta Phase Plan**:

- **Duration**: 8-12 weeks
- **User Cap**: Limited to 50+ food enthusiasts (personal network)
- **Recruitment**: Direct invitation only (wife's foodie friends)
- **Success Criteria**: 95% extraction success, <5% error rate, 80% satisfaction, zero critical bugs for 2 weeks
- **Exit to General Availability**: Only after all beta criteria are met

**The Magic Moment**: One-click capture that's fast (<3s), accurate (95% success), and simple (review, edit if needed, save—done)

## Development Principles & Standards

### Cost Optimization

- **Serverless-first**: Lambda, API Gateway, DynamoDB, S3 over persistent infrastructure
- **US-West default**: All AWS deployments unless cost analysis shows better alternative
- **No Kubernetes**: Avoid complex orchestration; use AWS built-in scaling and rate limiting
- **Minimal dependencies**: Every npm package must earn its place; prefer vanilla implementations

### Code Quality Standards

- **TypeScript everywhere** (except Go backend)
- **Clean, maintainable code** over clever optimizations
- **Security-first**: Never expose credentials, keys, or sensitive data
- **Test-driven**: Unit tests required for all business logic

## Current Implementation Status

### ✅ Completed Components

#### Chrome Extension (Fully Functional)

- **Location**: `/extensions/chrome/`
- **Authentication**: BASIC auth setup with secure Chrome storage
- **Recipe Extraction**: Smitten Kitchen parser with structured data capture
- **UI**: Complete popup interface with setup flow
- **Security**: Gitignored config files, sample templates for developers
- **Testing**: Jest unit tests + Playwright integration tests

**Key Files:**

- `manifest.json` - Manifest V3 compliant
- `content.js` - Recipe extraction logic (Smitten Kitchen) + fullTextContent for LLM
- `popup.js/popup.html` - Main UI with auth-gated access
- `setup.js/setup.html` - Authentication configuration
- `config.sample.json` - Developer template (DO NOT commit real config.json)

#### Safari Web Extension (Full Feature Parity)

- **Location**: `/extensions/safari/`
- **Cross-Platform**: Works on Safari desktop and mobile (iPhone/iPad)
- **Authentication**: BASIC auth with Safari storage APIs
- **Recipe Extraction**: Same Smitten Kitchen parser with cross-browser compatibility
- **UI**: Safari-optimized interface with iOS design guidelines
- **Mobile Optimized**: Touch targets, responsive design, dark mode support
- **Security**: Same gitignored config system as Chrome

**Key Files:**

- `manifest.json` - Safari Web Extension manifest with host_permissions
- `content.js` - Cross-browser recipe extraction + fullTextContent for LLM (`browserAPI` wrapper)
- `popup.js/popup.html` - Safari-styled UI with mobile optimizations
- `setup.js/setup.html` - iOS-optimized authentication flow
- `config.sample.json` - Safari-specific configuration template
- `README.md` - Comprehensive Safari extension documentation

#### Project Infrastructure

- **README.md**: Engaging project documentation
- **Repository structure**: Clean monorepo setup
- **Development tooling**: Testing frameworks, linting setup
- **Cross-platform testing**: Payload compatibility verification between Chrome/Safari

### 🚧 In Development

#### Recipe Data Model

```go
// Target structure for API
type Recipe struct {
    ID              string            `json:"id"`
    Title           string            `json:"title"`
    Ingredients     []IngredientSection `json:"ingredients"`
    Steps           []StepSection     `json:"steps"`
    ServingSize     string            `json:"servingSize"`
    PrepTime        string            `json:"prepTime"`
    CookTime        string            `json:"cookTime"`
    Photos          []string          `json:"photos"`
    Attribution     string            `json:"attributionUrl"`
    Archive         string            `json:"fullPageArchive"`
    FullTextContent string            `json:"fullTextContent"` // Complete page text for LLM analysis
    ExtractedAt     time.Time         `json:"extractedAt"`
    UserAgent       string            `json:"userAgent"`
    CreatedAt       time.Time         `json:"createdAt"`
    UpdatedAt       time.Time         `json:"updatedAt"`
}
```

#### New LLM Enhancement Field

**`fullTextContent`**: Complete text content from recipe pages, cleaned and normalized for LLM analysis. This enables inference of missing structured data like:

- **Total cooking time** when only prep/cook times are scattered in instructions
- **Difficulty level** from cooking technique descriptions
- **Cuisine type** from ingredient lists and cooking methods
- **Dietary restrictions** from ingredient analysis

### 📋 Next Development Priorities (PRD-Driven)

<<<<<<< HEAD

1. **AWS Backend Lambda Functions (High Priority)**
   - **Go-based Lambda functions** for recipe CRUD operations
   - **API Endpoints**: GET/POST/PUT/DELETE for recipes, user management
   - **DynamoDB Integration**: Connect to deployed `recipeArchive-recipes-dev` table
   - **S3 Integration**: Photo and HTML archive storage to `recipearchive-storage-dev-[ACCOUNT-ID]`
   - **Cognito Integration**: JWT authentication with User Pool `us-west-2_qJ1i9RhxD`
   - **Target**: <300ms response time, 99.9% uptime on Free Tier infrastructure

2. # **Priority Site Extraction (PRD Requirement)**
3. **Priority Site Extraction (PRD Requirement)**

   > > > > > > > origin/main
   - **Washington Post Recipes** - First expansion target
   - **Food & Wine** - Second priority site
   - **NYT Cooking** - Third priority site
   - **Love & Lemons, Damn Delicious, Serious Eats** - Remaining MVP sites
     <<<<<<< HEAD
   - **Target**: 95% extraction success on ALL priority sites before beta exit

4. **Authentication Migration (AWS Cognito Integration)**
   - **Replace Basic Auth** with AWS Cognito in both Chrome/Safari extensions
   - **JWT Token Management** in extensions for API calls
   - **User Registration/Login** flow in browser extension popup
   - **Session Management** with 1hr/30day token expiration

5. # **Performance & Quality Gates (Beta Requirements)**
   - Target: 95% extraction success on ALL priority sites before beta exit

6. **AWS Backend Implementation (Core Infrastructure)**
   - Go-based Lambda functions for recipe CRUD operations
   - DynamoDB table design optimized for recipe queries and multi-tenancy
   - S3 integration for photo and full page HTML archive storage
   - API Gateway with rate limiting, CORS, and JWT authentication
   - <300ms response time target, 99.9% uptime requirement

7. **Performance & Quality Gates (Beta Requirements)**
   > > > > > > > origin/main
   - Achieve <3 second extraction time across all priority sites
   - Implement robust error handling and graceful degradation
   - Add monitoring/alerting for extraction success rates
   - Create automated tests for each supported site

# <<<<<<< HEAD

4. **Safari Extension (Cross-platform Requirement)**
   - Port Chrome extension to Safari Web Extension format
   - Maintain shared extraction logic between Chrome/Safari
   - Ensure feature parity across both browser platforms

> > > > > > > origin/main

## Testing & Quality Assurance

### Chrome Extension Testing

```bash
cd extensions/chrome
npm test                    # Unit tests (Jest)
node test-recipe-extraction.js  # Integration tests with Playwright
```

### Safari Extension Testing

```bash
cd extensions/safari
npm install                 # Install dependencies including jest-environment-jsdom
npm test                    # Unit tests (Jest with cross-browser compatibility)
```

### Cross-Platform Compatibility Testing

```bash
# From project root - verifies both extensions produce identical payloads
node test-payload-compatibility.js
```

### Authentication Flow

- **Test Credentials**: user=`test`, password=`subject123`
- **Local Storage**: Browser extension APIs for secure credential storage
- **Config Management**: `.gitignore` protects real credentials

## AWS Infrastructure Design

### Rate Limiting & Security

- **Primary Defense**: 30-second window rate limits on all API endpoints
- **Configurable Thresholds**: Adjustable via GitHub Actions CI/CD
- **Cost Protection**: Automatic throttling to prevent DDoS-induced AWS costs

### Data Storage Strategy

- **DynamoDB**: Recipe metadata, user data, relationships
- **S3**: Recipe photos, full page HTML archives, large assets
- **Cognito**: User authentication and authorization (future multi-tenant)

## Development Workflow & Status (August 24, 2025 Update)

### **AGGRESSIVE UPDATE POLICY IMPLEMENTED**

This CLAUDE.md file is now updated **every few turns** to ensure it remains current with the latest development context. This ensures continuity between development sessions and maintains accurate project state.

### Current Development Status (As of August 24, 2025)

<<<<<<< HEAD

#### ✅ **COMPLETED** - AWS Infrastructure Deployment & Free Tier Optimization

- **CDK Stack Deployed**: `RecipeArchive-dev` fully deployed to AWS account `[ACCOUNT-ID]`
- **Free Tier Optimized**: All resources configured to stay within AWS Free Tier limits
- **Cost Monitoring**: Billing alerts and budget controls set up for $0 cost development
- **Multi-Machine Setup**: Complete documentation and scripts for seamless laptop switching
- **Resource IDs**: All deployed infrastructure IDs captured in `aws-backend/.env`
- **Security**: IAM user with specific policies, no root account usage

**Deployed Resources**:

- **API Gateway**: `https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/`
- **Cognito User Pool**: `us-west-2_qJ1i9RhxD`
- **DynamoDB Table**: `recipeArchive-recipes-dev`
- **S3 Bucket**: `recipearchive-storage-dev-[ACCOUNT-ID]`

=======

> > > > > > > origin/main

#### ✅ **COMPLETED** - Authentication & Security Implementation

- **Environment Variables**: All test credentials now use `RECIPE_TEST_USER` and `RECIPE_TEST_PASS` environment variables for security
- **Chrome Extension Authentication**: Complete BASIC auth integration with Playwright tests
- **Safari Extension Authentication**: Complete BASIC auth integration with Playwright tests
- **Cross-Platform Compatibility**: Both extensions produce identical AWS API payloads
- **Security**: No hardcoded credentials in source code (environment variable fallbacks only)

#### ✅ **COMPLETED** - Code Quality & Linting Implementation

- **ESLint Configuration**: Full ESLint v9 setup for both Chrome and Safari extensions
- **Linting Scripts**: `npm run lint` and `npm run lint:fix` for both extensions
- **Clean Code**: All linting issues resolved, both extensions pass ESLint with zero errors
- **Package.json**: Added `"type": "module"` to both extensions for ES module support
- **Standards**: Enforced single quotes, semicolons, and proper unused variable handling

#### ✅ **COMPLETED** - Test Infrastructure Enhancement

- **Playwright Authentication**: Both Chrome and Safari tests include full authentication setup
- **Environment Security**: Tests use environment variables for credentials (`RECIPE_TEST_USER`, `RECIPE_TEST_PASS`)
- **Cross-Platform Testing**: Payload compatibility verification between Chrome/Safari extensions
- **Integration Tests**: Both extensions have complete test suites with authentication flows

### Getting Started

1. **Chrome Extension Development**:

   ```bash
   cd extensions/chrome
   cp config.sample.json config.json  # Edit with your credentials
   npm install
   npm test                           # Unit tests
   npm run test:integration          # Playwright tests with auth
   npm run lint                      # Code quality check
   ```

2. **Safari Extension Development**:

   ```bash
   cd extensions/safari
   cp config.sample.json config.json  # Edit with your credentials
   npm install
   npm test                           # Unit tests
   npm run test:integration          # Playwright tests with auth
   npm run lint                      # Code quality check
   ```

3. **Load Extension in Chrome**:
   - Navigate to `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked" and select `/extensions/chrome/`

4. **Load Extension in Safari**:
   - Build Safari Web Extension using Xcode
   - Enable extension in Safari preferences

### Target Recipe Sources (Per PRD Priority)

- ✅ **Smitten Kitchen** - Fully implemented (95%+ extraction success)
- 🎯 **Washington Post Recipes** - High priority per PRD
- 🎯 **Food & Wine** - High priority per PRD
- 🎯 **New York Times Cooking** - High priority per PRD
- 🎯 **Love & Lemons** - High priority per PRD
- 🎯 **Damn Delicious** - High priority per PRD
- 🎯 **Serious Eats** - High priority per PRD
- 🔮 **Generic JSON-LD** - Future extensibility

## Project History & Notable Decisions

### August 23, 2025 Development Notes

- **Icon Resolution**: Fixed Chrome extension loading with proper PNG icons (16px, 32px, 48px, 128px)
- **Icon Design**: Updated extension icons from transparent placeholders to cake slice design reflecting recipe theme
- **ImageMagick**: Use `magick` command over deprecated `convert` in newer versions
- **VS Code Extensions**: React Native Tools and Swift Language Support installation failed; revisit as needed

### Architecture Decisions

- **Go Backend**: Chosen for performance, simplicity, and AWS Lambda compatibility
- **Manifest V3**: Chrome extension uses latest standard for future-proofing
- **MCP Protocol**: Future extensibility for plugin architecture

### Latest Development Context (August 24, 2025)

#### Security Enhancements

- **Environment Variable Strategy**: All test credentials moved to environment variables (`RECIPE_TEST_USER`, `RECIPE_TEST_PASS`)
- **Fallback Credentials**: Extensions use environment variables with fallback to test/subject123 for development
- **No Hardcoded Secrets**: All production credentials must be externalized before AWS deployment

#### Code Quality Implementation

- **ESLint v9**: Modern configuration using `eslint.config.js` format (not legacy `.eslintrc.json`)
- **Module Type**: Both package.json files now specify `"type": "module"` for ES module support
- **Standardized Rules**: Single quotes, semicolons, unused variable detection with proper ignore patterns
- **Cross-Browser Support**: ESLint globals configured for both Chrome (`chrome`) and Safari (`browser`, `browserAPI`)

#### Testing Infrastructure

- **Playwright Integration**: Both Chrome and Safari extensions have complete Playwright test suites
- **Authentication Flow**: Tests perform authentication setup before recipe extraction attempts
- **Cross-Platform Verification**: `test-payload-compatibility.js` ensures identical payload structure between extensions
- **Environment Integration**: Tests demonstrate proper environment variable usage for credentials

### ✅ **COMPLETED TODAY (August 24, 2025)** - Multi-Site Recipe Parser Implementation

#### **Massive Parser Expansion**

Successfully expanded both Chrome and Safari extensions from single-site (Smitten Kitchen) to **comprehensive multi-site recipe extraction**:

**Sites Now Fully Supported:**

- ✅ **Love & Lemons**: Enhanced filtering to remove navigation elements
- ✅ **Smitten Kitchen**: Original implementation maintained
- ✅ **Food52**: Comprehensive selector strategies with multiple fallbacks
- ✅ **Food Network**: Component class selectors (`.o-Ingredients__a-ListItem`, `.o-Method__m-Step`)
- ✅ **AllRecipes**: Data attribute extraction (`[data-ingredient-name]`) plus manual selectors
- ✅ **Epicurious**: Test ID selectors (`[data-testid="IngredientList"]`)
- ✅ **Washington Post**: Authentication-ready parser with paywall handling

#### **Technical Implementation Details**

- **Extraction Strategy**: JSON-LD structured data first, site-specific manual parsing fallback
- **Site Detection**: Automatic hostname-based routing to appropriate parser
- **Unified Data Structure**: All parsers return consistent recipe payload format
- **Cross-Platform**: Identical functionality implemented in both Chrome and Safari extensions
- **Helper Functions**: `createRecipePayload()` for common data extraction (times, servings, photos)

#### **Testing & Quality Assurance**

- **Comprehensive Test Suites**: Created dedicated test files for each major site
- **Washington Post Authentication**: Environment variable integration (`WAPOST_USERNAME`, `WAPOST_PASSWORD`)
- **Maintainable Testing**: Detailed page analysis for debugging future layout changes
- **Future-Proof**: Test suites designed for weekly execution to catch site changes

#### **Test Files Created:**

- `test-love-lemons-recipes.js` - 67 Love & Lemons recipes across categories
- `test-food52-simple.js` - Basic Food52 parser validation
- `test-food52-comprehensive.js` - 62 Food52 cookie recipes
- `test-washington-post.js` - Washington Post with authentication
- `test-washington-post-auth-training.js` - Interactive authentication training
- `manual-extension-test.html` - Local testing page with JSON-LD

#### **Key Code Changes**

- **Site Routing**: Enhanced `extractRecipeGeneric()` with hostname detection
- **Parser Functions**: Individual extraction functions for each site
- **Selector Arrays**: Multiple fallback selectors for robust extraction
- **Authentication**: Environment variable support for subscription sites
- **Error Handling**: Graceful degradation when extraction fails

#### **Performance Optimizations**

- **Efficient Selectors**: Try most likely selectors first
- **Minimal DOM Queries**: Cache results to reduce browser overhead
- **Payload Optimization**: Only extract necessary data fields
- **Memory Management**: Clean up after extraction

This represents the **largest single-day feature expansion** in the project, transforming the extensions from single-site tools to comprehensive multi-site recipe extractors capable of handling the vast majority of popular cooking websites.

---

## August 24, 2025 - Automatic Diagnostic Capture Enhancement

### **Innovation: Self-Improving Parser System**

Implemented automatic diagnostic capture functionality that triggers when recipe extraction fails, creating a continuous improvement feedback loop:

#### **Core Features Implemented**

- **Failure Detection**: `isExtractionFailed()` function analyzes extraction quality
- **Automatic Triggering**: Parser failures automatically capture comprehensive diagnostic data
- **AWS Integration**: Ready for `/v1/diagnostics/auto` endpoint when backend is available
- **User Feedback**: Clear messaging about automatic diagnostic submission
- **Privacy-First**: Diagnostic capture only on extraction failures, not successful extractions

#### **Technical Implementation**

- **Chrome Extension**: Auto-diagnostic in `content.js` and `popup.js`
- **Safari Extension**: Cross-browser compatible auto-diagnostic implementation
- **Failure Criteria**: Missing title AND (ingredients OR steps)
- **Data Payload**: Full page analysis, extraction attempts, and technical metadata
- **Non-Blocking**: Diagnostic failures don't affect user experience

#### **Business Value**

- **Continuous Improvement**: Real-world failure data drives parser enhancements
- **Rapid Response**: Detect site structure changes that break parsers
- **Quality Assurance**: Monitor extraction success rates in production
- **Site Coverage**: Identify new sites requiring parser support

This enhancement transforms the browser extensions from static tools into **self-improving systems** that get better over time through user interaction feedback.

---

## August 24, 2025 - Directory Structure Reorganization

### **Monorepo Structure Cleanup**

Reorganized the previously scattered test files and utilities into a logical directory structure:

```
RecipeArchive/
├── extensions/              # Browser extensions
│   ├── chrome/             # Chrome extension (Manifest V3)
│   └── safari/             # Safari Web Extension
├── tests/                  # All test files (NEW ORGANIZATION)
│   ├── integration/        # Integration tests (Playwright-based)
│   │   ├── sites/         # Site-specific recipe extraction tests
│   │   ├── extensions/    # Extension end-to-end tests
│   │   └── *.js          # Cross-platform integration tests
│   ├── unit/              # Unit tests (Jest-based)
│   │   ├── chrome/        # Chrome extension unit tests
│   │   └── safari/        # Safari extension unit tests
│   ├── fixtures/          # Test data and fixtures
│   ├── results/           # Test output and result files
│   ├── tools/             # Analysis scripts and debugging utilities
│   └── README.md          # Test documentation
├── dist/                   # Build artifacts and distribution files
├── docs/                   # Project documentation (PRDs, specs)
└── scripts/                # Build and deployment scripts (future)
```

#### **Benefits of New Structure**

- **Clear Separation**: Unit tests vs integration tests vs utilities
- **Logical Grouping**: Site-specific tests grouped by purpose
- **Easy Navigation**: Developers can quickly find relevant tests
- **Scalable**: Structure supports future backend and web app tests
- **Maintainable**: No more scattered test files in root directory

#### **Migration Completed**

- ✅ Moved 17+ test files to appropriate directories
- ✅ Created comprehensive test documentation
- ✅ Updated package.json scripts for new structure
- ✅ Added proper .gitignore patterns
- ✅ Removed legacy files and cleaned up extensions directories

---

## Development Commands Reference

### **Root Level Commands**

```bash
# All tests
npm run test:all                   # Run all unit and integration tests
npm run test                       # Run integration tests only
npm run test:unit                  # Run unit tests for both extensions
npm run test:integration           # Run integration tests
npm run lint                       # Lint both extensions

# Site-specific testing
npm run test:integration:sites     # Test all supported recipe sites
npm run test:integration:extensions # Test browser extensions
```

### **Extension-Specific Commands**

```bash
# Chrome Extension
cd extensions/chrome
npm test                           # Unit tests (Jest)
npm run lint                       # ESLint code quality check
npm run lint:fix                   # Auto-fix ESLint issues

# Safari Extension
cd extensions/safari
npm test                           # Unit tests (Jest with jsdom)
npm run lint                       # ESLint code quality check
npm run lint:fix                   # Auto-fix ESLint issues
```

### **Test-Specific Commands**

```bash
# Integration Tests
cd tests/integration
npm test                           # All integration tests
npm run test:comprehensive         # Cross-site comprehensive tests
npm run test:sites                 # Site-specific tests
npm run test:extensions           # Extension tests

# Site-specific tests
cd tests/integration/sites
node test-washington-post.js       # Washington Post tests
node test-food52-comprehensive.js  # Food52 tests
node test-love-lemons-recipes.js   # Love & Lemons tests
```

### **Environment Variable Setup**

```bash
# For Washington Post authentication tests
export WAPOST_USERNAME="your-email@domain.com"
export WAPOST_PASSWORD="your-password"
```

### **Future Backend Commands**

```bash
go run main.go                     # Local development server
go test ./...                      # Backend unit tests
<<<<<<< HEAD
```

### **AWS & Multi-Machine Setup Commands**

```bash
# AWS Infrastructure Management
cd aws-backend/infrastructure
npx cdk list                       # List available stacks
npx cdk deploy                     # Deploy infrastructure
npx cdk destroy                    # Destroy development resources
npx cdk diff                       # Show changes before deploy

# Free Tier Monitoring
./scripts/setup-aws-billing-controls.sh  # Set up cost monitoring
aws budgets describe-budgets --account-id [ACCOUNT-ID]  # Check budget status

# Multi-Machine Setup (New Laptop)
./scripts/setup-macos.sh           # Complete environment setup
aws configure                      # Configure AWS CLI (same credentials)
aws sts get-caller-identity        # Verify AWS access
source aws-backend/.env            # Load environment variables

# Cost Monitoring & Free Tier
# Check Free Tier Dashboard: https://console.aws.amazon.com/billing/home#/freetier
# Monitor costs: https://console.aws.amazon.com/cost-management/home
```

## 🔧 Multi-Machine Development Setup

### **Deployed AWS Resources (Account: [ACCOUNT-ID])**

- **API Gateway**: `https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/`
- **Cognito User Pool**: `us-west-2_qJ1i9RhxD`
- **Cognito Client**: `5grdn7qhf1el0ioqb6hkelr29s`
- **DynamoDB Table**: `recipeArchive-recipes-dev`
- **S3 Bucket**: `recipearchive-storage-dev-[ACCOUNT-ID]`

### **Resume Development on Any Machine**

1. **Clone repository**: `git clone git@github.com:bordenet/RecipeArchive.git`
2. **Run setup**: `./scripts/setup-macos.sh`
3. **Configure AWS**: `aws configure` (use same IAM credentials)
4. **Verify setup**: `aws sts get-caller-identity`
5. **Load environment**: `source aws-backend/.env`

### **Cost Management**

- ✅ **Free Tier Optimized**: All resources stay within AWS Free Tier limits
- ✅ **Billing Alerts**: Email notifications for ANY charges (should stay $0)
- ✅ **Budget Controls**: $1 monthly budget with $0.01 and $0.50 alerts
- ✅ **Monitoring**: CloudWatch alarms and SNS notifications active

**Development costs should remain $0.00** throughout the project lifecycle.

=======
./scripts/deploy.sh # AWS deployment

```

>>>>>>> origin/main
This CLAUDE.md serves as the definitive project guide and should be updated as development progresses.
```
