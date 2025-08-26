# RecipeArchive AWS Backend Testing

## Overview

This directory contains the AWS backend implementation for RecipeArchive, including comprehensive testing tools and CRUD validation utilities. The backend is designed to support the requirements outlined in the [AWS Backend PRD](../docs/requirements/aws-backend.md).

## Features Implemented

### ✅ Core CRUD Operations
- **CREATE**: Create new recipes with validation
- **READ**: Retrieve single recipes or paginated lists
- **UPDATE**: Complete recipe overwrite (per requirement)
- **DELETE**: Soft delete with `isDeleted` flag

### ✅ URL-Based Overwrite Behavior
- **Key Requirement**: "If a recipe exists (primary key: web url) and a user re-loads it from the web extension, the API behavior will be to simply overwrite the existing record"
- **Implementation**: Complete recipe replacement while preserving creation timestamp and incrementing version
- **User Isolation**: Different users can have recipes with same source URL

### ✅ Test Data & Tooling
- **Synthetic Test Recipes**: 5 comprehensive test recipes covering various cuisines and complexity
- **CRUD Validation**: Automated testing of all database operations
- **S3 Cleanup**: Tools to prevent test data accumulation
- **URL Overwrite Testing**: Specific validation of the overwrite requirement

## Project Structure

```
aws-backend/
├── functions/
│   ├── recipes/           # Main Lambda function for recipe CRUD
│   ├── health/            # Health check endpoint
│   ├── models/            # Go data models and types
│   ├── db/                # Database interfaces
│   ├── utils/             # Common utilities and helpers
│   ├── testdata/          # Test recipe data (JSON)
│   ├── test-tools/        # Comprehensive testing utilities
│   └── s3-manager/        # S3 bucket management tools
├── infrastructure/        # AWS CDK infrastructure as code
└── Makefile              # Testing and development commands
```

## Quick Start

### Prerequisites
- Go 1.21+
- AWS CLI configured with appropriate credentials
- DynamoDB table created (default: `RecipeArchive-Recipes-Dev`)
- S3 bucket created (default: `recipe-archive-dev`)

### Basic Testing
```bash
# Show available commands
make help

# Run complete test suite
make test-all

# Load test data only
make load-test-data

# Validate CRUD operations
make validate-crud

# Test URL-based overwrite behavior
make test-url-overwrite

# List current recipes
make list-recipes

# Clean up test data
make cleanup-all
```

## Test Data

The test suite includes 5 comprehensive recipes:

1. **Perfect Chocolate Chip Cookies** - Classic baking recipe with precise measurements
2. **Classic Margherita Pizza** - Simple ingredients, multiple cooking steps
3. **Grandma's Chicken Noodle Soup** - Complex recipe with long cook times
4. **Vegan Buddha Bowl** - Plant-based recipe with multiple components
5. **Quick 5-Minute Hummus** - Simple recipe with minimal ingredients

Each test recipe includes:
- Structured ingredients with amounts, units, and names
- Step-by-step instructions
- Timing information (prep, cook, total)
- Source URLs and metadata
- Different users for testing isolation

## CRUD Operations Testing

### Create Recipe
```bash
POST /v1/recipes
Content-Type: application/json

{
  "title": "Test Recipe",
  "ingredients": [
    {
      "text": "1 cup flour",
      "amount": 1,
      "unit": "cup", 
      "ingredient": "flour"
    }
  ],
  "instructions": [
    {
      "stepNumber": 1,
      "text": "Mix ingredients"
    }
  ],
  "sourceUrl": "https://example.com/recipe"
}
```

### Read Recipe
```bash
GET /v1/recipes/{id}
Authorization: Bearer {jwt-token}
```

### Update Recipe (Complete Overwrite)
```bash
PUT /v1/recipes/{id}
Content-Type: application/json

{
  "title": "Updated Recipe Title",
  "ingredients": [...],
  "instructions": [...],
  "sourceUrl": "https://example.com/recipe"
}
```

