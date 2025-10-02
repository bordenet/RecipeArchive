# AWS Backend

Go-based serverless backend for RecipeArchive with comprehensive CRUD operations, multi-tenant architecture, and S3 storage.

## Quick Start

```bash
# From repository root:
./scripts/deploy-lambda.sh --all      # Deploy all Lambda functions
./scripts/deploy-all.sh               # Deploy everything (infrastructure + functions)
./validate-monorepo.sh --all          # Validate deployment
```

## Key Features

- **CRUD Operations:** Full recipe management with soft delete
- **Multi-tenant:** Complete user isolation with JWT authentication
- **URL Overwrite:** Automatic recipe updates when re-extracted from same URL
- **S3 Storage:** All data storage uses S3 (no DynamoDB in production)
- **Diagnostic Telemetry:** Error reporting and production monitoring

## Lambda Functions

Located in `functions/` directory. Each function is independently deployable.

**Deployment:**
```bash
./scripts/deploy-lambda.sh recipes              # Deploy specific function
./scripts/deploy-lambda.sh --all                # Deploy all functions
```

## Infrastructure

CDK infrastructure code in `infrastructure/` directory.

See [COMMANDS.md](../COMMANDS.md) for complete command reference and [API Documentation](../docs/api/api-specification.md) for detailed endpoint specifications.