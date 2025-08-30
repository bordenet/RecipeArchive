# Recipe Archive iOS App

A native iOS application for managing and organizing your favorite recipes with a clean, intuitive interface built using SwiftUI.

## Features

- **User Authentication**: Secure sign-in and sign-up functionality with AWS Cognito integration
- **Recipe Management**: Add, view, edit, and delete recipes with detailed information
- **Search & Filter**: Find recipes by title, tags, cuisine, or ingredients
- **Offline Support**: Local data persistence with UserDefaults
- **Material Design**: Clean, modern interface following Apple's design guidelines
- **Pull to Refresh**: Easy data synchronization
- **Comprehensive Testing**: Unit tests and UI tests included

## Requirements

- iOS 17.0 or later
- Xcode 15.0 or later
- Swift 5.9 or later

## Installation & Setup

### 1. Prerequisites

Ensure you have the latest version of Xcode installed from the Mac App Store or Apple Developer Portal.

### 2. Open the Project

```bash
cd /path/to/RecipeArchive/ios_app
open RecipeArchive.xcodeproj
```

### 3. Build Configuration

The project includes three targets:
- **RecipeArchive**: Main iOS app
- **RecipeArchiveTests**: Unit tests
- **RecipeArchiveUITests**: UI automation tests

### 4. Run the App

1. Select your target device (iPhone simulator or physical device)
2. Press `Cmd+R` to build and run
3. The app will launch with the login screen

## Project Structure

```
RecipeArchive/
├── RecipeArchiveApp.swift          # App entry point
├── ContentView.swift               # Main content wrapper
├── Models/
│   ├── Recipe.swift               # Recipe data model
│   └── User.swift                 # User data model
├── Services/
│   ├── AuthService.swift          # Authentication logic
│   └── RecipeService.swift        # Recipe management logic
└── Views/
    ├── LoginView.swift            # Authentication screen
    ├── RecipeListView.swift       # Recipe listing and search
    ├── RecipeDetailView.swift     # Recipe details display
    ├── AddRecipeView.swift        # Add/edit recipe form
    └── ProfileView.swift          # User profile and settings
```

## Key Components

### Authentication Service
- Handles user sign-in, sign-up, and session management
- Simulates AWS Cognito integration
- Persistent authentication state

### Recipe Service  
- Manages recipe CRUD operations
- Implements search and filtering functionality
- Handles data persistence

### SwiftUI Views
- **LoginView**: User authentication interface
- **RecipeListView**: Main recipe browser with search
- **RecipeDetailView**: Detailed recipe display
- **AddRecipeView**: Recipe creation and editing
- **ProfileView**: User profile and app settings

## Testing

### Unit Tests
Run unit tests to verify core functionality:

```bash
# In Xcode: Cmd+U
# Or via command line:
xcodebuild test -project RecipeArchive.xcodeproj -scheme RecipeArchive -destination 'platform=iOS Simulator,name=iPhone 15'
```

**Test Coverage:**
- Recipe model serialization/deserialization
- User authentication flows
- Recipe service operations
- Search functionality
- Data persistence

### UI Tests
Run UI tests to verify user interface behavior:

```bash
# In Xcode: Select RecipeArchiveUITests scheme and press Cmd+U
xcodebuild test -project RecipeArchive.xcodeproj -scheme RecipeArchiveUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

**UI Test Coverage:**
- App launch and navigation
- Login/logout flows
- Recipe browsing and search
- Recipe detail viewing
- Profile management

## Usage Guide

### First Launch
1. Launch the app to see the login screen
2. Create an account using the "Sign Up" option
3. Enter email, password, and confirm password
4. Once signed in, you'll see the main recipe list

### Managing Recipes
1. **View Recipes**: Browse your recipe collection on the main screen
2. **Search**: Use the search bar to find specific recipes
3. **Add Recipe**: Tap the "+" button to create a new recipe
4. **View Details**: Tap any recipe to see full details
5. **Delete Recipe**: Use the "Delete" button in recipe details

### Profile Management
1. Switch to the "Profile" tab
2. View your recipe statistics
3. Access app settings
4. Sign out when needed

## Configuration

### Customization Options
The app supports several user preferences stored in UserDefaults:
- `showPrepTime`: Display preparation time in recipe lists
- `showDifficulty`: Display difficulty level in recipe lists  
- `defaultServings`: Default serving size for new recipes

### AWS Integration (Future)
The app is designed to integrate with AWS services:
- **Cognito**: User authentication and management
- **S3**: Recipe image storage
- **Lambda**: Backend API endpoints
- **DynamoDB**: Recipe data persistence

To enable AWS integration, update the service classes to use actual AWS SDK calls instead of simulated responses.

## Architecture

### Design Patterns
- **MVVM**: Model-View-ViewModel architecture with SwiftUI
- **ObservableObject**: Reactive data binding for services
- **Combine**: Asynchronous data handling and search debouncing
- **Dependency Injection**: Services injected via environment objects

### Data Flow
1. Views observe service state changes via `@ObservedObject`
2. Services manage business logic and API calls
3. Models define data structure and serialization
4. UserDefaults provides local persistence

## Troubleshooting

### Common Issues

**Build Errors:**
- Ensure iOS deployment target is set to 17.0+
- Clean build folder with `Cmd+Shift+K`
- Reset simulator if needed

**Test Failures:**
- Verify simulator is running iOS 17.0+
- Check network connectivity for integration tests
- Reset test data between runs

**Performance Issues:**
- Enable optimization in Release configuration
- Monitor memory usage in Instruments
- Use background queues for heavy operations

## Contributing

When contributing to the iOS app:

1. Follow Swift and SwiftUI best practices
2. Add unit tests for new functionality
3. Update UI tests for interface changes
4. Document public APIs and complex logic
5. Test on multiple device sizes and orientations

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and feature requests related to the iOS app, please check the main repository's issue tracker or create a new issue with the "ios-app" label.