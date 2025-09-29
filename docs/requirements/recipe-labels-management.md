# Recipe Labels Management Requirements

## Overview

RecipeArchive MUST provide comprehensive label (tag) management functionality on recipe details pages, enabling users to easily organize and categorize their personal recipe collections.

## Critical Label Management Requirements

### P1: Easy Label Management

- **Full CRUD operations**: Create, read, update, delete labels directly on recipe details pages
- **Intuitive interface**: Labels displayed prominently beneath recipe instructions
- **Real-time updates**: Label changes applied immediately without page refresh
- **Duplicate prevention**: Comprehensive duplicate detection and prevention across all tag operations

### P2: Label Organization

- **Multiple label types**: Support for various tag categories (user, semantic, dietary, etc.)
- **Label standardization**: Consistent formatting and normalization of user inputs
- **Bulk operations**: Ability to manage labels across multiple recipes efficiently
- **Search integration**: Labels fully integrated with search and filtering functionality

## Label Management Interface

### Details Page Integration

- **Prominent placement**: Labels section directly beneath recipe instructions
- **Visual hierarchy**: Clear distinction between different label types
- **Edit mode toggle**: Switch between view and edit modes for label management
- **Mobile optimization**: Touch-friendly interface for mobile recipe viewing

### Label Display Structure

```javascript
{
  "labelSections": {
    "mealType": {
      "label": "Meal Type",
      "tags": ["dinner", "lunch"],
      "editable": true,
      "multiSelect": true
    },
    "dietaryTags": {
      "label": "Dietary",
      "tags": ["vegetarian", "gluten-free"],
      "editable": true,
      "suggestions": ["vegan", "dairy-free", "keto", "paleo"]
    },
    "cookingMethods": {
      "label": "Cooking Methods",
      "tags": ["baked", "sautéed"],
      "editable": true,
      "suggestions": ["grilled", "roasted", "slow-cooked"]
    },
    "userTags": {
      "label": "My Tags",
      "tags": ["family-favorite", "quick-weeknight"],
      "editable": true,
      "freeform": true
    }
  }
}
```

## Label Types and Categories

### System-Generated Labels

- **Meal Type**: breakfast, brunch, lunch, dinner, snack, dessert, drink, appetizer
- **Cuisine Type**: italian, mexican, asian, mediterranean, american, french, indian
- **Cooking Methods**: baked, grilled, sautéed, roasted, slow-cooked, instant-pot, air-fryer
- **Difficulty**: beginner, intermediate, advanced
- **Equipment**: oven, stovetop, grill, slow-cooker, instant-pot, food-processor

### Dietary and Health Labels

- **Dietary Restrictions**: vegetarian, vegan, gluten-free, dairy-free, nut-free
- **Health Focus**: low-carb, keto, paleo, whole30, heart-healthy, low-sodium
- **Special Diets**: mediterranean, dash, plant-based, raw, sugar-free

### User-Generated Labels

- **Personal Tags**: Custom labels created by users (e.g., "mom's-recipe", "date-night")
- **Occasion Tags**: holiday, entertaining, meal-prep, weeknight-dinner, comfort-food
- **Season Tags**: spring, summer, fall, winter, seasonal-ingredients
- **Preference Tags**: family-favorite, tried-and-true, want-to-try, needs-tweaking

## Label Management Operations

### Adding Labels

```javascript
// Add label interface
{
  "addLabelOperation": {
    "input": "text field with autocomplete",
    "suggestions": "context-aware suggestions based on existing labels",
    "validation": "duplicate detection and format normalization",
    "confirmation": "immediate visual feedback on successful add"
  }
}
```

### Editing Labels

- **Inline editing**: Click/tap to edit existing labels directly
- **Bulk selection**: Select multiple labels for batch operations
- **Category management**: Move labels between categories as needed
- **Label merging**: Combine similar labels into single standardized version

### Removing Labels

- **Individual removal**: Remove single labels with confirmation
- **Batch removal**: Remove multiple selected labels at once
- **Undo functionality**: Short-term undo for accidental label removals
- **Cascade handling**: Handle label removal across recipe relationships

## Duplicate Prevention System

### Comprehensive Duplicate Detection

- **Case-insensitive matching**: "Italian" and "italian" treated as duplicates
- **Whitespace normalization**: "quick meal" and "quick-meal" handled consistently
- **Synonym detection**: "vegetarian" and "veggie" flagged as potential duplicates
- **Category-aware prevention**: Prevent same label in multiple categories

### Automatic Standardization

```javascript
{
  "labelNormalization": {
    "caseStandardization": "lowercase with proper capitalization for display",
    "whitespaceHandling": "trim and normalize internal spaces",
    "characterCleaning": "remove special characters and standardize punctuation",
    "synonymMapping": "map common synonyms to canonical forms"
  }
}
```

### Bulk Deduplication Tools

- **System-wide deduplication**: Clean up existing duplicate labels across all recipes
- **User-initiated cleanup**: Manual deduplication tools for user control
- **Migration support**: Handle duplicates during data imports and migrations
- **Reporting**: Identify and report potential duplicate issues

## Advanced Label Features

### Label Suggestions and Autocomplete

- **Smart suggestions**: Based on recipe content and existing user labels
- **Popular labels**: Suggest commonly used labels for similar recipes
- **Contextual recommendations**: Labels appropriate for specific recipe types
- **Learning system**: Improve suggestions based on user labeling patterns

### Label Analytics

