# Kotlin Structured Logging Migration Plan

**Target**: RecipeArchive Android app
**Framework**: Android Timber + structured log wrapper
**Status**: Planning phase

## Motivation

Structured logging provides:
- **Logcat filtering**: Search logs by tag, user ID, recipe ID, operation type
- **Firebase Crashlytics integration**: Custom keys for error context
- **Performance insights**: Track Share Intent processing, network latency, parsing duration
- **Error correlation**: Link failures across app components (Share Receiver ↔ Flutter ↔ Backend)
- **Production diagnostics**: Remote log collection via Firebase

## Current State

The Kotlin codebase will need logging infrastructure for:
- Share Intent receiver (URL extraction from browser shares)
- WebView HTML extraction (similar to iOS WKWebView proxy)
- Image download manager (bypassing CDN restrictions)
- MethodChannel bridge (Kotlin ↔ Flutter communication)
- Authentication manager (Cognito integration)

## Target Architecture

### Logger Organization

```kotlin
// AppLogger.kt - Centralized logger factory
object AppLogger {
    private const val APP_TAG = "RecipeArchive"

    val shareReceiver = timber.tag("$APP_TAG:ShareReceiver")
    val webView = timber.tag("$APP_TAG:WebView")
    val network = timber.tag("$APP_TAG:Network")
    val parser = timber.tag("$APP_TAG:Parser")
    val storage = timber.tag("$APP_TAG:Storage")
    val auth = timber.tag("$APP_TAG:Auth")

    // Custom Timber tree for structured logging
    class StructuredDebugTree : Timber.DebugTree() {
        override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
            // Add Firebase Crashlytics custom keys
            FirebaseCrashlytics.getInstance().apply {
                setCustomKey("log_tag", tag ?: "unknown")
                setCustomKey("log_level", priorityToString(priority))
            }
            super.log(priority, tag, message, t)
        }

        private fun priorityToString(priority: Int): String = when (priority) {
            Log.VERBOSE -> "VERBOSE"
            Log.DEBUG -> "DEBUG"
            Log.INFO -> "INFO"
            Log.WARN -> "WARN"
            Log.ERROR -> "ERROR"
            Log.ASSERT -> "ASSERT"
            else -> "UNKNOWN"
        }
    }
}
```

### Log Levels

- **Verbose**: Development-only detailed output (disabled in production)
- **Debug**: Development tracing (Share Intent received, WebView loaded)
- **Info**: Normal operations (recipe saved, cache hit)
- **Warn**: Recoverable errors (image download timeout, invalid HTML)
- **Error**: Critical failures (WebView crash, network unreachable)

### Privacy & Security

Unlike iOS which has built-in `.private` annotations, Android requires manual redaction:

```kotlin
// Sensitive data wrapper
@JvmInline
value class PrivateString(private val value: String) {
    override fun toString(): String = if (BuildConfig.DEBUG) value else "[REDACTED]"
}

// Usage
fun logRequest(url: String, userId: String) {
    AppLogger.network.i {
        "Network request: url=${PrivateString(url)}, userId=${PrivateString(userId)}"
    }
}
```

## Migration Strategy

### Phase 1: Share Intent Infrastructure (Week 1)

**Goal**: Capture shared URLs from browsers and process via WebView

**Files to create**:
1. `android/app/src/main/kotlin/com/bordenet/recipearchive/ShareIntentReceiver.kt`
   - Handles `ACTION_SEND` intents from browsers
   - Extracts URL, passes to WebView loader
   - Target: Structured logs for intent parsing, URL validation

2. `android/app/src/main/kotlin/com/bordenet/recipearchive/WebViewContentLoader.kt`
   - Off-screen WebView for HTML extraction (mirrors iOS implementation)
   - Downloads images using authenticated session
   - Target: Timing logs, content size, error rates

3. `android/app/src/main/kotlin/com/bordenet/recipearchive/AppLogger.kt`
   - Centralized logger factory with Timber integration
   - Firebase Crashlytics custom key injection

**Acceptance criteria**:
- Logcat filtering by tag works (`adb logcat RecipeArchive:*`)
- Share Intent → WebView → Flutter flow visible in logs
- Firebase Crashlytics shows custom keys for errors

### Phase 2: Network & Storage (Week 2)

**Goal**: Add observability to backend interactions

**Files to create**:
4. `S3UploadManager.kt` (recipe uploads to S3)
   - Target: Upload progress, success/failure rates, retry logic

5. `RecipeAPIClient.kt` (backend API calls via OkHttp)
   - Target: Request/response logging, latency, status codes

6. `CognitoAuthManager.kt` (AWS Cognito authentication)
   - Target: Token refresh events, auth errors

7. `CacheManager.kt` (local recipe caching)
   - Target: Cache hit/miss rates, eviction events

