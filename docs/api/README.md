# Recipe Archive API Documentation

## Overview

This directory contains the OpenAPI/Swagger documentation for the Recipe Archive API.

## Files

- `openapi.yaml` - Complete OpenAPI 3.1 specification for the Recipe Archive API

## Critical Maintenance Requirements

⚠️ **CRITICAL**: This documentation MUST be maintained in sync with actual API implementations.

### Mandatory Updates Required For:

1. **New Endpoints** - Add complete OpenAPI definitions
2. **Parameter Changes** - Update request/response schemas
3. **Authentication Changes** - Update security schemes
4. **Response Format Changes** - Update response schemas
5. **Error Code Changes** - Update error response definitions

### Validation Process

Before deploying API changes:

1. Update OpenAPI specification first
2. Validate schema against implementation
3. Generate client SDKs if needed
4. Update integration tests
5. Deploy API changes

### Tools

To validate the OpenAPI specification:

```bash
# Install OpenAPI tools
npm install -g @apidevtools/swagger-cli

# Validate the specification
swagger-cli validate docs/api/openapi.yaml

# Bundle for distribution
swagger-cli bundle docs/api/openapi.yaml -o dist/api-spec.yaml
```

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Recipes
- `GET /v1/recipes` - List recipes with filtering and pagination
- `POST /v1/recipes` - Create new recipe
- `GET /v1/recipes/{id}` - Get recipe by ID
- `PUT /v1/recipes/{id}` - Update recipe (owner only)
- `DELETE /v1/recipes/{id}` - Delete recipe (owner only)

## Authentication

The API uses AWS Cognito JWT tokens for authentication:

```http
Authorization: Bearer <cognito-jwt-token>
```

## Environment Variables

The API endpoints require these environment variables:

- `AWS_USER_POOL_ID` - Cognito User Pool ID
- `AWS_REGION` - AWS region
- `DATABASE_URL` - Database connection string

## Development

For local development, the API runs on `http://localhost:8080`.

For production, the API is deployed via AWS API Gateway.

## Schema Updates

When updating schemas:

1. Update `openapi.yaml` 
2. Re-generate any auto-generated code
3. Update client applications
4. Update documentation

## Security Considerations

- All endpoints except `/health` require authentication
- User can only modify their own recipes
- Input validation is enforced per schema definitions
- Rate limiting is configured at API Gateway level
