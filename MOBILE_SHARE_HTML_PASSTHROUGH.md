# Mobile Share HTML Passthrough Implementation Plan

## Status: IN PROGRESS (Phase 1.5)

### Completed ✅
1. **Phase 1.1**: iOS Share Extension created and configured
2. **Phase 1.2**: URL extraction and validation working
3. **Phase 1.3**: Platform Channel integration (Flutter ↔ iOS)
4. **Phase 1.4 MVP**: Bookmark-style URL saving implemented
5. **Phase 1.5 (Partial)**: HTML extraction in ShareViewController

### Current Changes (Uncommitted)
- `ShareViewController.swift`: Updated to extract both URL and HTML using DispatchGroup
- HTML saved to App Group with key `shared_html`
- Removed old `processURL()` method
- Created `saveToAppGroup(url:html:)` method

### Next Steps (To Complete Phase 1.5)

#### 1. Update AppDelegate.swift
**File**: `/Users/matt/GitHub/RecipeArchive/recipe_archive/ios/Runner/AppDelegate.swift`

**Current Issue**: File was modified during editing, need to re-read and update.

**Required Changes**:
```swift
private func checkForSharedUrl() -> String? {
    // Read URL, HTML, and timestamp from App Group
    let defaults = UserDefaults(suiteName: appGroupName)
    guard let urlString = defaults?.string(forKey: "shared_url") else { return nil }
    let htmlString = defaults?.string(forKey: "shared_html")

    // Create JSON payload: {"url": "...", "html": "..." (optional)}
    var payload: [String: Any] = ["url": urlString]
    if let html = htmlString {
        payload["html"] = html
    }

    // Return JSON string to Flutter
    if let jsonData = try? JSONSerialization.data(withJSONOptions: []),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        // Clear App Group data
        defaults?.removeObject(forKey: "shared_url")
        defaults?.removeObject(forKey: "shared_url_timestamp")
        defaults?.removeObject(forKey: "shared_html")
        return jsonString
    }

    // Fallback: return just URL
    return urlString
}
```

#### 2. Update Flutter ShareChannel.dart
**File**: `/Users/matt/GitHub/RecipeArchive/recipe_archive/lib/services/share_channel.dart`

**Required Changes**:
- Change return type from `String?` to `Map<String, String>?`
- Parse JSON payload from iOS
- Return `{url, html?}` map

```dart
static Future<Map<String, String>?> checkForSharedUrl() async {
  try {
    final String? jsonString = await _channel.invokeMethod('checkForSharedUrl');
    if (jsonString == null) return null;

    // Try to parse as JSON
    try {
      final Map<String, dynamic> payload = json.decode(jsonString);
      return {
        'url': payload['url'] as String,
        if (payload.containsKey('html')) 'html': payload['html'] as String,
      };
    } catch (e) {
      // Fallback: treat as plain URL string for backwards compatibility
      return {'url': jsonString};
    }
  } on PlatformException {
    return null;
  }
}
```

#### 3. Update HomeScreen.dart
**File**: `/Users/matt/GitHub/RecipeArchive/recipe_archive/lib/screens/home_screen.dart`

**Required Changes**:
```dart
Future<void> _checkForSharedUrl() async {
  final sharedData = await ShareChannel.checkForSharedUrl();
  if (sharedData != null && mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Processing shared recipe...'), duration: Duration(seconds: 2)),
    );
    await _processSharedRecipe(sharedData['url']!, sharedData['html']);
  }
}

Future<void> _processSharedRecipe(String url, String? html) async {
  try {
    final recipeService = ref.read(recipeServiceProvider);
    final uri = Uri.parse(url);
    final domain = uri.host.replaceAll('www.', '');

    // Send URL + HTML to backend for parsing
    final recipeData = {
      'sourceUrl': url,
      'title': 'Recipe from $domain',
      if (html != null) 'webArchiveHtml': html,
      'ingredients': [
        {'text': html != null ? 'Parsing recipe...' : '📱 Shared without HTML - Use browser extension'}
      ],
      'instructions': [
        {'stepNumber': 1, 'text': html != null ? 'Recipe is being parsed...' : 'Open source URL to view recipe'}
      ],
    };

    final response = await recipeService.saveRecipe(Recipe.fromJson(recipeData));

    if (mounted) {
      ref.invalidate(paginatedRecipesProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(html != null ? 'Recipe parsing...' : 'Recipe bookmarked!'),
          duration: const Duration(seconds: 4),
          action: SnackBarAction(label: 'View', onPressed: () {
            Navigator.pushNamed(context, '/recipe-detail', arguments: response.id);
          }),
        ),
      );
    }
  } catch (e) {
    // Error handling...
  }
}
```

