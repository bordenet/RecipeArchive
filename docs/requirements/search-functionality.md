# Recipe Search and Discovery Requirements

## Overview

RecipeArchive MUST provide comprehensive search functionality across all recipe metadata with advanced ingredient-based discovery capabilities.

## Critical Search Requirements

### P1: Complete Searchability

- **Full searchability across ALL recipe metadata fields**
- **Advanced ingredient-based search with "what can I make" scenarios**
- **Multi-dimensional filtering** by time, meal type, genre, dietary restrictions
- **Real-time search** with sub-second response times across large recipe collections

### P2: Intelligent Discovery

- **Ingredient inventory search**: "I have tuna, bread, and mayonnaise. What can I make?"
- **Partial ingredient matching**: Recipes requiring subset of available ingredients
- **Substitution suggestions**: Alternative ingredients for missing items
- **Dietary accommodation**: Automatic filtering based on restrictions

## Core Search Dimensions

### Text-Based Search

- **Recipe titles**: Full-text search with fuzzy matching
- **Ingredients**: Individual ingredient name matching
- **Instructions**: Search within cooking steps and techniques
- **Description/notes**: User-added content and recipe descriptions
- **Source websites**: Filter by originating recipe sites

### Time-Based Filtering

```javascript
{
  "prepTimeMinutes": {"min": 0, "max": 180},
  "cookTimeMinutes": {"min": 0, "max": 480},
  "totalTimeMinutes": {"min": 0, "max": 600},
  "readyInMinutes": {"min": 0, "max": 720}
}
```

### Meal Type Classification

- **Breakfast**: Morning meals, cereals, breakfast pastries
- **Brunch**: Late morning combination meals
- **Lunch**: Midday meals, sandwiches, salads
- **Dinner**: Evening meals, main courses
- **Snack**: Light meals, appetizers
- **Dessert**: Sweet courses, baked goods
- **Drink**: Beverages, cocktails, smoothies
- **Appetizer**: Starter courses, small plates
- **Hors-doeuvre**: Party foods, canapés

### Genre and Cooking Style

- **Grilling**: Outdoor cooking, barbecue techniques
- **Soup**: Liquid-based dishes, broths, stews
- **Basics**: Fundamental techniques, building blocks
- **Baking**: Oven-based desserts and breads
- **One-pot**: Single vessel cooking
- **Quick meals**: 30-minute recipes
- **Slow cooking**: Braising, slow cooker recipes
- **International**: Cuisine-specific categories

### Dietary and Lifestyle Filters

- **Dietary restrictions**: Vegetarian, vegan, gluten-free, dairy-free, keto, paleo
- **Health focus**: Low-carb, high-protein, low-sodium, heart-healthy
- **Lifestyle**: Meal prep, kid-friendly, entertaining, weeknight dinners
- **Skill level**: Beginner, intermediate, advanced techniques

## Advanced Search Scenarios

### Ingredient Inventory Search

```javascript
// User query: "I have chicken breast, tomatoes, onions, garlic"
{
  "availableIngredients": ["chicken breast", "tomatoes", "onions", "garlic"],
  "searchType": "whatCanIMake",
  "options": {
    "exactMatch": false,           // Allow additional ingredients
    "maxAdditionalIngredients": 3, // Limit extra ingredients needed
    "allowSubstitutions": true,    // Suggest ingredient alternatives
    "sortBy": "fewestAdditional"   // Order by minimal extra ingredients
  }
}
```

### Advanced Filtering Combinations

```javascript
{
  "textSearch": "pasta",
  "mealType": ["lunch", "dinner"],
  "maxTotalTime": 45,
  "dietaryTags": ["vegetarian"],
  "cookingMethods": ["stovetop"],
  "difficulty": ["beginner", "intermediate"],
  "availableEquipment": ["stovetop", "oven"]
}
```

### Nutritional Search

```javascript
{
  "nutrition": {
    "maxCalories": 500,
    "minProtein": 20,
    "maxCarbs": 30,
    "minFiber": 5
  },
  "allergenFree": ["nuts", "shellfish"]
}
```

## Search Implementation Requirements

### Performance Standards

- **Sub-second response**: All search queries return results in <1000ms
- **Large collection support**: Efficient search across 500+ recipes per user
- **Real-time filtering**: Instant results as filters are applied/removed
- **Memory efficiency**: Minimal memory usage for search indices

### Search Architecture

- **In-memory search**: Lambda-based search without external dependencies
- **Cost optimization**: No ElasticSearch or external search services
- **Multi-tenant isolation**: Search scoped to authenticated user's recipes
- **Scalable indexing**: Efficient recipe indexing for fast retrieval

### Index Structure

```javascript
{
  "recipeId": "UUID",
  "searchableText": "combined title, ingredients, instructions",
  "ingredients": ["normalized ingredient names"],
  "primaryIngredients": ["main recipe components"],
  "mealTypes": ["breakfast", "dinner"],
  "cookingMethods": ["baked", "sautéed"],
  "totalTimeMinutes": 45,
  "difficulty": "intermediate",
  "dietaryTags": ["vegetarian", "gluten-free"]
}
```