### Delete Recipe (Soft Delete)
```bash
DELETE /v1/recipes/{id}
Authorization: Bearer {jwt-token}
```

## URL Overwrite Testing

The AWS backend implements a specific requirement: when a user re-extracts a recipe from the same URL via the web extension, the system overwrites the existing record completely.

### Test Scenario
1. Create recipe with basic data
2. "Re-extract" same recipe with completely different data
3. Verify complete overwrite occurred
4. Confirm creation timestamp preserved
5. Confirm version incremented

```bash
make test-url-overwrite
```

## S3 Cleanup & Management

### Automated S3 Cleanup
```bash
# Clean all S3 objects (DESTRUCTIVE)
make cleanup-s3

# Build S3 manager tool
cd functions/s3-manager && go build -o s3-manager main.go

# Clean specific user's objects
./s3-manager -action=cleanup-user -bucket=recipe-archive-dev -user-id=test-user-001

# List all S3 objects
./s3-manager -action=list-objects -bucket=recipe-archive-dev

# Create test objects for development
./s3-manager -action=create-test-objects -bucket=recipe-archive-dev
```

## Environment Configuration

### Environment Variables
```bash
# Required for testing
export DYNAMODB_TABLE_NAME="RecipeArchive-Recipes-Dev"
export S3_BUCKET_NAME="recipe-archive-dev"
export AWS_REGION="us-west-2"

# Optional for development
export AWS_PROFILE="your-profile"
```

### Makefile Configuration
The Makefile uses these default values for testing:
- `TEST_USER_ID`: test-user-001
- `DYNAMODB_TABLE_NAME`: RecipeArchive-Recipes-Dev
- `S3_BUCKET_NAME`: recipe-archive-dev

## Development Workflow

### Daily Development
```bash
# Reset development environment
make dev-reset

# Show current data status
make status

# Run quick CRUD validation
make quick-test
```

### Before Committing
```bash
# Run full test suite
make test-all

# Clean up any test residue
make cleanup-all
```

## Error Handling & Validation

### Request Validation
- Required fields: `title`, `ingredients`, `instructions`, `sourceUrl`
- Field limits: Title max 200 chars, ingredient names required
- Structured validation for amounts and units

### Response Formats
```json
// Success Response
{
  "recipe": {
    "id": "uuid",
    "userId": "cognito-user-id",
    "title": "Recipe Title",
    "ingredients": [...],
    "instructions": [...],
    "createdAt": "2025-08-26T10:30:00Z",
    "updatedAt": "2025-08-26T10:30:00Z",
    "version": 1
  }
}

// Error Response  
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "timestamp": "2025-08-26T10:30:00Z",
    "requestId": "request-uuid"
  }
}
```

## Performance & Monitoring

### SLA Targets (from PRD)
- **Critical APIs**: <300ms response time (95th percentile)
- **List Operations**: <500ms response time (95th percentile)
- **Heavy Operations**: <2s response time (95th percentile)
- **Availability**: 99.9% uptime
- **Error Rate**: <1% for all operations

### Test Validation
The test suite validates these requirements by:
- Measuring response times for each operation
- Testing concurrent updates (version conflicts)
- Validating error handling and recovery
- Ensuring user isolation and data integrity

## Security

### Authentication
- JWT token validation on all endpoints
- User-scoped data access only
- No hardcoded credentials or secrets

### Authorization
- All recipes scoped by `userId` from JWT claims
- Cross-user access prevention
- Soft delete preserves audit trail

## Next Steps

1. **Infrastructure Deployment**: Deploy CDK stack to AWS
2. **Integration Testing**: Test with actual web extensions
3. **Performance Optimization**: Add caching and optimize queries
4. **Search Implementation**: Add recipe search functionality
5. **Photo Upload**: Implement S3 photo upload endpoints

---

**Status**: Development Complete, Ready for AWS Deployment
**Last Updated**: August 26, 2025
**Branch**: aws-backend