#### 4. Backend Changes (Future Work)
**File**: `/Users/matt/GitHub/RecipeArchive/aws-backend/functions/recipes/main.go`

**Required**:
- `CreateRecipeRequest` already has `WebArchiveHTML *string` field ✅
- Backend normalization needs to parse provided HTML instead of fetching
- Check if background normalizer can handle HTML parsing

**Investigation Needed**:
- Does `background-normalizer` Lambda parse HTML from `webArchiveHtml` field?
- If not, need to add HTML parsing logic
- May need to port TypeScript parser to Go or call external service

### Testing Checklist
- [ ] Share from Safari - verify HTML is extracted
- [ ] Check Xcode console for "Got HTML" debug message
- [ ] Verify App Group contains both URL and HTML
- [ ] Flutter receives JSON payload with both fields
- [ ] Recipe saved with `webArchiveHtml` field populated
- [ ] Backend normalization processes HTML correctly
- [ ] Test with paywalled recipe site
- [ ] Test with non-paywalled site (HTML should still work)

### Known Limitations
1. **HTML Size**: UserDefaults has ~4MB limit per key
   - Most recipe pages are < 1MB
   - If exceeded, HTML will be truncated or fail
   - Consider fallback to URL-only mode

2. **Security**: Server-side HTML fetching disabled
   - All HTML must come from client
   - Backend only parses provided HTML, never fetches

3. **Parsing**: TypeScript parser not available in Swift/Go
   - Need backend implementation
   - Or: Use WebView in Flutter to run TypeScript parser client-side

### Future Enhancements
- [ ] Add AppLifecycleState listener for background→foreground URL checking
- [ ] Remove debug logging before production
- [ ] Add progress indicator during parsing
- [ ] Handle HTML size limit gracefully
- [ ] Implement retry logic for failed parses
- [ ] Add unit tests for HTML extraction

### Files Modified (Uncommitted)
1. `recipe_archive/ios/RecipeArchive/ShareViewController.swift` - HTML extraction
2. (Pending) `recipe_archive/ios/Runner/AppDelegate.swift` - JSON payload
3. (Pending) `recipe_archive/lib/services/share_channel.dart` - Parse JSON
4. (Pending) `recipe_archive/lib/screens/home_screen.dart` - Handle HTML

### Commit Message Template
```
feat: implement iOS share HTML passthrough (Phase 1.5)

Share Extension HTML Extraction:
- Extract both URL and HTML from NSExtensionItem using DispatchGroup
- Support public.url and public.html type identifiers
- Save HTML to App Group with key 'shared_html'
- Handle HTML extraction failures gracefully

Platform Channel Updates:
- AppDelegate returns JSON payload: {url, html?}
- ShareChannel parses JSON and returns Map<String, String>?
- Backwards compatible fallback to plain URL string

Flutter Integration:
- Updated _processSharedRecipe to accept optional HTML
- Send webArchiveHtml field to backend when available
- Show appropriate messages based on HTML availability

Architecture:
- Enables paywalled site support
- Backend parses provided HTML (no server-side fetching)
- Maintains security by not fetching external content

TODO: Backend normalization HTML parsing implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
