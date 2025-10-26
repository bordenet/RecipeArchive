# PRD: Mobile Share Target Integration

## Overview

Enable Recipe Archive native apps (iOS/Android) to receive recipe URLs shared from mobile browsers, parse recipes using existing extraction logic, and save them to AWS backend.

**Version:** 1.0.0
**Status:** Draft
**Author:** Product Team
**Date:** 2025-10-25

## Problem Statement

Users browsing recipes on mobile Safari/Chrome cannot easily save recipes to Recipe Archive. They must:
1. Copy the URL
2. Open Recipe Archive app
3. Paste and submit manually

This friction reduces adoption and breaks the natural mobile sharing workflow.

## Solution

Implement platform-native share target functionality that allows users to share recipe URLs directly from their mobile browser to Recipe Archive app, triggering automatic parsing and storage.

## User Flow

### iOS (Safari/Chrome)
1. User views recipe on supported site (e.g., Food52.com)
2. Taps share button (square with upward arrow)
3. Scrolls through share sheet to find "Recipe Archive"
4. Taps "Recipe Archive" icon
5. Recipe Archive app opens, displays parsing progress
6. Recipe appears in user's collection

### Android (Chrome/Firefox)
1. User views recipe on supported site
2. Taps three-dot menu → Share
3. Selects "Recipe Archive" from share sheet
4. Recipe Archive app opens, displays parsing progress
5. Recipe appears in user's collection

## Technical Architecture

### Platform Integration

#### iOS Implementation
```swift
// Share Extension Target
// Info.plist configuration for NSExtensionActivationRule
// CRITICAL: Only activate for web content, not other apps
{
  "NSExtensionActivationSupportsWebURLWithMaxCount": 1,
  "NSExtensionActivationSupportsWebPageWithMaxCount": 1
}
```

**Activation Rules:**
- **Web URLs Only**: Share target only appears when sharing from mobile browsers (Safari, Chrome, Firefox, Edge)
- **Not for Apps**: Share target will NOT appear when sharing from native iOS apps (Photos, Notes, Messages, etc.)
- **Validation**: Extension validates that shared content is a valid HTTP/HTTPS URL before proceeding

**Components:**
- **Share Extension**: Separate app extension target that receives shared content
- **App Group**: Shared container for passing data between extension and main app
- **URL Scheme**: Deep link to open main app with recipe data

#### Android Implementation
```xml
<!-- AndroidManifest.xml -->
<!-- CRITICAL: Only accept text/plain (URLs) from web browsers -->
<intent-filter>
  <action android:name="android.intent.action.SEND" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="text/plain" />
</intent-filter>
```

**Activation Rules:**
- **Web URLs Only**: Intent filter accepts `text/plain` MIME type, typically used for sharing URLs from browsers
- **Validation Required**: Code must validate that shared text is a valid URL (not arbitrary text from other apps)
- **Browser Detection**: While Android doesn't restrict by source app in manifest, runtime validation ensures only HTTP/HTTPS URLs are processed
- **Rejection of Non-URLs**: Sharing text snippets, file paths, or app-specific data will be rejected with error dialog

**Components:**
- **Intent Filter**: Registers app as share target for URLs
- **Activity**: Handles incoming share intents
- **Deep Link**: Routes to recipe parsing flow

### Code Reuse Strategy

Both platforms will reuse existing parsing logic:

1. **Extract URL** from platform share data
2. **Fetch webpage** content via HTTP client
3. **Parse recipe** using shared Dart/Flutter business logic
4. **Upload to AWS** using existing API clients

### Shared Parsing Pipeline

```
Mobile Browser Share
    ↓
Platform Share Handler (Swift/Kotlin)
    ↓
Flutter Share Receiver (MethodChannel)
    ↓
Existing Recipe Parser (Dart)
    ↓
AWS Upload Service (Dart)
    ↓
S3 Storage + SQS Processing
```

### Implementation Plan

#### Phase 1: iOS Share Extension (Week 1-2)

1. **Create Share Extension Target**
   - Add new iOS App Extension to Flutter project
   - Configure Info.plist for URL/webpage activation **ONLY** (web content restriction)
   - Validate activation rules prevent sharing from non-browser apps
   - Set up App Group for data sharing

2. **Implement Native Handler**
   - Extract URL from NSExtensionItem
   - Validate URL format (HTTP/HTTPS only)
   - Reject non-URL content with error message
   - Pass valid URLs to main app via App Group or URL scheme
   - Handle network failures gracefully with user feedback