```javascript
{
  "labelInsights": {
    "mostUsedLabels": "top 10 labels by frequency",
    "unusedLabels": "labels not applied to any recipes",
    "labelTrends": "labeling patterns over time",
    "categoryDistribution": "label distribution across categories"
  }
}
```

### Label-Based Organization

- **Label clouds**: Visual representation of label frequency and usage
- **Label hierarchies**: Organize related labels into hierarchical structures
- **Label collections**: Group related labels for batch application
- **Custom label templates**: Predefined label sets for specific recipe types

## Search and Filter Integration

### Label-Based Search

- **Individual label search**: Find all recipes with specific labels
- **Multi-label AND/OR queries**: Complex label combination searches
- **Label exclusion**: Find recipes without specific labels
- **Related label suggestions**: Suggest related labels during search

### Advanced Filter Combinations

```javascript
{
  "labelFilters": {
    "includeAny": ["italian", "pasta"],           // OR logic
    "includeAll": ["vegetarian", "quick"],       // AND logic
    "exclude": ["gluten-free"],                  // NOT logic
    "categories": {
      "mealType": ["dinner"],
      "difficulty": ["beginner", "intermediate"]
    }
  }
}
```

## Performance and Scalability

### Efficient Label Operations

- **Fast label queries**: Sub-second response for label-based searches
- **Optimized storage**: Efficient tag storage and indexing strategies
- **Batch operations**: Handle bulk label changes efficiently
- **Memory management**: Minimize memory usage for large label collections

### Scalability Considerations

- **Large recipe collections**: Handle 500+ recipes per user efficiently
- **Complex label hierarchies**: Support deep label organizational structures
- **High-frequency updates**: Handle frequent label modifications smoothly
- **Cross-device synchronization**: Ensure label changes sync across devices

## Data Model and Storage

### Label Storage Schema

```json
{
  "recipeLabels": {
    "recipeId": "UUID",
    "userId": "UUID",
    "labels": {
      "mealType": ["dinner", "lunch"],
      "dietaryTags": ["vegetarian"],
      "cookingMethods": ["baked"],
      "userTags": ["family-favorite", "quick-weeknight"],
      "systemGenerated": ["italian", "intermediate"],
      "semanticTags": ["comfort-food", "crowd-pleaser"]
    },
    "lastUpdated": "ISO8601 timestamp",
    "version": "integer for conflict resolution"
  }
}
```

### Label Validation Rules

```javascript
{
  "labelValidation": {
    "maxLength": 50,
    "allowedCharacters": "alphanumeric, hyphens, spaces, apostrophes",
    "minLength": 2,
    "maxLabelsPerCategory": 20,
    "maxTotalLabelsPerRecipe": 50,
    "duplicateHandling": "prevent with user notification"
  }
}
```

## User Experience Design

### Visual Design Principles

- **Clear visual hierarchy**: Distinguish between label categories
- **Intuitive interactions**: Self-evident label management operations
- **Responsive design**: Consistent experience across device sizes
- **Accessibility**: Screen reader support and keyboard navigation

### Interaction Patterns

- **Add labels**: Plus button or type-to-add interface
- **Remove labels**: X button or swipe-to-delete on mobile
- **Edit labels**: Click to edit existing labels inline
- **Batch operations**: Selection interface for multi-label management

### Error Handling and Feedback

- **Validation messages**: Clear feedback for invalid label inputs
- **Duplicate notifications**: Inform users about prevented duplicates
- **Operation confirmation**: Visual confirmation of successful operations
- **Undo capabilities**: Temporary undo for accidental changes

## Integration Requirements

### Flutter App Integration

```dart
// Label management widget
class RecipeLabelManager extends StatefulWidget {
  final Recipe recipe;
  final Function(Map<String, List<String>>) onLabelsChanged;

  // Features:
  // - Categorized label display
  // - Inline editing capabilities
  // - Autocomplete suggestions
  // - Duplicate prevention
  // - Real-time updates
}
```

### API Integration

```javascript
// Label management endpoints
PUT /recipes/{recipeId}/labels
{
  "labels": {
    "mealType": ["dinner"],
    "userTags": ["family-favorite", "quick"]
  }
}

GET /v1/users/labels/suggestions?category=dietary
{
  "suggestions": ["vegetarian", "vegan", "gluten-free", "dairy-free"]
}

POST /v1/users/labels/deduplicate
{
  "action": "merge|remove",
  "duplicateGroups": [["italian", "Italian"], ["quick", "quick-meal"]]
}
```

## Success Metrics

### User Engagement

- **Label usage**: >70% of recipes have at least one user-applied label
- **Label diversity**: Users apply labels from multiple categories
- **Label editing**: >50% of users modify labels after initial application
- **Search usage**: >40% of searches include label-based filters

### System Performance

- **Label operation speed**: <500ms for add/remove operations
- **Search performance**: <1 second for complex label-based queries
- **Deduplication efficiency**: >95% duplicate prevention success rate
- **Data consistency**: Zero label data corruption or inconsistencies

### User Satisfaction

- **Intuitive interface**: Users easily understand label management
- **Organizational value**: Labels help users organize recipe collections
- **Search effectiveness**: Label-based searches return relevant results
- **Feature adoption**: High usage of advanced label features

## Cross-References

- [recipe-schema-normalization.md](./recipe-schema-normalization.md): Label fields in recipe schema
- [search-functionality.md](./search-functionality.md): Label-based search and filtering
- [web-extension-parsing.md](./web-extension-parsing.md): Automatic label generation during import
- [backup-restore-versioning.md](./backup-restore-versioning.md): Label data in backup operations
