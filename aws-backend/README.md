# AWS Backend

Go-based serverless backend for RecipeArchive with comprehensive CRUD operations, multi-tenant architecture, and S3 storage.

## Quick Start

```bash
# Deploy infrastructure
cd aws-backend && cdk deploy

# Run tests
make test-all

# Load test data
make load-test-data
```

## Key Features

- **CRUD Operations:** Full recipe management with soft delete
- **Multi-tenant:** Complete user isolation with JWT authentication
- **URL Overwrite:** Automatic recipe updates when re-extracted from same URL
- **Backup System:** Automated backup creation and restoration
- **S3 Storage:** File uploads and management

## API Endpoints

- `GET/POST /recipes` - Recipe CRUD operations
- `GET /health` - Health check endpoint
- `POST /report-error` - Diagnostic error reporting
- `POST /backup/create` - Backup creation
- `GET /backup/list` - Backup listing

## Testing

```bash
make help              # Show available commands
make test-all          # Complete test suite
make validate-crud     # CRUD operation validation
make cleanup-all       # Clean test data
```

See [API Documentation](../docs/api/api-specification.md) for detailed endpoint specifications.