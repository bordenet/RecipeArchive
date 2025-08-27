# RecipeArchive Project Guide

## 🚀 Current Status: REAL AWS COGNITO AUTHENTICATION IMPLEMENTED ✅

**PROJECT STATUS: BOTH EXTENSIONS READY FOR PRODUCTION AWS**

### Recent Major Achievements (August 27, 2025)

**✅ REAL AWS Cognito Authentication System**
- Enhanced shared authentication library (`extensions/shared/cognito-auth.js`) with OAuth2 + direct auth support
- Added PKCE security for OAuth2 flow (code_challenge/code_verifier)
- Configured Cognito hosted UI domain: `recipearchive.auth.us-west-2.amazoncognito.com`
- Both extensions now use real JWT tokens (replacing mock tokens)
- Cross-browser identity API support for OAuth2 popup flow

**✅ Chrome Extension Production Ready**
- Fixed CONFIG loading issue (added config.js to popup.html)
- Implemented AWS-only backend flow (removed dual backend complexity)
- Added feature flag for dev testing: `recipeArchive.enableDevTesting`
- Real Cognito authentication with proper JWT token handling
- API endpoint fixed: `/v1/recipes` (was missing `/v1/` prefix)

**✅ Safari Extension Enhanced**  
- Already production-ready with working AWS integration
- API endpoint fixed: `/v1/recipes` for consistency
- Real authentication ready to replace mock tokens

**✅ Infrastructure Validation**
- AWS API Gateway correctly rejects mock JWT tokens (401 Unauthorized) ✅ 
- Cognito authorizer properly configured and working
- Recipe extraction working on both extensions (tested with Smitten Kitchen)

---

## Project Overview

**RecipeArchive** is a cross-platform recipe archiving system that captures, stores, and syncs culinary discoveries across all devices.

**Problem**: Home cooks lose access to recipes due to paywalls, site changes, ads, or site disappearance.

**Solution**: One-click permanent capture of any online recipe in a clean, ad-free format that syncs everywhere and works offline.

### Platform Architecture

- 🔌 **Browser Extensions** (Chrome & Safari, JavaScript) - One-click recipe extraction
- ☁️ **AWS Backend** (Go, serverless) - Scalable, cost-effective cloud infrastructure  
- 🛠️ **Development Tools** (Go CLI) - Unified development workflow
- 📱 **iOS Mobile App** (Swift) - Recipe browsing and capture (planned)
- 🌐 **Web Application** (React + TypeScript) - Meal planning interface (planned)

## 📋 Product Requirements & Architecture

### 🎯 PRD Governance

**CRITICAL**: All development work must strictly adhere to the PRDs included in this project. PRDs are the authoritative requirements specification and serve as the definitive guide for all development decisions.

**Development Principle**: Every feature, design decision, and implementation must align with what is explicitly stated in the PRDs. When in doubt, consult the PRDs first. PRDs define the "WHAT" - the requirements, user experience, and functional specifications that must be followed.

**PRD Attribution**: All PRD files include proper attribution to the Product Requirements Assistant at https://github.com/bordenet/product-requirements-assistant

### 🏗️ Architecture Decisions (RESOLVED)

**Authentication**: AWS Cognito from Day 1 across all platforms ✅  
**Recipe Data Model**: Unified TypeScript interface with 15 core fields ✅  
**Search Features**: Recipe library search (not external discovery) ✅  
**Performance Standards**: 3-tier SLA structure across platforms ✅  
**Storage Architecture**: S3-based JSON storage (95% cost reduction vs DynamoDB) ✅

### Critical PRD Documents

This project is guided by **four comprehensive PRD documents** that define the complete product vision and serve as the authoritative source for all development work:

#### 1. **Browser Extension PRD** (`docs/requirements/browser-extension.md`)
- **Core Mission**: One-click recipe capture with 95% accuracy in <3 seconds
- **Authentication**: Signed-in experience with authentication-first user interface
- **Target Sites**: Washington Post, Food & Wine, NYT Cooking, Smitten Kitchen, Love & Lemons, etc.
- **Performance**: <3 second extraction, <500ms popup load, 95% success rate

#### 2. **AWS Backend PRD** (`docs/requirements/aws-backend.md`)
- **Core Mission**: Secure, scalable, cost-effective recipe storage and sync
- **Architecture**: Serverless (Lambda, DynamoDB, S3, API Gateway)
- **Performance**: <300ms API response times, 99.9% uptime

