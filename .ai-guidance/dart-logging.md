# Dart/Flutter Logging Standards

**ALWAYS use structured logging via `AppLogger` for all Dart/Flutter code.**

The project uses the `logger` package with a custom `AppLogger` wrapper that provides:
- Consistent structured logging with metadata
- Privacy controls for sensitive data (URLs, user IDs, email addresses)
- Production-ready log levels (debug, info, warning, error, fatal)
- Category-based loggers (auth, network, recipe, storage, share, backup, analytics, ui)

## DO ✅

```dart
import "package:recipe_archive/utils/app_logger.dart";

// Info-level logging for normal operations
AppLogger.auth.info("User signed in", metadata: {
  "userId": AppLogger.auth.redact(user.id),
  "email": AppLogger.auth.redact(user.email),
});

// Error logging with exception details
AppLogger.network.error("API request failed",
    metadata: {
      "url": AppLogger.network.redact(url),
      "statusCode": response.statusCode,
    },
    error: error,
    stackTrace: stackTrace);

// Debug logging (disabled in production)
AppLogger.recipe.debug("Processing recipe", metadata: {
  "recipeId": recipeId,
  "ingredientCount": ingredients.length,
});

// Warning for recoverable errors
AppLogger.storage.warning("Cache miss, fetching from network");

// Performance tracking with timing
final startTime = DateTime.now();
// ... operation ...
final duration = DateTime.now().difference(startTime).inMilliseconds;
AppLogger.network.info("Request completed", metadata: {
  "durationMs": duration,
  "endpoint": endpoint,
});
```

## DON'T ❌

```dart
// ❌ Bad: Using print() for production logging
print("User signed in: ${user.email}");

// ❌ Bad: Using debugPrint() for production logging
debugPrint("API error: $error");

// ❌ Bad: Exposing sensitive data without redaction
AppLogger.auth.info("Login", metadata: {"password": password}); // NEVER log passwords!

// ❌ Bad: Logging in tight loops (performance impact)
for (var item in items) {
  AppLogger.ui.debug("Processing $item"); // Use sparingly
}
```

## Privacy Guidelines

- **ALWAYS redact**: URLs, user IDs, email addresses, recipe titles, authentication tokens
- **NEVER log**: Passwords, API keys, authentication tokens (raw), session data
- **Public data**: Operation types, counts, durations, status codes, error types

## Available Loggers

| Logger | Purpose |
|--------|---------|
| `AppLogger.auth` | Authentication and user management |
| `AppLogger.network` | HTTP requests, API calls, network operations |
| `AppLogger.recipe` | Recipe processing, parsing, storage |
| `AppLogger.storage` | Local storage, caching, file I/O |
| `AppLogger.share` | Share Extension, recipe capture |
| `AppLogger.backup` | Backup and restore operations |
| `AppLogger.analytics` | Analytics tracking and reporting |
| `AppLogger.ui` | UI events, navigation, user interactions |

