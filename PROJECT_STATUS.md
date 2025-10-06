# RecipeArchive - Project Status v1.0.0

**Status: Production with Critical Issues**

Recipe management solution with web app, browser extensions, and AWS serverless backend. Currently experiencing significant quality and reliability problems.

## Platform Status

### Deployed
- **Web App**: https://d1jcaphz4458q7.cloudfront.net (Flutter web)
- **Backend**: AWS Lambda (Go), API Gateway, Cognito, S3
- **Browser Extensions**: Chrome & Safari (14+ supported recipe sites)

### Development Toolchains Available
- **Mobile Apps**: Flutter iOS/Android toolchains operational
- **Distribution**: Not currently pursuing app store or extension store submissions

## Critical Issues Requiring Immediate Attention

### Parser Quality Problems
- [x] **Overly broad CSS selectors extract navigation menu items as recipe ingredients**
  - Status: FIXED in v0.7.0 - tested and verified working
  - Removed selectors `ul li, .entry-content ul li` from ingredient/instruction parsing
  - Root cause identified: Selectors matched everything on page including navigation

- [x] **Duplicate parser directories causing confusion**
  - Status: FIXED - `/parsers/src/` deleted (13 files removed)
  - Only `/parsers/sites/` remains as single source of truth
  - No more confusion about which files are used by build

- [x] **Old narrative-style recipes (2013 era) fail to parse**
  - Status: FIXED - paragraph-based parsing implemented and tested
  - Extracts ingredients from newline-separated paragraphs
  - Extracts instructions from narrative text using cooking verb patterns
  - Verified working with smittenkitchen.com 2013 recipe

### Error Reporting Failures

**Complete lack of error detection and reporting at every layer:**

- [x] **Browser Extension validation too permissive**
  - Status: FIXED in v0.7.0
  - Now returns error status for empty recipe extractions
  - Reports failures to diagnostics endpoint for offline analysis
  - Shows clear error messages to users instead of submitting garbage

- [ ] **Backend recipe submission has zero validation**
  - Accepts recipes with empty arrays
  - No content quality checks
  - Broken recipes persist to S3

- [ ] **Background normalizer blindly processes garbage**
  - No validation before OpenAI call
  - Cache returns poisoned results for broken recipes
  - Logs show "✅ success" when recipes have 0 ingredients/0 instructions

- [ ] **CloudWatch logs provide false success indicators**
  - "✅ success" messages everywhere despite broken recipes
  - No error-level logging for quality failures
  - Impossible to distinguish real problems from successful processing

- [x] **Cache poisoning persists broken normalizations**
  - Status: FIXED - Cache completely disabled as of 2025-10-06
  - Lambda now always calls OpenAI for fresh normalization
  - No more poisoned results persisting across re-ingestions
  - Note: Architectural review still needed for proper caching strategy

### Validation Gaps

- [ ] **No end-to-end validation test suite**
  - Parser changes not tested against actual websites
  - No regression testing for known-good recipes
  - Breakage discovered by users, not tests

- [ ] **Recipes Lambda needs validation**
  - Must reject recipes with `len(ingredients) == 0 && len(instructions) == 0`
  - Must validate content quality beyond presence
  - Should return 400 Bad Request for invalid submissions

- [ ] **Background normalizer needs defensive validation**
  - Reject recipes from S3 if both ingredients and instructions are empty
  - Log ERROR level (not INFO) for broken recipes
  - Do not report success for recipes with no content

### Architectural Issues

- [ ] **In-memory Lambda cache is unreliable**
  - Persists across Lambda container reuse
  - No cache invalidation strategy
  - Content hashing insufficient (based on counts only)
  - Consider: DynamoDB cache with TTL or disable caching entirely

- [ ] **No diagnostic aggregation or alerting**
  - Extension reports errors to S3 but no monitoring
  - No CloudWatch alarms for parsing failures
  - No dashboard for error trends

- [ ] **Silent failure modes everywhere**
  - Functions return success even when producing garbage
  - No distinction between "processed successfully" and "processed broken data successfully"

## New Adopter Support

Clone-and-deploy available with complete AWS infrastructure setup:
- Setup script: `./scripts/setup-new-adopter-environment.sh`
- AWS deployment guide: [docs/setup/aws-setup.md](docs/setup/aws-setup.md)
- Security: Extensions configured for adopter's own AWS resources
- Validation: `./validate-monorepo.sh --all` ensures correctness

## Core Features

- Recipe capture from 14+ websites with intelligent parsing
- OpenAI-powered recipe normalization
- Cross-platform authentication (AWS Cognito)
- Real-time synchronization across devices
- Multi-tenant invitation system
- Diagnostic telemetry and error tracking
- Security validation and monitoring

## Known Limitations

### Search Functionality
Search logic is currently brittle with exact word matching:
- Searching for `drink` works, but `drinks` may not match
- No fuzzy matching or stemming
- Logical operators (AND/OR/NOT) not fully implemented

### Parser Coverage
- Modern recipe sites generally work
- Historical recipes (pre-2015) often fail
- Narrative-style recipes without structured markup are problematic

## Documentation

### Setup & Deployment
- [AWS Setup Guide](docs/setup/aws-setup.md)
- [Mobile Deployment Guide](recipe_archive/MOBILE_DEPLOYMENT.md)
- [Environment Setup](docs/setup/ENVIRONMENT_SETUP.md)

### Architecture & API
- [API Documentation](docs/api/api-specification.md)
- [Data Model](docs/architecture/data-model.md)
- [Data Flow Diagram](docs/diagrams/claude_data-flow.md)
- [API Integration Diagram](docs/diagrams/claude_api-integration.md)

### Developer Guides
- [Project Guide](CLAUDE.md) - Development workflows and critical instructions
- [Command Reference](COMMANDS.md) - Complete command lookup tables
- [Browser Extensions](extensions/README.md)
