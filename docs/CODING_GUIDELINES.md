# RecipeArchive Coding Guidelines

**Purpose**: Consolidated coding standards and best practices for all languages in the RecipeArchive project.

**Last Updated**: 2025-11-04

---

## Table of Contents

- [Go](#go)
  - [Style Guide](#go-style-guide)
  - [Structured Logging](#go-structured-logging)
  - [Lambda Best Practices](#go-lambda-best-practices)
- [JavaScript/TypeScript](#javascripttypescript)
  - [Style Guide](#jsts-style-guide)
  - [Quote Style](#jsts-quote-style)
- [Dart/Flutter](#dartflutter)
  - [Structured Logging](#dart-structured-logging)
  - [Privacy Controls](#dart-privacy-controls)
- [Swift](#swift)
  - [Structured Logging](#swift-structured-logging)
  - [Privacy Controls](#swift-privacy-controls)
- [Kotlin](#kotlin)
  - [Style Guide](#kotlin-style-guide)
  - [Structured Logging (Future)](#kotlin-structured-logging)

---

## Go

### Go Style Guide

See [GO_STYLE_GUIDE.md](GO_STYLE_GUIDE.md) for complete details. Key highlights:

**Code Organization**:
- Use `internal/` for package-private code
- Use `pkg/` for reusable libraries
- Keep functions under 50 lines when possible

**Error Handling**:
```go
// ✅ Good: wrapped errors with context
if err != nil {
    return fmt.Errorf("failed to fetch recipe %s: %w", recipeID, err)
}

// ❌ Bad: lost error context
if err != nil {
    return err
}
```

**Naming**:
- Use `camelCase` for unexported, `PascalCase` for exported
- Avoid stuttering: `recipe.GetRecipe()` → `recipe.Get()`

### Go Structured Logging

**Status**: 14/18 binaries migrated (78% complete)

**Pattern**: Use `log/slog` for all logging

**Lambda Functions** (JSON Handler):
```go
package main

import (
    "context"
    "log/slog"
    "os"
)

var logger *slog.Logger

func init() {
    // JSON handler for Lambda functions (CloudWatch Logs Insights compatible)
    logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level:     slog.LevelInfo,
        AddSource: true, // Include source file/line for errors
    }))
}

func handler(ctx context.Context, event events.APIGatewayProxyRequest) error {
    requestLogger := logger.With(
        "requestID", event.RequestContext.RequestID,
        "userID", event.RequestContext.Authorizer["userId"],
    )

    requestLogger.Info("processing request", "path", event.Path)

    if err := processRequest(ctx, event); err != nil {
        requestLogger.Error("request processing failed",
            "error", err,
            "path", event.Path,
        )
        return err
    }

    requestLogger.Info("request completed",
        "path", event.Path,
        "statusCode", 200,
    )
    return nil
}
```

**CLI Tools** (Text Handler):
```go
package main

import (
    "fmt"
    "log/slog"
    "os"
)

var logger *slog.Logger

func init() {
    // Text handler for CLI tools (human-readable)
    logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
}

func main() {
    // User-facing output - keep emojis
    fmt.Printf("🔍 Fetching all tenants from Cognito User Pool...\n")

    // Operational logging - structured
    logger.Info("fetching tenants", "poolID", poolID)

    tenants, err := fetchTenants()
    if err != nil {
        logger.Error("failed to fetch tenants",
            "poolID", poolID,
            "error", err,
        )
        fmt.Fprintf(os.Stderr, "❌ Failed to fetch tenants: %v\n", err)
        os.Exit(1)
    }

    fmt.Printf("✅ Found %d tenants\n", len(tenants))
}
```

**Rules**:
- **NO emojis in Lambda functions** - breaks JSON parsing
- **NO string interpolation** - use structured fields
- **Include AddSource: true** for error-level logs in Lambda
- **Reuse loggers** with `.With()` for common fields
- **Keep user-facing output** separate from operational logs (CLI only)

### Go Lambda Best Practices

**Lazy Initialization with sync.Once**:

```go
// ✅ CORRECT PATTERN
var (
    s3Client  *s3.Client
    sqsClient *sqs.Client
    initOnce  sync.Once
    initErr   error
)

func initAWSClients(ctx context.Context) error {
    initOnce.Do(func() {
        region := os.Getenv("AWS_REGION") // Provided by Lambda runtime
        if region == "" {
            region = "us-west-2" // Fallback for local dev
        }

        cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
        if err != nil {
            initErr = fmt.Errorf("failed to load AWS config: %w", err)
            return
        }

        s3Client = s3.NewFromConfig(cfg)
        sqsClient = sqs.NewFromConfig(cfg)
    })
    return initErr
}

func handler(ctx context.Context, event events.APIGatewayProxyRequest) error {
    if err := initAWSClients(ctx); err != nil {
        return err
    }
    // handler logic
}
```

**Why**:
- Lazy initialization (only when needed)
- Proper context propagation (not `context.TODO()`)
- Thread-safe with `sync.Once`
- Multi-region ready (uses `AWS_REGION` environment variable)
- Reduces cold start by ~100-200ms

**❌ ANTI-PATTERN** (do not use):
```go
func init() {
    cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("us-west-2"))
    if err != nil {
        log.Fatal(err)
    }
    s3Client = s3.NewFromConfig(cfg)
}
```

---

## JavaScript/TypeScript

### JS/TS Style Guide

See [JAVASCRIPT_TYPESCRIPT_STYLE_GUIDE.md](JAVASCRIPT_TYPESCRIPT_STYLE_GUIDE.md) for complete details.

###  JS/TS Quote Style

**MANDATORY**: Always use double quotes in JavaScript/TypeScript files.

```javascript
// ✅ Correct
console.log("Checking URL:", url);
const message = "Hello, world!";

// ❌ Wrong
console.log('Checking URL:', url);
const message = 'Hello, world!';
```

**Enforcement**:
```bash
# Always run after editing JavaScript files
npm run lint -- --fix
```

**ESLint Configuration**:
```json
{
  "rules": {
    "quotes": ["error", "double"]
  }
}
```

---

## Dart/Flutter

### Dart Structured Logging

**Library**: `logger: ^2.0.2` (in `pubspec.yaml`)

**Location**: `recipe_archive/lib/utils/app_logger.dart`

**Available Loggers**:
```dart
AppLogger.auth       // Authentication events
AppLogger.network    // HTTP requests/responses
AppLogger.recipe     // Recipe operations
AppLogger.storage    // File I/O, cache operations
AppLogger.share      // Share extension events
AppLogger.backup     // Backup/restore operations
AppLogger.analytics  // Analytics tracking
AppLogger.ui         // UI events
```

**Usage Examples**:

```dart
import 'package:recipe_archive/utils/app_logger.dart';

// Info-level logging (normal operations)
AppLogger.auth.info("Starting sign in", metadata: {
  "email": AppLogger.auth.redact(email),
});

// Error-level logging with exception
AppLogger.network.error("API request failed",
  metadata: {
    "url": AppLogger.network.redact(url),
    "statusCode": statusCode,
  },
  error: exception,
  stackTrace: stackTrace,
);

// Performance tracking
final startTime = DateTime.now();
// ... operation ...
final duration = DateTime.now().difference(startTime).inMilliseconds;

AppLogger.auth.info("Sign in completed successfully", metadata: {
  "durationMs": duration,
  "userId": AppLogger.auth.redact(currentUser.id),
});
```

**Log Levels**:
- `debug()` - Development-only verbose output
- `info()` - Normal operations
- `warning()` - Recoverable errors
- `error()` - Critical failures (include `error` and `stackTrace` parameters)
- `fatal()` - Unrecoverable errors

### Dart Privacy Controls

**Always redact sensitive data**:

```dart
// ✅ Good: Redacted sensitive data
AppLogger.auth.info("User logged in", metadata: {
  "email": AppLogger.auth.redact(user.email),
  "userId": AppLogger.auth.redact(user.id),
});

// ❌ Bad: Exposed sensitive data
AppLogger.auth.info("User logged in", metadata: {
  "email": user.email,  // NEVER do this!
  "userId": user.id,    // NEVER do this!
});
```

**Redaction behavior**:
- Input: `"john.doe@example.com"` → Output: `"john...com"`
- Input: `"abc123xyz789"` → Output: `"abc1...x789"`
- Input: `"short"` → Output: `"<redacted>"`
- Input: `null` → Output: `"<null>"`

**What to redact**:
- Email addresses
- User IDs
- Recipe titles (may contain personal notes)
- URLs (may contain auth tokens)
- Authentication tokens (NEVER log these, even redacted)

---

## Swift

### Swift Structured Logging

**Framework**: Apple's native `os.Logger` (iOS 14+, macOS 11+)

**Centralized Logger** (create `AppLogger.swift`):
```swift
import os

enum AppLogger {
    static let shareExtension = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "ShareExtension")
    static let webView = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "WebView")
    static let network = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Network")
    static let parser = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Parser")
    static let storage = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Storage")
    static let auth = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Auth")
}
```

**Usage Examples**:

```swift
import os

class WebViewContentLoader {
    private let logger = AppLogger.webView

    func loadContent(url: URL) {
        logger.info("Loading recipe content", metadata: [
            "url": "\(url, privacy: .private)",
            "hasAuth": "\(hasAuthCookies)"
        ])

        let startTime = Date()
        webView.load(URLRequest(url: url))

        if let error = error {
            logger.error("Failed to load content",
                url: "\(url, privacy: .private)",
                error: "\(error.localizedDescription)",
                duration: "\(Date().timeIntervalSince(startTime))s"
            )
        } else {
            logger.notice("Content loaded successfully",
                url: "\(url, privacy: .private)",
                duration: "\(Date().timeIntervalSince(startTime))s",
                htmlSize: "\(htmlContent.count) bytes"
            )
        }
    }
}
```

**Log Levels**:
- **Debug**: Development-only verbose output (disabled in production)
- **Info**: Normal operations (Share Extension invoked, recipe saved)
- **Notice**: Significant events (cache miss, fallback to URL-only)
- **Warning**: Recoverable errors (image download timeout, invalid HTML)
- **Error**: Critical failures (WKWebView crash, network unreachable)
- **Fault**: Unrecoverable errors requiring user intervention

### Swift Privacy Controls

**Always mark sensitive data as `.private`**:

```swift
// ✅ Good: Privacy annotation
logger.error("Network request failed",
    url: "\(url, privacy: .private)",
    statusCode: statusCode,
    error: "\(error.localizedDescription)"
)

// ❌ Bad: No privacy annotation
logger.error("Network request failed: \(url)")
```

**Privacy Levels**:
- **Public**: Operation types, counts, durations (safe for logs)
- **Private** (default): URLs, recipe titles, user identifiers
- **Sensitive**: Authentication tokens, passwords (never logged)

**Console.app Queries** (for debugging):
```bash
# All Share Extension activity
log show --predicate 'subsystem == "com.RecipeArchive" AND category == "ShareExtension"' --last 1h

# WebView errors only
log show --predicate 'category == "WebView" AND eventType == error' --last 1h

# Performance: Share Extension load times
log show --predicate 'category == "ShareExtension" AND eventMessage CONTAINS "duration"' --last 1h
```

**Rules**:
- Use `Logger` from `os` framework (iOS 14+, macOS 11+)
- Create centralized logger instances via `AppLogger` enum
- Mark sensitive data as `.private` (URLs, user IDs, recipe titles)
- Include timing for async operations (network, WebView loads)
- **Never** use `print()` for production code (development debugging only)
- **Never** use `NSLog()` (legacy, no privacy controls)
- **Never** log authentication tokens, passwords, or API keys

---

## Kotlin

### Kotlin Style Guide

See [KOTLIN_STYLE_GUIDE.md](KOTLIN_STYLE_GUIDE.md) for complete details.

**Naming Conventions**:
- Classes/Interfaces: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Packages: lowercase (no underscores)

**Null Safety**:
```kotlin
// ✅ Good: Safe null handling
val recipe: Recipe? = getRecipe(id)
recipe?.let {
    processRecipe(it)
}

// ❌ Bad: Force unwrap
val recipe: Recipe? = getRecipe(id)
processRecipe(recipe!!)  // Will crash if null
```

### Kotlin Structured Logging

**Status**: FUTURE WORK (Android not yet implemented)

**Planned Framework**: Android Timber + structured log wrapper

When Android development begins, structured logging will use:
- **Timber** for logging infrastructure
- **Firebase Crashlytics** for production error tracking
- **Logcat** filtering by tag
- **Lambda-based logging** for lazy evaluation

**Planned Pattern**:
```kotlin
import timber.log.Timber

// Centralized loggers
object AppLogger {
    val shareReceiver = Timber.tag("RecipeArchive:ShareReceiver")
    val webView = Timber.tag("RecipeArchive:WebView")
    val network = Timber.tag("RecipeArchive:Network")
}

// Usage with lazy evaluation
AppLogger.network.i {
    "Network request: url=${PrivateString(url)}, statusCode=$statusCode"
}
```

**Planned Privacy Controls**:
```kotlin
// Sensitive data wrapper (auto-redaction in release builds)
@JvmInline
value class PrivateString(private val value: String) {
    override fun toString(): String = if (BuildConfig.DEBUG) value else "[REDACTED]"
}
```

---

## Common Patterns Across All Languages

### Structured Logging Best Practices

**DO**:
- Use dedicated logging libraries (not `print`/`console.log` for production)
- Include context fields (userID, requestID, operation type)
- Add performance tracking (duration, latency)
- Redact sensitive data (emails, URLs, user IDs)
- Use appropriate log levels
- Keep operational logs separate from user-facing output (CLI tools)

**DON'T**:
- Log authentication tokens, passwords, API keys
- Log in tight loops (impacts performance)
- Use string interpolation without privacy controls
- Mix user-facing and operational logging
- Emit JSON logs from CLI tools (confusing for users)

### Privacy-First Logging

**Always redact**:
- Email addresses
- User IDs / UUIDs
- Recipe titles (may contain personal information)
- URLs (may contain query parameters or tokens)
- IP addresses
- Session tokens

**Never log** (even redacted):
- Passwords
- API keys
- OAuth tokens
- Credit card numbers
- Social security numbers

### Performance Logging

**Always include timing for**:
- API requests (HTTP calls)
- Database operations (S3, DynamoDB)
- External service calls (OpenAI, Cognito)
- Heavy computations (recipe parsing, normalization)
- User-visible operations (sign in, recipe save)

**Example pattern** (all languages):
```
1. Record start time
2. Perform operation
3. Calculate duration
4. Log with duration metadata
```

---

## Reference Documents

For complete details, see:
- [GO_STYLE_GUIDE.md](GO_STYLE_GUIDE.md) - Full Go coding standards
- [JAVASCRIPT_TYPESCRIPT_STYLE_GUIDE.md](JAVASCRIPT_TYPESCRIPT_STYLE_GUIDE.md) - Full JS/TS standards
- [KOTLIN_STYLE_GUIDE.md](KOTLIN_STYLE_GUIDE.md) - Full Kotlin standards
- [CLAUDE.md](../CLAUDE.md) - Project-wide development guidelines

---

**Last Updated**: 2025-11-04
**Maintained By**: Project maintainers
**Questions**: Refer to language-specific style guides or CLAUDE.md