**Acceptance criteria**:
- Failed S3 uploads visible in Logcat with error codes
- Network latency P95 trackable
- Authentication errors correlated with recipe operations

### Phase 3: Flutter Integration (Week 3)

**Goal**: Bridge Flutter and native logging

**Files to create**:
8. `FlutterBridge.kt` (MethodChannel handlers)
   - Target: Kotlin ↔ Flutter communication tracking
   - Correlation IDs for cross-layer debugging

**Acceptance criteria**:
- Flutter errors visible in Logcat with Kotlin context
- Share Intent → Kotlin → Flutter → Backend flow traceable
- Recipe processing timeline reconstructable from logs

### Phase 4: Production Monitoring (Week 4)

**Goal**: Enable remote diagnostics via Firebase

**Tasks**:
9. Firebase Crashlytics integration for non-fatal errors
10. Performance metrics (Share Intent processing time)
11. Remote log collection for support tickets

**Acceptance criteria**:
- Non-fatal errors appear in Firebase Console
- Share Intent P95 duration < 5s (visible in Firebase Performance)
- Remote logs downloadable for debugging

## Code Patterns

### Timber Initialization

```kotlin
// MainActivity.kt or Application class
class RecipeArchiveApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Initialize Timber
        if (BuildConfig.DEBUG) {
            Timber.plant(AppLogger.StructuredDebugTree())
        } else {
            Timber.plant(CrashlyticsTree()) // Production: send to Firebase
        }
    }
}

// CrashlyticsTree.kt
class CrashlyticsTree : Timber.Tree() {
    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        if (priority < Log.INFO) return // Only log WARN/ERROR to Firebase

        FirebaseCrashlytics.getInstance().apply {
            setCustomKey("log_tag", tag ?: "unknown")
            setCustomKey("log_message", message)
            t?.let { recordException(it) }
        }
    }
}
```

### Structured Logging Examples

```kotlin
// ShareIntentReceiver.kt
import timber.log.Timber

class ShareIntentReceiver : BroadcastReceiver() {
    private val logger = AppLogger.shareReceiver

    override fun onReceive(context: Context, intent: Intent) {
        val startTime = System.currentTimeMillis()

        logger.i { "Share intent received: action=${intent.action}" }

        val url = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (url.isNullOrBlank()) {
            logger.w { "Share intent missing URL" }
            return
        }

        logger.i {
            "Processing share URL: url=${PrivateString(url)}, duration=${System.currentTimeMillis() - startTime}ms"
        }

        // Process URL via WebView
        WebViewContentLoader.load(url) { result ->
            when (result) {
                is Success -> {
                    logger.i {
                        "Share processing succeeded: " +
                        "url=${PrivateString(url)}, " +
                        "htmlSize=${result.html.length}, " +
                        "imageCount=${result.images.size}, " +
                        "duration=${System.currentTimeMillis() - startTime}ms"
                    }
                }
                is Failure -> {
                    logger.e(result.error) {
                        "Share processing failed: " +
                        "url=${PrivateString(url)}, " +
                        "error=${result.error.message}, " +
                        "duration=${System.currentTimeMillis() - startTime}ms"
                    }
                }
            }
        }
    }
}
```

### Network Logging with OkHttp Interceptor

```kotlin
// LoggingInterceptor.kt
class StructuredLoggingInterceptor : Interceptor {
    private val logger = AppLogger.network

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val startTime = System.currentTimeMillis()

        logger.i {
            "HTTP request: method=${request.method}, url=${PrivateString(request.url.toString())}"
        }

        val response = chain.proceed(request)
        val duration = System.currentTimeMillis() - startTime

        logger.i {
            "HTTP response: " +
            "method=${request.method}, " +
            "url=${PrivateString(request.url.toString())}, " +
            "status=${response.code}, " +
            "duration=${duration}ms, " +
            "bodySize=${response.body?.contentLength() ?: 0}"
        }

        return response
    }
}

// Usage in OkHttpClient builder
val client = OkHttpClient.Builder()
    .addInterceptor(StructuredLoggingInterceptor())
    .build()
```

## Testing Protocol

For each Kotlin file created/migrated:

1. **Build Test**: Android Studio build succeeds
2. **Runtime Test**: Run Share Intent with test URL
3. **Log Verification**: Check Logcat for structured logs
   ```bash
   # Filter by app tag
   adb logcat RecipeArchive:* *:S

   # Filter by specific component
   adb logcat RecipeArchive:ShareReceiver:* *:S

   # Search for errors
   adb logcat RecipeArchive:* *:S | grep ERROR

   # Show timing logs
   adb logcat RecipeArchive:* *:S | grep "duration="
   ```
4. **Privacy Test**: Confirm URLs/user IDs show `[REDACTED]` in release builds
5. **Firebase Test**: Verify custom keys appear in Crashlytics for errors

