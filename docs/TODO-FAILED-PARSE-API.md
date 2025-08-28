# TODO: Failed-to-Parse API Integration

## Overview
After fixing the current AWS 500 error, implement a fallback system that uses failed-to-parse APIs when recipe extraction fails.

## Why This is Important
- Websites change their structure frequently, breaking our parsers
- Having a fallback ensures users can still capture recipes even when our specific parsers fail
- Provides graceful degradation of functionality

## Implementation Plan

### 1. Detection Logic
```javascript
// In both Chrome and Safari extensions
function shouldUseFallbackAPI(extractedRecipe) {
    return !extractedRecipe || 
           !extractedRecipe.ingredients || 
           extractedRecipe.ingredients.length === 0 ||
           !extractedRecipe.instructions ||
           extractedRecipe.instructions.length === 0;
}
```

### 2. Fallback Flow
1. Try normal recipe extraction
2. If extraction fails or returns insufficient data:
   - Send page URL + HTML to failed-parse API
   - API attempts alternative parsing methods
   - Returns structured recipe data or manual entry prompt
3. Present results to user for review/editing

### 3. Failed-Parse API Requirements
- **Endpoint**: `/v1/recipes/parse-failed`
- **Method**: POST
- **Payload**: 
  ```json
  {
    "url": "https://example.com/recipe",
    "html": "<html>...</html>",
    "userAgent": "RecipeArchive Extension v1.0"
  }
  ```
- **Response**: Same format as regular recipe extraction

### 4. User Experience
- Show "Advanced parsing..." message
- Allow manual editing if API also fails
- Provide feedback mechanism for parser improvements

### 5. Implementation Files to Modify
- `extensions/chrome/popup.js` - Add fallback logic
- `extensions/safari/popup.js` - Add fallback logic  
- `extensions/chrome/content.js` - Enhanced extraction methods
- `extensions/safari/content.js` - Enhanced extraction methods
- `aws-backend/functions/` - New parse-failed endpoint

## Next Steps
1. ✅ Fix current AWS 500 error
2. ⏳ Implement failed-parse API endpoint
3. ⏳ Add fallback logic to extensions
4. ⏳ Add user feedback collection
5. ⏳ Test with problematic websites

---
*Created: August 27, 2025*
*Priority: High (after current bug fix)*
