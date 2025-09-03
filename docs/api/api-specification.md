# RecipeArchive API Specification

## Overview

RESTful API for the RecipeArchive application, designed for AWS Free Tier deployment with high performance and security.

**Base URL**: `[CONFIGURED_VIA_ENVIRONMENT]`  
**Version**: v1  
**Authentication**: AWS Cognito JWT tokens  
**Region**: [CONFIGURED_VIA_ENVIRONMENT]

## Authentication

All API endpoints require authentication via AWS Cognito JWT tokens.

### Headers Required

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Authentication Flow

1. User authenticates with AWS Cognito (via browser extension/app)
2. Cognito returns JWT access token
3. Include JWT in Authorization header for all API calls
4. Token expires after 1 hour (refresh token valid for 30 days)

## API Endpoints

### Health & Diagnostics

#### GET /health

Basic health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-08-24T16:30:00Z",
  "version": "1.0.0"
}
```

#### GET /v1/diagnostics

Detailed system diagnostics (authenticated).

**Response:**

```json
{
  "status": "healthy",
  "services": {
    "dynamodb": "healthy",
    "s3": "healthy",
    "cognito": "healthy"
  },
  "user": {
    "userId": "us-west-2:12345...",
    "email": "user@example.com"
  },
  "timestamp": "2025-08-24T16:30:00Z"
}
```

---

## Recipes API

### GET /v1/recipes

Retrieve all recipes for the authenticated user.

**Query Parameters:**

- `limit` (optional): Number of recipes to return (default: 50, max: 100)
- `cursor` (optional): Pagination cursor from previous response
- `sortBy` (optional): `created` | `updated` | `title` (default: `created`)
- `sortOrder` (optional): `asc` | `desc` (default: `desc`)
- `search` (optional): Search term for title/ingredients (min 3 chars)

**Response:**

```json
{
  "recipes": [
    {
      "id": "recipe-uuid-1234",
      "userId": "us-west-2:user-id",
      "title": "Perfect Chocolate Chip Cookies",
      "ingredients": [
        {
          "text": "2 cups all-purpose flour",
          "amount": 2,
          "unit": "cups",
          "ingredient": "all-purpose flour"
        }
      ],
      "instructions": [
        {
          "stepNumber": 1,
          "text": "Preheat oven to 375°F"
        }
      ],
      "sourceUrl": "https://example.com/recipe",
      "mainPhotoUrl": "https://recipearchive-storage-dev-[ACCOUNT-ID].s3.us-west-2.amazonaws.com/signed-url",
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 12,
      "totalTimeMinutes": 27,
      "servings": 24,
      "createdAt": "2025-08-24T15:30:00Z",
      "updatedAt": "2025-08-24T15:30:00Z",
      "version": 1
    }
  ],
  "pagination": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI1LTA4LTI0VDE1OjMwOjAwWiJ9",
    "hasMore": true,
    "total": 127
  }
}
```

### GET /v1/recipes/{recipeId}

Retrieve a specific recipe by ID.

**Path Parameters:**

- `recipeId`: UUID of the recipe

**Response:**

```json
{
  "recipe": {
    "id": "recipe-uuid-1234",
    "userId": "us-west-2:user-id",
    "title": "Perfect Chocolate Chip Cookies",
    "ingredients": [...],
    "instructions": [...],
    "sourceUrl": "https://example.com/recipe",
    "mainPhotoUrl": "https://signed-s3-url",
    "webArchiveUrl": "https://signed-s3-archive-url",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 12,
    "totalTimeMinutes": 27,
    "servings": 24,
    "createdAt": "2025-08-24T15:30:00Z",
    "updatedAt": "2025-08-24T15:30:00Z",
    "version": 1
  }
}
```

### POST /v1/recipes

Create a new recipe.

**Request Body:**

```json
{
  "title": "Perfect Chocolate Chip Cookies",
  "ingredients": [
    {
      "text": "2 cups all-purpose flour",
      "amount": 2,
      "unit": "cups",
      "ingredient": "all-purpose flour"
    }
  ],
  "instructions": [
    {
      "stepNumber": 1,
      "text": "Preheat oven to 375°F"
    }
  ],
  "sourceUrl": "https://example.com/recipe",
  "mainPhotoUrl": "https://example.com/photo.jpg",
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 12,
  "totalTimeMinutes": 27,
  "servings": 24,
  "webArchiveHtml": "<html>...</html>"
}
```

**Response:**

```json
{
  "recipe": {
    "id": "recipe-uuid-1234",
    "userId": "us-west-2:user-id",
    "title": "Perfect Chocolate Chip Cookies",
    "ingredients": [...],
    "instructions": [...],
    "sourceUrl": "https://example.com/recipe",
    "mainPhotoUrl": "https://recipearchive-storage-dev-[ACCOUNT-ID].s3.us-west-2.amazonaws.com/signed-url",
    "webArchiveUrl": "https://recipearchive-storage-dev-[ACCOUNT-ID].s3.us-west-2.amazonaws.com/archive-signed-url",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 12,
    "totalTimeMinutes": 27,
    "servings": 24,
    "createdAt": "2025-08-24T16:30:00Z",
    "updatedAt": "2025-08-24T16:30:00Z",
    "version": 1
  }
}
```

### PUT /v1/recipes/{recipeId}

Update an existing recipe.

**Path Parameters:**

- `recipeId`: UUID of the recipe

**Request Body:** (Same as POST, with optional version for conflict resolution)

```json
{
  "title": "Updated Recipe Title",
  "ingredients": [...],
  "instructions": [...],
  "version": 1
}
```

**Response:** (Same as POST with updated timestamps and incremented version)

### DELETE /v1/recipes/{recipeId}

Soft delete a recipe.

**Path Parameters:**

- `recipeId`: UUID of the recipe

**Response:**

```json
{
  "success": true,
  "message": "Recipe deleted successfully"
}
```

---

## File Upload API

### POST /v1/recipes/{recipeId}/photo

Upload a photo for a recipe.

**Path Parameters:**

- `recipeId`: UUID of the recipe

**Request Body:** (multipart/form-data)

- `photo`: Image file (JPEG, PNG, WebP, max 5MB)

**Response:**

```json
{
  "photoUrl": "https://recipearchive-storage-dev-[ACCOUNT-ID].s3.us-west-2.amazonaws.com/signed-url",
  "thumbnailUrl": "https://recipearchive-storage-dev-[ACCOUNT-ID].s3.us-west-2.amazonaws.com/thumb-signed-url"
}
```

### POST /v1/recipes/{recipeId}/archive

Upload HTML archive for a recipe.

**Path Parameters:**

- `recipeId`: UUID of the recipe

**Request Body:**

```json
{
  "html": "<html>...</html>",
  "sourceUrl": "https://example.com/recipe"
}
```

**Response:**

```json
{
  "archiveUrl": "https://recipearchive-storage-dev-[ACCOUNT-ID].s3.us-west-2.amazonaws.com/archive-signed-url"
}
```

---

## User Management API

### GET /v1/user/profile

Get current user profile.

**Response:**

```json
{
  "user": {
    "userId": "us-west-2:12345...",
    "email": "user@example.com",
    "givenName": "John",
    "familyName": "Doe",
    "emailVerified": true,
    "createdAt": "2025-08-20T10:00:00Z",
    "lastLogin": "2025-08-24T16:00:00Z"
  },
  "stats": {
    "totalRecipes": 127,
    "recipesThisMonth": 23,
    "storageUsedMB": 45.7,
    "lastRecipeAdded": "2025-08-24T15:30:00Z"
  }
}
```

### PUT /v1/user/profile

Update user profile.

**Request Body:**

```json
{
  "givenName": "John",
  "familyName": "Doe"
}
```

### DELETE /v1/user/account

Delete user account and all data.

**Response:**

```json
{
  "success": true,
  "message": "Account deletion initiated. Data will be permanently removed within 24 hours."
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "title",
      "issue": "Title cannot be empty"
    },
    "timestamp": "2025-08-24T16:30:00Z",
    "requestId": "req-uuid-1234"
  }
}
```

### Error Codes

| Code                      | HTTP Status | Description                      |
| ------------------------- | ----------- | -------------------------------- |
| `AUTHENTICATION_REQUIRED` | 401         | JWT token missing or invalid     |
| `AUTHORIZATION_FAILED`    | 403         | User not authorized for resource |
| `RESOURCE_NOT_FOUND`      | 404         | Recipe or resource not found     |
| `VALIDATION_ERROR`        | 400         | Request data validation failed   |
| `DUPLICATE_RESOURCE`      | 409         | Resource already exists          |
| `RATE_LIMIT_EXCEEDED`     | 429         | Too many requests                |
| `SERVER_ERROR`            | 500         | Internal server error            |
| `SERVICE_UNAVAILABLE`     | 503         | Temporary service outage         |

---

## Rate Limiting

To stay within AWS Free Tier limits:

- **Authenticated requests**: 100 requests per minute per user
- **File uploads**: 10 uploads per minute per user
- **Bulk operations**: 5 requests per minute per user

Rate limit headers included in responses:

```http
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1692889200
```

---

## Performance Standards

Based on the performance requirements from the PRDs:

- **API Response Time**: <300ms for all endpoints (95th percentile)
- **File Upload Time**: <5s for photos up to 5MB
- **Search Response**: <500ms for recipe search queries
- **Availability**: 99.9% uptime target

---

## AWS Free Tier Considerations

### DynamoDB Optimization

- Use composite keys for efficient queries
- Minimize scan operations
- Stay within 25 RCU/WCU limits

### S3 Optimization

- Use presigned URLs for direct client uploads
- Implement image compression for thumbnails
- Stay within 5GB storage limit with lifecycle policies

### Lambda Optimization

- Keep functions warm with scheduled pings
- Optimize memory allocation (128MB-256MB)
- Stay within 1M requests/month limit

### API Gateway Optimization

- Enable response caching where appropriate
- Use request validation to reduce Lambda invocations
- Stay within 1M requests/month limit

---

## Security Considerations

### Data Protection

- All data encrypted at rest (DynamoDB, S3)
- All data encrypted in transit (HTTPS only)
- JWT tokens validated on every request

### Access Control

- User isolation via userId in all DynamoDB queries
- S3 bucket policies prevent cross-user access
- No public read access to any resources

### Input Validation

- Strict schema validation for all requests
- File type and size validation for uploads
- SQL injection prevention (parameterized queries)

---

## Development Workflow

### 1. Implement Core CRUD Operations

- Start with `POST /v1/recipes` (recipe creation)
- Then `GET /v1/recipes` (list recipes)
- Add `GET /v1/recipes/{id}` (single recipe)
- Implement `PUT` and `DELETE` operations

### 2. Add File Management

- Photo upload with S3 presigned URLs
- HTML archive storage
- Image optimization and thumbnails

### 3. Enhanced Features

- Search functionality
- User profile management
- Analytics and usage stats

### 4. Performance Optimization

- Response caching
- Database query optimization
- Lambda cold start mitigation
