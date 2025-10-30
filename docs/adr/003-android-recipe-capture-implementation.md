# ADR 003: Android Recipe Capture Implementation Plan

**Status**: Proposed
**Date**: 2025-10-29
**Platform**: Android
**Target**: Parity with iOS v1.0.0

## Context

iOS recipe capture is production-ready with WKWebView-based HTML+image extraction. Android requires equivalent functionality to maintain cross-platform feature parity.

## iOS Reference Architecture

See [ADR 002](002-ios-recipe-capture-architecture.md) for complete iOS implementation details.

**iOS Success Pattern**:
- WKWebView loads URL in background (off-screen)
- JavaScript extracts HTML + image URLs from rendered DOM
- URLSession downloads images (bypasses CDN restrictions via authenticated session)
- Base64 encode and save to App Group
- CFNotification wakes Flutter app
- MethodChannel passes data to Dart
- Backend API receives HTML + images, parses recipe

**Key Success Factors**:
1. Client-side HTML extraction (works with paywalled content)
2. Client-side image download (bypasses 403 errors)
3. Asynchronous processing (doesn't block UI)
4. Queue-based architecture (handle multiple shares)

## Android Implementation Plan

### Phase 1: Share Intent Receiver (Week 1)

**Goal**: Receive shared URLs from Chrome/Firefox and pass to Flutter app

**Components**:

1. **AndroidManifest.xml** - Register share intent handler
```xml
<activity
    android:name=".ShareActivity"
    android:exported="true"
    android:theme="@style/Theme.Transparent">
    <intent-filter>
        <action android:name="android.intent.action.SEND" />
        <category android:name="android.intent.category.DEFAULT" />
        <data android:mimeType="text/plain" />
    </intent-filter>
</activity>
```

2. **ShareActivity.kt** - Receive URL and delegate to WebView loader
```kotlin
class ShareActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent?.action == Intent.ACTION_SEND) {
            val sharedUrl = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (sharedUrl != null && isValidWebUrl(sharedUrl)) {
                // Load HTML via WebView
                WebViewContentLoader(this, sharedUrl) { html, images ->
                    saveToSharedPreferences(sharedUrl, html, images)
                    openMainApp()
                }
            }
        }
    }
}
```

3. **MethodChannel Integration** - Bridge to Flutter
```kotlin
// MainActivity.kt
class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.recipearchive/share"

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method == "checkForSharedUrl") {
                    result.success(checkSharedPreferences())
                }
            }
    }
}
```

**Deliverables**:
- [ ] AndroidManifest.xml with share intent filter
- [ ] ShareActivity.kt skeleton
- [ ] MethodChannel bridge to Flutter
- [ ] SharedPreferences queue mechanism
- [ ] Unit tests for URL validation

### Phase 2: WebView HTML Extraction (Week 2)

**Goal**: Load URL in background WebView, extract HTML + images

**Components**:

1. **WebViewContentLoader.kt** - Mirror iOS implementation
```kotlin
class WebViewContentLoader(
    private val context: Context,
    private val url: String,
    private val callback: (String?, Map<String, ByteArray>?) -> Unit
) {
    private var webView: WebView? = null
    private val imageData = mutableMapOf<String, ByteArray>()

    init {
        webView = WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    extractHtmlAndImages()
                }
            }
            loadUrl(url)
        }

        // 30-second timeout
        Handler(Looper.getMainLooper()).postDelayed({
            completeWithError()
        }, 30000)
    }

    private fun extractHtmlAndImages() {
        webView?.evaluateJavascript("""
            (function() {
                let images = document.querySelectorAll('img');
                let imageUrls = [];
                images.forEach(img => {
                    if (img.src && (img.width >= 200 || img.height >= 200)) {
                        imageUrls.push(img.src);
                    }
                });
                return JSON.stringify({
                    html: document.documentElement.outerHTML,
                    images: imageUrls
                });
            })();
        """) { result ->
            val data = JSONObject(result)
            val html = data.getString("html")
            val imageUrls = data.getJSONArray("images")

            // Download images asynchronously
            downloadImages(imageUrls) {
                callback(html, imageData)
            }
        }
    }

    private fun downloadImages(urls: JSONArray, onComplete: () -> Unit) {
        // Use OkHttp or HttpURLConnection to download images
        // Store in imageData map with base64 encoding
        // Call onComplete() when all downloads finish
    }
}
```

2. **Image Download Service** - Parallel image fetching
```kotlin
class ImageDownloader {
    fun downloadImages(
        urls: List<String>,
        callback: (Map<String, ByteArray>) -> Unit
    ) {
        val results = mutableMapOf<String, ByteArray>()
        val latch = CountDownLatch(urls.size)

        urls.forEach { url ->
            OkHttpClient().newCall(Request.Builder().url(url).build())
                .enqueue(object : Callback {
                    override fun onResponse(call: Call, response: Response) {
                        response.body?.bytes()?.let { results[url] = it }
                        latch.countDown()
                    }

                    override fun onFailure(call: Call, e: IOException) {
                        latch.countDown()
                    }
                })
        }

        thread {
            latch.await(10, TimeUnit.SECONDS)
            callback(results)
        }
    }
}
```

**Deliverables**:
- [ ] WebViewContentLoader.kt implementation
- [ ] ImageDownloader.kt with OkHttp integration
- [ ] JavaScript extraction script
- [ ] Timeout handling
- [ ] Integration tests with test URLs

### Phase 3: Flutter Integration (Week 3)

**Goal**: Pass extracted data to Flutter app via existing MethodChannel

**Components**:

1. **Shared Storage** - Use SharedPreferences for IPC
```kotlin
private fun saveToSharedPreferences(
    url: String,
    html: String?,
    images: Map<String, ByteArray>?
) {
    val prefs = getSharedPreferences("recipe_queue", Context.MODE_PRIVATE)
    val timestamp = System.currentTimeMillis()
    val uuid = UUID.randomUUID().toString().take(8)
    val key = "recipe_${timestamp}_${uuid}"

    val payload = JSONObject().apply {
        put("url", url)
        put("timestamp", timestamp)
        html?.let { put("html", it) }
        images?.let {
            val imagesArray = JSONArray()
            it.forEach { (imageUrl, data) ->
                imagesArray.put(JSONObject().apply {
                    put("url", imageUrl)
                    put("data", Base64.encodeToString(data, Base64.DEFAULT))
                    put("mimeType", inferMimeType(imageUrl))
                })
            }
            put("images", imagesArray)
        }
    }

    prefs.edit().putString(key, payload.toString()).apply()
}
```

2. **Flutter MethodChannel** - Reuse existing iOS channel
```kotlin
private fun checkSharedPreferences(): String? {
    val prefs = getSharedPreferences("recipe_queue", Context.MODE_PRIVATE)
    val allPrefs = prefs.all

    // Get oldest recipe (sorted by timestamp)
    val oldestKey = allPrefs.keys
        .filter { it.startsWith("recipe_") }
        .minByOrNull { prefs.getString(it, "")?.let {
            JSONObject(it).getLong("timestamp")
        } ?: Long.MAX_VALUE }

    return oldestKey?.let {
        val payload = prefs.getString(it, null)
        prefs.edit().remove(it).apply()
        payload
    }
}
```

3. **Dart Side** - Existing code already supports Android
```dart
// recipe_archive/lib/services/share_channel.dart
// No changes required - already platform-agnostic
static Future<Map<String, dynamic>?> checkForSharedUrl() async {
    final String? result = await _channel.invokeMethod('checkForSharedUrl');
    if (result == null) return null;

    final Map<String, dynamic> payload = json.decode(result);
    return {
        'url': payload['url'] as String,
        if (payload.containsKey('html')) 'html': payload['html'] as String,
        if (payload.containsKey('images')) 'images': payload['images'] as List,
    };
}
```

**Deliverables**:
- [ ] SharedPreferences queue implementation
- [ ] MethodChannel handler in MainActivity
- [ ] Integration with existing Flutter code
- [ ] End-to-end test: Share URL → Flutter app receives data

### Phase 4: Testing & Polish (Week 4)

**Goal**: Production-ready Android share extension

**Testing Matrix**:
- [ ] Chrome share intent
- [ ] Firefox share intent
- [ ] DuckDuckGo share intent
- [ ] Edge share intent
- [ ] Paywalled sites (NYT Cooking, Food Network)
- [ ] CDN-restricted images
- [ ] Multiple rapid shares (queue handling)
- [ ] App backgrounded during WebView load
- [ ] Network timeout scenarios
- [ ] Invalid URLs
- [ ] Large HTML pages (>5MB)

**Performance Optimization**:
- [ ] WebView recycling (pool pattern)
- [ ] Image download parallelization
- [ ] Memory management (large image handling)
- [ ] Battery impact analysis

**Error Handling**:
- [ ] Network errors
- [ ] WebView crashes
- [ ] JavaScript errors
- [ ] OOM scenarios
- [ ] User cancellation

**Deliverables**:
- [ ] Test suite (instrumented + unit tests)
- [ ] Performance benchmarks
- [ ] Error telemetry integration
- [ ] User-facing error messages
- [ ] Build script: `./scripts/build-android-unified.sh`

## Alternative Approaches Considered

### Option 1: Chrome Custom Tabs Service

**Concept**: Use Chrome Custom Tabs API to extract HTML

**Pros**:
- Direct access to Chrome's rendering engine
- Potentially faster than WebView

**Cons**:
- Chrome-only (doesn't work with Firefox, Edge, etc.)
- Limited HTML extraction API
- Requires Chrome 45+ (excludes older devices)

**Decision**: Not recommended - WebView provides broader compatibility

### Option 2: Flutter Plugin (receive_sharing_intent)

**Concept**: Use `receive_sharing_intent` pub.dev package

**Pros**:
- Less native code to write
- Maintained by community

**Cons**:
- Provides URL only (no HTML/image extraction)
- Still requires native WebView code for HTML
- Additional dependency

**Decision**: Use for inspiration, but implement custom solution for full control

### Option 3: Background Service

**Concept**: Run WebView in background service instead of transparent activity

**Pros**:
- Doesn't flash UI to user
- Can handle multiple requests in queue

**Cons**:
- Android 12+ background execution restrictions
- Battery drain concerns
- Requires foreground service notification

**Decision**: Use transparent activity initially, evaluate background service later

## Implementation Dependencies

**Required Tools**:
- Android Studio Hedgehog (2023.1.1) or later
- Kotlin 1.9+
- Flutter SDK (already installed)
- OkHttp for image downloads

**Required Permissions**:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

**Gradle Dependencies**:
```gradle
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

## Success Criteria

- [ ] Android users can share URLs from any browser to RecipeArchive app
- [ ] HTML + images extracted client-side (mirrors iOS behavior)
- [ ] Queue-based architecture handles multiple rapid shares
- [ ] Integration tests pass for 10+ recipe sites
- [ ] No regressions in Flutter app functionality
- [ ] Build script validates all components

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| WebView API differences vs iOS | High | Extensive testing, fallback to URL-only mode |
| Android version fragmentation | Medium | Target API 28+ (90% of devices) |
| Memory pressure on low-end devices | Medium | Image size limits, WebView recycling |
| Browser compatibility issues | Low | Test matrix covers 4 major browsers |

## Timeline Estimate

- **Week 1**: Share intent receiver + MethodChannel (5 days)
- **Week 2**: WebView HTML extraction + image download (7 days)
- **Week 3**: Flutter integration + queue system (5 days)
- **Week 4**: Testing + polish + build automation (5 days)

**Total**: 22 working days (~1 month)

## References

- [Android Share Intent Documentation](https://developer.android.com/training/sharing/receive)
- [WebView API Reference](https://developer.android.com/reference/android/webkit/WebView)
- [Flutter MethodChannel Guide](https://docs.flutter.dev/platform-integration/platform-channels)
- [OkHttp Documentation](https://square.github.io/okhttp/)
- [iOS ADR 002](002-ios-recipe-capture-architecture.md)

## Related Documentation

- [iOS Implementation](002-ios-recipe-capture-architecture.md) - Reference architecture
- [Backend Parser](../../aws-backend/functions/recipes/parser.go) - Server-side HTML parsing
- [CLAUDE.md](../../CLAUDE.md) - Project development guide