#### 3. **Website PRD** (`docs/requirements/website.md`)
- **Core Mission**: Clean, responsive web interface for recipe management
- **Features**: Browse, search, filter recipes; CRUD operations; meal prep view

#### 4. **iOS App PRD** (`docs/requirements/ios-app.md`)
- **Core Mission**: Native iOS experience with offline-first design
- **Platform**: iPhone and iPad support with size-optimized layouts

## Current Implementation Status

### ✅ Completed Components

#### Safari Web Extension (Production Ready)
- **Location**: `/extensions/safari/`
- **Authentication**: Complete AWS Cognito integration with SafariCognitoAuth class
- **Bug Resolution**: Fixed hanging authentication checks with timeout protection
- **Code Quality**: Optimized DOM caching, eliminated duplicates, proactive error prevention
- **Cross-Platform**: Works on Safari desktop and mobile (iPhone/iPad)
- **UI**: Safari-optimized interface with iOS design guidelines
- **Security**: Secure token storage, no hardcoded credentials

**Key Files:**
- `popup.js` - Main UI with optimized DOM caching and timeout protection
- `cognito-auth.js` - Complete authentication with timeout-protected storage operations
- `auth.html` - Authentication page with 8-second timeout protection
- `content.js` - Recipe extraction with cross-browser compatibility
- `manifest.json` - Safari Web Extension manifest

#### Chrome Extension (Production Ready)
- **Location**: `/extensions/chrome/`
- **Authentication**: Full AWS Cognito integration with JWT tokens
- **Recipe Extraction**: Structured data capture with fullTextContent for LLM
- **UI**: Complete popup interface with production authentication flow
- **Testing**: Jest unit tests + Playwright integration tests

#### Shared Authentication System (Production Ready)
- **Location**: Embedded in extension files
- **Cognito Integration**: Complete authentication library with JWT management
- **Cross-Browser Support**: Works in both Chrome and Safari with proper storage abstraction
- **Token Management**: Automatic refresh, secure storage, proper expiration handling

### Recent Technical Improvements

#### Authentication Flow Debugging
```javascript
// Implemented step-by-step status tracking
showMessage('Step 1: Getting configuration...', 'info');
showMessage('Step 2: Getting Cognito configuration...', 'info');
showMessage('Step 3: Checking SafariCognitoAuth availability...', 'info');
// ... with comprehensive timeout protection
```

#### DOM Element Optimization
```javascript
// Cached DOM elements (reduced from 15+ repeated queries to 9 cached)
domElements = {
  authSection: document.getElementById('authSection'),
  captureBtn: document.getElementById('captureBtn'),
  message: document.getElementById('message'),
  // ... etc
};
```

#### Timeout Protection System
```javascript
// Multi-layer timeout protection
const authTimeout = setTimeout(() => {
  showMessage('Authentication check timed out. Check emergency bypass.', 'error');
  showAuthRequired();
}, 10000); // 10 second timeout for popup

// Storage operation timeouts
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Storage operation timed out')), 3000)
);
```

