# Swift Structured Logging Migration Plan

**Target**: RecipeArchive iOS app
**Framework**: Apple's native `os.Logger` (iOS 14+, macOS 11+)
**Status**: Planning phase

## Motivation

Structured logging provides:
- **CloudWatch/Console.app filtering**: Search logs by user ID, recipe ID, operation type
- **Performance insights**: Track Share Extension load times, network latency, parsing duration
- **Error correlation**: Link failures across app components (Share Extension ↔ Main App ↔ Backend)
- **Privacy compliance**: Automatic redaction of sensitive data (URLs, user IDs) per Apple guidelines

## Current State

The Swift codebase uses mix of logging approaches:
- `print()` statements (no structure, production noise)
- `NSLog()` (legacy, no privacy controls)
- Ad-hoc `os_log()` calls (inconsistent categories)
- Debug-only logging (no production visibility)

## Target Architecture

### Logger Organization

```swift
// Centralized logger factory
enum AppLogger {
    static let shareExtension = Logger(subsystem: "com.RecipeArchive", category: "ShareExtension")
    static let webView = Logger(subsystem: "com.RecipeArchive", category: "WebView")
    static let network = Logger(subsystem: "com.RecipeArchive", category: "Network")
    static let parser = Logger(subsystem: "com.RecipeArchive", category: "Parser")
    static let storage = Logger(subsystem: "com.RecipeArchive", category: "Storage")
    static let auth = Logger(subsystem: "com.RecipeArchive", category: "Auth")
}
```

### Privacy Levels

- **Public**: Operation types, counts, durations (safe for logs)
- **Private** (default): URLs, recipe titles, user identifiers
- **Sensitive**: Authentication tokens, passwords (never logged)

### Log Levels

- **Debug**: Development-only verbose output (disabled in production)
- **Info**: Normal operations (Share Extension invoked, recipe saved)
- **Notice**: Significant events (cache miss, fallback to URL-only)
- **Warning**: Recoverable errors (image download timeout, invalid HTML)
- **Error**: Critical failures (WKWebView crash, network unreachable)
- **Fault**: Unrecoverable errors requiring user intervention

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1)

**Goal**: Establish logger factory and add to critical paths

**Files to migrate**:
1. `recipe_archive/ios/Shared/WebViewContentLoader.swift` (WKWebView proxy - highest priority)
   - Current: ~15 `print()` statements for HTML extraction debugging
   - Target: Structured logs with timing, URL (private), content size

2. `recipe_archive/ios/RecipeArchive/ShareViewController.swift` (Share Extension entry)
   - Current: Ad-hoc NSLog for errors
   - Target: Structured logs for lifecycle events, input validation

3. `recipe_archive/ios/Runner/AppDelegate.swift` (Flutter bridge)
   - Current: Minimal logging
   - Target: MethodChannel call tracking, error propagation

**Acceptance criteria**:
- Console.app filtering by category works
- Share Extension load time visible in logs
- URL privacy redaction confirmed

### Phase 2: Network & Storage (Week 2)

**Goal**: Add observability to backend interactions

**Files to migrate**:
4. Network layer (Cognito auth, S3 uploads, recipe API calls)
   - Current: Silent failures or print() statements
   - Target: Request/response logging with latency, status codes (public), URLs (private)

5. App Group storage (UserDefaults, file I/O)
   - Current: Unlogged
   - Target: Read/write operations, data size, migration events

**Acceptance criteria**:
- Failed S3 uploads visible in logs with error codes
- Cache hit/miss rates trackable
- Authentication token refresh events logged

### Phase 3: Flutter Integration (Week 3)

**Goal**: Bridge Flutter and native logging

**Files to migrate**:
6. MethodChannel handlers (Swift ↔ Dart communication)
   - Current: Dart logs don't appear in Xcode/Console.app
   - Target: Unified logging across Swift and Flutter with correlation IDs

**Acceptance criteria**:
- Flutter errors visible in Console.app
- Share Extension → Flutter → Backend flow traceable
- Recipe processing timeline reconstructable from logs

### Phase 4: Production Monitoring (Week 4)

**Goal**: Enable remote diagnostics and performance tracking

**Tasks**:
7. Add OSLog export for diagnostics (similar to Flutter error reporting)
8. Performance metrics (Share Extension duration, WebView load time)
9. Error aggregation (group similar failures)

**Acceptance criteria**:
- Remote log collection works for support tickets
- P95 Share Extension duration visible in production
- Crash correlation with log events

## Code Patterns

### Before (legacy print statements)

```swift
// WebViewContentLoader.swift
print("Loading URL: \\(url)")
webView.load(URLRequest(url: url))

if let error = error {
    print("ERROR: Failed to load: \\(error)")
}
```

### After (structured logging)

```swift
// WebViewContentLoader.swift
import os

private let logger = Logger(subsystem: "com.bordenet.RecipeArchive", category: "WebView")

func loadContent(url: URL) {
    logger.info("Loading recipe content", metadata: [
        "url": "\\(url, privacy: .private)",
        "hasAuth": "\\(hasAuthCookies)"
    ])

    let startTime = Date()
    webView.load(URLRequest(url: url))

    if let error = error {
        logger.error("Failed to load content",
            url: "\\(url, privacy: .private)",
            error: "\\(error.localizedDescription)",
            duration: "\\(Date().timeIntervalSince(startTime))s"
        )
    } else {
        logger.notice("Content loaded successfully",
            url: "\\(url, privacy: .private)",
            duration: "\\(Date().timeIntervalSince(startTime))s",
            htmlSize: "\\(htmlContent.count) bytes"
        )
    }
}
```