## Intelligent Search Features

### Ingredient Matching Logic

1. **Exact Match**: Recipe uses only specified ingredients
2. **Subset Match**: Recipe requires subset of available ingredients
3. **Superset Match**: Recipe needs additional ingredients (show count)
4. **Substitution Match**: Recipe adaptable with ingredient substitutions

### Smart Suggestions

- **Related searches**: Based on current query and user history
- **Popular combinations**: Commonly searched ingredient combinations
- **Seasonal suggestions**: Time-appropriate recipe recommendations
- **Quick alternatives**: Faster versions of complex recipes

### Search Analytics

- **Query tracking**: Most common search terms and patterns
- **Result effectiveness**: Click-through rates on search results
- **Filter usage**: Most popular filter combinations
- **Performance monitoring**: Search response times and optimization opportunities

## User Experience Requirements

### Search Interface

- **Real-time suggestions**: Autocomplete for ingredients and search terms
- **Filter persistence**: Maintain filter state across sessions
- **Search history**: Quick access to recent searches
- **Clear all filters**: Easy reset of complex filter combinations

### Results Display

- **Relevance ranking**: Most relevant recipes first
- **Rich previews**: Image, time, difficulty, rating visible
- **Filter badges**: Clear indication of applied filters
- **Result count**: Total matches and pagination info

### Mobile Optimization

- **Touch-friendly filters**: Easy to apply/remove on mobile
- **Swipe navigation**: Intuitive result browsing
- **Voice search**: "Hey Siri, find pasta recipes under 30 minutes"
- **Offline capability**: Basic search functionality without network

## Advanced Scenarios

### "What Can I Make" Implementation

```javascript
function findRecipesByIngredients(availableIngredients, options = {}) {
  const recipes = getAllUserRecipes();

  return recipes
    .map((recipe) => ({
      recipe,
      matchScore: calculateIngredientMatch(
        recipe.ingredients,
        availableIngredients
      ),
      additionalIngredients: findMissingIngredients(
        recipe.ingredients,
        availableIngredients
      ),
      substitutionOptions: findSubstitutions(
        recipe.ingredients,
        availableIngredients
      ),
    }))
    .filter((result) => result.matchScore >= options.minMatchThreshold)
    .sort((a, b) => b.matchScore - a.matchScore);
}
```

### Dietary Accommodation

- **Automatic filtering**: Hide recipes containing restricted ingredients
- **Substitution suggestions**: Alternative ingredients for dietary needs
- **Nutritional warnings**: Alert for potential allergens or dietary conflicts
- **Custom dietary profiles**: Save and reuse dietary preference sets

### Recipe Discovery

- **Similar recipes**: Find variations of favorite dishes
- **Cuisine exploration**: Discover new international flavors
- **Technique-based search**: Find recipes using specific cooking methods
- **Equipment-based filtering**: Recipes for available kitchen tools

## Integration Requirements

### Flutter App Integration

- **Native search UI**: Optimized for mobile and web interfaces
- **Filter persistence**: State management across app sessions
- **Offline search**: Cached search indices for network-independent search
- **Cross-platform consistency**: Identical search behavior across platforms

### API Design

```javascript
// Search endpoint structure
POST /recipes/search
{
  "query": "chicken pasta",
  "filters": {
    "mealType": ["dinner"],
    "maxTotalTime": 60,
    "availableIngredients": ["chicken", "pasta"],
    "dietaryTags": ["gluten-free"]
  },
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### Performance Monitoring

- **Search latency tracking**: Monitor response times across query types
- **Memory usage monitoring**: Track search index memory consumption
- **User behavior analytics**: Search pattern analysis for optimization
- **A/B testing framework**: Test search algorithm improvements

## Success Metrics

### Search Performance

- **<1 second response time** for all search queries
- **>95% search success rate** (users find desired recipes)
- **Zero search downtime** with proper error handling
- **Efficient memory usage** (<100MB search indices per 500 recipes)

### User Engagement

- **High click-through rate** (>60%) on search results
- **Frequent use** of advanced filtering options
- **Positive feedback** on "what can I make" feature accuracy
- **Reduced recipe discovery time** compared to manual browsing

### Feature Adoption

- **>80% users** use text search functionality
- **>50% users** apply time-based filters
- **>40% users** utilize ingredient-based search
- **>30% users** leverage dietary filtering options

## Cross-References

- [recipe-schema-normalization.md](./recipe-schema-normalization.md): Schema fields enabling search functionality
- [web-extension-parsing.md](./web-extension-parsing.md): Recipe data extraction feeding search indices
- [recipe-ratings-system.md](./recipe-ratings-system.md): Rating integration in search results
- [flutter-pagination.md](./flutter-pagination.md): Large result set handling