3. **Integrate with Flutter**
   - Add MethodChannel in Flutter for share handling
   - Implement error handling with diagnostic reporting
   - Route to existing recipe parsing flow
   - Display progress UI
   - Show error dialogs for parse failures
   - Report all failures to diagnostic backend API

#### Phase 2: Android Intent Filter (Week 3)

1. **Register Share Target**
   - Update AndroidManifest.xml with intent filter (text/plain MIME type)
   - Implement runtime validation for web URLs only
   - Create/modify Activity to handle SEND intents

2. **Implement Intent Handler**
   - Extract shared content from Intent extras
   - Validate content is a valid HTTP/HTTPS URL
   - Reject non-URL text (arbitrary strings, file paths) with error dialog
   - Pass valid URLs to Flutter via MethodChannel
   - Handle edge cases (multiple URLs, invalid data, empty content)

3. **Integrate with Flutter**
   - Reuse iOS MethodChannel interface
   - Same parsing/upload flow as iOS
   - Same error handling and diagnostic reporting as iOS

#### Phase 3: Testing & Refinement (Week 4)

1. **Cross-platform Testing**
   - **iOS Browser Testing**: Safari, Chrome, Firefox, Edge (verify share target appears)
   - **iOS App Testing**: Photos, Notes, Messages (verify share target does NOT appear)
   - **Android Browser Testing**: Chrome, Firefox, Samsung Internet, Edge (verify share target appears)
   - **Android App Testing**: Other apps sharing text (verify URL validation rejects non-URLs)
   - Verify parsing across supported recipe sites
   - Test unsupported sites trigger error dialog + diagnostic report

2. **Error Handling & Diagnostic Reporting**
   - Network timeout handling with retry UI
   - Invalid URL rejection (non-web URLs, malformed URLs)
   - User-facing error dialogs with clear messaging
   - Automatic diagnostic reporting to backend API for all failures
   - Test diagnostic payload structure and API integration
   - Verify error messages are non-technical and actionable

3. **Performance Optimization**
   - Background processing for large images
   - Progress indicators during parsing
   - Cache parsed recipes to prevent duplicates

## Technical Specifications

### Supported Input Types

| Platform | Input Type | Notes |
|----------|------------|-------|
| iOS | URL (String) | Preferred method |
| iOS | Web Page (Safari Reading List) | Extract URL from page metadata |
| Android | URL (text/plain) | Standard share format |
| Android | Web Page Title + URL | Some browsers send both |

### Data Flow

```dart
// Shared Dart code (existing)
class ShareHandler {
  Future<void> handleSharedUrl(String url) async {
    try {
      // 1. Validate URL (must be HTTP/HTTPS from web)
      if (!isValidWebUrl(url)) {
        await reportFailedParse(url, "invalid_url");
        throw InvalidUrlException("Not a valid web URL");
      }

      // 2. Fetch page content (existing HTTP client)
      final html = await fetchPageContent(url);

      // 3. Parse recipe (existing parser)
      final recipe = await recipeParser.parse(html, url);

      // 4. Validate parse results
      if (!recipe.hasValidContent()) {
        await reportFailedParse(url, "parse_failure");
        throw ParseException("Unable to extract recipe from page");
      }

      // 5. Upload to AWS (existing API)
      await uploadRecipe(recipe);

      // 6. Emit success event
      emit(RecipeAddedEvent(recipe));

    } on InvalidUrlException catch (e) {
      // Show error dialog, report to diagnostics
      await showErrorDialog("Invalid URL", "Recipe Archive only works with web pages from recipe sites.");
      rethrow;

    } on ParseException catch (e) {
      // Show error dialog, report to diagnostics
      await showErrorDialog("Unable to Parse Recipe", "We couldn't find a recipe on this page. This has been reported to help improve support.");
      rethrow;

    } catch (e) {
      // Generic error handling
      await reportFailedParse(url, "unknown_error", error: e.toString());
      await showErrorDialog("Something Went Wrong", "Please try again or contact support if the problem persists.");
      rethrow;
    }
  }

  Future<void> reportFailedParse(String url, String errorType, {String? error}) async {
    // Send to diagnostic backend API
    await diagnosticService.reportMobileShareFailure(
      url: url,
      errorType: errorType,
      errorDetails: error,
      platform: Platform.operatingSystem,
      timestamp: DateTime.now(),
    );
  }
}
```

