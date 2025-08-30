# Recipe Archive iPad App

A native iPad application optimized for large-screen recipe management with split-view navigation, two-column layouts, and iPad-specific user interactions.

## Features

- **Split-View Interface**: Master-detail navigation optimized for iPad's large screen
- **Two-Column Layouts**: Ingredients and instructions displayed side-by-side
- **Enhanced Search**: Full-width search with real-time filtering
- **User Authentication**: Secure sign-in with iPad-optimized layouts
- **Recipe Management**: Add, view, edit, and delete recipes with iPad-friendly forms
- **Responsive Design**: Adapts to portrait and landscape orientations
- **Multitasking Support**: Optimized for iPad multitasking and Stage Manager
- **Comprehensive Testing**: Unit tests and UI tests for iPad-specific functionality

## Requirements

- iPad running iPadOS 17.0 or later
- Xcode 15.0 or later
- Swift 5.9 or later

## Installation & Setup

### 1. Prerequisites

Ensure you have the latest version of Xcode installed from the Mac App Store or Apple Developer Portal.

### 2. Open the Project

```bash
cd /path/to/RecipeArchive/ipad_app
open RecipeArchiveiPad.xcodeproj
```

### 3. Build Configuration

The project includes three targets:
- **RecipeArchiveiPad**: Main iPad app (TARGETED_DEVICE_FAMILY = 2)
- **RecipeArchiveiPadTests**: Unit tests
- **RecipeArchiveiPadUITests**: UI automation tests for iPad interface

### 4. Run the App

1. Select an iPad simulator or physical iPad device
2. Press `Cmd+R` to build and run
3. The app will launch with the iPad-optimized login screen

## Project Structure

```
RecipeArchiveiPad/
├── RecipeArchiveApp.swift          # App entry point
├── ContentView.swift               # Main split-view wrapper
├── Models/
│   ├── Recipe.swift               # Recipe data model
│   └── User.swift                 # User data model
├── Services/
│   ├── AuthService.swift          # Authentication logic
│   └── RecipeService.swift        # Recipe management logic
└── Views/
    ├── LoginView.swift            # iPad split login screen
    ├── RecipeListView.swift       # Sidebar recipe list
    ├── RecipeDetailView.swift     # Two-column recipe details
    ├── AddRecipeView.swift        # Two-column recipe form
    └── ProfileView.swift          # Enhanced profile with stats
```

## iPad-Specific Features

### Split-View Navigation
- **Sidebar**: Recipe list with search and filtering
- **Detail Pane**: Recipe details or welcome screen
- **Persistent Selection**: Selected recipe remains visible during navigation

### Enhanced Login Screen
- **Two-Panel Design**: Feature showcase on left, login form on right
- **Larger Typography**: Optimized for iPad viewing distances
- **Contextual Information**: Feature highlights to engage users

### Recipe Detail Layout
- **Two-Column Design**: Ingredients on left, instructions on right
- **Enhanced Metadata**: Recipe statistics in grid layout
- **Action Menu**: Contextual actions via toolbar menu
- **Rich Typography**: Larger fonts and better spacing

### Add Recipe Form
- **Split Layout**: Basic info on left, ingredients/instructions on right
- **Section Organization**: Clear visual hierarchy
- **Enhanced Input Fields**: Larger touch targets and text areas
- **Smart Validation**: Real-time form validation

### Profile Interface
- **Statistics Cards**: Visual recipe collection overview
- **Preference Settings**: Toggle switches for app behavior
- **User Information**: Enhanced profile display with creation date

## Key Components

### Authentication Service
- Handles user sign-in, sign-up, and session management
- Simulates AWS Cognito integration
- Persistent authentication state across app launches

### Recipe Service  
- Manages recipe CRUD operations with performance optimizations
- Implements debounced search for smooth typing experience
- Handles large recipe collections efficiently

### iPad-Optimized Views
- **iPadMainView**: Split-view coordinator with sidebar and detail panes
- **RecipeListSidebar**: Enhanced recipe browser with iPad-specific row layouts
- **iPadRecipeHeader**: Rich recipe metadata display with grid layout
- **iPadWelcomeView**: Feature showcase for empty detail state

## Testing

### Unit Tests
Run unit tests to verify core functionality and iPad-specific features:

```bash
# In Xcode: Cmd+U
# Or via command line:
xcodebuild test -project RecipeArchiveiPad.xcodeproj -scheme RecipeArchiveiPad -destination 'platform=iOS Simulator,name=iPad Pro (12.9-inch) (6th generation)'
```

**iPad-Specific Test Coverage:**
- Large dataset handling and performance
- Split-view data flow and state management
- Search performance with iPad-sized collections
- Multitasking and background state handling
- Layout adaptation for different orientations

