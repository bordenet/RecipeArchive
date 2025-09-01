# Failed Parse Workflow Plan

## Overview
When browser extensions fail to parse recipes from supported sites, this workflow provides fallback mechanisms through the backend to ensure recipe capture success.

## Workflow Architecture

### 1. Extension-Level Detection
**Trigger Conditions:**
- Parser returns null/undefined recipe object
- Required fields missing (title, ingredients, or instructions)
- Parsing timeout (>30 seconds)
- DOM structure changes on supported sites

**Extension Response:**
```javascript
if (!parsedRecipe || !parsedRecipe.title || !parsedRecipe.ingredients?.length) {
  return await submitFailedParse(url, htmlContent, userContext);
}
```

### 2. Backend Processing Pipeline

#### Stage 1: Diagnostic Collection
**Endpoint:** `POST /v1/recipes/failed-parse`
**Payload:**
```json
{
  "url": "https://example.com/recipe",
  "htmlContent": "compressed+base64_encoded_html", 
  "userAgent": "Chrome/Safari extension",
  "timestamp": "2025-09-01T12:00:00Z",
  "userId": "user-uuid",
  "parserAttempted": "site-name",
  "errorDetails": "specific_error_description"
}
```

#### Stage 2: Backend Parser Retry
1. **Lambda Function**: `RecipeArchive-FailedParseProcessor`
2. **Process**: 
   - Decompress HTML content
   - Apply server-side parsers with enhanced selectors
   - Try alternative parsing strategies (JSON-LD, microdata, fallback CSS)
   - Generate structured recipe data

#### Stage 3: OpenAI Content Enhancement (Optional)
If backend parsing partially succeeds but data quality is poor:
```
OpenAI Prompt: "Extract and structure recipe data from this HTML:
- Normalize ingredient formatting
- Clean instruction text  
- Infer missing fields (prep time, servings)
- Standardize measurements"
```

#### Stage 4: Response & Storage
**Success Response:**
```json
{
  "success": true,
  "recipe": {/* structured recipe data */},
  "method": "backend-parser|openai-enhanced",
  "processingTime": 2.3
}
```

**Failure Response:**
```json
{
  "success": false,
  "fallbackUrl": "https://recipearchive.app/manual-entry?url=...",
  "supportTicket": "ticket-uuid"
}
```

### 3. Flutter App Integration

#### Failed Parse Notification
```dart
class FailedParseHandler {
  static void showRetryDialog(String url) {
    // Show user-friendly dialog with options:
    // 1. "Try Again" - re-attempt parsing  
    // 2. "Manual Entry" - open form pre-filled with URL
    // 3. "Report Issue" - submit feedback
  }
}
```

#### Manual Entry Fallback
- Pre-populate form with URL and site name
- Allow user to paste/edit recipe content
- Suggest similar recipes from database
- Save as user-contributed content

## Implementation Priority

### Phase 1: Basic Backend Fallback
- [ ] Create failed parse endpoint
- [ ] Implement server-side parser retry
- [ ] Add diagnostic logging

### Phase 2: Enhanced Processing  
- [ ] OpenAI integration for content cleaning
- [ ] Alternative parser strategies
- [ ] Quality scoring system

### Phase 3: User Experience
- [ ] Flutter app retry dialogs
- [ ] Manual entry forms
- [ ] Support ticket system

## Success Metrics
- Parse success rate improvement: Target >95%
- User retry completion: Target >60% 
- Support ticket volume: Reduce by 40%
- Processing time: <5 seconds average

## Database Schema

### FailedParses Table
```sql
CREATE TABLE failed_parses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  site_name TEXT,
  html_content TEXT, -- compressed
  error_type TEXT,
  created_at TIMESTAMP,
  resolution_status TEXT, -- pending|resolved|manual_entry
  backend_success BOOLEAN DEFAULT FALSE,
  processing_time_ms INTEGER
);
```

### ParseRetries Table  
```sql
CREATE TABLE parse_retries (
  id UUID PRIMARY KEY,
  failed_parse_id UUID REFERENCES failed_parses(id),
  method TEXT, -- backend|openai|manual
  success BOOLEAN,
  recipe_data JSONB,
  created_at TIMESTAMP
);
```

## Error Handling Strategy

1. **Extension Timeout**: 30s max, then submit to backend
2. **Backend Timeout**: 60s max, then manual fallback  
3. **OpenAI Rate Limits**: Queue requests, retry with exponential backoff
4. **Storage Failures**: Log for analysis, continue with next method

This workflow ensures comprehensive coverage while maintaining user experience quality.