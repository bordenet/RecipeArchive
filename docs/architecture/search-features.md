# Search Feature Requirements Clarification

## Document Status: **URGENT RESOLUTION REQUIRED**

**Date**: August 24, 2025  
**Issue**: Critical feature scope conflict across PRDs

## Problem Statement

**CRITICAL CONFLICT IDENTIFIED**:

- **Browser Extension PRD**: **EXCLUDES** "Recipe search/discovery"
- **iOS App PRD**: **REQUIRES** "Search/filter by name, ingredient, date"
- **Website PRD**: **REQUIRES** "Search/filter by name, ingredient, date"

This creates incompatible feature requirements that block development.

## Root Cause Analysis

The conflict stems from **ambiguous terminology** mixing two distinct concepts:

1. **Recipe Discovery**: Finding NEW recipes from external sources/websites
2. **Recipe Library Search**: Searching within user's personal saved recipe collection

## Proposed Resolution: Clarified Feature Definitions

### ✅ **INCLUDED: Recipe Library Search** (All Platforms)

**Definition**: Search and filter within user's personal saved recipe collection

**Required Functionality**:

- **Text Search**: Search by recipe title, ingredient names
- **Filter Options**:
  - By date range (created/modified)
  - By cook time / prep time
  - By servings count
  - By source website
- **Sort Options**:
  - Alphabetical (A-Z, Z-A)
  - Chronological (newest first, oldest first)
  - Recently accessed
- **Search Scope**: Only user's saved recipes, never external content

### ❌ **EXCLUDED: Recipe Discovery** (All Platforms - MVP)

**Definition**: Finding new recipes from external sources or recipe databases

**Explicitly Excluded**:

- Searching external recipe websites
- Recipe recommendation engines
- "Discover new recipes" features
- Social recipe sharing/browsing
- Recipe aggregation from multiple sources

## Updated Platform Requirements

### Browser Extension

**CHANGE REQUIRED**: Update exclusions list for clarity

- **Remove**: "Recipe search/discovery" (ambiguous)
- **Add to Inclusions**: "Recipe library search within saved recipes"
- **Add to Exclusions**: "External recipe discovery and recommendations"

### iOS App

**NO CHANGE REQUIRED**: Already correctly specifies library search functionality

- ✅ "Search/filter by name, ingredient, date" = Recipe library search

### Website

**NO CHANGE REQUIRED**: Already correctly specifies library search functionality

- ✅ "Search/filter by name, ingredient, date" = Recipe library search

### AWS Backend

**ADDITION REQUIRED**: Add search API specifications

- **New Endpoint**: `GET /v1/recipes/search`
- **Search Indexing**: DynamoDB GSI for title and ingredient search
- **Performance Target**: <300ms search response times

## Implementation Specifications

### Search API Design

#### Endpoint: `GET /v1/recipes/search`

**Query Parameters**:

```typescript
interface SearchParams {
  q?: string; // Text search in title and ingredients
  dateFrom?: string; // ISO date filter (created after)
  dateTo?: string; // ISO date filter (created before)
  minServings?: number; // Minimum servings filter
  maxServings?: number; // Maximum servings filter
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

### Database Indexing Requirements

#### DynamoDB Global Secondary Indexes

1. **recipes-search-title**
   - Partition Key: `userId`
   - Sort Key: `title` (for alphabetical search)

2. **recipes-search-date**
   - Partition Key: `userId`
   - Sort Key: `createdAt` (for date range filtering)

#### Search Strategy

- **Text Search**: DynamoDB scan with FilterExpression (acceptable for MVP scale)
- **Future Enhancement**: Amazon OpenSearch for full-text search capabilities

### Browser Extension Search UI

#### Popup Search Interface

- **Search Bar**: Text input with real-time search suggestions
- **Quick Filters**: Buttons for "Recent", "Favorites", "This Week"
- **Results View**: List with recipe title, source, and thumbnail
- **Performance**: <500ms search response, local caching of recent searches

## PRD Update Requirements

### Browser Extension PRD Updates

**Section 6.2**: Replace exclusions language

```markdown
### 6.2 Explicitly Excluded (The "Not Now" List)

- External recipe discovery and recommendations
- Recipe search from external sources or databases
- Social features (sharing, comments)
- [... rest unchanged]
```

**Section 3**: Add search requirements

```markdown
### 3.4 Recipe Library Management

- Search within saved recipes by title and ingredients
- Filter by date, cook time, servings, source website
- Sort alphabetically or chronologically
- Quick access to recently viewed recipes
```

### AWS Backend PRD Updates

**Section 2**: Add search API endpoint

```markdown
### 2. API Endpoints

- GET /v1/recipes/search - Search and filter user's recipe library
- [... existing endpoints]
```

### iOS App & Website PRDs

**NO CHANGES REQUIRED**: Already correctly specify library search functionality

## Timeline Impact

- **No Development Delay**: This clarification doesn't change implementation scope
- **Backend Addition**: Search API adds ~3 days to backend development
- **Enhanced Value**: Unified search across all platforms improves user experience

---

**Immediate Actions Required**:

1. ✅ Get approval for this clarified search definition
2. Update Browser Extension PRD exclusions section
3. Update AWS Backend PRD with search API specifications
4. Update ../development/claude-context.md with resolved conflict status

**Resolution Deadline**: August 24, 2025 (today) - blocks further development