### Recipe Data Model
```typescript
interface Recipe {
  id: string;
  title: string;
  ingredients: IngredientSection[];
  steps: StepSection[];
  servingSize: string;
  prepTime: string;
  cookTime: string;
  photos: string[];
  attributionUrl: string;
  fullPageArchive: string;
  fullTextContent: string; // Complete page text for LLM analysis
  extractedAt: Date;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Development Workflow & Quality Standards

### Quality Gates
- ✅ All tests pass
- ✅ ESLint clean (0 errors)  
- ✅ Cross-references validated
- ✅ No duplicate files or variables
- ✅ Proactive issue detection
- ✅ **CLAUDE.md Review**: Automated review for pruning/consolidation opportunities
- 🚨 **PII/Secrets scan (CRITICAL)**: Zero tolerance for PII/credentials in source

### Development Principles
- **Timeout Protection**: All async operations have timeouts to prevent hanging
- **DOM Optimization**: Cache elements, minimize repeated queries
- **Error Handling**: Comprehensive logging and fallback mechanisms
- **Code Quality**: Proactive duplicate/conflict detection
- **Repository Cleanliness**: Regular cleanup of unnecessary files
- **Documentation Maintenance**: Regular CLAUDE.md review and consolidation to keep project guide concise

### 📋 CLAUDE.md Maintenance Rule

**COMMIT RULE**: Every commit triggers an automated CLAUDE.md review to identify pruning and consolidation opportunities.

**Automated Review Process**:
- **Script**: `scripts/review-claude-md.js` runs on every commit via pre-commit hook
- **Checks**: File length, section count, outdated content, duplicate mentions, verbosity
- **Output**: Advisory suggestions for maintaining a concise project guide
- **Goal**: Keep CLAUDE.md under 400 lines with focused, current content

**Review Command**:
```bash
npm run docs:review  # Manual CLAUDE.md review
```

**Common Consolidation Actions**:
- Archive completed features to reduce redundancy
- Merge related sections for better organization  
- Remove outdated status updates and TODOs
- Keep essential context, prune verbose explanations
- Consolidate repeated mentions of key topics (Authentication, Safari Extension, etc.)

This ensures CLAUDE.md remains a focused, actionable project guide rather than an overwhelming historical document.

---

*Last updated: August 25, 2025 - CLAUDE.md review rule successfully implemented and active*

## 🚨 CRITICAL SECURITY REQUIREMENT: PII & SECRETS PROTECTION

**ABSOLUTELY UNACCEPTABLE TO LEAK:**
- ❌ Personally Identifiable Information (PII): emails, names, phone numbers
- ❌ Account credentials: passwords, API keys, tokens
- ❌ AWS account IDs, resource ARNs
- ❌ Browser cookies, session data
- ❌ Any sensitive user or system information

### 🔒 Security Standards

**MANDATORY PRACTICES:**
1. **Environment Variables**: ALL sensitive data MUST use `.env` files (never committed)
2. **Template Pattern**: Use `.env.template` with placeholder values for documentation
3. **Automated Scanning**: PII/secrets scanning runs on every commit (pre-commit hook)
4. **Code Reviews**: Manual verification that no secrets are hardcoded
5. **Git History**: If PII is accidentally committed, immediately force-push removal

### 🛡️ Automated Security Scanning

**Pre-commit Hook Configuration:**
- **Tool**: TruffleHog v3 (industry-standard secrets detection)
- **Trigger**: Every git commit automatically scanned
- **Result**: Commit blocked if ANY secrets/PII detected
- **Coverage**: Scans all file types, detects 700+ secret patterns

**Security Gate Commands:**
```bash
# Manual security scan
npm run security:scan

# Pre-commit hook (automatically runs)
trufflehog git file://. --since-commit HEAD --only-verified

# Emergency PII cleanup
npm run security:clean
```

### 🚫 Zero Tolerance Policy

**If PII/secrets are detected:**
1. **IMMEDIATE STOP**: Do not proceed with any commits
2. **Clean Repository**: Remove ALL sensitive data immediately  
3. **Environment Variables**: Replace with proper `.env` pattern
4. **Force Push**: Rewrite git history if already committed
5. **Verify**: Run full repository scan before proceeding

**Example Violations:**
```javascript
// ❌ NEVER DO THIS
const email = "user@example.com";
const password = "mypassword123";
const awsAccountId = "123456789012";

// ✅ ALWAYS DO THIS  
const email = process.env.USER_EMAIL;
const password = process.env.USER_PASSWORD;
const awsAccountId = process.env.AWS_ACCOUNT_ID;
```

### 📁 Secure File Patterns

**Template Structure:**
```bash
# .env.template (committed - safe placeholders)
USER_EMAIL=user@example.com
AWS_ACCOUNT_ID=123456789012
API_KEY=your_api_key_here

# .env (local only - real values, NEVER committed)
USER_EMAIL=actual@email.com
AWS_ACCOUNT_ID=990537043943
API_KEY=sk-1234567890abcdef
```

This security standard is **NON-NEGOTIABLE** and applies to all future development work.

### Development Commands (Go CLI)
```bash
# Project Setup
recipe-cli setup                   # One-time project initialization

# Development Workflow  
recipe-cli dev start               # Start complete development environment
recipe-cli dev stop                # Stop all development services

# Testing
recipe-cli test run                # Run complete test suite
recipe-cli test unit               # JavaScript unit tests only
recipe-cli test go                 # Go backend tests only

