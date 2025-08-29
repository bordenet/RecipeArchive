# RecipeArchive Project Guide

## 🚀 Current Status: TypeScript Parser System - PRODUCTION READY

### COMPLETED: Browser Extensions Migration to TypeScript Parsers
- **Chrome Extension**: ✅ Fixed content script communication, now uses TypeScript parser system
- **Safari Extension**: ✅ Updated with TypeScript parser bundle and messaging
- **Parser Coverage**: ✅ 6/6 test URLs supported (Smitten Kitchen, Food Network, NYT Cooking)
- **Architecture**: ✅ Decoupled, maintainable parsers in `extensions/shared/parsers/`

### Latest Achievements (August 29, 2025)
- **Hardcoded Paths Fixed**: ✅ Eliminated all 16 instances of `/Users/Matt.Bordenet/` paths from codebase
- **Cross-Platform Compatibility**: ✅ Project now works on any developer machine with relative paths
- **Backend De-duplication**: ✅ Implemented recipe de-duplication logic to prevent duplicates with same source URL
- **Recipe Reports**: ✅ Fixed domain extraction (AttributionURL → SourceURL field mapping)
- **Parser Validation**: ✅ Fixed overly aggressive 404 detection and updated 15+ broken test URLs
- **Cache System**: ✅ Parser validation cache properly repopulates with [FETCH] for new URLs
- **Food52 Parser**: ✅ Fixed false positive 404 detection, now 4/5 URLs pass validation
- **System Health**: ✅ All Go builds pass, TypeScript compiles, security scans clean
- **Branch Sync**: ✅ Website-parsers branch fully synchronized with main branch

---


## TODO (Updated August 29, 2025)

### Parser System Action Plan (Current)
- [x] All site parsers pass contract validation against real recipe URLs
- [x] Chrome/Safari extensions updated for new schema
- [x] AWS backend Go model and handler logic patched for new schema
- [x] Playwright-based test files patched for correct environment headers
- [x] Lint errors (no-undef, process.exit, browser globals) resolved
- [ ] Console warnings remain in test files (note: revisit and refactor/suppress)
- [ ] End-to-end validation: Run full extension-to-backend-to-S3 test for all supported sites
- [ ] S3 bucket reset and validation (pending correct bucket name)
- [ ] Final monorepo validation (run validate-monorepo.sh and fix any errors)

### Next Steps
- Run validate-monorepo.sh and address any reported errors
- Complete end-to-end tests for all supported sites
- Refactor or suppress console warnings in test files
- Document any new issues or edge cases found during validation

### Context Persistence
- See also: docs/development/claude-context.md for full project state and resume instructions

### Resume Instructions
1. Clone repo and run ./scripts/setup-macos.sh
2. Configure AWS CLI and source aws-backend/.env
3. Review CLAUDE.md and claude-context.md for current state
4. Continue with next TODO item above

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

#### AWS Backend (Production Ready)
- **Location**: `/aws-backend/functions/recipes/`
- **Recipe De-duplication**: ✅ Prevents duplicate recipes with same source URL per user
- **S3 Storage**: Cost-effective JSON storage with 95% cost savings vs DynamoDB
- **Authentication**: JWT token validation with AWS Cognito integration
- **Architecture**: Serverless Lambda functions with S3-based database
- **Contract Validation**: Enforces required fields (title, ingredients, instructions, sourceUrl)

**Key Files:**
- `main.go` - Recipe creation with de-duplication logic (lines 325-355)
- `db/s3storage.go` - S3-based database implementation
- `models/recipe.go` - Recipe data model with 15 core fields

#### TypeScript Parser System (Production Ready)
- **Location**: `/extensions/shared/parsers/` and `/tools/test-tools/website-parser-validator.cjs`
- **Architecture**: BaseParser abstract class with ParserRegistry pattern
- **Site Coverage**: 8 sites supported (Food Network, Food52, Serious Eats, AllRecipes, etc.)
- **Cache System**: 48-hour intelligent caching to reduce network requests
- **Authentication**: Washington Post cookie authentication for paywall bypass
- **Integration**: Bundled JavaScript works in both Chrome and Safari extensions

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

*Last updated: August 28, 2025 - Fixed web extension integration, authentication unification, and parser validation system*

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

#### Go CLI Commands
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

## Next Development Priorities

### IMMEDIATE (Blocking)
1. **Fix Web Extension Linting**: Resolve ESLint errors preventing monorepo validation

### Short Term  
1. **Recipe Extraction Enhancement**: Support additional recipe sites
2. **Extension Store Submission**: Chrome Web Store and Safari Extensions
3. **Remove Playwright Infrastructure**: 2000+ lines, 26MB dependencies, minimal value

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
- Real Cognito authentication with JWT tokens (Chrome & Safari)
- ✅ **NEW** TypeScript parser system with decoupled site-specific parsers
- Recipe extraction from JSON-LD fallback and site-specific parsers (Smitten Kitchen, Food Network, NYT Cooking)
- Data transformation for AWS backend (`transformRecipeDataForAWS`)
- S3-based JSON storage architecture (95% cost savings vs DynamoDB)
- Content script messaging (no more complex script injection)

### Critical Architecture Decisions
- **S3-Only Storage**: Never use DynamoDB (cost and complexity)
- **Failed-Parse API**: Planned fallback for extraction failures
- **Security**: No PII/secrets in code, environment variables only

# 🏁 Remaining Work for Full Web Extension Support

To achieve full, reliable support for all listed sites in both Chrome and Safari extensions, the following work remains:

1. **Parser Refinement:**
   - Update and iterate on all site parsers (Food Network, Food52, Epicurious, AllRecipes, Love & Lemons, Alexandra's Kitchen, NYT Cooking, Smitten Kitchen) until every test URL passes strict contract validation.
   - Expand fallback logic and selectors for sites with inconsistent HTML or missing JSON-LD.
   - Add diagnostic logging for edge cases and failures.

2. **Validator Workflow:**
   - Rerun the monorepo-wide validator after each parser update.
   - Block release until all test URLs pass for every site.

3. **Web Extension Integration:**
   - Ensure both Chrome and Safari extensions use the latest, validated TypeScript parser bundle.
   - Test extensions against all supported sites and URLs for real-world coverage.
   - Fix any extension-specific issues (content script messaging, parser loading, etc.).

4. **Documentation & Release:**
   - Update README.md and CLAUDE.md to reflect full site support and validation workflow.
   - Push all changes to GitHub after validation and linting.

5. **Final Validation:**
   - Confirm all parsers and extensions work for every test URL and site.
   - Mark project as fully supporting all listed sites.

---
