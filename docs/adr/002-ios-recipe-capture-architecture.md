# ADR 002: iOS Recipe Capture Architecture

**Status**: Accepted
**Date**: 2025-10-29
**Authors**: RecipeArchive Team
**Platform**: iOS (iPadOS)

## Context

RecipeArchive needs to capture recipes from web sources on iOS devices. The primary challenge is extracting full HTML content from paywalled websites where server-side HTML fetching fails due to authentication requirements. iOS Safari restricts Share Extension access to URLs only (not HTML content), requiring alternative approaches for authenticated content capture.

### Key Requirements

1. **Paywalled Content Access**: Capture recipes from sites requiring authentication (e.g., Food Network, NYT Cooking)
2. **Complete Data Extraction**: Extract full HTML, recipe data, and embedded images
3. **Cross-Browser Support**: Handle Safari (primary) and other iOS browsers (Chrome, Firefox, etc.)
4. **Image Handling**: Bypass CDN restrictions that block server-side image downloads
5. **Minimal User Friction**: Simple, intuitive sharing workflow

## Decision

We implemented a **three-tier approach** to recipe capture on iOS:

### Tier 1: Safari Web Extension (Premium Path) ✅ **Implemented**

**Availability**: iOS 15+, Safari only
**Access Level**: Full page HTML + Web Archive images
**Use Case**: Paywalled content, authenticated sessions

**Architecture**:
```
User taps Share → Safari Web Extension → JavaScript extracts HTML →
Native Swift handler → App Group storage → CFNotification →
Flutter app → Backend API (with HTML) → S3 storage
```

**Components**:
- **JavaScript Extension** ([RecipeExtension/Resources/](../../recipe_archive/ios/RecipeExtension/Resources/)):
  - `background.js`: Handles native messaging via `browser.runtime.sendNativeMessage()`
  - `popup.js`: User interface for triggering recipe capture
  - `manifest.json`: Extension permissions and configuration

- **Native Handler** ([SafariWebExtensionHandler.swift](../../recipe_archive/ios/RecipeExtension/SafariWebExtensionHandler.swift)):
  - Receives messages from JavaScript via `SafariWebExtensionHandler` protocol
  - Writes recipe data to App Group container (`group.com.recipearchive.shared`)
  - Posts `CFNotification` to wake Flutter app

- **Flutter Integration** ([ShareChannel](../../recipe_archive/lib/services/share_channel.dart)):
  - `AppDelegate.swift` listens for CFNotifications
  - Reads JSON payload from App Group
  - Invokes Flutter method channel with URL + HTML

**Advantages**:
- ✅ Full HTML access (runs in page context with authentication)
- ✅ Can extract Web Archive images (bypasses CDN restrictions)
- ✅ Works with paywalled content
- ✅ No server-side HTML fetching needed

**Limitations**:
- ❌ Safari only (not available in Chrome, Firefox, etc.)
- ❌ Requires iOS 15+ (App Extension with native messaging)
- ❌ Manual Xcode configuration required (see [XCODE_WEB_EXTENSION_SETUP.md](../../XCODE_WEB_EXTENSION_SETUP.md))

### Tier 2: Web Archive Sharing (Offline Path) ✅ **Implemented**

**Availability**: iOS 13+, Safari only
**Access Level**: Full page HTML + all embedded resources (images, CSS, JS)
**Use Case**: Offline recipe access, complete content preservation

**Architecture**:
```
User saves Web Archive → Shares .webarchive file →
Share Extension → Parses PropertyList format →
Extracts WebMainResource (HTML) + WebSubresources (images) →
Base64 encodes images → App Group storage →
Flutter app → Backend API → Matches images to recipe → S3 upload
```

**Implementation** ([ShareViewController.swift](../../recipe_archive/ios/RecipeArchive/ShareViewController.swift:119-216)):
```swift
// Extract Web Archive (contains both URL and HTML)
if attachment.hasItemConformingToTypeIdentifier("com.apple.webarchive") {
    let archive = PropertyListSerialization.propertyList(from: data, format: nil)

    // Extract URL
    let mainResource = archive["WebMainResource"]
    let url = mainResource["WebResourceURL"]

    // Extract HTML
    let htmlData = mainResource["WebResourceData"]
    let html = String(data: htmlData, encoding: .utf8)

    // Extract images from WebSubresources
    let subresources = archive["WebSubresources"]
    for resource in subresources {
        if mimeType.hasPrefix("image/") {
            webArchiveImages.append({
                url: resource["WebResourceURL"],
                data: resource["WebResourceData"], // Binary data
                mimeType: resource["WebResourceMIMEType"]
            })
        }
    }
}
```

**Backend Processing** ([main.go:999-1050](../../aws-backend/functions/recipes/main.go:999-1050)):
1. Parse HTML to extract recipe data (including main image URL)
2. Search `webArchiveImages` array for matching image URL
3. If found: decode base64 data and upload directly to S3
4. If not found: attempt HTTP download (may fail with 403)