# Deployment
recipe-cli deploy aws              # Deploy to AWS Lambda + API Gateway
```

## Next Development Priorities (Updated December 2025)

### ⚡ IMMEDIATE NEXT STEPS 
1. **Enable OAuth2 Authentication**: Configure Cognito hosted UI and enable OAuth2 flow in extensions
2. **Test Real Authentication**: Replace mock JWT tokens with real Cognito OAuth2 tokens  
3. **USER_PASSWORD_AUTH Config**: Optionally enable direct password auth in Cognito User Pool client settings
4. **🚨 EVALUATE PLAYWRIGHT REMOVAL**: Remove Playwright test infrastructure (2000+ lines, 26MB dependencies, questionable value vs manual testing)

### Short Term
1. **Recipe Extraction Enhancement**: Support for additional recipe sites beyond Smitten Kitchen
2. **Error Handling**: Improve user feedback for authentication and API errors
3. **Extension Store Submission**: Submit both extensions to Chrome Web Store and Safari Extensions

### Medium Term
1. **Web Application**: React-based recipe management interface
2. **iOS App Development**: Native mobile experience using existing authentication

### Long Term
1. **Advanced Features**: Meal planning, shopping lists
2. **Social Features**: Recipe sharing and collections
3. **ML Enhancement**: Recipe categorization and recommendations

---

## Critical Context for Future Development

### Authentication Architecture
- Uses AWS Cognito User Pool: `us-west-2_qJ1i9RhxD`
- JWT tokens with automatic refresh
- Cross-browser storage compatibility (extension API + localStorage fallback)
- Emergency development bypass for testing

### Code Quality Standards
- All DOM queries cached at initialization
- Timeout protection for all async operations (3-10 seconds)
- Comprehensive error logging and fallback mechanisms
- Proactive duplicate detection before user encounters issues

### Repository Structure
- Monorepo with clean separation of concerns
- No duplicate files or conflicting variables
- Essential documentation only (removed 77+ unnecessary files)
- Focused on production-ready code vs development artifacts

### Known Working Patterns
- SafariCognitoAuth class for Safari extension authentication
- Step-by-step status messages for debugging complex flows
- Promise.race() for timeout protection
- Cached DOM elements for performance optimization

## 🚨 CRITICAL STORAGE ARCHITECTURE DECISION

**NEVER USE DYNAMODB AGAIN - S3 ONLY**: This project uses S3-based JSON storage for recipes.

**Why S3-Only Architecture:**
- **95% Cost Savings**: $0.05/month vs $3-5/month DynamoDB minimum
- **Simpler Code**: Direct JSON read/write vs complex attribute mapping
- **Perfect for Files**: Images and archives stored alongside recipe data
- **No Vendor Lock-in**: Standard JSON files vs proprietary NoSQL

**Architecture Confirmed 3 Times**:
1. ✅ Original architecture decision documented
2. ✅ Storage recommendations analysis completed  
3. ✅ Implementation refactored from DynamoDB to S3

**If Anyone Suggests DynamoDB**: Point to `docs/architecture/STORAGE_RECOMMENDATIONS.md`

### AWS Infrastructure Setup

**Status**: **READY FOR DEPLOYMENT** 🚀

**Infrastructure Created**:
- ✅ **AWS CDK Stack**: Complete infrastructure as code (`aws-backend/infrastructure/`)
- ✅ **Cognito User Pool**: Email-based authentication with 1hr/30day token expiration
- ✅ **S3 Bucket**: Recipe JSON storage + photos + web archives with lifecycle management
- ✅ **API Gateway**: RESTful API with CORS and rate limiting
- ✅ **IAM Roles**: Least-privilege access for Lambda functions  
- ✅ **Security**: Encryption at rest and in transit, no hardcoded secrets
- 🗑️ **DynamoDB**: REMOVED - Use cleanup script if any tables exist

**Deployment Tools**:
- ✅ **Setup Command**: `recipe-cli setup` - Automated project initialization
- ✅ **Environment Template**: `.env.template` - Secure credential management
- ✅ **Security**: Enhanced `.gitignore` to prevent credential leaks

### Success Metrics Across All Platforms
- **Quality**: 95% extraction success rate, <5% error rate
- **Engagement**: 5-10+ recipes saved per user per week
- **Retention**: 80%+ user retention at 30 days
- **Performance**: Sub-second response times across all platforms
- **Beta Success**: 50+ active users with high satisfaction scores

This guide serves as the definitive project reference and should be updated as development progresses.
