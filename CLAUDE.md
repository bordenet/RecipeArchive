# RecipeArchive Project Guide

## Current Status

**Production**: https://d1jcaphz4458q7.cloudfront.net
**Ready for New Adopters**: Complete setup documentation and tooling available

PLEASE review PROJECT_STATUS.md and keep that document up to date

**CURRENT PRIORITIES:**

1. **Infrastructure Optimization** (MEDIUM PRIORITY)
   - Monitor Lambda function performance
   - Evaluate cost optimization impact

### Infrastructure Validation Protocol

When making infrastructure changes, ALWAYS:

1. Run deployment scripts completely
2. Validate ALL Lambda function environment variables
3. Test end-to-end functionality via app
4. Check SQS queues, triggers, and Lambda event mappings
5. Monitor CloudWatch logs for integration errors
6. Use `./validate-monorepo.sh --all` for comprehensive validation

### Go Tools                                                                                                                                                              │

- **`content-ops`**: A multi-tenant content operations utility for analyzing recipes across all tenants in AWS S3. It supports pagination for large datasets and provides operational insights for multi-tenant management.
- **`recipe-tracer`**: An end-to-end tracing tool that tracks recipe processing through S3, SQS, and CloudWatch logs, with cache performance analysis and detailed normalization debugging.

## API VERSIONING MANDATE

**ABSOLUTE RULE: NO /v1/ PREFIX ON ANY API ENDPOINTS**

- `/report-error`, `/images/upload`, `/recipes`, `/health`

## CODE STYLE MANDATE

**CRITICAL: ALWAYS USE DOUBLE QUOTES IN JAVASCRIPT FILES**

This project uses ESLint with double quote enforcement. This has been fixed TEN TIMES across sessions:
- **CORRECT**: `console.log("Checking URL:", url);`
- **WRONG**: `console.log('Checking URL:', url);`

**ALWAYS run `npm run lint -- --fix` after editing JavaScript files to prevent quote style errors.**

## Quick Start Commands

```bash
# From repository root:
./validate-monorepo.sh --all           # Validate all components
npm run build:extensions               # Build extensions with latest parser fixes
npm run security:scan                  # Check for security issues
```

## New Adopter Security

**CRITICAL**: Browser extensions contain hardcoded AWS infrastructure references. New adopters MUST:

1. Deploy their own AWS infrastructure via CDK
2. Run `./scripts/setup-new-adopter-environment.sh` to configure extensions
3. Ensure all validation passes before use

## Mobile Development

iOS/Android toolchain available

## Security & Validation

### Image Security Architecture
- **CRITICAL**: Extensions upload images directly to S3 only
- **NEVER** implement server-side image fetching - major security risk
- Backend validates S3-only image URLs, external URLs rejected for security

### CORS Issue Handling
- **REPORT, DON'T BYPASS**: When CORS blocks image downloads, report via diagnostics
- Use diagnostic reporting to identify domains needing CORS rule updates
- Push extension updates to handle new domains properly
- **NEVER** fall back to server-side downloads as "solution"

### Storage Architecture
- **S3-ONLY**: All data storage uses S3, no DynamoDB in production
- Cost optimized

## Essential Commands

| Task | Command |
| --- | --- |
| Validate All | `./validate-monorepo.sh --all` |
| Validate Quick | `./validate-monorepo.sh --p1` |
| Validate Medium | `./validate-monorepo.sh --med` |
| Validate Mobile | `./validate-monorepo.sh --mobile` |
| Deploy All | `./scripts/deploy-all.sh` |
| Deploy Lambda | `./scripts/deploy-lambda.sh --all` |
| Deploy Web App | `./scripts/deploy-web-app.sh` |
| Build Extensions | `npm run build:extensions` |
| Package Extensions | `./scripts/package-extensions.sh` |
| Security Scan | `npm run security:scan` |

### Essential Tools

| Task | Command |
| --- | --- |
| Content Analysis | `cd tools/content-ops && ./content-ops -user email -password pass` |
| Recipe ID Lookup | `cd tools/content-ops && ./content-ops -include-recipe-id "RECIPE TITLE"` |
| Recipe Tracing | `cd tools/recipe-tracer && ./recipe-tracer -recipe RECIPE_ID` |

### DEBUGGING PROTOCOL

**For Recipe Normalization Issues:**
1. **Find Recipe ID**: `cd tools/content-ops && ./content-ops -include-recipe-id "Recipe Name"`
2. **Trace Processing**: `cd tools/recipe-tracer && ./recipe-tracer -recipe RECIPE_ID`
3. **Check for Cross-Contamination**: Look for foreign recipe data in CloudWatch logs

