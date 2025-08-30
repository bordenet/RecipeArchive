# RecipeArchive Project Guide

## 🚀 Status: PRODUCTION READY + Flutter Web App ✅

### Deployed Components (August 2025)
- **Browser Extensions**: Chrome/Safari with TypeScript parsers + AWS Cognito auth
- **AWS Backend**: Lambda + S3 + Cognito (URL-based deduplication)
- **Parser System**: 10+ sites via registry (`parsers/sites/site-registry.ts`)
- **Flutter Web App**: Clean UI at `recipe_archive_fresh/` (lint-free, tested)
- **Security**: TruffleHog validated, environment variables only

### Quick Start
```bash
git clone https://github.com/bordenet/RecipeArchive
./validate-monorepo.sh                    # Validates all components
cd recipe_archive_fresh && flutter run -d chrome  # Run Flutter app
```

## Architecture

### Core System
- **Extensions** (`extensions/`): Chrome/Safari with shared auth + parsers
- **Parsers** (`parsers/`): TypeScript registry system for 10+ recipe sites
- **AWS** (`aws-backend/`): Lambda + S3 + Cognito serverless infrastructure
- **Flutter** (`recipe_archive_fresh/`): Modern web interface

### Supported Sites
Smitten Kitchen, Food Network, NYT Cooking, Washington Post, Love & Lemons, Food52, AllRecipes, Epicurious, Serious Eats, Alexandra's Kitchen, Food & Wine, Damn Delicious

### Development
- **Validation**: `./validate-monorepo.sh` checks all components
- **Flutter**: Material Design UI, zero lint issues, production ready
- **Extensions**: Load Chrome from `extensions/chrome/`, Safari via Xcode
- **Parsers**: Add sites to registry, use HTML fixtures for testing

### Production Infrastructure
- **Cognito**: User Pool `us-west-2_qJ1i9RhxD`
- **S3**: Primary (`recipearchive-storage-dev-*`), Failed parsing, Temp buckets
- **Lambda**: `RecipeArchive-dev-RecipesFunction16AA7634-Jo1qXv3AOj5w`

## Standards
- **Security**: Environment variables only, no hardcoded credentials
- **Quality**: Contract validation, timeout protection, comprehensive error handling
- **Testing**: TruffleHog scans, monorepo validation, Flutter tests passing
- **API Documentation**: OpenAPI spec in `docs/api/` MUST be maintained with ALL API changes

## ⚠️ CRITICAL MAINTENANCE REQUIREMENTS

### OpenAPI Documentation
**MANDATORY**: The OpenAPI specification in `docs/api/openapi.yaml` MUST be updated for ANY API changes:
- New endpoints or parameters
- Request/response schema changes  
- Authentication modifications
- Error response updates

**Process**: Update OpenAPI spec BEFORE deploying API changes, validate schema, then deploy.

*See README.md and docs/ for detailed architecture and requirements.*