### Platform Channel Interface

```dart
// Flutter side
static const platform = MethodChannel("com.recipearchive/share");

Future<void> initializeShareHandler() async {
  platform.setMethodCallHandler((call) async {
    if (call.method == "handleSharedUrl") {
      final url = call.arguments as String;
      await shareHandler.handleSharedUrl(url);
    }
  });
}
```

```swift
// iOS side
let channel = FlutterMethodChannel(
  name: "com.recipearchive/share",
  binaryMessenger: controller.binaryMessenger
)

channel.invokeMethod("handleSharedUrl", arguments: sharedUrl)
```

```kotlin
// Android side
val channel = MethodChannel(
  flutterEngine.dartExecutor.binaryMessenger,
  "com.recipearchive/share"
)

channel.invokeMethod("handleSharedUrl", sharedUrl)
```

## Security Considerations

### Image Upload Security
- **Maintain existing security model**: Images upload directly from app to S3
- **No external URL fetching on backend**: Backend validates S3-only URLs
- **Mobile app downloads images**: Fetch from recipe site, upload to S3
- **CORS handling**: Mobile apps not subject to browser CORS restrictions

### URL Validation
- **Web-only restriction**: Share target only appears for web content (enforced via platform configuration)
- **URL format validation**: Reject non-HTTP/HTTPS URLs before fetching
- **Runtime validation**: Verify shared content is a valid URL (not arbitrary text, file paths, or app data)
- **HTTPS preference**: Warn or auto-upgrade HTTP to HTTPS where possible
- **Domain whitelist**: Optional future enhancement for abuse prevention
- **Rate limiting**: Per-user share request limits to prevent abuse

### Authentication
- Require user login before accepting shares
- Associate parsed recipes with authenticated user's tenant
- Use existing JWT authentication flow

## User Experience

### Success Flow
1. User shares URL from browser
2. App opens with loading spinner
3. Progress indicator shows:
   - "Fetching recipe..."
   - "Parsing ingredients..."
   - "Uploading images..."
4. Success message: "Recipe added to your collection"
5. Navigate to recipe detail view

### Error Handling

All parsing failures automatically report to diagnostic backend API for analysis and improvement.

| Error | User Message | Recovery Action | Diagnostic Report |
|-------|--------------|-----------------|-------------------|
| Non-web URL | "Invalid URL - Recipe Archive only works with web pages from recipe sites." | Dismiss, return to source app | ✓ Sent (error_type: `invalid_url`) |
| Non-URL content shared | "Invalid URL - Recipe Archive only works with web pages from recipe sites." | Dismiss, return to source app | ✓ Sent (error_type: `invalid_url`) |
| Network timeout | "Couldn't connect. Try again?" | Retry button | ✓ Sent (error_type: `network_timeout`) |
| Parsing failed | "Unable to Parse Recipe - We couldn't find a recipe on this page. This has been reported to help improve support." | Dismiss, return to browser | ✓ Sent (error_type: `parse_failure`) |
| Auth required | "Please log in to save recipes" | Navigate to login | ✗ Not sent (user action required) |
| Duplicate recipe | "You already have this recipe" | View existing recipe | ✗ Not sent (expected behavior) |
| Unknown error | "Something Went Wrong - Please try again or contact support if the problem persists." | Dismiss | ✓ Sent (error_type: `unknown_error`) |

#### Diagnostic Reporting Payload

```dart
{
  "event_type": "mobile_share_failure",
  "url": "https://example.com/recipe",
  "error_type": "parse_failure", // invalid_url, network_timeout, parse_failure, unknown_error
  "error_details": "Exception message or stack trace",
  "platform": "iOS" | "Android",
  "app_version": "1.2.0",
  "user_id": "tenant_uuid",
  "timestamp": "2025-10-25T14:30:00Z",
  "browser_context": "com.apple.mobilesafari" // if detectable
}
```

#### Error Dialog Design

**Title**: Clear, non-technical error name
**Message**: User-friendly explanation with actionable context
**Actions**:
- Primary: Dismiss / OK (closes dialog, returns to source app)
- Secondary (optional): Retry (network errors only)

**Example:**
```
┌─────────────────────────────────┐
│    Unable to Parse Recipe       │
├─────────────────────────────────┤
│ We couldn't find a recipe on    │
│ this page. This has been        │
│ reported to help improve        │
│ support.                        │
│                                 │
│              [OK]               │
└─────────────────────────────────┘
```

