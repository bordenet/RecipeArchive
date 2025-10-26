# Tasks for Gemini - iOS Share Extension HTML Passthrough

## Context
We're implementing HTML passthrough from iOS Share Extension to support paywalled recipe sites. The Share Extension now extracts both URL and HTML content. We need to complete the iOS→Flutter→Backend pipeline.

## Completed Work
✅ ShareViewController.swift - Extracts URL and HTML using DispatchGroup
✅ HomeScreen.dart - MVP bookmark flow committed (git hash: 8b32c84)

## Your Tasks

### Task 1: Update AppDelegate.swift to Return JSON Payload
**File**: `/Users/matt/GitHub/RecipeArchive/recipe_archive/ios/Runner/AppDelegate.swift`

**What to do**:
1. Locate the `checkForSharedUrl()` method
2. Modify it to:
   - Read both `shared_url` and `shared_html` from UserDefaults
   - Create JSON payload: `{"url": "...", "html": "..." (optional)}`
   - Serialize to JSON string
   - Clear ALL three keys: `shared_url`, `shared_url_timestamp`, `shared_html`
   - Return JSON string (or fallback to plain URL string for backwards compatibility)

**Expected code**:
```swift
private func checkForSharedUrl() -> String? {
    let defaults = UserDefaults(suiteName: appGroupName)
    guard let urlString = defaults?.string(forKey: "shared_url") else { return nil }
    let htmlString = defaults?.string(forKey: "shared_html")

    // Create JSON payload
    var payload: [String: Any] = ["url": urlString]
    if let html = htmlString {
        payload["html"] = html
    }

    // Return JSON string
    if let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: []),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        // Clear all shared data
        defaults?.removeObject(forKey: "shared_url")
        defaults?.removeObject(forKey: "shared_url_timestamp")
        defaults?.removeObject(forKey: "shared_html")
        defaults?.synchronize()
        return jsonString
    }

    // Fallback to plain URL string
    return urlString
}
```

### Task 2: Update ShareChannel.dart to Parse JSON
**File**: `/Users/matt/GitHub/RecipeArchive/recipe_archive/lib/services/share_channel.dart`

**What to do**:
1. Change return type from `String?` to `Map<String, String>?`
2. Parse JSON payload from iOS
3. Maintain backwards compatibility with plain URL strings

**Expected code**:
```dart
import 'dart:convert';

class ShareChannel {
  static const MethodChannel _channel = MethodChannel('com.example.recipeArchive/share');

  static Future<Map<String, String>?> checkForSharedUrl() async {
    try {
      final String? result = await _channel.invokeMethod('checkForSharedUrl');
      if (result == null) return null;

      // Try to parse as JSON first
      try {
        final Map<String, dynamic> payload = json.decode(result);
        return {
          'url': payload['url'] as String,
          if (payload.containsKey('html')) 'html': payload['html'] as String,
        };
      } catch (e) {
        // Fallback: treat as plain URL string (backwards compatibility)
        return {'url': result};
      }
    } on PlatformException catch (e) {
      print('Error checking for shared URL: ${e.message}');
      return null;
    }
  }
}
```

### Task 3: Update HomeScreen.dart to Handle HTML
**File**: `/Users/matt/GitHub/RecipeArchive/recipe_archive/lib/screens/home_screen.dart`

**What to do**:
1. Update `_checkForSharedUrl()` to receive Map instead of String
2. Update `_processSharedRecipe()` to accept optional HTML parameter
3. Include `webArchiveHtml` in recipe data when HTML is available
4. Update user feedback messages based on HTML presence

**Expected changes**:
```dart
Future<void> _checkForSharedUrl() async {
  final sharedData = await ShareChannel.checkForSharedUrl();
  if (sharedData != null && mounted) {
    final url = sharedData['url']!;
    final html = sharedData['html'];

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(html != null
          ? 'Processing recipe with HTML...'
          : 'Processing shared URL...'),
        duration: const Duration(seconds: 2),
      ),
    );
    await _processSharedRecipe(url, html: html);
  }
}

Future<void> _processSharedRecipe(String url, {String? html}) async {
  final uri = Uri.parse(url);
  final domain = uri.host.replaceAll('www.', '');

  // Build recipe data with optional HTML
  final recipeData = {
    'sourceUrl': url,
    'title': 'Recipe from $domain',
    'ingredients': [
      {'text': html != null
        ? '🔄 Processing HTML content...'
        : '📱 Shared from mobile - Full parsing coming soon!'}
    ],
    'instructions': [
      {'stepNumber': 1, 'text': html != null
        ? 'Recipe is being processed by the backend'
        : 'Open the source URL to view the recipe'}
    ],
  };

  // Include HTML if available
  if (html != null) {
    recipeData['webArchiveHtml'] = html;
  }

  final response = await recipeService.saveRecipe(Recipe.fromJson(recipeData));

  if (mounted) {
    ref.invalidate(paginatedRecipesProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(html != null
          ? 'Recipe saved! Backend will process HTML content.'
          : 'Recipe bookmarked! Use browser extension for full parsing.'),
        action: SnackBarAction(
          label: 'View',
          onPressed: () {
            Navigator.pushNamed(context, '/recipe-detail', arguments: response.id);
          },
        ),
      ),
    );
  }
}
```

## Testing Checklist

After completing the changes:

1. **Build and Deploy**: Run `flutter run -d iPhone`
2. **Test URL Only**: Share a non-paywalled recipe from Safari
   - Verify snackbar shows "Processing shared URL..."
   - Check recipe saves with placeholder content
3. **Test URL + HTML**: Share a recipe that has HTML content available
   - Check Xcode console for "DEBUG: Saved HTML to App Group" message
   - Verify snackbar shows "Processing recipe with HTML..."
   - Verify recipe saves with `webArchiveHtml` field populated
4. **Verify App Group Cleanup**: After sharing, check that all three keys are cleared

## Important Notes

- **Don't modify ShareViewController.swift** - it's already done
- **Maintain backwards compatibility** - code should handle both JSON and plain string from iOS
- **Follow double-quote style** - JavaScript/TypeScript files use double quotes per ESLint config
- **No new files** - only modify the three files listed above
- **UserDefaults limit** - HTML content is ~4MB max, most recipe pages are < 1MB

## Commit Message Template

When done, commit with:
```
feat(mobile): add HTML passthrough from iOS Share Extension

- Update AppDelegate to return JSON payload with URL and optional HTML
- Update ShareChannel to parse JSON with backwards compatibility
- Update HomeScreen to handle HTML content in shared recipes
- Include webArchiveHtml field when HTML is available

Supports paywalled recipe sites by extracting HTML from user's
authenticated Safari session. Backend normalizer will process
webArchiveHtml field to parse recipe content.

Part of iOS Share Extension Phase 1.5
```

## Questions to Verify

Before marking complete, confirm:
1. ✅ Does AppDelegate return valid JSON?
2. ✅ Does ShareChannel parse JSON correctly?
3. ✅ Does ShareChannel fallback to plain string work?
4. ✅ Does HomeScreen receive both URL and HTML?
5. ✅ Is webArchiveHtml included in recipe data when HTML present?
6. ✅ Are App Group keys cleaned up after reading?
