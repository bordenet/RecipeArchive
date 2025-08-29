# RecipeArchive Project Guide

## 🚀 Current Status: PRODUCTION READY - Registry-Driven Migration Complete

### ACHIEVED: Registry-Driven Recipe Archiving System
- **Chrome Extension**: ✅ Production-ready with TypeScript parser integration and AWS Cognito auth
- **Safari Extension**: ✅ iPhone/iPad compatible, feature parity with Chrome
- **AWS Backend**: ✅ Lambda functions deployed with S3 storage and URL-based overwrite
- **Parser System**: ✅ All registry sites migrated, validated, and production-ready
- **Documentation/PRD**: ✅ README.md, CLAUDE.md, PRD, and AUDIT_STATUS.md are in lock-step
- **Monorepo Validation**: ✅ All tests and quality gates pass

### Final Production Achievements (August 29, 2025)
- **Registry-Driven Architecture**: All supported sites managed in `/parsers/sites/site-registry.ts` and reflected in documentation and PRD
- **Monorepo Validation**: `./validate-monorepo.sh` passes all checks
- **Documentation Synchronization**: All major docs updated and cross-linked
- **Security Validated**: TruffleHog scans clean, no secrets in repository

---

## PRODUCTION STATUS: Registry-Driven System Complete ✅

### All Major Components Deployed
- [x] All registry sites migrated and pass contract validation (see README.md and PRD)
- [x] Chrome/Safari extensions use TypeScript parser bundle with AWS integration
- [x] AWS Lambda backend deployed with URL-based recipe overwrite behavior
- [x] S3 storage working (recipearchive-storage-dev-990537043943)
- [x] AWS Cognito authentication functional across all components
- [x] Branch synchronization complete (main ↔ website-parsers)
- [x] Documentation comprehensive and current

### Future Development Areas
- iOS native app development (Swift)
- Web application interface (React + TypeScript)
- Additional recipe site support (user feedback driven)
- Chrome/Safari extension store submission
- Recipe management features (meal planning, shopping lists)

### Quick Start for New Developers
1. Clone repository: `git clone https://github.com/bordenet/RecipeArchive`
2. Run validation: `./validate-monorepo.sh` (ensures all components work)
3. Configure AWS CLI credentials for deployment access
4. Review README.md and PRD for architecture overview and current capabilities

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
- **Recipe Extraction**: ✅ **NEW** TypeScript parser system with decoupled site-specific parsers
- **UI**: Complete popup interface with production authentication flow
- **Architecture**: Fixed content script messaging, no more script injection complexity

#### AWS Backend (Production Deployed)
- **Location**: `/aws-backend/functions/recipes/`
- **Lambda Function**: RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w (deployed)
- **Recipe URL Overwrite**: ✅ Overwrites existing recipes by source URL, preventing duplicates
- **S3 Storage Architecture**:
  - **Primary**: recipearchive-storage-dev-990537043943 (recipe data)
  - **Temporary**: recipearchive-temp-dev-990537043943 (processing)
  - **Failed Parsing**: recipearchive-failed-parsing-dev-990537043943 (HTML diagnostics, 20MB limit, 30-day auto-purge)
- **Authentication**: JWT token validation with AWS Cognito User Pool
- **API Gateway**: https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/v1/recipes
- **Diagnostic Collection**: Failed parsing HTML stored in dedicated S3 bucket with cost controls

**Key Files:**
- `main.go` - Recipe creation with URL-based overwrite logic (lines 341-402)
- `db/s3storage.go` - S3-based database implementation
- `models/recipe.go` - Recipe data model with version management

#### TypeScript Parser System (Production Deployed)
- **Location**: `/parsers/src/sites/` with bundled JavaScript in extensions
- **Architecture**: BaseParser abstract class with ParserRegistry pattern
- **Site Coverage**: 10 sites supported with comprehensive validation
  - Smitten Kitchen, Food Network, NYT Cooking, Food52, Epicurious
  - AllRecipes, Love & Lemons, Alexandra's Kitchen, Serious Eats, Washington Post
- **Extension Integration**: Bundled as `typescript-parser-bundle.js` in both extensions
- **Contract Validation**: Strict enforcement of required fields for all sites

#### Shared Authentication System (Production Ready)
- **Location**: Embedded in extension files
- **Cognito Integration**: Complete authentication library with JWT management
- **Cross-Browser Support**: Works in both Chrome and Safari with proper storage abstraction
- **Token Management**: Automatic refresh, secure storage, proper expiration handling

### Key Technical Solutions