**Advantages**:
- ✅ Complete offline content capture
- ✅ Bypasses CDN restrictions (images already downloaded by Safari)
- ✅ Works with paywalled content (if user is authenticated)
- ✅ Preserves all page resources

**Limitations**:
- ❌ Safari only (Web Archive is Apple proprietary format)
- ❌ Manual user action (save page as Web Archive first)
- ❌ Large file sizes (includes all page resources)

### Tier 3: Standard Share Extension (Fallback Path) ✅ **Implemented**

**Availability**: iOS 13+, All browsers
**Access Level**: URL only
**Use Case**: Public recipes, non-paywalled content

**Architecture**:
```
User shares URL → Share Extension → Extracts URL →
App Group storage → Flutter app → Backend API →
Server-side HTML fetch → HTML parsing → S3 storage
```

**Backend Fetch Logic** ([main.go:926-951](../../aws-backend/functions/recipes/main.go:926-951)):
```go
// BEST-EFFORT HTML FETCHING & PARSING
if recipeData.WebArchiveHTML == nil || *recipeData.WebArchiveHTML == "" {
    fmt.Printf("📡 [BEST-EFFORT] No HTML provided, attempting to fetch from %s\n", sourceURL)

    html, err := fetchHTMLFromURL(ctx, sourceURL)
    if err != nil {
        // Fetch failed - this is expected for paywalled sites
        fmt.Printf("⚠️ [BEST-EFFORT] Failed to fetch HTML: %v\n", err)
        fmt.Printf("📝 [BEST-EFFORT] Saving as bookmark - use Safari Web Extension for full parsing\n")

        // Update title to indicate bookmark status
        domain := getDomainFromURL(sourceURL)
        recipeData.Title = fmt.Sprintf("🔖 Bookmarked: %s", domain)
    } else {
        fmt.Printf("✅ [BEST-EFFORT] HTML fetched successfully (%d bytes)\n", len(html))
        htmlContent = html
    }
}
```

**Advantages**:
- ✅ Works in all browsers (Chrome, Firefox, DuckDuckGo, etc.)
- ✅ Simple user experience (standard iOS sharing)
- ✅ No manual configuration required

**Limitations**:
- ❌ Cannot access authenticated content (paywall bypass impossible)
- ❌ No HTML access from client (server must fetch)
- ❌ Fails on sites with CDN restrictions or bot detection

## Backend Architecture

### Recipe Processing Pipeline

**Input Format** ([models/recipe.go:93-119](../../aws-backend/functions/models/recipe.go:93-119)):
```go
type CreateRecipeRequest struct {
    // Standard fields
    Title                   string          `json:"title"`
    Ingredients             []Ingredient    `json:"ingredients"`
    Instructions            []Instruction   `json:"instructions"`
    SourceURL               string          `json:"sourceUrl"`

    // Premium HTML path (Safari Web Extension / Web Archive)
    WebArchiveHTML          *string             `json:"webArchiveHtml,omitempty"`
    WebArchiveImages        *[]WebArchiveImage  `json:"webArchiveImages,omitempty"`
}

type WebArchiveImage struct {
    URL      string `json:"url"`      // Original image URL
    Data     string `json:"data"`     // Base64-encoded image data
    MimeType string `json:"mimeType"` // image/jpeg, image/png, etc.
}
```

### Processing Flow

1. **HTML Parsing** ([parser.go](../../aws-backend/functions/recipes/parser.go)):
   - Extract JSON-LD structured data
   - Parse HTML DOM for recipe metadata
   - Extract main image URL

2. **Image Handling** ([main.go:999-1050](../../aws-backend/functions/recipes/main.go:999-1050)):
   ```go
   if recipeData.MainPhotoURL != nil {
       imageURL := *recipeData.MainPhotoURL

       // Check Web Archive images first (bypasses CDN restrictions)
       if recipeData.WebArchiveImages != nil {
           for _, img := range *recipeData.WebArchiveImages {
               if img.URL == imageURL {
                   // Upload from base64 data (avoids 403 errors)
                   s3URL := uploadWebArchiveImage(ctx, &img, userID, recipeID)
                   recipeData.MainPhotoURL = &s3URL
                   break
               }
           }
       }

       // Fallback: HTTP download (may fail with 403)
       if s3URL == "" {
           s3URL, err := downloadAndUploadImage(ctx, imageURL, userID, recipeID)
           if err != nil {
               fmt.Printf("⚠️ Image download failed: %s - recipe saves without image\n", err)
               recipeData.MainPhotoURL = nil
           }
       }
   }
   ```

3. **S3 Storage**:
   - Recipe JSON: `recipes/{userID}/{recipeID}.json`
   - Images: `recipe-images/{recipeID}/recipes/main-photo.{ext}`

## Future Considerations for Android

When implementing Android support, consider these approaches:

### Option 1: Chrome Extension (Recommended)

