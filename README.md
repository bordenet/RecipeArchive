# 🍽️ RecipeArchive

**The ultimate recipe hoarding tool for digital food obsessives**

Stop screenshotting recipes like it's the 90's! RecipeArchive is your handy little sous chef that captures, stores, and syncs your culinary discoveries across all your devices. Because losing that perfect brownie recipe to a broken bookmark is basically a crime against dessert.

## 🚀 Quick Start

### One-Command Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/RecipeArchive
cd RecipeArchive

# 🔒 SECURITY FIRST: Set up environment variables
cp .env.template .env
# Edit .env with your actual credentials (NEVER commit this file!)

# Setup everything automatically with our unified CLI
recipe-cli setup
```

### 🔐 Security Notice
**CRITICAL**: This project uses `.env` files for sensitive credentials. The `.env` file is protected by `.gitignore` and should NEVER be committed to version control. Always use `.env.template` as a reference for setup.

### Local Development (Zero AWS Costs)
```bash
# Start local development environment
recipe-cli dev start

# Run comprehensive test suite
recipe-cli test run

# Deploy to AWS when ready
recipe-cli deploy aws
```

**Unified CLI Features:**
- 🏠 **Local Development**: One command starts everything
- 🧪 **Comprehensive Testing**: All tests across Go, JavaScript, and integrations
- ☁️ **AWS Deployment**: Streamlined cloud deployment
- 🔧 **Development Tools**: High-performance Go utilities
- � **Status Monitoring**: Real-time development feedback
- 💰 **Zero AWS Costs**: Develop completely offline

## 🎯 What We're Building

A cross-platform recipe archiving system currently featuring:

- 🔌 **Browser Extensions** - Chrome & Safari extensions for one-click recipe archiving (PRODUCTION READY)
- ☁️ **AWS Backend** - Go-based serverless backend with local development server (LOCAL DEVELOPMENT COMPLETE)

**🚧 Planned Components:**
- 📱 **iOS App** - Native mobile recipe browsing
- 🌐 **Web App** - Recipe management and meal planning interface

## 🚀 The Big Picture

Turn recipe chaos into culinary zen with:

- **Lightning-fast capture** - Grab ingredients, steps, photos, and timing in seconds
- **Smart organization** - Find that pasta dish from 3 months ago instantly
- **Offline access** - Cook without WiFi like it's 2005
- **Multi-device sync** - Start on phone, finish on laptop
- **Full page archives** - Because food blogs love to disappear recipes

## 💪 Tech Stack

**Production Ready:**
- **Unified CLI:** Go-based `recipe-cli` for all development operations
- **Browser Extensions:** JavaScript + Manifest V3 (Chrome & Safari)
- **Backend API:** Go with local development server + comprehensive tests  
- **Authentication:** AWS Cognito with JWT token management
- **Recipe Parsing:** JSON-LD structured data + site-specific parsers
- **Testing:** Jest + Go testing with 40/40 tests passing

**In Development:**
- **Cloud Infrastructure:** AWS Lambda, S3, API Gateway (TypeScript CDK)
- **Mobile App:** Swift for iOS
- **Web Interface:** React + TypeScript

**Language Strategy:**
- **Go:** Backend services, CLI tools, web scraping, high-performance operations
- **JavaScript:** Browser extensions (required for DOM APIs), DOM manipulation
- **TypeScript:** AWS infrastructure, future web UI
- **Swift:** iOS app development

*Strategic hybrid approach: each language serves its optimal purpose.*

## 🎮 Core Superpowers (MVP)

1. **Recipe Extraction Magic** - Pull ingredients, steps, photos, and timing data
2. **Smart Recipe Library** - Sort, search, and filter your collection like a boss
3. **Meal Prep Mode** - Perfect detail view for cooking chaos
4. **Offline Fortress** - Access recipes even when the internet dies
5. **Cross-Device Harmony** - Pick up where you left off, anywhere

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
- No Kubernetes complexity - we're not Netflix
- Zero npm bloat - every dependency earns its place
- One CLI to rule them all

## 🎯 Supported Recipe Websites

**Fully Implemented & Tested:**
- 🥘 **Smitten Kitchen** - JSON-LD + manual parsing with comprehensive test coverage
- 🍋 **Love & Lemons** - Site-specific parser with ingredient/instruction extraction
- 📄 **JSON-LD Sites** - Universal structured data support for compliant recipe sites

**Ready for Implementation:**
- 📰 **Washington Post** - Authentication-ready parser implemented
- 🍽️ **Food & Wine** - High priority per PRD requirements  
- 🗞️ **New York Times Cooking** - Premium recipes target
- 🌶️ **Damn Delicious** - PRD specified site
- 🧪 **Serious Eats** - Science-based cooking target

*HTML fixtures and parsing validation framework ready for rapid expansion to all priority sites.*

## 📊 Test Coverage & Quality

| Component | Tests | Status | Coverage |
|-----------|-------|--------|----------|
| **Go Backend** | 5/5 passing | ✅ | Health, Auth, CRUD APIs |
| **Recipe Parsing Logic** | 30/30 passing | ✅ | Real business logic tests |
| **Integration Tests** | 5/5 passing | ✅ | Server lifecycle & APIs |
| **ESLint (Code Quality)** | 0 errors | ✅ | 100% compliant |
| **Overall Test Suite** | 40/40 tests | ✅ | 100% pass rate |

*Testing focuses on catching real bugs rather than metrics. Recipe parsing tests validate actual business logic and HTML extraction patterns.*

### Unified CLI Commands
```bash
# Development workflow
recipe-cli dev start        # Start local development environment
recipe-cli dev stop         # Stop all development services  
recipe-cli dev status       # Check development environment status

