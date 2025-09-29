# Recipe Ratings System Requirements

## Overview

RecipeArchive MUST provide a private, whole-number star rating system visible on both gallery and details pages, enabling users to rate and organize their personal recipe collections.

## Critical Rating Requirements

### P1: Private Rating System

- **Personal ratings only**: Each user sees ONLY their own ratings, zero rating aggregation across users
- **Whole-number stars**: 1-5 star ratings displayed as integers (show "4", not "4.0")
- **Dual visibility**: Ratings visible on both gallery page cards AND recipe details pages
- **Persistent ratings**: Ratings saved across sessions with proper state management

### P2: User Experience

- **Interactive rating controls** on recipe details pages for setting/changing ratings
- **Visual rating badges** on gallery page recipe cards showing current rating
- **Immediate feedback** with real-time rating updates without page refresh
- **Clear rating status** indicating unrated vs rated recipes

## Rating System Architecture

### Data Model

```json
{
  "recipeRating": {
    "recipeId": "UUID",
    "userId": "UUID",
    "personalRating": "integer (1-5, null if unrated)",
    "ratedAt": "ISO8601 timestamp",
    "lastUpdated": "ISO8601 timestamp",
    "personalNotes": "string (optional)",
    "makeCount": "integer (optional tracking)"
  }
}
```

### Database Storage

- **Recipe model integration**: `personalRating` field in main recipe schema
- **User-specific storage**: Ratings tied to authenticated user ID
- **Efficient querying**: Indexed for fast gallery page rating display
- **Atomic updates**: Rating changes applied instantly without data loss

## User Interface Requirements

### Gallery Page Display

- **Rating badges**: Small star indicator showing rating number
- **Visual prominence**: Clear visibility without overwhelming recipe card design
- **Consistent positioning**: Same location on all recipe cards
- **Unrated indication**: Clear visual state for recipes without ratings

```javascript
// Gallery card rating display
{
  "ratingBadge": {
    "position": "top-right corner of recipe card",
    "style": "star icon + number (e.g., ⭐ 4)",
    "unratedState": "no badge shown",
    "colors": {
      "rated": "yellow star with dark text",
      "background": "semi-transparent white"
    }
  }
}
```

### Recipe Details Page

- **Interactive star rating widget**: Clickable 5-star control for rating input
- **Current rating display**: Show existing rating prominently
- **Rating change feedback**: Immediate visual confirmation of rating updates
- **Rating removal**: Option to remove/clear existing rating

```javascript
// Interactive rating widget specification
{
  "starRatingWidget": {
    "type": "InteractiveStarRating",
    "starCount": 5,
    "allowHalfStars": false,
    "displayMode": "wholeNumbers",
    "feedback": "immediate visual update",
    "clearOption": true
  }
}
```

## Rating Behavior and Logic

### Rating Input Rules

- **Whole numbers only**: Accept ratings 1, 2, 3, 4, 5 (no decimals)
- **Single rating per recipe**: One rating per user per recipe (update existing)
- **Optional rating**: Users not required to rate recipes
- **Rating removal**: Allow users to remove ratings (set to null)

### Rating Persistence

- **Real-time saving**: Rating changes saved immediately to backend
- **State synchronization**: Rating updates reflected across all app views
- **Offline handling**: Queue rating changes for sync when network available
- **Conflict resolution**: Last-write-wins for concurrent rating updates

### Privacy and Security

- **User isolation**: Ratings completely private to rating user
- **No aggregation**: Zero cross-user rating visibility or averaging
- **No social features**: No sharing, commenting, or social aspects
- **Secure storage**: Ratings tied to authenticated user sessions

## Performance Requirements

### Loading Performance

- **Gallery page**: Rating badges load with recipe cards (<2 seconds)
- **Details page**: Rating widget available immediately on page load
- **Rating updates**: <500ms response time for rating changes
- **Batch loading**: Efficient bulk rating queries for gallery display

### Storage Efficiency

- **Minimal storage overhead**: Ratings add <1KB per rated recipe
- **Efficient indexing**: Fast queries for user's rated recipes
- **Cleanup procedures**: Remove ratings for deleted recipes
- **Archive handling**: Maintain ratings through recipe backup/restore

## Integration Requirements

### Flutter App Integration

```dart
// Rating widget integration
class InteractiveStarRating extends StatefulWidget {
  final int? currentRating;
  final Function(int?) onRatingChanged;
  final bool readOnly;

  // Implementation ensures:
  // - Whole number display (show "4" not "4.0")
  // - Immediate visual feedback
  // - Proper state management
  // - Integration with recipe provider
}
```

### API Integration

