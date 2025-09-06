# RecipeArchive Cloud Infrastructure - User Benefits

## 🎯 What This Means for You

The RecipeArchive cloud backend is the invisible foundation that makes your recipe experience seamless across all your devices. When you save a recipe on your computer, it instantly appears on your phone. When you edit a recipe on your iPad, the changes sync everywhere.

### Why Cloud-Powered Recipe Storage Matters

- **🔒 Your recipes are always safe** - Never lose a recipe to a crashed device or lost bookmark
- **📱 Access anywhere, anytime** - Your complete recipe library on every device you own
- **⚡ Lightning-fast sync** - Save on one device, cook from another seconds later
- **🛡️ Enterprise-grade security** - Your personal recipe collection is protected and private
- **🔄 Conflict-free editing** - Make changes on multiple devices without losing data

### The RecipeArchive Ecosystem

Your cloud storage powers the complete RecipeArchive experience:

- **[Browser Extension](browser-extension.md)** - Captures recipes and saves them to your cloud library
- **[Website](website.md)** - Full recipe management and organization interface
- **[iOS App](ios-app.md)** - Native mobile access to your complete recipe collection

The backend is the **invisible backbone** that makes all your devices work together as one unified cooking companion.

## 🚀 Key User Benefits

### Seamless Multi-Device Experience
- **One-click recipe access** across phone, tablet, computer, and browser
- **Real-time synchronization** - changes appear instantly everywhere
- **Smart conflict resolution** - handles simultaneous edits gracefully
- **Offline access** - your recipes work even without internet connection

### Rock-Solid Reliability  
- **99.9% uptime guarantee** - your recipes are always available when you need them
- **Automatic backups** - multiple copies keep your data ultra-safe
- **Version history** - recover accidentally deleted or changed recipes
- **Global accessibility** - fast access from anywhere in the world

## 🍳 What Your Cloud-Powered Recipe Library Can Do

### Complete Recipe Information Storage
- **Full recipe details** - title, ingredients, instructions, cook times, and servings
- **Original source tracking** - always know where you found each recipe
- **High-quality photos** - visual reference for every dish
- **Smart ingredient formatting** - quantities, measurements, and preparation notes
- **Step-by-step instructions** - clear directions with timing and temperature details

### Intelligent Recipe Management
- **Automatic organization** - recipes are structured and searchable from day one
- **Version control** - track changes and recover previous versions
- **Conflict resolution** - handle simultaneous edits from multiple devices
- **Smart formatting** - consistent presentation regardless of source website
- **Metadata enhancement** - cooking times and serving information automatically inferred

### Powerful Search & Discovery
- **Find recipes instantly** - search by ingredient, cooking time, or recipe name  
- **Smart filtering** - narrow down by prep time, servings, or source website
- **Recently added tracking** - easily find your newest recipe discoveries
- **Frequently accessed** - your most-used recipes rise to the top
- **Cross-device search** - same search results on every device

#### Recipe Search & Filtering

- **GET** `/v1/recipes/search` - Search within user's recipe library
  - Query Parameters: `q` (text), `dateFrom/dateTo`, `minServings/maxServings`, `maxPrepTime/maxCookTime`, `source`, `sortBy`, `sortOrder`, `limit`, `offset`
  - Response: Paginated results with search metadata

#### Diagnostic Data Collection (Critical for Browser Extension)

- **POST** `/v1/diagnostics` - Manual diagnostic data submission
- **POST** `/v1/diagnostics/auto` - Automatic failure diagnostic submission
- **Authentication**: Bearer token required
- **Purpose**: Continuous parser improvement and site compatibility monitoring

#### Parser Failure API (Enhanced Diagnostic Requirements)

**POST** `/v1/diagnostics/parser-failure` - Parser failure with HTML dump submission

**Critical Security Requirements:**

- **Cognito Authentication**: Bearer token validation required
- **User Rate Limiting**: Maximum 200 submissions per user per hour
- **Data Validation**: Strict payload validation to prevent abuse
- **Content Filtering**: HTML sanitization and size limits (max 2MB per submission)