#### Web Extension Async Fix
```javascript
// Fixed Chrome/Safari content scripts with proper async handling
(async () => {
  try {
    const recipeData = await extractRecipeFromPage();
    const response = { status: "success", data: recipeData };
    setTimeout(() => sendResponse(response), 0);
  } catch (error) {
    // Error handling...
  }
})();
```

#### Authentication Unification
```go
// Report tool now uses same JWT extraction as extensions
func (r *RecipeReporter) extractUserFromJWT(token string) (string, string, error) {
  parts := strings.Split(token, ".")
  payload, err := base64.RawURLEncoding.DecodeString(parts[1])
  // Extract sub (user ID) from JWT payload
}
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

### Production Quality Standards
- ✅ Monorepo validation (8-tier quality gates)
- ✅ Security scanning (TruffleHog - zero secrets detected)
- ✅ Cross-platform compatibility (no hardcoded paths)
- ✅ AWS Lambda deployed and functional
- ✅ Extension-to-S3 pipeline working
- ⚠️ ESLint (1 warning - non-blocking)
- ✅ **Documentation**: README.md and CLAUDE.md current and comprehensive

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

*Last updated: August 29, 2025 - Production deployment complete with all core components functional*

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

### Development Commands

#### Monorepo Validation (Primary Command)
```bash
./validate-monorepo.sh            # Comprehensive validation of entire monorepo
```
**Run this script periodically** (daily/before commits) to ensure monorepo health across all four areas:
- 🔌 Web Extensions (Chrome & Safari)  
- 🧩 Recipe Parsers (site-specific parsers)
- ☁️ AWS Backend (Go services)  
- 🌐 Frontend Clients (coming soon)

#### Essential Development Commands
```bash
# Comprehensive validation (primary command)
./validate-monorepo.sh            # 8-tier quality gates across entire system

# Individual components
npm run lint                       # ESLint for web extensions
npm run test:go                    # Go backend tests
npm run security:scan              # TruffleHog security scanning

# AWS deployment (when needed)
cd aws-backend/functions/recipes
GOOS=linux GOARCH=amd64 go build -o bootstrap main.go
zip deployment.zip bootstrap
aws lambda update-function-code --function-name RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w --zip-file fileb://deployment.zip --region us-west-2
```

## Future Development Roadmap

### Next Phase: User Experience Enhancement
1. **iOS Native App**: Swift-based mobile application with offline support
2. **Web Application**: React + TypeScript recipe management interface
3. **Extension Store Submission**: Chrome Web Store and Safari Extensions gallery

### Future Enhancements
1. **Additional Recipe Sites**: Food & Wine, Damn Delicious expansion
2. **Advanced Features**: Meal planning, shopping list generation
3. **Social Features**: Recipe sharing and community collections

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

### Production Architecture (Deployed)
- **AWS Cognito Authentication**: User Pool `us-west-2_qJ1i9RhxD` with JWT tokens
- **TypeScript Parser System**: 10 sites supported with bundled JavaScript integration  
- **S3 Storage Architecture**: Three dedicated buckets with lifecycle policies
  - Primary: `recipearchive-storage-dev-990537043943` (recipe data)
  - Failed Parsing: `recipearchive-failed-parsing-dev-990537043943` (diagnostics, 20MB limit, 30-day purge)
  - Temporary: `recipearchive-temp-dev-990537043943` (processing)
- **Lambda Function**: `RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w` (deployed)
- **URL-Based Overwrite**: Recipe duplicates prevented by source URL per user
- **Extension Pipeline**: Chrome/Safari → TypeScript Parsers → AWS Lambda → S3 Storage
- **Diagnostic Collection**: Failed parsing HTML automatically stored for parser improvement

### Critical Architecture Standards
- **S3-Only Storage**: Cost-effective JSON storage, never use DynamoDB
- **Security First**: Zero tolerance for PII/secrets, environment variables only
- **Cross-Platform**: No hardcoded paths, works on any developer machine
- **Contract Validation**: Strict enforcement of required fields across all parsers

---

## 📝 Development Notes

**Current System Status**: All core components are production-ready and deployed. The recipe archiving system successfully captures recipes from 10 supported websites through browser extensions, processes them with TypeScript parsers, and stores them in AWS S3 through Lambda functions with AWS Cognito authentication.

**For Future Development**: Focus areas include iOS app development, web application interface, and additional recipe site support. The current architecture provides a solid foundation for these enhancements.

*This document serves as the primary context for understanding the RecipeArchive project's current state and architecture.*