Tools are pre-built.

### iOS Development Commands

| Task | Command |
| --- | --- |
| iOS Setup | `./scripts/ios-setup.sh` |
| iOS Simulator (Auto) | `./scripts/ios-simulator.sh` |
| iOS Xcode (Manual) | `./scripts/ios-xcode.sh` |
| iOS Run (Legacy) | `./scripts/ios-run.sh` |
| iOS Build | `./scripts/ios-build.sh` |
| iOS Help | `./scripts/ios-help.sh` |
| iOS Clean | `./scripts/ios-clean.sh` |

### Mobile App Commands

| Task | Command |
| --- | --- |
| Validate Mobile Setup | `./validate-monorepo.sh --mobile` |
| Build Android APK | `cd recipe_archive && ./scripts/build-mobile.sh android release` |
| Build iOS App | `cd recipe_archive && ./scripts/build-mobile.sh ios release` |
| Build Both Platforms | `cd recipe_archive && ./scripts/build-mobile.sh both release` |
| Mobile Debug Build | `cd recipe_archive && ./scripts/build-mobile.sh both debug` |

### API Gateway Management Commands

| Command | Purpose |
| --- | --- |
| `./scripts/manage-api-routes.sh show` | Display all API Gateway routes |
| `./scripts/manage-api-routes.sh validate` | Check all Lambda integrations |
| `./scripts/manage-api-routes.sh fix` | Auto-repair broken integrations |
| `./scripts/validate-api-gateway.sh` | Standalone validation script |
| `./scripts/validate-api-gateway.sh --fix` | Validate and fix in one command |

### Other Useful Scripts

| Task | Command |
| --- | --- |
| Analyze Flutter Errors | `./tools/analyze-flutter-errors.sh` |
| Recipe Report | `./tools/recipe-report.sh` |

## Deployment Rules

### Quality Gates

**CRITICAL - ENHANCED PROCEDURES TO PREVENT COMPILATION FAILURES:**

- ALWAYS run `./validate-monorepo.sh --all` before GitHub push (includes comprehensive compilation testing)
- ALWAYS test multi-file Go builds: `go build -o bootstrap *.go` in function directories
- FIXED: GitHub Actions uses `*.go` instead of `main.go` for Lambda compilation testing
- FIXED: Multi-file Lambda functions (like test-tools) build correctly in CI/CD
- FIXED: Flutter test platform compatibility with conditional imports for web-only code
- Pre-commit hooks include comprehensive compilation validation for ALL components
- NEVER bypass Husky checks - they catch compilation errors locally
- NEVER hand off broken builds - quality gates enhanced to catch platform/import mismatches
- NEVER let deployment scripts bit-rot

### Lambda Deployment

```bash
# Preferred method
./scripts/deploy-lambda.sh recipes
./scripts/deploy-lambda.sh --all

# Emergency only
cd aws-backend/functions/[name]
GOOS=linux GOARCH=amd64 go build -o bootstrap *.go
aws lambda update-function-code --function-name [NAME] --zip-file fileb://deployment-package.zip
```

## Important Instructions

Do what has been asked; nothing more, nothing less.
NEVER create files unless absolutely necessary.
ALWAYS prefer editing existing files.
NEVER proactively create documentation files.

### Localhost Policy

NEVER attempt to run Flutter locally or test localhost endpoints. This consistently fails and wastes significant tokens. Always work directly with the production environment at https://d1jcaphz4458q7.cloudfront.net for testing and debugging.

### Post-Push Procedure

**Standard process after successful GitHub push:**

1. Remove all backwards-looking "Recent Completed Work" sections from CLAUDE.md
2. Archive accomplishments to maintain lean documentation focused on:
   - Current issues requiring attention
   - How-to guidance for upcoming work
   - Essential context for development workflow
3. Keep document orientation forward-looking and actionable

# important-instruction-reminders
- Do what has been asked; nothing more, nothing less.
- NEVER create files unless they're absolutely necessary for achieving your goal.
- ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (*.md) or README files if existing documents can be updated. Only create new documentation files if explicitly requested by the User.
- In cases where we need to find a recipeID from a recipe title, remember to use tools/content-ops/content-ops -include-recipe-id
- In cases where we're reviewing normalization issues, remember to use tools/recipe-tracer
- In cases where we're reviewing Flutter errors, remember to use tools/analyze-flutter-errors.sh
- In cases where we're reviewing recipe reports, remember to use tools/recipe-report.sh