**Request Payload Structure:**

```typescript
interface ParserFailurePayload {
  url: string; // Source recipe URL
  timestamp: string; // ISO 8601 timestamp
  userAgent: string; // Browser/extension info
  extractionAttempt: {
    method: 'json-ld' | 'html-parsing' | 'mixed';
    timeElapsed: number; // Milliseconds
    elementsFound: {
      jsonLdScripts: number;
      recipeContainers: number;
      ingredientSections: number;
      instructionSections: number;
    };
    partialData: {
      title?: string;
      ingredients?: string[];
      instructions?: string[];
      timing?: string;
      servings?: string;
    };
  };
  htmlDump: string; // Complete page HTML
  domMetrics: {
    totalElements: number;
    imageCount: number;
    linkCount: number;
    listCount: number;
  };
  failureReason: string; // Human-readable failure description
}
```

**Response Structure:**

```typescript
interface ParserFailureResponse {
  submissionId: string; // Unique identifier for tracking
  status: 'received' | 'queued' | 'processing';
  timestamp: string; // Server processing time
  retryRecommendation?: {
    waitMinutes: number; // Suggested retry delay
    alternativeMethod?: string; // Alternative extraction approach
  };
}
```

**AWS Implementation Requirements:**

1. **Dedicated S3 Bucket for Failed Parsing HTML:**
   - **Bucket Name**: `recipearchive-failed-parsing-{environment}-{accountId}`
   - **Cost Control**: 20MB maximum size enforced by CloudWatch alarms
   - **Data Retention**: 30-day automatic purging via S3 lifecycle rules
   - **Security**: Block all public access, encrypted with S3-managed keys

2. **S3 Storage Structure:**

   ```
   recipearchive-failed-parsing-{environment}-{accountId}/
   └── failed-parsing/
       └── {timestamp}_{domain}_{uuid}.html    // Raw HTML files
   ```

3. **Storage Cost Control Measures:**
   - **Size Limit**: CloudWatch alarm triggers at 20MB bucket size
   - **Time Limit**: S3 lifecycle rule deletes files after 30 days
   - **Monitoring**: SNS notifications for size limit breaches
   - **Cleanup**: Automatic incomplete multipart upload deletion

4. **Lambda Processing Pipeline:**
   - **Validation Function**: Authenticate user, validate payload, enforce rate limits
   - **Storage Function**: Store HTML dump and metadata in S3
   - **Analysis Function**: Extract features for ML retraining pipeline
   - **Notification Function**: Alert development team of critical parsing failures

5. **DynamoDB Tracking Table: `parser-failures`**
   - **Partition Key**: `userId` (String)
   - **Sort Key**: `submissionId` (String)
   - **Attributes**: `url`, `timestamp`, `failureReason`, `processingStatus`, `s3Location`
   - **TTL**: 90 days for automatic cleanup

6. **ML Retraining Integration:**
   - **Feature Extraction**: Automated analysis of HTML structure patterns
   - **Parser Improvement**: Integration with parser development workflow
   - **Success Metrics**: Track parser improvement over time
   - **Feedback Loop**: Automatically test new parsers against historical failures

### 3. Authentication & Authorization

**AWS Cognito Integration** (see `../architecture/auth-decision.md`):

- **User Pool**: Email-based authentication with verified accounts
- **JWT Tokens**: 1-hour access tokens, 30-day refresh tokens with rotation
- **API Security**: Cognito authorizer on API Gateway for all endpoints
- **User Isolation**: All data scoped by `userId` from JWT claims
- **Session Management**: Automatic token refresh in clients

### 4. File Storage Architecture

**S3 Bucket Structure** - Three dedicated buckets for different purposes:

