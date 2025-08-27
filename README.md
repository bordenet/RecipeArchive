# 🍽️ RecipeArchive

**A simple recipe archiving platform for home cooks**

RecipeArchive streamlines the way you capture, organize, and access your favorite recipes. Our platform provides reliable recipe capture, intelligent storage, and seamless synchronization across all your devices, ensuring your culinary collection is always accessible when you need it.

Are there commercial solutions available for this? Why yes, of course there are. (AnyList, as an example.) But this one is mine, and this is a vibe coding opportunity!

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

### 🌐 Recipe Site Support

🔵 **Currently Implemented:**
- [Smitten Kitchen](https://smittenkitchen.com) - Full support with structured data extraction

🔄 **Previously Supported (August 24, 2025):**
- Love & Lemons 
- Food52
- Food Network
- AllRecipes
- Epicurious
- Washington Post (with paywall support)

*These sites were supported but need reimplementation in the new parser architecture. Work is underway to restore full functionality.*

````

- 🔌 **Browser Extensions** - Chrome & Safari extensions for one-click recipe archiving (PRODUCTION READY)
- ☁️ **AWS Backend** - Go-based serverless backend with local development server (LOCAL DEVELOPMENT COMPLETE)

**🚧 Planned Components:**
- 📱 **iOS App** - Native mobile recipe browsing
- 🌐 **Web App** - Recipe management and meal planning interface

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
- Unified CLI for development operations

## 🎯 Supported Recipe Websites

**Fully Implemented & Tested:**
- 🥘 **Smitten Kitchen** - JSON-LD + manual parsing with comprehensive test coverage
- 🍋 **Love & Lemons** - Site-specific parser with ingredient/instruction extraction
- 🍽️ **Food Network** - JSON-LD + custom parser for Alton Brown recipes and more
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
- ✅ Comprehensive recipe site support
- ✅ One-click capture with complete HTML archiving  
- ✅ Production Cognito authentication
- ✅ Cross-browser Safari extension available

**Safari Extension: Production Ready** 🍎
- ✅ iPhone/iPad compatible Web Extension
- ✅ Feature parity with Chrome version
- ✅ Mobile-optimized interface with dark mode support

**Unified CLI: Development Ready** ⚡
- ✅ Go-based `recipe-cli` for streamlined development operations
- ✅ Automated development environment setup
- ✅ Comprehensive testing across all components
- ✅ Integrated AWS deployment workflow

**Next Priorities:**
- AWS Lambda deployment via CLI
- Additional recipe site parsers (Food & Wine, NYT Cooking)
- iOS app development

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

_Designed for home cooks who value organization and accessibility in their recipe collection 🍳_