# Testing
recipe-cli test run         # Run comprehensive test suite
recipe-cli test unit        # Run unit tests only
recipe-cli test integration # Run integration tests only

# Deployment  
recipe-cli deploy aws       # Deploy to AWS
recipe-cli deploy validate  # Validate deployment configuration

# Utilities
recipe-cli setup            # One-time project setup
recipe-cli --version        # Show CLI version
recipe-cli --help          # Show available commands
```

## 🚀 Current Status

**Chrome Extension: Production Ready** 🔥
- ✅ Smitten Kitchen recipes conquered
- ✅ One-click capture with full HTML archiving  
- ✅ Production Cognito authentication
- ✅ Cross-browser Safari extension ready

**Safari Extension: Production Ready** 🍎
- ✅ iPhone/iPad compatible Web Extension
- ✅ Same functionality as Chrome version
- ✅ Mobile-optimized UI with dark mode

**Unified CLI: Development Ready** ⚡
- ✅ Go-based `recipe-cli` for all development operations
- ✅ One-command development environment setup
- ✅ Comprehensive testing across all languages
- ✅ Streamlined AWS deployment workflow

**Next Priorities:**
- AWS Lambda deployment via CLI
- Additional recipe site parsers (Food & Wine, NYT Cooking)
- iOS app development

## 📚 Project Documentation

### 📋 Product Requirements Documents (PRDs)
- **docs/requirements/BrowserExtension_PRD.md** - Chrome & Safari extension specifications
- **docs/requirements/iOSApp_PRD.md** - Native mobile app requirements  
- **docs/requirements/Website_PRD.md** - Web application specifications
- **docs/requirements/AWS_Backend_PRD.md** - Cloud infrastructure requirements

### 🏗️ Architecture Decisions
- **AUTH_ARCHITECTURE_DECISION.md** - AWS Cognito authentication strategy
- **RECIPE_DATA_MODEL.md** - Unified TypeScript recipe interface
- **PERFORMANCE_STANDARDS.md** - Performance targets and SLAs
- **STORAGE_RECOMMENDATIONS.md** - Cost optimization analysis (S3 vs DynamoDB)

### 🧪 Development Validation
```bash
# Run comprehensive test suite with CLI
recipe-cli test run

# Extension development workflow  
cd extensions/chrome
npm install && npm test && npm run lint

# Load extension: chrome://extensions/ → Developer Mode → Load unpacked

# Recommended CLI workflow
recipe-cli setup           # One-time setup
recipe-cli dev start       # Start everything needed for development
recipe-cli test run        # Validate all components
```

## 🛡️ Infrastructure

Our AWS backend includes:

- **S3 Recipe Storage** - Your recipes, safely stored
- **Rate Limiting** - Configurable thresholds protect costs
- **GitHub Actions** - Automated deployment and testing

---

_Built for people who bookmark recipes they'll definitely cook "someday" 🍳_
