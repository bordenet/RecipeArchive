# Recipe Capture Architecture

## Three-Tier Approach (iOS & Android)

1. **WebView Proxy** (primary) - Loads page in background, extracts HTML + images
2. **Archive/Queue** - iOS Web Archive / Android SharedPreferences
3. **URL-only** - Fallback for public content

## iOS Implementation

See [ADR 002](../docs/adr/002-ios-recipe-capture-architecture.md)

Key file: `recipe_archive/ios/Shared/WebViewContentLoader.swift`
- Off-screen WKWebView loads URL with auth session
- JS extracts HTML + image URLs → URLSession downloads → Base64 → App Group
- Files: `ShareViewController.swift`, `AppDelegate.swift`, `share_channel.dart`

## Android Implementation

See [ADR 003](../docs/adr/003-android-recipe-capture-implementation.md)

Key file: `recipe_archive/android/app/src/main/kotlin/.../WebViewContentLoader.kt`
- Off-screen WebView loads URL with auth (cookies, headers)
- JS extracts HTML + image URLs → OkHttp downloads → Base64 → SharedPreferences
- Files: `ShareActivity.kt`, `MainActivity.kt`, `AndroidManifest.xml`, `share_channel.dart`

