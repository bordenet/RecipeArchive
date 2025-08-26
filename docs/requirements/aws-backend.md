# Product Requirements Document (PRD): RecipeArchive AWS Backend

## Overview

The AWS backend for RecipeArchive provides secure, scalable, and cost-effective storage and management of recipe data. It supports multi-device access, future multi-tenancy, and integration with browser extensions and mobile/web apps.

### Related Product Requirements

This backend infrastructure supports the complete RecipeArchive ecosystem. See related PRDs:

- **[Browser Extension PRD](browser-extension.md)** - Chrome and Safari extensions for one-click recipe capture and archival
- **[iOS App PRD](ios-app.md)** - Native mobile app that consumes backend APIs for recipe access and management
- **[Website PRD](website.md)** - Web application that provides comprehensive recipe management interface

The AWS backend serves as the **central data layer** that enables seamless sync between the browser extension (capture), iOS app (mobile access), and website (management interface).

## Goals

- Store and manage recipes for users with unified data model
- Support CRUD and search operations via RESTful API
- Enable multi-device sync and offline caching with conflict resolution
- Prepare for future multi-tenant support
- Integrate with AWS Cognito authentication from day 1
- Support diagnostic data collection for continuous parser improvement

## Functional Requirements

### 1. Recipe Data Management

**Unified Recipe Data Model** (see `../architecture/data-model.md` for complete specification):

#### Core Recipe Entity

- **Required Fields**: `id`, `userId`, `title`, `ingredients[]`, `instructions[]`, `sourceUrl`
- **Optional Metadata**: `prepTimeMinutes`, `cookTimeMinutes`, `totalTimeMinutes`, `servings`, `mainPhotoUrl`
- **System Fields**: `createdAt`, `updatedAt`, `isDeleted`, `version`
- **Archive Fields**: `webArchiveUrl`, `webArchiveFormat`
- **Future Extensions**: `tags[]`, `notes`, `rating`

#### Structured Ingredient Format

```typescript
interface Ingredient {
  quantity?: number;
  unit?: string;
  name: string;
  notes?: string;
  originalText: string;
}
```

#### Structured Instruction Format

```typescript
interface Instruction {
  stepNumber: number;
  text: string;
  timeMinutes?: number;
  temperature?: string;
}
```

### 2. API Endpoints

#### Recipe CRUD Operations

- **POST** `/v1/recipes` - Create new recipe
- **GET** `/v1/recipes/{id}` - Retrieve specific recipe
- **PUT** `/v1/recipes/{id}` - Update existing recipe
- **DELETE** `/v1/recipes/{id}` - Soft delete recipe
- **GET** `/v1/recipes` - List user's recipes with pagination

#### Recipe Search & Filtering

- **GET** `/v1/recipes/search` - Search within user's recipe library
  - Query Parameters: `q` (text), `dateFrom/dateTo`, `minServings/maxServings`, `maxPrepTime/maxCookTime`, `source`, `sortBy`, `sortOrder`, `limit`, `offset`
  - Response: Paginated results with search metadata

#### Diagnostic Data Collection (Critical for Browser Extension)

- **POST** `/v1/diagnostics` - Manual diagnostic data submission
- **POST** `/v1/diagnostics/auto` - Automatic failure diagnostic submission
- **Authentication**: Bearer token required
- **Purpose**: Continuous parser improvement and site compatibility monitoring

### 3. Authentication & Authorization

**AWS Cognito Integration** (see `../architecture/auth-decision.md`):

- **User Pool**: Email-based authentication with verified accounts
- **JWT Tokens**: 1-hour access tokens, 30-day refresh tokens with rotation
- **API Security**: Cognito authorizer on API Gateway for all endpoints
- **User Isolation**: All data scoped by `userId` from JWT claims
- **Session Management**: Automatic token refresh in clients

### 4. File Storage Architecture

**S3 Bucket Structure**:

```
recipeArchive-{environment}/
├── users/{userId}/
│   ├── photos/{recipeId}/main.jpg
│   └── archives/{recipeId}/
│       ├── page.html (primary)
│       └── page.pdf (fallback)
```

**Access Control**:

- **Signed URLs**: Pre-signed URLs for secure file access (24-hour expiration)
- **User Scoping**: All file paths include `userId` for isolation
- **Content Types**: Support JPEG, PNG for photos; HTML, PDF for archives