```
# Primary storage bucket for user data
recipearchive-storage-{environment}-{accountId}/
├── users/{userId}/
│   ├── photos/{recipeId}/main.jpg
│   └── archives/{recipeId}/
│       ├── page.html (primary)
│       └── page.pdf (fallback)

# Temporary processing bucket
recipearchive-temp-{environment}-{accountId}/
├── uploads/{userId}/{sessionId}/...  (7-day retention)

# Failed parsing diagnostics bucket (NEW)
recipearchive-failed-parsing-{environment}-{accountId}/
├── failed-parsing/
│   └── {timestamp}_{domain}_{uuid}.html  (30-day retention, 20MB limit)
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

- **Recipe Operations**: 200 requests/hour per user
- **Search Operations**: 100 requests/hour per user
- **File Uploads**: 200 uploads/hour per user
- **Diagnostic Submissions**: 200 requests/hour per user
- **Parser Failure Submissions**: 50 requests/hour per user (security critical)

### Cost Protection Measures

- **DynamoDB**: On-demand billing with burst protection
- **S3**: Lifecycle policies for archive cleanup
- **Lambda**: Memory optimization and timeout controls
- **API Gateway**: Request throttling and quota management

## New Feature Requirements

### OpenAI Content Normalization at Ingestion

**Integration Point**: Recipe processing pipeline between parsing and storage

**Core Requirements:**

- **Content Enhancement**: Standardize recipe titles, ingredient formats, instruction clarity
- **Metadata Inference**: Auto-detect cuisine types, cooking methods, dietary information
- **Quality Scoring**: Rate normalization quality with fallback to original content
- **Cost Management**: Rate limiting, budget controls, and batch processing capabilities

**API Extensions:**

- **POST** `/v1/recipes/normalize` - On-demand recipe normalization
- **GET** `/v1/recipes/{id}/normalization-history` - View normalization details
- **PUT** `/v1/recipes/{id}/revert-normalization` - Restore original content

**Lambda Functions:**

- `ContentNormalizer`: OpenAI integration for recipe enhancement
- `NormalizationValidator`: Quality validation and fallback logic
- `CostTracker`: Monitor OpenAI API usage and costs

### Failed Parse Workflow Enhancement

**Mobile Integration Pipeline**: Route failed parsing attempts to mobile applications

**Enhanced Diagnostic Collection:**

- **Structured Failure Analysis**: Categorize failure types and provide actionable feedback
- **Recovery Workflow**: Convert failed parses to manual recipe entry opportunities
- **Parser Improvement Pipeline**: Track parsing success improvements over time

**New API Endpoints:**

- **GET** `/v1/diagnostics/failed-parses` - List user's failed parsing attempts
- **POST** `/v1/diagnostics/{id}/convert-manual` - Convert failed parse to manual entry
- **GET** `/v1/diagnostics/parsing-improvements` - Show site parsing success rates

**Mobile App Integration:**

- Failed parse notifications and management screens
- One-click conversion to manual recipe entry
- Progress tracking for parser improvements

### Multi-Tenant Administration System

**Admin Role Management**: System administrator capabilities across all tenant accounts

**Core Admin Features:**

- **Tenant Management**: Create, configure, and manage tenant accounts
- **User Administration**: Cross-tenant user management and support tools
- **System Monitoring**: Health dashboards and performance analytics across all tenants
- **Content Management**: Bulk operations and data migration tools

**Admin API Endpoints:**

- **GET** `/admin/v1/tenants` - List all tenant accounts
- **POST** `/admin/v1/tenants` - Create new tenant with full infrastructure provisioning
- **GET** `/admin/v1/users/{userId}/cross-tenant` - Admin view of user across tenants
- **POST** `/admin/v1/bulk-operations` - Execute bulk operations across tenants

**Security Requirements:**

- **Role-Based Access**: System admin (`mattbordenet@hotmail.com`) vs tenant-scoped access
- **Audit Logging**: Comprehensive logging of all admin actions
- **Data Isolation**: Strict tenant boundary enforcement with admin override capability

## Out of Scope (MVP)

- Advanced analytics or reporting dashboards beyond admin monitoring
- Social/sharing features or multi-user recipe access within tenants
- Real-time collaborative editing
- Advanced search (full-text indexing with OpenSearch) - phase 2 feature

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