## Analytics & Monitoring

### Track Events

**Success Events:**
- `share_received` (platform, browser, url_domain)
- `share_parse_success` (platform, parsing_duration_ms, url_domain)
- `share_upload_success` (platform, image_count, upload_duration_ms)

**Failure Events (Auto-reported to Diagnostics):**
- `share_parse_failure` (platform, error_type, url_domain, error_details)
  - error_type: `invalid_url`, `network_timeout`, `parse_failure`, `unknown_error`
- `share_upload_failure` (platform, error_type, url_domain)
- `share_non_web_content` (platform, content_type) - when non-URL content is shared

### Diagnostic Integration

**Backend API Extension:**
Create new endpoint for mobile share failure reporting:
```
POST /api/v1/diagnostics/mobile-share-failure
Authorization: Bearer <jwt_token>

Request Body:
{
  "event_type": "mobile_share_failure",
  "url": "https://example.com/recipe",
  "error_type": "parse_failure",
  "error_details": "Exception message",
  "platform": "iOS",
  "app_version": "1.2.0",
  "user_id": "tenant_uuid",
  "timestamp": "2025-10-25T14:30:00Z",
  "browser_context": "com.apple.mobilesafari"
}
```

**Diagnostic Tool Enhancement:**
Extend existing `get-diagnostics` tool to query and analyze mobile share failures:
- Share extension errors (iOS-specific)
- Platform channel communication failures
- Parse failures from mobile share flow
- Failed URL domains and patterns
- Error rate by platform and error type
- Retry success rates

**Data Storage:**
Store mobile share failure events in S3 diagnostic bucket for analysis:
- Path: `s3://diagnostics-bucket/mobile-share-failures/YYYY/MM/DD/HH/{uuid}.json`
- Retention: 90 days
- Queryable via Athena for aggregate analysis

## Success Metrics

### Adoption Metrics (30 days post-launch)
- 40%+ of mobile users try share feature
- 60%+ share success rate (parse + upload)
- 20%+ of new recipes added via share (vs. manual entry)

### Performance Metrics
- 95th percentile share-to-save time: <10 seconds
- Share feature crash rate: <0.1%
- Parsing success rate: >85% (same as web extensions)

## Dependencies

### Internal
- Existing Flutter recipe parser (Dart)
- AWS upload service (Dart)
- Authentication service (Dart)
- Diagnostic telemetry (Dart)

### External
- iOS 13+ (Share Extension support)
- Android 6+ (Intent filter support)
- AWS S3 (existing infrastructure)
- SQS normalization queue (existing)

### Development Tools
- Xcode 14+ (iOS development)
- Android Studio (Android development)
- Flutter 3.x (existing)

## Out of Scope (v1.0)

- Sharing images directly (URL only)
- Batch sharing (multiple URLs)
- Share from within Recipe Archive app to other apps
- Custom share sheet UI beyond platform defaults
- Sharing to specific collections/folders
- Offline share queuing (requires network)

## Future Enhancements (v2.0+)

- **Clipboard monitoring**: Auto-detect recipe URLs copied to clipboard
- **Share to collection**: Allow user to select destination collection during share
- **Share history**: Track and display recently shared recipes
- **Quick Actions**: iOS Home Screen quick action "Add Recipe"
- **Siri Shortcuts**: "Add recipe from [URL]" voice command
- **Android App Shortcuts**: Long-press app icon → "Add Recipe"

## Open Questions

1. Should we support sharing recipe text directly (without URL)?
   - **Recommendation**: No, URL required for source attribution and updates

2. Should we deduplicate based on URL before parsing?
   - **Recommendation**: Yes, check existing recipes by source URL first

3. How to handle paid content/paywalled recipes?
   - **Recommendation**: Parse what's available, same as web extensions

4. Should share extension work offline then sync later?
   - **Recommendation**: No for v1.0, requires network (future enhancement)

## Approval & Sign-off

- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] Security Review
- [ ] Privacy Review

## References

- [iOS Share Extension Documentation](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller)
- [Android Share Target Documentation](https://developer.android.com/training/sharing/receive)
- [Flutter Platform Channels](https://docs.flutter.dev/platform-integration/platform-channels)
- Recipe Archive: [CLAUDE.md](../CLAUDE.md)
- Recipe Archive: [COMMANDS.md](../COMMANDS.md)
