# Dart Logging Privacy

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

## Performance Tracking

```dart
final startTime = DateTime.now();
// ... operation ...
final duration = DateTime.now().difference(startTime).inMilliseconds;
AppLogger.network.info("Request completed", metadata: {
  "durationMs": duration,
  "endpoint": endpoint,
});
```

## Avoid Logging in Loops

```dart
// ❌ Bad: Logging in tight loops (performance impact)
for (var item in items) {
  AppLogger.ui.debug("Processing $item"); // Use sparingly
}
```