### 5. Database Schema (DynamoDB)

#### Primary Table: `recipes`

- **Partition Key**: `userId` (String)
- **Sort Key**: `id` (String)
- **Attributes**: All Recipe fields except computed URLs

#### Global Secondary Indexes

1. **recipes-by-created**: `userId` (PK) + `createdAt` (SK) - chronological listing
2. **recipes-by-title**: `userId` (PK) + `title` (SK) - alphabetical search
3. **recipes-search-date**: `userId` (PK) + `createdAt` (SK) - date range filtering

### 6. Multi-device Sync & Conflict Resolution

- **Version-Based Sync**: `version` field incremented on every update
- **Conflict Strategy**: Last-write-wins with version comparison
- **Batch Operations**: Support bulk sync for initial cache population
- **Incremental Sync**: Delta updates since last sync timestamp

## Non-Functional Requirements

### Performance Requirements (see `../architecture/performance-standards.md`)

- **Critical APIs**: <300ms response time (95th percentile SLA)
- **List Operations**: <500ms response time (95th percentile SLA)
- **Heavy Operations**: <2s response time (95th percentile SLA)
- **Availability**: 99.9% uptime SLA
- **Error Rate**: <1% for all operations

### Scalability & Cost Optimization

- **Architecture**: Serverless (Lambda, API Gateway, DynamoDB, S3)
- **Auto-scaling**: DynamoDB on-demand, Lambda concurrent execution
- **Cost Protection**: Rate limiting per user to prevent runaway costs
- **Regional Deployment**: US-West-2 primary region

### Security Requirements

- **Data Encryption**: At rest (DynamoDB, S3) and in transit (HTTPS)
- **Authentication**: JWT validation on all endpoints
- **Authorization**: User-scoped data access only
- **Audit Logging**: CloudTrail for API access, CloudWatch for application logs
- **Rate Limiting**: Configurable per-user and per-endpoint limits

### Monitoring & Observability

- **CloudWatch Metrics**: API response times, error rates, Lambda duration
- **Performance Dashboards**: Real-time SLA monitoring
- **Alerting**: Automated alerts for SLA violations and errors
- **Cost Monitoring**: Budget alerts and spend tracking

## Rate Limiting & Cost Protection

### Per-User Rate Limits

- **Recipe Operations**: 100 requests/hour per user
- **Search Operations**: 50 requests/hour per user
- **File Uploads**: 20 uploads/hour per user
- **Diagnostic Submissions**: 200 requests/hour per user

### Cost Protection Measures

- **DynamoDB**: On-demand billing with burst protection
- **S3**: Lifecycle policies for archive cleanup
- **Lambda**: Memory optimization and timeout controls
- **API Gateway**: Request throttling and quota management

## Out of Scope (MVP)

- Advanced analytics or reporting dashboards
- Social/sharing features or multi-user recipe access
- Admin dashboard or user management tools
- Real-time collaborative editing
- Advanced search (full-text indexing with OpenSearch)

## Success Metrics

- **API Performance**: 95% of requests meet SLA targets
- **Data Integrity**: Zero data loss incidents
- **Availability**: 99.9% uptime achievement
- **User Engagement**: API calls per active user, recipe storage growth
- **Error Rates**: <1% failed requests across all endpoints
- **Cost Efficiency**: Monthly AWS spend within budget projections

## Future Considerations

- **Multi-tenant Support**: Organization-level recipe sharing
- **Advanced Search**: Full-text search with Amazon OpenSearch
- **AI Enhancement**: Recipe extraction improvement with ML
- **Global Expansion**: Multi-region deployment for international users
- **MCP Server Integration**: Protocol support for extensibility

---

**Implementation Priority**:

1. **Week 1**: Core CRUD APIs with DynamoDB schema
2. **Week 2**: Authentication integration and S3 file handling
3. **Week 3**: Search functionality and diagnostic endpoints
4. **Week 4**: Performance optimization and monitoring setup

This PRD will be updated as requirements evolve, maintaining alignment with browser extension, iOS app, and website requirements.

---

**Document Attribution**: This Product Requirements Document was created using the [Product Requirements Assistant](https://github.com/bordenet/product-requirements-assistant) - an AI-powered tool for generating comprehensive, structured PRDs. The assistant helped ensure thoroughness, consistency, and professional formatting throughout the requirements definition process.