### Centralized Logger Usage

```swift
// AppLogger.swift
import os

enum AppLogger {
    static let shareExtension = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "ShareExtension")
    static let webView = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "WebView")
    static let network = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Network")
    static let parser = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Parser")
}

// Usage in files
import os

class WebViewContentLoader {
    private let logger = AppLogger.webView

    func load() {
        logger.info("Starting load operation")
    }
}
```

## Testing Protocol

For each Swift file migrated:

1. **Build Test**: Xcode build succeeds
2. **Runtime Test**: Run Share Extension with test URL
3. **Log Verification**: Check Console.app for structured logs
   ```bash
   # Filter by subsystem
   log show --predicate 'subsystem == "com.bordenet.RecipeArchive"' --last 1h

   # Filter by category
   log show --predicate 'category == "ShareExtension"' --last 1h

   # Search for errors
   log show --predicate 'category == "WebView" AND eventType == error' --last 1h
   ```
4. **Privacy Test**: Confirm URLs/user IDs redacted in Console.app
5. **Performance Test**: Verify timing metadata appears in logs

## Style Guide Additions

### Swift Logging Guidelines

**DO**:
- Use `Logger` from `os` framework (iOS 14+, macOS 11+)
- Create centralized logger instances via `AppLogger` enum
- Mark sensitive data as `.private` (URLs, user IDs, recipe titles)
- Include timing for async operations (network, WebView loads)
- Use appropriate log levels (info for normal ops, error for failures)

**DON'T**:
- Use `print()` for production code (development debugging only)
- Use `NSLog()` (legacy, no privacy controls)
- Log authentication tokens, passwords, or API keys
- Log in tight loops (impacts performance)
- Use string interpolation without privacy annotations

**Example**:
```swift
// ❌ Bad: print statement, no structure, URL exposed
print("Failed to load \\(url): \\(error)")

// ✅ Good: structured log with privacy
AppLogger.network.error("Network request failed",
    url: "\\(url, privacy: .private)",
    statusCode: statusCode,
    error: "\\(error.localizedDescription)"
)
```

## Migration Checklist

### Share Extension Components
- [ ] WebViewContentLoader.swift (~15 print statements)
- [ ] ShareViewController.swift (~5 NSLog calls)
- [ ] ContentProxyStrategy.swift (authentication logging)

### Main App Components
- [ ] AppDelegate.swift (MethodChannel bridge)
- [ ] RecipeArchivePlugin.swift (Flutter integration)
- [ ] CognitoAuthManager.swift (authentication flows)

### Network Layer
- [ ] S3UploadManager.swift (recipe uploads)
- [ ] RecipeAPIClient.swift (backend API calls)
- [ ] ImageDownloader.swift (image fetching)

### Storage Layer
- [ ] AppGroupStorage.swift (UserDefaults, file I/O)
- [ ] CacheManager.swift (recipe caching)

**Total Progress: 0/12 files migrated**

## Console.app Queries (Post-Migration)

After migration, these queries will work:

```bash
# All Share Extension activity
log show --predicate 'subsystem == "com.RecipeArchive" AND category == "ShareExtension"' --last 1h

# WebView errors only
log show --predicate 'subsystem == "com.RecipeArchive" AND category == "WebView" AND eventType == error' --last 1h

# Network requests with duration
log show --predicate 'subsystem == "com.RecipeArchive" AND category == "Network"' --info --last 1h

# Authentication events
log show --predicate 'subsystem == "com.RecipeArchive" AND category == "Auth"' --last 24h

# Performance: Share Extension load times
log show --predicate 'subsystem == "com.RecipeArchive" AND category == "ShareExtension" AND eventMessage CONTAINS "duration"' --last 1h
```

## CloudWatch Integration

For production monitoring, logs should be:
1. Collected via OSLog export API (iOS 15+)
2. Sent to Lambda diagnostics endpoint (similar to Flutter error reporting)
3. Stored in S3 for analysis (same bucket as extension diagnostics)
4. Queryable via CloudWatch Logs Insights

**Future enhancement**: Automatic log upload on Share Extension errors (similar to Flutter diagnostics).

## Success Metrics

- **Coverage**: 100% of Share Extension files migrated
- **Privacy**: 0 URLs/user IDs exposed in Console.app
- **Performance**: Share Extension P95 duration < 5s (visible in logs)
- **Diagnostics**: Remote log collection working for support tickets
- **Correlation**: Recipe processing traceable from Share → Flutter → Backend

## References

- [Apple os.Logger Documentation](https://developer.apple.com/documentation/os/logger)
- [Unified Logging Privacy](https://developer.apple.com/documentation/os/logging/generating_log_messages_from_your_code)
- [Console.app Predicate Reference](https://developer.apple.com/documentation/os/logging/viewing_log_messages)