Similar to Safari Web Extension, Chrome on Android supports extensions that can:
- Access page HTML content
- Run in authenticated context
- Send data to native app via Custom Tabs / Chrome Custom Tabs Service

**Advantages**: Mirrors iOS Safari approach, full HTML access
**Limitations**: Chrome only, requires Chrome 90+ on Android

### Option 2: WebView Bridge

Use Android WebView with JavaScript interface:
```kotlin
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun sendRecipe(html: String) {
        // Process recipe data
    }
}, "RecipeArchive")
```

**Advantages**: Works with any browser that supports "Open in..." intent
**Limitations**: Requires users to "Open" page in RecipeArchive app (extra step)

### Option 3: Accessibility Service (Advanced)

Android Accessibility Service can capture UI content from other apps:
```kotlin
class RecipeCaptureService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val rootNode = event.source
        extractHtmlContent(rootNode)
    }
}
```

**Advantages**: Works across all apps/browsers
**Limitations**: Requires explicit user permission, privacy concerns, complex implementation

**Recommendation**: Start with **Option 1 (Chrome Extension)** for parity with iOS Safari, fall back to **Option 2 (WebView Bridge)** for other browsers.

## Alternative iOS Approaches (Not Implemented)

### Document Provider Extension

**Concept**: Use iOS Document Provider to access other apps' documents

**Pros**:
- System-level integration
- Works across apps

**Cons**:
- Complex setup (requires iCloud container, File Provider domain)
- Limited to file-based sharing (not suitable for web content)
- Poor user experience (multiple taps required)

**Decision**: **Not implemented** - Share Extension provides better UX for web content

### Action Extension with JavaScript Preprocessing

**Concept**: Use Action Extension (runs in-page) instead of Share Extension

**Pros**:
- Can access page content via `NSExtensionJavaScriptPreprocessingResultsKey`
- Runs in Safari context

**Cons**:
- Deprecated in favor of Safari Web Extensions (iOS 15+)
- Limited to Safari
- Complex JavaScript ↔ Native communication

**Decision**: **Not implemented** - Safari Web Extension is the modern replacement

### XPC Service for Inter-App Communication

**Concept**: Use XPC (Cross-Process Communication) for extension ↔ app data transfer

**Pros**:
- Secure, sandboxed IPC
- Bidirectional communication
- Built-in error handling

**Cons**:
- **Extremely complex setup** (requires entitlements, Mach services, launchd plists)
- Requires shared framework target for protocol definitions
- Debugging is difficult (XPC logs to system daemon)
- App Store review scrutiny (XPC usage must be justified)

**Decision**: **Not implemented** - App Group + CFNotification provides sufficient functionality with far less complexity. XPC would be overkill for our one-way data flow.

**When to Consider XPC**: If we needed bidirectional communication (e.g., extension requests data from main app, app sends progress updates back to extension), XPC would be the correct choice.

## Decision Drivers

1. **Paywalled Content**: Safari Web Extension is the only iOS solution that can access authenticated HTML
2. **Image CDN Restrictions**: Web Archive images bypass 403 errors from CDNs (e.g., Food Network)
3. **User Experience**: Standard Share Extension works everywhere as fallback
4. **Maintainability**: Three simple tiers easier to maintain than one complex solution
5. **Future-Proofing**: Architecture supports Android implementation with similar patterns

## Consequences

### Positive

- ✅ Full paywalled content support via Safari Web Extension
- ✅ Complete offline capture via Web Archive (including images)
- ✅ Graceful degradation to URL-only sharing on all browsers
- ✅ Backend handles all three input formats transparently
- ✅ Image handling bypasses CDN restrictions

### Negative

- ❌ Safari Web Extension requires manual Xcode configuration
- ❌ Different capabilities across browsers (Safari > Chrome/Firefox)
- ❌ Users must understand three different sharing methods
- ❌ Increased testing surface (3 paths × multiple iOS versions)

### Neutral

- 📝 Documentation critical for setup and troubleshooting
- 📝 Android will require parallel implementation (but can learn from iOS)
- 📝 Future browser changes may require adaptation

## References

- [Safari Web Extensions Documentation](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
- [iOS Share Extension Programming Guide](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)
- [Web Archive Format Specification](https://en.wikipedia.org/wiki/Webarchive)
- [App Groups Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_application-groups)
- [CFNotificationCenter](https://developer.apple.com/documentation/corefoundation/cfnotificationcenter-r8j)

## Related Documentation

- [XCODE_WEB_EXTENSION_SETUP.md](../../XCODE_WEB_EXTENSION_SETUP.md) - Step-by-step Safari Web Extension setup
- [PROJECT_STATUS.md](../../PROJECT_STATUS.md) - Current implementation status
- [CLAUDE.md](../../CLAUDE.md) - Project development guide

## Version History

- **v1.0** (2025-10-29): Initial ADR documenting iOS recipe capture architecture
  - Safari Web Extension implementation
  - Web Archive support with image extraction
  - Standard Share Extension fallback
  - Backend processing pipeline
  - Android future considerations
