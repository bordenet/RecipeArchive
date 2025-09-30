# Search Feature Requirements Clarification

**See also:** [Website Parsers Architecture Decision Record](./website-parsers.md)

## Document Status: **Active**

Search functionality for RecipeArchive v1.0.0.

## Search Types

### Recipe Library Search (Included)

Search and filter within user's personal saved recipe collection.

**Functionality:**
- Text Search: By recipe title, ingredient names
- Filter Options: Date range, cook/prep time, servings, source website
- Sort Options: Alphabetical, chronological, recently accessed
- Scope: Only user's saved recipes

### Recipe Discovery (Excluded)

Finding new recipes from external sources is not implemented:
- No external recipe website search
- No recipe recommendations
- No social recipe sharing/browsing

## Implementation

### Search API: `GET /recipes/search`

**Query Parameters**:

```typescript
interface SearchParams {
  q?: string; // Text search in title and ingredients
  dateFrom?: string; // ISO date filter (created after)
  dateTo?: string; // ISO date filter (created before)
  maxPrepTime?: number; // Maximum prep time (minutes)
  maxCookTime?: number; // Maximum cook time (minutes)
  source?: string; // Filter by source domain
  sortBy?: 'title' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number; // Results per page (max 50)
  offset?: number; // Pagination offset
}
```

**Response Format**:

```typescript
interface SearchResponse {
  recipes: Recipe[]; // Array of matching recipes
  total: number; // Total matching results
  hasMore: boolean; // Whether more results exist
  searchTime: number; // Search execution time (ms)
}
```

### Search Strategy

**Current Implementation:**
- Load all user recipes from S3
- In-memory filtering in Lambda
- Text matching on title and ingredients
- Filter by metadata fields
- Sort by specified field

**Performance:**
- Target: <500ms for typical user recipe collection
- Scales to hundreds of recipes per user
- No additional infrastructure cost (no OpenSearch/ElasticSearch)