### UI Tests
Run UI tests to verify iPad interface behavior:

```bash
# In Xcode: Select RecipeArchiveiPadUITests scheme and press Cmd+U
xcodebuild test -project RecipeArchiveiPad.xcodeproj -scheme RecipeArchiveiPadUITests -destination 'platform=iOS Simulator,name=iPad Pro (12.9-inch) (6th generation)'
```

**iPad UI Test Coverage:**
- Split-view navigation and interaction
- Login screen layout in both orientations
- Recipe selection and detail view display
- Search functionality with iPad keyboard
- Add recipe form with two-column layout
- Profile interface and settings management
- Multitasking and orientation changes
- Gesture recognition and touch interactions

## Usage Guide

### First Launch
1. Launch the app to see the iPad-optimized login screen
2. Create an account using the enhanced sign-up interface
3. Experience the split-view welcome screen

### Managing Recipes
1. **Browse Recipes**: Use the sidebar to view your recipe collection
2. **Search**: Use the enhanced search bar for real-time filtering
3. **View Details**: Select a recipe to see it in the detail pane
4. **Add Recipe**: Use the "+" button for the iPad-optimized form
5. **Edit/Delete**: Use the context menu in the detail view

### iPad-Specific Interactions
1. **Split-View**: Recipes remain selected while browsing
2. **Landscape Mode**: Optimized layouts for landscape viewing
3. **Multitasking**: App supports Stage Manager and Split View
4. **Pull to Refresh**: Enhanced pull-to-refresh in recipe list

## iPad Optimization Details

### Layout Adaptations
- **Larger Touch Targets**: 44pt minimum for iPad interactions
- **Appropriate Typography**: Larger font sizes for iPad viewing distances
- **Generous Spacing**: Increased padding and margins for clarity
- **Grid Layouts**: Multi-column arrangements utilizing screen space

### Performance Considerations
- **Efficient Scrolling**: Optimized for large recipe collections
- **Search Debouncing**: Smooth typing experience without lag
- **Memory Management**: Proper cleanup for multitasking scenarios
- **Background Handling**: State preservation for app switching

### Accessibility
- **Dynamic Type**: Supports user font size preferences
- **VoiceOver**: Semantic markup for screen reader compatibility
- **High Contrast**: Respects accessibility display preferences
- **Reduced Motion**: Honors user animation preferences

## Configuration

### iPad-Specific Settings
The app includes iPad-optimized preferences:
- `showPrepTime`: Display timing information in recipe cards
- `showDifficulty`: Show difficulty indicators in list view
- `defaultServings`: Default serving count for new recipes
- `enableLandscapeMode`: Allow landscape orientation (default: true)

### AWS Integration
The iPad app is designed for enhanced AWS integration:
- **Enhanced S3**: Optimized for larger image uploads
- **Batch Operations**: Efficient bulk recipe synchronization
- **Cognito**: Advanced user management features
- **Lambda**: High-performance API calls for large datasets

## Troubleshooting

### iPad-Specific Issues

**Split View Not Working:**
- Ensure app is running on iPad (not iPhone in compatibility mode)
- Check TARGETED_DEVICE_FAMILY is set to 2 (iPad)
- Verify minimum deployment target is iPadOS 17.0+

**Layout Issues in Landscape:**
- Test with different iPad models and orientations
- Verify constraints support both portrait and landscape
- Check Safe Area usage for notched iPads

**Performance Issues:**
- Monitor memory usage with large recipe collections
- Test multitasking scenarios and background handling
- Profile search performance with Instruments

**Touch Interaction Problems:**
- Verify touch targets meet iPad guidelines (44pt minimum)
- Test with Apple Pencil if supported
- Ensure hover states work with trackpad/mouse

## Development Guidelines

When contributing to the iPad app:

1. **Test on Multiple iPad Models**: Support various screen sizes
2. **Optimize for Large Datasets**: Handle 500+ recipes efficiently
3. **Support All Orientations**: Landscape and portrait modes
4. **iPad Interaction Patterns**: Follow iPad-specific design guidelines
5. **Multitasking Compatibility**: Test with Stage Manager and Split View
6. **Performance Profiling**: Use Instruments for optimization

## Architecture

### iPad-Specific Design Patterns
- **Master-Detail**: Split-view navigation for hierarchical content
- **Adaptive Layout**: Dynamic layout changes based on size class
- **Enhanced Navigation**: Context-aware navigation with large datasets
- **State Preservation**: Robust state management for multitasking

### Data Flow Optimization
- **Efficient Filtering**: Optimized search algorithms for large collections
- **Smart Caching**: Intelligent data caching for performance
- **Background Processing**: Non-blocking operations for smooth UI

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For iPad-specific issues and feature requests, please create an issue with the "ipad-app" label in the main repository.