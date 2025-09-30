# RecipeArchive Data Flow Diagram

This diagram illustrates the complete data flow through the RecipeArchive AWS backend infrastructure, showing how client applications interact with Lambda functions, storage, and external services.

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web App<br/>Flutter]
        EXT[Browser Extensions<br/>Chrome/Safari]
        MOB[Mobile Apps<br/>iOS/Android]
    end

    subgraph "API Gateway"
        APIGW[API Gateway<br/>REST API]
    end

    subgraph "Authentication"
        COGNITO[AWS Cognito<br/>User Pool]
    end

    subgraph "Lambda Functions"
        RECIPES[recipes<br/>CRUD Operations]
        IMGUP[image-upload<br/>Image Storage]
        NORM[content-normalizer<br/>OpenAI Processing]
        BGNORM[background-normalizer<br/>SQS Consumer]
        DIAG[diagnostics<br/>Error Collection]
        HEALTH[health<br/>Status Check]
        INV[invitation-manager<br/>User Invites]
        S3MGR[s3-manager<br/>Storage Ops]
    end

    subgraph "Storage Layer"
        S3[(S3 Bucket<br/>recipe-archive-dev)]
        S3DIAG[(S3 Bucket<br/>diagnostics)]
    end

    subgraph "Queue System"
        SQS[SQS Queue<br/>Normalization Jobs]
    end

    subgraph "External Services"
        OPENAI[OpenAI API<br/>GPT-4o-mini]
        SES[AWS SES<br/>Email Service]
    end

    %% Client to API Gateway
    WEB -->|HTTPS| APIGW
    EXT -->|HTTPS| APIGW
    MOB -->|HTTPS| APIGW

    %% Authentication flow
    APIGW -->|Validate JWT| COGNITO
    COGNITO -->|User Claims| APIGW

    %% API Gateway to Lambda routing
    APIGW -->|/recipes| RECIPES
    APIGW -->|/images/upload| IMGUP
    APIGW -->|/normalize| NORM
    APIGW -->|/report-error| DIAG
    APIGW -->|/health| HEALTH
    APIGW -->|/admin/invitations| INV

    %% Recipe operations flow
    RECIPES -->|Read/Write| S3
    RECIPES -->|Queue Job| SQS
    SQS -->|Trigger| BGNORM
    BGNORM -->|Read Recipe| S3
    BGNORM -->|HTTP POST| NORM
    NORM -->|OpenAI Request| OPENAI
    OPENAI -->|Normalized Data| NORM
    NORM -->|Response| BGNORM
    BGNORM -->|Update Recipe| S3

    %% Image upload flow
    IMGUP -->|Store Image| S3

    %% Diagnostics flow
    DIAG -->|Store Errors| S3DIAG

    %% Invitation management
    INV -->|Read/Write| S3
    INV -->|Send Email| SES

    %% S3 manager utilities
    S3MGR -->|Cleanup/List| S3

    %% Storage structure (note references in documentation)
    %% S3: recipes/userId/recipeId.json
    %% S3: recipe-images/imageId/filename
    %% S3: invitations/tokens/tokenId.json
    %% S3DIAG: diagnostics/timestamp_url.json
    %% S3DIAG: failed-parsing/timestamp_url.html

    style WEB fill:#e1f5ff
    style EXT fill:#e1f5ff
    style MOB fill:#e1f5ff
    style APIGW fill:#fff4e6
    style COGNITO fill:#ffe6f0
    style RECIPES fill:#e8f5e9
    style IMGUP fill:#e8f5e9
    style NORM fill:#f3e5f5
    style BGNORM fill:#f3e5f5
    style DIAG fill:#e8f5e9
    style HEALTH fill:#e8f5e9
    style INV fill:#e8f5e9
    style S3MGR fill:#e8f5e9
    style S3 fill:#fff3e0
    style S3DIAG fill:#fff3e0
    style SQS fill:#fce4ec
    style OPENAI fill:#e3f2fd
    style SES fill:#e3f2fd
```

## Components Overview

### Client Applications
- **Web App**: Flutter web application served via CloudFront
- **Browser Extensions**: Chrome and Safari extensions for recipe capture
- **Mobile Apps**: iOS and Android Flutter applications

### API Gateway
- Single REST API endpoint
- JWT validation via Cognito authorizer
- CORS handling for all origins
- No /v1/ prefix on endpoints

### Lambda Functions (Go)

| Function | Path | Description |
|----------|------|-------------|
| recipes | `/recipes` | Full CRUD operations, search, pagination |
| image-upload | `/images/upload` | Direct S3 image uploads with validation |
| content-normalizer | `/normalize` | Two-stage OpenAI normalization |
| background-normalizer | SQS Trigger | Async recipe processing consumer |
| diagnostics | `/report-error` | Error telemetry collection |
| health | `/health` | System health check |
| invitation-manager | `/admin/invitations` | S3-based invitation system |
| s3-manager | CLI Tool | Storage cleanup and management |

### Storage Architecture
All data storage uses S3 (no DynamoDB in production):
- **recipes/{userId}/{recipeId}.json**: Recipe objects
- **recipe-images/{imageId}/{filename}**: Uploaded images
- **invitations/tokens/{tokenId}.json**: Invitation records
- **invitations/by-email/{emailKey}.json**: Email index
- **invitations/by-admin/{adminId}.json**: Admin index
- **diagnostics/{timestamp}_{url}.json**: Error diagnostics
- **failed-parsing/{timestamp}_{url}.html**: HTML context

### Security Features
- **Image URL Validation**: Only S3 bucket URLs allowed, external URLs rejected
- **Tenant Isolation**: Multi-level validation with user ID enforcement
- **JWT Authentication**: All endpoints require valid Cognito tokens
- **Resource Access Control**: Path-based access validation

### Performance Optimizations
- **In-Memory Search**: Cost-efficient Lambda-based filtering
- **Two-Stage Normalization**: Fast classification (10s) + detailed processing (25s)
- **SQS Batch Processing**: Up to 10 messages per invocation
- **Cursor Pagination**: Efficient navigation through large datasets

## Data Flow Patterns

### Synchronous Operations
1. Recipe CRUD operations
2. Image uploads
3. Invitation management
4. Health checks
5. Diagnostics submission

### Asynchronous Operations
1. Recipe normalization via SQS
2. OpenAI content enhancement
3. Email delivery via SES

### Storage Patterns
- **Write-Once, Read-Many**: Recipe objects
- **Overwrite on Duplicate**: Same sourceURL detection
- **Soft Delete**: IsDeleted flag, hard delete available
- **Versioning**: Increment version on update