# Kotlin Coding Style Guide for RecipeArchive

This document defines the Kotlin coding standards for the RecipeArchive Android application.

## 1. File Organization

### Package Structure
```kotlin
// Package name should follow reverse domain notation
package com.recipeArchive.recipe_archive

// Imports organized in groups:
// 1. Android framework
// 2. Third-party libraries (alphabetical)
// 3. Project-local imports
import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
```

### Class Structure Order
1. Companion object
2. Properties
3. Init blocks
4. Constructors
5. Override functions
6. Public functions
7. Private functions

## 2. Naming Conventions

### Classes and Objects
```kotlin
// PascalCase for classes
class MainActivity : FlutterActivity()
class WebViewContentLoader(...)

// Companion objects for constants
companion object {
    private const val TAG = "MainActivity"
    private const val TIMEOUT_MS = 30000L
}
```

### Functions and Variables
```kotlin
// camelCase for functions and variables
private fun extractHtmlAndImages() { }
val imageData = mutableMapOf<String, ByteArray>()
```

### Constants
```kotlin
// UPPER_SNAKE_CASE for constants in companion object
private const val TAG = "ShareActivity"
private const val PREFS_NAME = "recipe_queue"
private const val TIMEOUT_MS = 30000L
```

## 3. Logging Standards

Use Android's Log class with consistent tags:

```kotlin
// Tag should be class name
companion object {
    private const val TAG = "WebViewContentLoader"
}

// Log levels
Log.d(TAG, "Debug message")       // DEBUG: Development info
Log.i(TAG, "Info message")        // INFO: Normal flow
Log.w(TAG, "Warning message")     // WARN: Potential issues
Log.e(TAG, "Error message", e)    // ERROR: Failures with exception
```

### Logging Best Practices
- Always include TAG constant for filtering
- Use string templates for readability: `"Loading URL: $url"`
- Include context in messages: `"Downloaded image: $imageUrl (${bytes.size} bytes)"`
- Log exceptions with throwable parameter: `Log.e(TAG, "Error message", exception)`

## 4. Null Safety

Leverage Kotlin's null safety features:

```kotlin
// Use safe calls
val length = text?.length

// Use elvis operator for defaults
val name = user?.name ?: "Unknown"

// Use let for null checks
result?.let { value ->
    process(value)
}
```

## 5. Coroutines and Async Code

```kotlin
// Use CoroutineScope for structured concurrency
private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

// Cancel scopes in cleanup
private fun cleanup() {
    scope.cancel()
    webView?.destroy()
}

// Use appropriate dispatchers
Dispatchers.Main    // UI operations
Dispatchers.IO      // Network/disk operations
Dispatchers.Default // CPU-intensive work
```

## 6. Error Handling

```kotlin
// Use try-catch for expected errors
try {
    val data = JSONObject(result)
} catch (e: Exception) {
    Log.e(TAG, "Error parsing data", e)
    handleError()
}

// Use error callbacks for async operations
callback.onFailure(call, e)
```

## 7. Function Structure

```kotlin
// Single expression functions
private fun isValidWebUrl(url: String): Boolean =
    url.startsWith("http://") || url.startsWith("https://")

// Multi-line functions with clear separation
private fun saveToSharedPreferences(
    url: String,
    html: String?,
    images: Map<String, ByteArray>?
) {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    // Implementation
}
```

## 8. Collections and Loops

```kotlin
// Use Kotlin collection functions
val urls = imageUrls.take(maxImages)
val oldest = keys.minByOrNull { getTimestamp(it) }

// Use forEachIndexed when index is needed
images.entries.forEachIndexed { index, (url, data) ->
    process(index, url, data)
}
```

## 9. String Building

```kotlin
// Use buildString for complex JSON/text construction
val payload = buildString {
    append("{")
    append("\"url\":\"${escapeJson(url)}\",")
    append("\"timestamp\":$timestamp")
    append("}")
}

// Use string templates for simple cases
val message = "Loading $count items from $source"
```

## 10. Android-Specific Patterns

### MethodChannel Communication
```kotlin
MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
    .setMethodCallHandler { call, result ->
        when (call.method) {
            "methodName" -> {
                val data = processData()
                result.success(data)
            }
            else -> result.notImplemented()
        }
    }
```

### SharedPreferences
```kotlin
// Use apply() for asynchronous writes
prefs.edit().putString(key, value).apply()

// Use commit() only when synchronous write is required
val success = prefs.edit().putString(key, value).commit()
```

### WebView Configuration
```kotlin
webView = WebView(context).apply {
    settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
    }
}
```

## 11. Constants and Timeouts

```kotlin
// Define timeouts in milliseconds with clear naming
private const val TIMEOUT_MS = 30000L
private const val IMAGE_DOWNLOAD_TIMEOUT_MS = 10000L

// Use descriptive constant names
private const val MAX_IMAGES = 10
private const val MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
```

## 12. Documentation

```kotlin
/**
 * Loads webpage content using WebView and extracts HTML and images.
 *
 * @param context Android context for WebView creation
 * @param url URL to load
 * @param callback Called with (html, images) on success, or (null, null) on failure
 */
class WebViewContentLoader(
    private val context: Context,
    private val url: String,
    private val callback: (String?, Map<String, ByteArray>?) -> Unit
)
```

## Current Status

All RecipeArchive Android/Kotlin code follows these conventions:
- **MainActivity.kt**: MethodChannel integration, queue management
- **ShareActivity.kt**: Share intent handling, HTML extraction queuing
- **WebViewContentLoader.kt**: WebView-based HTML/image extraction

The codebase demonstrates consistent adherence to Kotlin best practices and Android development patterns.
