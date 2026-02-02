# Recipe Capture Architecture

## iOS Recipe Capture

**Architecture**: Three-tier approach (see [ADR 002](../docs/adr/002-ios-recipe-capture-architecture.md))

1. **WKWebView Proxy** (primary) - Loads page in background, extracts HTML + images
2. **Web Archive** - Offline capture with embedded resources
3. **URL-only** - Fallback for public content

### Key Implementation
[WebViewContentLoader.swift](../recipe_archive/ios/Shared/WebViewContentLoader.swift)

- Off-screen WKWebView loads URL with authenticated session
- JavaScript extracts HTML + image URLs
- URLSession downloads images (bypasses CDN restrictions)
- Base64 encodes and saves to App Group
- Flutter app processes via MethodChannel

### Files
- `recipe_archive/ios/Shared/WebViewContentLoader.swift` - WKWebView loader
- `recipe_archive/ios/RecipeArchive/ShareViewController.swift` - Share Extension entry point
- `recipe_archive/ios/Runner/AppDelegate.swift` - Flutter integration
- `recipe_archive/lib/services/share_channel.dart` - Dart bridge

---

## Android Recipe Capture

**Architecture**: Full parity with iOS three-tier approach (see [ADR 003](../docs/adr/003-android-recipe-capture-implementation.md))

1. **WebView Proxy** (primary) - Loads page in background, extracts HTML + images
2. **SharedPreferences Queue** - Reliable cross-process communication
3. **URL-only** - Fallback for public content

### Key Implementation
[WebViewContentLoader.kt](../recipe_archive/android/app/src/main/kotlin/com/recipeArchive/recipe_archive/WebViewContentLoader.kt)

- Off-screen WebView loads URL with authenticated session (cookies, headers)
- JavaScript extracts HTML + image URLs
- OkHttp downloads images (bypasses CDN restrictions)
- Base64 encodes and queues via SharedPreferences
- Flutter app processes via MethodChannel

### Files
- `recipe_archive/android/app/src/main/kotlin/com/recipeArchive/recipe_archive/ShareActivity.kt` - Share intent receiver
- `recipe_archive/android/app/src/main/kotlin/com/recipeArchive/recipe_archive/WebViewContentLoader.kt` - WebView loader
- `recipe_archive/android/app/src/main/kotlin/com/recipeArchive/recipe_archive_fresh/MainActivity.kt` - MethodChannel bridge
- `recipe_archive/android/app/src/main/AndroidManifest.xml` - Share intent configuration
- `recipe_archive/lib/services/share_channel.dart` - Dart bridge (shared with iOS)

