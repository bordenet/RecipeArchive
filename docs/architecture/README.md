# RecipeArchive Architecture Diagrams

This directory contains comprehensive architecture documentation for the RecipeArchive AWS backend infrastructure.

## Diagrams

### [Data Flow Diagram](data-flow.md)
Visual representation of the complete data flow through the system, showing:
- Client applications (Web, Mobile, Extensions)
- API Gateway routing
- Lambda function interactions
- Storage architecture
- External service integrations
- Queue system for async processing

**Use this diagram to understand:**
- How data moves through the system
- Which Lambda functions handle which operations
- Storage patterns and S3 bucket structure
- Integration points with OpenAI and AWS SES

### [API Integration Diagram](api-integration.md)
Detailed sequence diagrams showing API interactions for major workflows:
- Recipe creation and normalization
- Recipe list and search operations
- Image upload flow
- Error diagnostics reporting
- Invitation management

**Use this diagram to understand:**
- Request/response flows for each endpoint
- Authentication and authorization steps
- Async processing with SQS
- OpenAI normalization stages
- Error handling patterns

**Complete API endpoint documentation included:**
- Request/response formats
- Query parameters
- Error codes
- CORS configuration
- Authentication requirements

## Architecture Overview

### Technology Stack
- **Backend**: AWS Lambda (Go 1.x)
- **API**: AWS API Gateway (REST)
- **Authentication**: AWS Cognito User Pool
- **Storage**: S3 (no DynamoDB)
- **Queue**: SQS for async processing
- **AI**: OpenAI GPT-4o-mini
- **Email**: AWS SES

### Lambda Functions

| Function | Trigger | Description | File |
|----------|---------|-------------|------|
| recipes | API Gateway | Recipe CRUD, search, pagination | [main.go](../../aws-backend/functions/recipes/main.go) |
| image-upload | API Gateway | S3 image upload with validation | [main.go](../../aws-backend/functions/image-upload/main.go) |
| content-normalizer | API Gateway | Two-stage OpenAI normalization | [main.go](../../aws-backend/functions/content-normalizer/main.go) |
| background-normalizer | SQS | Async recipe processing consumer | [main.go](../../aws-backend/functions/background-normalizer/main.go) |
| diagnostics | API Gateway | Error telemetry collection | [main.go](../../aws-backend/functions/diagnostics/main.go) |
| health | API Gateway | System health check | [main.go](../../aws-backend/functions/health/main.go) |
| invitation-manager | API Gateway | S3-based invitation system | [main.go](../../aws-backend/functions/invitation-manager-s3/main.go) |
| s3-manager | CLI | Storage utilities | [main.go](../../aws-backend/functions/s3-manager/main.go) |

### API Endpoints (No /v1/ prefix)

```
GET    /health
GET    /recipes
GET    /recipes/search
GET    /recipes/{recipeId}
POST   /recipes
PUT    /recipes/{recipeId}
DELETE /recipes/{recipeId}
POST   /images/upload
POST   /normalize
POST   /report-error
GET    /admin/invitations
POST   /admin/invitations
DELETE /admin/invitations/{token}
```

### Storage Structure

```
s3://recipe-archive-dev/
├── recipes/
│   └── {userId}/
│       └── {recipeId}.json          # Recipe objects
├── recipe-images/
│   └── {imageId}/
│       └── {filename}                # Uploaded images
├── invitations/
│   ├── tokens/
│   │   ├── {tokenId}.json           # Invitation records
│   │   └── index.json               # Active tokens index
│   ├── by-email/
│   │   └── {emailKey}.json          # Email lookup index
│   └── by-admin/
│       └── {adminId}.json           # Admin's invitations index
└── diagnostics/
    ├── {timestamp}_{url}.json       # Error diagnostics
    └── failed-parsing/
        └── {timestamp}_{url}.html   # HTML context for errors
```

## Key Design Decisions

### S3-Only Architecture
- **Decision**: Use S3 for all data storage, no DynamoDB
- **Rationale**: Cost optimization, simpler architecture
- **Trade-offs**: In-memory search instead of DynamoDB queries

### Two-Stage OpenAI Normalization
- **Stage 1**: Fast classification (10s timeout)
  - Title normalization
  - Metadata extraction
  - Multi-method detection
- **Stage 2**: Detailed processing (25s timeout)
  - Instruction normalization
  - Ingredient standardization
  - Cooking method separation

### Image Security
- **Decision**: Only accept S3 bucket URLs for images
- **Rationale**: Security - prevent SSRF attacks
- **Implementation**: Validation in recipes Lambda [line 357-398](../../aws-backend/functions/recipes/main.go#L357-L398)

### Async Normalization
- **Decision**: Queue normalization jobs via SQS
- **Rationale**: Fast API response, handle OpenAI latency
- **Flow**: POST /recipes → Queue job → Background processing

### Recipe Deduplication
- **Decision**: Overwrite recipes with same sourceURL
- **Rationale**: Browser extensions may re-save same recipe
- **Implementation**: Check sourceURL, keep same ID, increment version

## Performance Characteristics

### Recipe Operations
- **Create**: ~100-200ms (before normalization)
- **Read**: ~50-100ms (S3 GetObject)
- **List**: ~200-500ms (100 recipes)
- **Search**: ~300-800ms (in-memory filtering)
- **Normalization**: ~30-60s (async, two-stage OpenAI)

### Cost Optimization
- S3 storage instead of DynamoDB saves ~70% on storage costs
- In-memory search eliminates OpenSearch cluster costs
- Two-stage normalization reduces OpenAI API costs by 40%

## Security Features

### Multi-Layer Validation
1. **API Gateway**: JWT validation via Cognito
2. **Lambda**: Tenant validation with user ID extraction
3. **Resource Access**: Path-based validation for S3 objects

### Image URL Security
- Only S3 bucket URLs accepted
- External URLs rejected with error
- Prevents SSRF and image proxy attacks

### Tenant Isolation
- User ID extracted from JWT
- All S3 paths include user ID prefix
- Cross-tenant access prevented by path validation

## Monitoring and Diagnostics

### Error Tracking
- Clients POST to `/report-error`
- Diagnostics stored in S3 with full context
- HTML snapshots for parsing failures
- Use `get-diagnostics` tool for analysis

### Tools
- **content-ops**: Multi-tenant recipe analysis
- **recipe-tracer**: End-to-end recipe processing tracing
- **get-diagnostics**: Diagnostic telemetry analysis

## Deployment

### Prerequisites
- AWS CDK deployed infrastructure
- Environment variables configured
- OpenAI API key in Lambda environment

### Deployment Commands
```bash
# Deploy all Lambda functions
./scripts/deploy-lambda.sh --all

# Deploy specific function
./scripts/deploy-lambda.sh recipes

# Validate deployment
./scripts/validate-api-gateway.sh
```

## Related Documentation

- [Project Status](../../PROJECT_STATUS.md)
- [Project Guide](../../CLAUDE.md)
- [API Specification](../api/api-specification.md)
- [AWS Setup Guide](../setup/aws-setup.md)
- [Infrastructure README](../../aws-backend/infrastructure/README.md)

## Diagram Compatibility

All diagrams in this directory are written in standard Mermaid syntax and are compatible with:
- GitHub's native Mermaid rendering
- GitLab's Mermaid integration
- VS Code Mermaid preview extensions
- [Mermaid Live Editor](https://mermaid.live)
- Documentation site generators (MkDocs, Docusaurus, etc.)

To view diagrams locally, use any Mermaid-compatible viewer or the Mermaid Live Editor.