```javascript
// Rating endpoints
PUT /recipes/{recipeId}/rating
{
  "personalRating": 4  // 1-5 or null to clear
}

GET /recipes/{recipeId}/rating
{
  "personalRating": 4,
  "ratedAt": "2025-09-09T12:00:00Z"
}

// Batch rating queries for gallery
GET /recipes/ratings?recipeIds=id1,id2,id3
{
  "ratings": [
    {"recipeId": "id1", "personalRating": 4},
    {"recipeId": "id2", "personalRating": null},
    {"recipeId": "id3", "personalRating": 5}
  ]
}
```

### Provider State Management

- **Recipe provider integration**: Ratings included in recipe model
- **State consistency**: Rating changes update all relevant views
- **Optimistic updates**: UI updates immediately, sync with backend asynchronously
- **Error handling**: Rollback UI changes if backend update fails

## Advanced Rating Features

### Rating Analytics (Private)

- **Personal statistics**: User's rating distribution and patterns
- **Highly rated recipes**: Easy access to 4-5 star favorites
- **Rating history**: Timeline of when recipes were rated
- **Rating trends**: Personal rating patterns over time

### Recipe Organization

- **Rating-based filtering**: Show only 4-5 star recipes
- **Rating-based sorting**: Order recipes by personal rating
- **Unrated recipe identification**: Find recipes needing ratings
- **Favorite recipe shortcuts**: Quick access to highest-rated recipes

### Search Integration

```javascript
// Search with rating filters
{
  "searchQuery": "pasta",
  "filters": {
    "personalRating": {"min": 4, "max": 5},
    "unratedOnly": false,
    "sortBy": "personalRating"
  }
}
```

## Backup and Migration

### Rating Data Protection

- **Backup inclusion**: Ratings included in recipe backup/restore
- **Schema versioning**: Rating field changes handled in migrations
- **Data integrity**: Rating validation during backup operations
- **Cross-device sync**: Ratings available on all user devices

### Migration Considerations

- **Legacy rating support**: Handle existing rating data formats
- **Schema evolution**: Support rating field additions/changes
- **Data validation**: Ensure rating values within valid range (1-5)
- **Cleanup procedures**: Remove orphaned ratings for deleted recipes

## Quality Assurance

### Testing Requirements

- **Rating widget testing**: Verify interactive star control functionality
- **Cross-platform testing**: Consistent behavior web/mobile
- **State management testing**: Rating updates reflected across views
- **Performance testing**: Gallery page load times with rating badges

### Validation Rules

```javascript
{
  "ratingValidation": {
    "allowedValues": [null, 1, 2, 3, 4, 5],
    "dataType": "integer or null",
    "userOwnership": "rating.userId must match authenticated user",
    "recipeExists": "recipe must exist and be accessible to user"
  }
}
```

## User Experience Specifications

### Visual Design

- **Star icons**: Clear, recognizable star symbols
- **Color scheme**: Yellow/gold stars for rated, gray for unrated
- **Size consistency**: Appropriate sizing for gallery vs details contexts
- **Accessibility**: Screen reader support and keyboard navigation

### Interaction Design

- **Click to rate**: Single click/tap sets rating
- **Visual feedback**: Immediate star fill/color change
- **Confirmation**: Brief visual confirmation of rating save
- **Error handling**: Clear error messages for failed rating updates

### Mobile Optimization

- **Touch targets**: Appropriately sized for finger interaction
- **Gesture support**: Tap to rate, swipe for other actions
- **Visual clarity**: Ratings clearly visible on smaller screens
- **Performance**: Smooth animations and responsive interactions

## Success Metrics

### User Engagement

- **Rating adoption**: >60% of users rate at least one recipe
- **Rating coverage**: >40% of user recipes have ratings
- **Rating consistency**: <5% rating changes after initial rating
- **Feature usage**: >80% of users use rating-based filtering

### Technical Performance

- **Loading speed**: Gallery rating badges load in <2 seconds
- **Update responsiveness**: Rating changes applied in <500ms
- **State consistency**: 100% rating synchronization across views
- **Data integrity**: Zero rating data corruption or loss

### User Satisfaction

- **Intuitive interface**: Users easily understand rating system
- **Reliable functionality**: Consistent rating behavior across platforms
- **Privacy confidence**: Users understand ratings are private
- **Useful organization**: Ratings help users organize recipe collections

## Cross-References

- [recipe-schema-normalization.md](./recipe-schema-normalization.md): Rating fields in recipe schema
- [search-functionality.md](./search-functionality.md): Rating-based search and filtering
- [backup-restore-versioning.md](./backup-restore-versioning.md): Rating data in backup operations
- [flutter-pagination.md](./flutter-pagination.md): Rating display in paginated gallery views
