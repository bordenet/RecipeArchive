# 🍽️ RecipeArchive

**A simple recipe archiving platform for home cooks**

RecipeArchive streamlines the way you capture, organize, and access your favorite recipes. Our platform provides reliable recipe capture, intelligent storage, and seamless synchronization across all your devices, ensuring your culinary collection is always accessible when you need it.

Are there commercial solutions available for this? Why yes, of course there are. (AnyList, as an example.) But this one is mine, and this is a vibe coding opportunity!

## � Security First

**IMPORTANT**: This project uses environment-based configuration to ensure no credentials are hardcoded in source code. Before running any components, you must configure your environment variables.

## �🚀 Quick Start

### One-Command Setup

```bash
# Clone the repository
git clone https://github.com/bordenet/RecipeArchive
cd RecipeArchive

# 🔒 SECURITY FIRST: Set up environment variables
cp .env.template .env
cp extensions/.env.template extensions/.env
# Edit ALL .env files with your actual credentials (NEVER commit .env files!)

# Environment validation (quick check)
npm run validate  # Checks Node.js, Go, Git, and project structure

# Full monorepo validation (comprehensive)
npm test  # Runs complete 8-tier quality gate system including Flutter
# OR run directly: ./validate-monorepo.sh
```

### 🔧 Environment Configuration

See [Environment Setup Guide](docs/setup/ENVIRONMENT_SETUP.md) for detailed configuration instructions.

**Required for all components:**
- AWS Cognito credentials
- API Gateway endpoints  
- Test user credentials (development only)

### 🌐 Flutter Web App Quick Start

The Recipe Archive web application is built with Flutter and provides a modern, responsive interface for managing your recipe collection.

```bash
# Navigate to the Flutter web app directory
cd recipe_archive_fresh

# Install Flutter dependencies
flutter pub get

# Start the development server
flutter run -d chrome

# Or build for production
flutter build web
```

**Web App Features:**
- 📱 **Responsive Design**: Mobile-first with tablet and desktop optimizations
- 🔍 **Advanced Search**: Filter by cuisine, tags, cooking time, and favorites
- 🎨 **Material Design 3**: Modern UI with recipe-focused color scheme
- ⚡ **Progressive Web App**: Installable with offline capabilities
- 🔄 **Real-time Sync**: Connected to AWS backend for cross-device synchronization

**Development URLs:**
- Local Development: `http://localhost:PORT` (PORT shown in terminal)
- Production Build: Served from `recipe_archive_fresh/build/web/`

**Prerequisites:**
- Flutter SDK 3.10.0 or higher
- Chrome browser for development
- Valid AWS credentials for backend integration

### 🔐 Security Notice

**CRITICAL**: This project uses `.env` files for sensitive credentials. The `.env` file is protected by `.gitignore` and should NEVER be committed to version control. Always use `.env.template` as a reference for setup.

### Development Workflow

```bash
# Run comprehensive monorepo validation
./validate-monorepo.sh

# Or use npm shortcut
npm test
```

**Development Features:**

- 🔨 **Build Tools**: Compiles TypeScript parsers and builds Go CLI tools
- 🧪 **Comprehensive Testing**: All tests across Go, JavaScript, and integrations
- ☁️ **AWS Deployment**: CDK-based infrastructure deployment
- 🔧 **Development Tools**: High-performance Go utilities for reporting and testing
- 📊 **Monorepo Validation**: 8-tier quality gate system with security scanning
- ⚡ **Direct AWS Integration**: Extensions authenticate with AWS Cognito, store to S3

## 🎯 What We're Building

A cross-platform recipe archiving system currently featuring:

### 🌐 Recipe Site Support

🔵 **Currently Supported Sites (11 Total):**

