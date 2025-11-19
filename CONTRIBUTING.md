# Contributing to RecipeArchive

Thank you for your interest in contributing to RecipeArchive. This guide provides technical conventions and best practices for development.

**Production URL**: https://d1jcaphz4458q7.cloudfront.net

## Table of Contents

- [Development Environment](#development-environment)
- [Code Style Guidelines](#code-style-guidelines)
- [Build System](#build-system)
- [Testing & Validation](#testing--validation)
- [Deployment](#deployment)
- [Debugging Tools](#debugging-tools)

## Development Environment

### Prerequisites

- macOS (required for iOS development)
- Xcode 14+ (for iOS builds)
- Android Studio (for Android builds)
- Node.js 18+ (for extensions and tooling)
- Go 1.21+ (for Lambda functions and tools)
- Flutter 3.x (for mobile apps)
- AWS CLI configured

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/bordenet/RecipeArchive.git
cd RecipeArchive

# Install all dependencies
./scripts/setup-macos.sh

# Configure environment variables
cp .env.example .env
# Edit .env with your AWS infrastructure details

# Validate installation
./validate-monorepo.sh --all
```

See [docs/setup/GETTING_STARTED.md](docs/setup/GETTING_STARTED.md) for detailed setup instructions.

## Code Style Guidelines

### JavaScript/TypeScript

- Use double quotes for all strings (enforced by ESLint)
- Run `npm run lint -- --fix` after editing JavaScript files
- Follow conventions in [docs/JAVASCRIPT_TYPESCRIPT_STYLE_GUIDE.md](docs/JAVASCRIPT_TYPESCRIPT_STYLE_GUIDE.md)

```javascript
// Correct
console.log("Checking URL:", url);

// Incorrect
console.log('Checking URL:', url);
```

### Go

- Follow [docs/GO_STYLE_GUIDE.md](docs/GO_STYLE_GUIDE.md)
- Use `log/slog` for structured logging (JSON for Lambda functions, text for CLI tools)
- Always run `go build` after fixing linting errors to catch unused imports

### Dart/Flutter

- Use `AppLogger` for all logging (see [docs/CODING_GUIDELINES.md](docs/CODING_GUIDELINES.md))
- Redact sensitive data (URLs, user IDs, email addresses)
- Follow structured logging patterns with metadata

### Swift

- Use Apple's `os.Logger` for structured logging
- Mark sensitive data as `.private` in log statements
- See [docs/CODING_GUIDELINES.md](docs/CODING_GUIDELINES.md) for complete Swift conventions

### Kotlin

- Follow [docs/KOTLIN_STYLE_GUIDE.md](docs/KOTLIN_STYLE_GUIDE.md)
- Use safe null handling (avoid force unwraps with `!!`)

### Shell Scripts

- All scripts must follow [scripts/STYLE_GUIDE.md](scripts/STYLE_GUIDE.md)
- Use `set -e` for fail-fast behavior
- Include usage documentation in header comments
- Pass `shellcheck` with zero warnings

## Build System

### Build Hygiene

**Critical Rule**: Build scripts must output to separate `build/` or `dist/` directories. Never modify source files in place.

### Mobile Builds

#### iOS

```bash
# Development build (simulator)
./scripts/ios/build.sh --dev --run

# Production build (device)
./scripts/ios/build.sh --prod --device --release --version 1.0.1
```

**Important**: Use Xcode build system directly via `xcodebuild` (NOT `flutter build ios`). This avoids scheme ambiguity issues.

#### Android

```bash
# Development build (emulator)
./scripts/android/build.sh --dev --run

# Production build (APK)
./scripts/android/build.sh --prod --device --release --version 1.0.1

# Production build (AAB for Play Store)
./scripts/android/build.sh --prod --device --release --version 1.0.1 --appbundle
```

**Important**: Use Gradle build system directly via `./gradlew` (NOT `flutter build apk`).

### Browser Extensions

```bash
# Generate environment configuration
npm run build:extension-env

# Build extensions
npm run build:extensions

# Package for distribution
./scripts/extensions/package.sh
```

### Environment Variables

**Flutter .env Management**: Flutter does not follow symlinks in asset bundles.

- Master `.env` lives at repository root (gitignored)
- Build scripts automatically copy to `recipe_archive/.env` before builds
- Never commit `recipe_archive/.env` to git

## Testing & Validation

### Pre-Commit Validation

The project uses Husky pre-commit hooks to validate code quality:

```bash
# Manually run validation
./validate-monorepo.sh --all

# Quick validation (P1 components only)
./validate-monorepo.sh --p1

# Mobile-specific validation
./validate-monorepo.sh --mobile
```

### Quality Gates

Before pushing to GitHub:

1. Run `./validate-monorepo.sh --all`
2. Ensure all tests pass
3. Verify linting passes for all languages
4. Test multi-file Go builds

**Do not bypass Husky pre-commit hooks.**

### Parser Testing

```bash
# Run all E2E parser tests
npm run test:e2e

# Test specific recipe site
npm run test:e2e -- -t "food52"
```

## Deployment

### Infrastructure Deployment

```bash
# Deploy AWS infrastructure (CDK)
./scripts/aws/deploy-infrastructure.sh

# Preview changes before deployment
./scripts/aws/deploy-infrastructure.sh --diff

# Bootstrap CDK (first time only)
./scripts/aws/deploy-infrastructure.sh --bootstrap
```

### Lambda Function Deployment

```bash
# Deploy all Lambda functions
./scripts/aws/lambda.sh --all

# Deploy single function
./scripts/aws/lambda.sh recipes
```

### Web Application Deployment

```bash
# Deploy Flutter web app to CloudFront
./scripts/web/deploy.sh
```

### Full Deployment

```bash
# Deploy everything (infrastructure + code + web)
./scripts/aws/all.sh
```

## Debugging Tools

### Recipe Diagnostics

**Find Recipe ID**:
```bash
cd tools/content-ops && ./content-ops -include-recipe-id "Recipe Name"
```

**Trace Recipe Processing**:
```bash
cd tools/recipe-tracer && ./recipe-tracer -recipe RECIPE_ID
```

This shows:
- Current recipe state (ingredient/instruction counts)
- Processing timeline with CloudWatch logs
- Cache performance
- S3 operations
- Errors encountered

### Error Diagnostics

**Global Diagnostic Report**:
```bash
cd tools/get-diagnostics && ./get-diagnostics
```

**Extension Diagnostics** (last 24 hours):
```bash
cd tools/get-diagnostics && ./get-diagnostics -extensions -since 24h
```

**Lambda Diagnostics** (last 1 hour):
```bash
cd tools/get-diagnostics && ./get-diagnostics -lambdas -since 1h
```

### S3 Cleanup

```bash
# Preview orphaned S3 objects
cd tools/s3-cleanup && ./s3-cleanup

# Execute cleanup (use with caution)
cd tools/s3-cleanup && ./s3-cleanup --dry-run=false
```

## Architecture Documentation

- [API Specification](docs/api/api-specification.md) - Backend API reference
- [Data Model](docs/architecture/data-model.md) - Schema and storage design
- [Multi-Tenant Provisioning](docs/architecture/multi-tenant-provisioning.md) - Tenant management
- [ADR 002](docs/adr/002-ios-recipe-capture-architecture.md) - iOS recipe capture
- [ADR 003](docs/adr/003-android-recipe-capture-implementation.md) - Android recipe capture

## Development Conventions

### Dependency Management

All dependencies must be installed via `./scripts/setup-macos.sh`. This is the single source of truth for environment configuration.

### Shell Scripts for Recurring Tasks

- Use shell scripts with production-grade error handling
- All scripts live in `./scripts/` at repository root (exception: component-specific scripts in `package.json`)
- Include clear error messages with exit codes
- Add usage documentation in header comments

### Long-Running Task Safety

All long-running operations have a 10-minute timeout to prevent blocked shells:
- Emulator/simulator deployments
- Device deployments
- Network operations
- Build operations

### Infrastructure Validation

When making infrastructure changes:

1. Run deployment scripts completely
2. Validate all Lambda function environment variables
3. Test end-to-end functionality via app
4. Check SQS queues, triggers, and Lambda event mappings
5. Monitor CloudWatch logs for integration errors
6. Run `./validate-monorepo.sh --all`

## Security

### Image Security

- Backend automatically downloads external recipe images and uploads to S3
- Images stored at `recipe-images/{recipeID}/recipes/main-photo.{ext}`
- S3 bucket policy allows public read for `recipe-images/*` path
- Image downloads have 10s timeout and 10MB size limit

### Data Privacy in Logging

Always redact sensitive data in logs:
- Email addresses
- User IDs
- Recipe titles (may contain personal information)
- URLs (may contain query parameters)
- Authentication tokens

Never log:
- Passwords
- API keys
- OAuth tokens
- Session data

## Questions?

- See [COMMANDS.md](COMMANDS.md) for quick command reference
- See [docs/setup/GETTING_STARTED.md](docs/setup/GETTING_STARTED.md) for detailed setup
- See [PROJECT_STATUS.md](PROJECT_STATUS.md) for system health and known issues
- Review language-specific style guides in [docs/](docs/)
