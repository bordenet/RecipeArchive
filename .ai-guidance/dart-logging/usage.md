# Dart Logging Usage

**ALWAYS use structured logging via `AppLogger` for all Dart/Flutter code.**

The project uses the `logger` package with a custom `AppLogger` wrapper that provides:
- Consistent structured logging with metadata
- Privacy controls for sensitive data
- Production-ready log levels (debug, info, warning, error, fatal)
- Category-based loggers

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
    metadata: {"url": AppLogger.network.redact(url), "statusCode": response.statusCode},
    error: error, stackTrace: stackTrace);

// Debug logging (disabled in production)
AppLogger.recipe.debug("Processing recipe", metadata: {"recipeId": recipeId});

// Warning for recoverable errors
AppLogger.storage.warning("Cache miss, fetching from network");
```

## DON'T ❌

```dart
print("User signed in: ${user.email}");                    // Bad: print()
debugPrint("API error: $error");                           // Bad: debugPrint()
AppLogger.auth.info("Login", metadata: {"password": p});   // NEVER log passwords
```

