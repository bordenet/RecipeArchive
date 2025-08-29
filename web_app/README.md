# Recipe Archive Web App

A beautiful, responsive web application for managing and browsing your recipe collection. Built with Flutter for web.

## Features

🍳 **Recipe Management**
- Browse your recipe collection with beautiful cards
- Search by title, ingredients, cuisine, or tags
- Filter by cooking time, tags, and cuisine
- Mark recipes as favorites
- Rate recipes (1-5 stars)
- Add personal notes to recipes

📱 **Responsive Design**
- Works perfectly on desktop, tablet, and mobile
- Material Design 3 with custom recipe-focused theme
- Dark and light mode support
- Progressive Web App (PWA) capabilities

🔍 **Smart Filtering & Search**
- Real-time search across all recipe fields
- Filter by cuisine, tags, cooking time
- Quick filters for favorites and popular tags
- Advanced filter combinations

⚡ **Performance**
- Lazy loading for optimal performance
- Efficient state management with Riverpod
- Cached network images
- Offline capability planning

## Getting Started

### Prerequisites

- Flutter SDK (>=3.10.0)
- Dart SDK (>=3.0.0)

### Installation

1. Navigate to the web app directory:
   ```bash
   cd web_app
   ```

2. Install dependencies:
   ```bash
   flutter pub get
   ```

3. Generate code (for JSON serialization):
   ```bash
   flutter packages pub run build_runner build
   ```

### Development

Run the app in development mode:
```bash
flutter run -d chrome
```

For hot reload during development:
```bash
flutter run -d chrome --hot
```

### Building for Production

Build the web app for production:
```bash
flutter build web
```

The built files will be in `build/web/` directory.

## Architecture

### State Management
- **Riverpod** for dependency injection and state management
- Providers for API services and data fetching
- Reactive UI updates based on state changes

### API Integration
- RESTful API integration with the AWS backend
- Recipe CRUD operations
- Search and filtering capabilities
- Error handling and loading states

### UI Structure
```
lib/
├── main.dart                 # App entry point
├── models/                   # Data models
│   └── recipe.dart
├── services/                 # API services
│   └── recipe_service.dart
├── screens/                  # Main screens
│   ├── home_screen.dart
│   └── recipe_detail_screen.dart
├── widgets/                  # Reusable components
│   ├── recipe_card.dart
│   ├── search_bar.dart
│   └── filter_chips.dart
└── theme/                    # App theming
    └── app_theme.dart
```

## Configuration

### API Endpoints
The app can be configured to use either local development or production endpoints in `lib/services/recipe_service.dart`:

```dart
static const bool useLocalBackend = false;  // Toggle for dev/prod
```

### Theme Customization
The app theme can be customized in `lib/theme/app_theme.dart`. The current theme uses:
- Primary: Green (#2E7D32) - representing fresh food/cooking
- Secondary: Orange (#FF6F00) - warm accent color
- Material Design 3 principles

## Browser Extension Integration

This web app is designed to work seamlessly with the Recipe Archive browser extensions:
- Extensions save recipes directly to the API
- Web app provides the browsing and management interface
- Shared data model and API endpoints

## Future Enhancements

- [ ] Recipe editing and creation UI
- [ ] Meal planning features
- [ ] Shopping list generation
- [ ] Recipe sharing capabilities
- [ ] Offline sync
- [ ] Recipe collections/folders
- [ ] Nutrition tracking
- [ ] Recipe scaling
- [ ] Print-friendly views

## Contributing

1. Follow Flutter style guidelines
2. Use meaningful commit messages
3. Add tests for new features
4. Update documentation

## Technologies Used

- **Flutter** - Cross-platform UI framework
- **Dart** - Programming language
- **Riverpod** - State management
- **Material Design 3** - Design system
- **HTTP** - API communication
- **JSON Serialization** - Data handling