- [Smitten Kitchen](https://smittenkitchen.com) ✅
- [Love & Lemons](https://www.loveandlemons.com) ✅
- [Food52](https://food52.com) ✅
- [Food Network](https://www.foodnetwork.com) ✅
- [Epicurious](https://www.epicurious.com) ✅
- [NYT Cooking](https://cooking.nytimes.com) ✅
- [AllRecipes](https://www.allrecipes.com) ✅
- [Serious Eats](https://www.seriouseats.com) ✅
- [Washington Post](https://www.washingtonpost.com) ✅ (with cookie auth)
- [Food & Wine](https://www.foodandwine.com) ✅
- [Damn Delicious](https://damndelicious.net) ✅

## Supported Recipe Websites & Test Fixture Strategy

| Site Name           | URL Pattern                  | Parser Status | Test Fixture | Paywall/Notes                  |
|---------------------|-----------------------------|--------------|--------------|-------------------------------|
| Smitten Kitchen     | smittenkitchen.com           | ✅           | Yes          | JSON-LD + manual parsing      |
| Food Network        | foodnetwork.com              | ✅           | Yes          | Complex CSS selectors         |
| NYT Cooking         | cooking.nytimes.com          | ✅           | Yes          | data-testid attributes        |
| Washington Post     | washingtonpost.com           | ✅           | Yes          | Cookie auth for live tests; offline HTML fixture for CI |
| Love & Lemons       | loveandlemons.com            | ✅           | Yes          | Complex ingredient grouping   |
| Food52              | food52.com                   | ✅           | Yes          | Multiple recipe formats       |
| AllRecipes          | allrecipes.com               | ✅           | Yes          | Community-generated content   |
| Epicurious          | epicurious.com               | ✅           | Yes          | Condé Nast network           |
| Serious Eats        | seriouseats.com              | ✅           | Yes          | Technical cooking focus       |
| Alexandra's Kitchen | alexandracooks.com           | ✅           | Yes          | Standard extraction           |
| Food & Wine         | foodandwine.com              | ✅           | Yes          | Magazine recipes              |
| Damn Delicious      | damndelicious.net            | ✅           | Yes          | High-traffic food blog        |
| JSON-LD Sites       | (universal fallback)         | ✅           | Yes          | Structured data support       |

**Legend:**
- ✅ = Production-ready TypeScript parser, full test coverage
- 🔄 Planned = PRD-defined, parser framework ready or in development
- Test Fixture: HTML sample available in `/tests/fixtures/html-samples/`

**Site Registry:**
- All supported sites, parser files, fixture files, paywall status, and implementation status are centrally managed in `/parsers/sites/site-registry.ts`.
- To add or update a site, edit the registry and add the corresponding fixture file.

**Registry-Driven Tests:**
- Extraction tests are automatically generated for all sites in the registry via `/tests/unit/registry-driven-recipe-extraction.test.ts`.
- Shared test utilities in `/tests/unit/test-utils.ts` handle parser loading, fixture loading, extraction, and contract validation.
- Redundant site-specific extraction test files have been removed for maintainability.

**Paywalled Sites:**
- *Washington Post*: Live tests require cookie-based authentication. For CI/offline testing, use the checked-in HTML fixture (`washington-post-sample.html`).

**Test Coverage:**
- All registry sites have matching HTML fixtures and are covered by registry-driven tests.
- Backend synthetic recipes reference real URLs in `/aws-backend/functions/testdata/test-recipes.json`.

**Universal Fallback:**
- For unsupported sites, JSON-LD extraction is attempted first. If unavailable, generic DOM parsing is used. Failed parses trigger diagnostic submission for parser improvement. **All registry sites are now fully supported and validated. Documentation and PRD are in lock-step with the codebase.**

**Diagnostic Automation:**
- Failed extractions automatically submit diagnostic payloads (HTML, metadata) for parser improvement.
- Diagnostic coverage is enforced in both extension and backend workflows, ensuring continuous parser quality.

**Current Mobile Applications:**
- iOS App: Native mobile recipe browsing and editing with AWS integration
- iPad App: Split-view interface optimized for tablet usage
- Android App: Jetpack Compose with Material 3 design
- Flutter Web App: Modern responsive web interface with full recipe management

## 🚀 The Big Picture

Transform your recipe management with a complete archiving solution:

- **Efficient capture** - Extract ingredients, instructions, photos, and timing information quickly
- **Intelligent organization** - Advanced search and filtering capabilities
- **Offline access** - View recipes without an internet connection
- **Multi-device synchronization** - Access your collection from any device
- **Complete page preservation** - Maintain full recipe context and source information

## 💪 Tech Stack

**Production Ready:**

- **Unified CLI:** Go-based `recipe-cli` for all development operations
- **Browser Extensions:** JavaScript + Manifest V3 (Chrome & Safari)
- **Backend API:** Go serverless functions with AWS Lambda + comprehensive tests
- **Authentication:** AWS Cognito with JWT token management
- **Recipe Parsing:** JSON-LD structured data + site-specific TypeScript parsers
- **Testing:** Jest + Go testing with comprehensive validation

**Deployed Infrastructure:**

- **Cloud Infrastructure:** AWS Lambda, S3, API Gateway (TypeScript CDK)
- **Authentication:** AWS Cognito with JWT token management
- **Storage:** S3-based JSON storage with 95% cost savings vs DynamoDB

**Language Strategy:**

- **Go:** Backend services, CLI tools, web scraping, high-performance operations
- **JavaScript:** Browser extensions (required for DOM APIs), DOM manipulation
- **TypeScript:** AWS infrastructure, TypeScript parsers, type safety
- **Flutter/Dart:** Cross-platform web and mobile applications
- **Kotlin:** Android native development with Jetpack Compose
- **Native iOS/iPadOS:** Platform-specific optimizations and features

_Strategic hybrid approach: each language serves its optimal purpose._

## 🎮 Core Features (MVP)

1. **Recipe Extraction** - Extract ingredients, instructions, photos, and timing data
2. **Recipe Library Management** - Comprehensive sorting, searching, and filtering
3. **Cooking Interface** - Optimized view for kitchen use
4. **Offline Capability** - Access recipes without internet connectivity
5. **Cross-Device Synchronization** - Seamless experience across all platforms

## 🏗️ Development Philosophy

**Strategic Hybrid Architecture**

Use the right tool for each job:

- **Go CLI First**: Unified `recipe-cli` command for all development operations
- **JavaScript Where Required**: Browser extensions need DOM APIs
- **TypeScript for Infrastructure**: AWS CDK and future web UI
- **No Language Dogma**: Pragmatic choices over ideology

**Keep It Simple, Keep It Fast**

- Serverless-first AWS architecture
- US-West deployment by default
- Streamlined infrastructure without unnecessary complexity
- Efficient dependency management
- Cross-platform mobile applications (Flutter, native iOS/iPad, Android)

## 🎯 Supported Recipe Websites

**Fully Implemented & Tested:**

- 🥘 **Smitten Kitchen** - JSON-LD + manual parsing with comprehensive test coverage
- 🍋 **Love & Lemons** - Site-specific parser with ingredient/instruction extraction
- 🍽️ **Food Network** - JSON-LD + custom parser for Alton Brown recipes and more
- 📄 **JSON-LD Sites** - Universal structured data support for compliant recipe sites

**Parser Development Status:**

All 13 sites have complete TypeScript parsers with comprehensive contract validation. Each parser handles both JSON-LD structured data and site-specific HTML extraction patterns.

_All sites with ✅ status are production-ready with comprehensive test coverage and validation._

## 📊 Test Coverage & Quality

| Component                 | Tests         | Status | Coverage                  |
| ------------------------- | ------------- | ------ | ------------------------- |
| **Go Backend**            | 5/5 passing   | ✅     | Health, Auth, CRUD APIs   |
| **Recipe Parsing Logic**  | 10+ sites     | ✅     | Real business logic tests |
| **Integration Tests**     | 5/5 passing   | ✅     | Server lifecycle & APIs   |
| **ESLint (Code Quality)** | 1 warning     | ⚠️     | Near 100% compliant      |
| **Monorepo Validation**   | 8-tier gates  | ✅     | Security, linting, tests  |

_Testing focuses on catching real bugs rather than metrics. Recipe parsing tests validate actual business logic and HTML extraction patterns._

### Development Commands

```bash
# Comprehensive validation (recommended)
./validate-monorepo.sh      # Full 8-tier validation
npm test                    # Shortcut for validation

# Individual components
npm run lint                # ESLint for web extensions
npm run test:go             # Go backend tests
npm run test:parsers        # TypeScript parser tests

# Build and deploy
npm run build:parsers       # Compile TypeScript parsers
cd aws-backend/functions/recipes && go build -o bootstrap main.go  # Build Lambda

# Utilities
npm run security:scan       # TruffleHog security scan
npm run docs:review         # CLAUDE.md maintenance check
```

## 🚀 Current Status

**Chrome Extension: Production Ready** 🔥

- ✅ 11 recipe sites supported with comprehensive validation
- ✅ TypeScript parser system with decoupled site-specific parsers
- ✅ JWT authentication with AWS Cognito integration
- ✅ Recipe URL-based overwrite behavior (no duplicates)

**Safari Extension: Production Ready** 🍎

- ✅ iPhone/iPad compatible Web Extension
- ✅ Feature parity with Chrome extension
- ✅ Mobile-optimized interface
- ✅ Same TypeScript parser bundle integration

**AWS Backend: Production Ready** ☁️

- ✅ Recipe URL-based overwrite prevents duplicates per user
- ✅ S3-based JSON storage with 95% cost savings vs DynamoDB
- ✅ Recipe report tool with domain extraction (SourceURL field)
- ✅ JWT authentication with AWS Cognito User Pool
- ✅ Test tools for duplicate cleanup and validation

**Development Tools: Production Ready** ⚡

- ✅ Monorepo validation script with 8-tier quality gates
- ✅ TypeScript parser compilation and bundling
- ✅ Security scanning with TruffleHog (zero secrets detected)
- ✅ Cross-platform compatibility (no hardcoded paths)

**Current Status:**

- All core components are production-ready and deployed
- Extensions successfully save recipes to AWS S3 storage
- Branch synchronization complete (main ↔ website-parsers)
- Comprehensive documentation updated and current

**Development Requirements:**
- AWS Account with Cognito and S3 access
- Valid AWS credentials in `.env` file
- Development incurs minimal AWS costs (~$1-5/month for testing)

## 📚 Project Documentation

### 📋 Product Requirements Documents (PRDs)

- **docs/requirements/browser-extension.md** - Chrome & Safari extension specifications
- **docs/requirements/ios-app.md** - Native mobile app requirements
- **docs/requirements/website.md** - Web application specifications
- **docs/requirements/aws-backend.md** - Cloud infrastructure requirements

### 🏗️ Architecture Decisions

- **AUTH_ARCHITECTURE_DECISION.md** - AWS Cognito authentication strategy
- **RECIPE_DATA_MODEL.md** - Unified TypeScript recipe interface
- **PERFORMANCE_STANDARDS.md** - Performance targets and SLAs
- **STORAGE_RECOMMENDATIONS.md** - Cost optimization analysis (S3 vs DynamoDB)

### 🧪 Development Validation

#### Monorepo Validation (Primary Command)
```bash
./validate-monorepo.sh            # Comprehensive validation of entire monorepo
```

**Run this script periodically** (daily/before commits) to ensure monorepo health across all four areas:
- 🔌 Web Extensions (Chrome & Safari)  
- 🧩 Recipe Parsers (site-specific parsers)
- ☁️ AWS Backend (Go services)  
- 🌐 Frontend Clients (coming soon)

#### Extension Development
```bash
# Extension development workflow
cd extensions/chrome
npm install && npm test && npm run lint

# Load extension: chrome://extensions/ → Developer Mode → Load unpacked

# Parser development
cd parsers && npm run build  # Compile TypeScript parsers
cp dist/bundle.js ../extensions/chrome/typescript-parser-bundle.js
```

## 🛡️ Infrastructure

Our AWS backend includes:

- **S3 Recipe Storage** - Your recipes, safely stored
- **Rate Limiting** - Configurable thresholds protect costs
- **GitHub Actions** - Automated deployment and testing

---

_Designed for home cooks who value organization and accessibility in their recipe collection 🍳_

# 🏗️ Architecture Overview

## TypeScript Parser System

**Production-Ready Architecture:** Decoupled site-specific parsers with contract validation

- **Base Parser:** Abstract class defining standard interface and validation
- **Site Parsers:** Specialized parsers for each supported recipe website
- **Parser Registry:** Dynamic loading system for parser selection
- **Contract Validation:** Strict enforcement of required fields (title, ingredients, instructions)
- **Extension Integration:** Bundled JavaScript works in both Chrome and Safari

**Quality Assurance:** 

- Comprehensive validation against real recipe URLs
- 48-hour intelligent caching system
- Cross-platform compatibility testing
- Authentication support (Washington Post cookie auth)

## AWS Backend Architecture

**S3-Based Storage:** Cost-effective JSON storage with 95% savings vs DynamoDB

- **Recipe Storage:** Individual JSON files per recipe in S3
- **URL-Based Overwrite:** Prevents duplicates by source URL per user
- **Version Management:** Incremental versioning for recipe updates
- **Authentication:** JWT token validation with AWS Cognito
- **Cleanup Tools:** Duplicate detection and removal utilities

## Browser Extension Integration

**Production Deployment:** Both Chrome and Safari extensions ready for store submission

- **Authentication:** AWS Cognito with secure token storage
- **Recipe Extraction:** TypeScript parser system integration
- **Data Pipeline:** Extension → AWS Lambda → S3 storage
- **Cross-Browser:** Shared codebase with browser-specific adaptations
- **Mobile Support:** Safari Web Extension works on iPhone/iPad

---

*Last Updated: August 29, 2025 - Production-ready status across all core components*