## Style Guide Additions

### Kotlin Logging Guidelines

**DO**:
- Use Timber via `AppLogger` centralized factory
- Use lambda-based logging for lazy evaluation: `logger.i { "message" }`
- Wrap sensitive data in `PrivateString` for redaction
- Include timing for async operations (network, WebView loads)
- Use appropriate log levels (Info for normal ops, Error for failures)
- Add Firebase Crashlytics custom keys for error context

**DON'T**:
- Use `Log.d()` directly (bypasses Timber infrastructure)
- Use string concatenation in log calls (impacts performance)
- Log authentication tokens, passwords, or API keys
- Log in tight loops (impacts performance)
- Forget to check log level before expensive string building

**Example**:
```kotlin
// ❌ Bad: Direct Log.d, no structure, URL exposed
Log.d("TAG", "Failed to load $url: $error")

// ❌ Bad: String concatenation (always evaluated)
AppLogger.network.e("Failed: " + buildExpensiveString())

// ✅ Good: Timber via AppLogger, lazy eval, privacy
AppLogger.network.e(error) {
    "Network request failed: url=${PrivateString(url)}, statusCode=$statusCode"
}
```

## Migration Checklist

### Share Intent Components (New Files)
- [ ] ShareIntentReceiver.kt (intent handling)
- [ ] WebViewContentLoader.kt (HTML extraction, ~15 log points)
- [ ] AppLogger.kt (centralized logger factory)
- [ ] PrivateString.kt (sensitive data wrapper)

### Network Layer (New Files)
- [ ] S3UploadManager.kt (S3 uploads)
- [ ] RecipeAPIClient.kt (backend API)
- [ ] StructuredLoggingInterceptor.kt (OkHttp logging)
- [ ] CognitoAuthManager.kt (authentication)

### Storage Layer (New Files)
- [ ] CacheManager.kt (local caching)
- [ ] AppGroupStorage.kt (SharedPreferences)

### Flutter Integration (New Files)
- [ ] FlutterBridge.kt (MethodChannel handlers)

### Infrastructure (New Files)
- [ ] CrashlyticsTree.kt (Firebase integration)
- [ ] RecipeArchiveApplication.kt (Timber initialization)

**Total Progress: 0/13 files (all new, no migration needed)**

## Logcat Queries (Post-Implementation)

After implementation, these queries will work:

```bash
# All Share Intent activity
adb logcat RecipeArchive:ShareReceiver:* *:S

# WebView errors only
adb logcat RecipeArchive:WebView:* *:S | grep ERROR

# Network requests with duration
adb logcat RecipeArchive:Network:* *:S | grep "duration="

# Authentication events
adb logcat RecipeArchive:Auth:* *:S

# Performance: Share Intent processing times
adb logcat RecipeArchive:* *:S | grep "Share processing succeeded" | grep "duration="
```

## Firebase Crashlytics Integration

For production monitoring:

1. **Non-fatal errors**: Use `FirebaseCrashlytics.recordException()`
2. **Custom keys**: Add context via `setCustomKey()`
3. **User IDs**: Set via `setUserId()` for error correlation
4. **Breadcrumbs**: Use Timber logs as breadcrumbs (max 64KB)

```kotlin
// Example: Record non-fatal error with context
try {
    processRecipe(url)
} catch (e: Exception) {
    FirebaseCrashlytics.getInstance().apply {
        setCustomKey("recipe_url", PrivateString(url).toString())
        setCustomKey("operation", "share_intent_processing")
        setCustomKey("duration_ms", processingTime)
        recordException(e)
    }
    AppLogger.shareReceiver.e(e) { "Recipe processing failed" }
}
```

## Success Metrics

- **Coverage**: 100% of Share Intent flow logged
- **Privacy**: 0 URLs/user IDs exposed in release builds
- **Performance**: Share Intent P95 duration < 5s (visible in Firebase Performance)
- **Diagnostics**: Firebase Crashlytics shows custom keys for 100% of errors
- **Correlation**: Recipe processing traceable from Share → Kotlin → Flutter → Backend

## Dependencies

Add to `android/app/build.gradle`:

```gradle
dependencies {
    // Timber for structured logging
    implementation 'com.jakewharton.timber:timber:5.0.1'

    // Firebase Crashlytics for production monitoring
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-crashlytics-ktx'
    implementation 'com.google.firebase:firebase-analytics-ktx'

    // OkHttp for network logging
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
}
```

## References

- [Timber Documentation](https://github.com/JakeWharton/timber)
- [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics/get-started?platform=android)
- [OkHttp Logging](https://square.github.io/okhttp/features/logging/)
- [Android Logcat](https://developer.android.com/studio/command-line/logcat)
