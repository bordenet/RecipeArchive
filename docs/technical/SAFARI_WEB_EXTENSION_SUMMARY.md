# Safari Web Extension Implementation Summary

## Problem Solved

**Issue**: iOS Safari Share Sheet only provides `["public.url"]` - no HTML content
- Share Extension could bookmark recipes but not parse them
- Backend cannot fetch paywalled content (user logged in, backend not)
- Blocked from supporting premium recipe sites (NYT Cooking, Cook's Illustrated, etc.)

## Solution Implemented

Created Safari Web Extension that:
1. Runs JavaScript in authenticated browser context
2. Extracts full HTML from rendered page
3. Saves to App Group container
4. Notifies Flutter app via CFNotification
5. Flutter sends HTML to backend for parsing

## Files Created

### JavaScript Extension Files
```
recipe_archive/ios/RecipeExtension/
├── manifest.json              # Extension configuration and permissions
├── content.js                 # Extracts HTML + recipe schema from pages
├── popup.html                 # User interface (Save button)
├── popup.js                   # Handles user interaction
└── background.js              # Service worker for background tasks
```

### Native Swift Bridge
```
recipe_archive/ios/RecipeExtension/
├── SafariWebExtensionHandler.swift   # Bridges JS ↔ App Group
├── Info.plist                         # Extension metadata
└── RecipeExtension.entitlements      # App Group permissions
```

### Updated Files
- `recipe_archive/ios/Runner/AppDelegate.swift` - Added CFNotification listener
- `recipe_archive/ios/RecipeExtension/` - Safari Web Extension target configuration
- `docs/technical/SAFARI_WEB_EXTENSION_SETUP.md` - Complete setup guide

### Documentation
- `docs/adr/002-ios-recipe-capture-architecture.md` - Detailed architecture and design decisions
- `docs/technical/SAFARI_WEB_EXTENSION_SETUP.md` - Step-by-step Xcode and Safari Web Extension setup
- `docs/technical/SAFARI_WEB_EXTENSION_SUMMARY.md` - This summary

## How It Works

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ 1. User browses recipe in Safari (logged in if paywalled)  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. User taps Web Extension icon in Safari toolbar          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Popup.js sends message to content.js                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Content.js extracts HTML + recipe schema (if available) │
│    - document.documentElement.outerHTML                     │
│    - Structured data from <script type="ld+json">          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Popup.js saves to browser.storage.local                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. SafariWebExtensionHandler.swift writes to App Group     │
│    File: group.com.recipearchive.shared/shared_recipe.json │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Posts CFNotification: com.recipearchive.newRecipe       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. AppDelegate receives notification → notifyFlutterOfSharedUrl()│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. home_screen.dart processes shared recipe with HTML      │
│    - Reads URL + HTML from MethodChannel                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. recipe_service.dart sends POST with HTML to backend    │
│     Body: { sourceUrl, title, webArchiveHtml, ... }        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Backend Lambda parses HTML → ingredients/instructions  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. Recipe appears in app with FULL CONTENT (not bookmark) │
└─────────────────────────────────────────────────────────────┘
```

## Advantages

✅ **Captures paywalled content** - Uses user's authenticated session
✅ **No backend fetching** - Respects paywalls and auth requirements
✅ **Extracts rendered HTML** - Includes content loaded by JavaScript
✅ **Structured data extraction** - Parses JSON-LD recipe schema when available
✅ **Better UX** - Integrated into Safari toolbar, familiar to users
✅ **Works offline** - Can save recipes for processing when back online

## Next Steps

### 1. Complete Xcode Setup (Manual)

**You must add the Safari Web Extension target in Xcode** - this cannot be automated via CLI.

Follow: [SAFARI_WEB_EXTENSION_SETUP.md](SAFARI_WEB_EXTENSION_SETUP.md)

Key steps:
1. Add Safari Web Extension target to Runner.xcodeproj
2. Replace generated files with our implementation
3. Configure App Groups capability
4. Embed extension in Runner app
5. Create extension icons
6. Build and install

### 2. Testing Checklist

#### Public Recipe Site (No Paywall)
- [ ] Navigate to https://www.allrecipes.com/recipe/62696/chicken-parmesan-casserole/
- [ ] Tap Web Extension icon
- [ ] Verify "✓ Recipe saved!" message
- [ ] Switch to RecipeArchive app
- [ ] Verify recipe has ingredients and instructions (not placeholder text)
- [ ] Check CloudWatch logs for HTML processing

#### Paywalled Recipe Site (Requires Login)
- [ ] Log into NYT Cooking or Cook's Illustrated in Safari
- [ ] Navigate to a recipe page
- [ ] Use Web Extension to save
- [ ] Verify recipe parses correctly with full content
- [ ] Confirm backend received HTML (not attempted to fetch)

#### Edge Cases
- [ ] Test with recipe that has JSON-LD structured data
- [ ] Test with recipe that uses JavaScript to load content
- [ ] Test with very large recipe (10+ images, 50+ steps)
- [ ] Test with non-recipe page (should still save URL)

### 3. Backend Verification

Check that backend handles HTML correctly:

```bash
# Trace a recipe saved via Web Extension
cd tools/recipe-tracer
./recipe-tracer -recipe [RECIPE_ID]

# Look for:
# - "webArchiveHtml" field in request payload
# - HTML processing in normalization logs
# - Successful ingredient/instruction extraction
```

### 4. User Documentation

Update user-facing docs to explain:
- Two ways to save recipes (Share Extension vs Web Extension)
- Web Extension works with paywalled sites
- How to enable extension in Safari settings
- Troubleshooting common issues

### 5. Known Limitations

- **Requires iOS 15+** (Web Extensions not available on older versions)
- **User must enable extension** in Safari Settings (one-time setup)
- **Domain permissions** may need updating for new recipe sites
- **Icons required** (currently placeholders, need actual assets)

### 6. Future Enhancements

- **Auto-detect recipe pages** - Show badge when recipe detected
- **Batch save** - Save multiple recipes from collection/list pages
- **Offline queue** - Save when offline, sync when online
- **Reader mode integration** - Extract from Safari Reader view
- **macOS support** - Same extension works on macOS Safari

## Comparison: Share Extension vs Web Extension

| Feature | Share Extension | Web Extension |
|---------|----------------|---------------|
| **HTML Capture** | ❌ URL only | ✅ Full HTML |
| **Paywalled Sites** | ❌ Bookmarks only | ✅ Full parse |
| **Setup Complexity** | Simple (already works) | Requires Xcode setup |
| **User Action** | Share Sheet | Extension icon |
| **iOS Version** | iOS 13+ | iOS 15+ |
| **Use Case** | Quick bookmarks | Full recipe extraction |

**Recommendation**: Keep both! Share Extension for quick saves, Web Extension for full parsing.

## Technical Notes

### Why CFNotification Instead of URL Scheme?

- URL schemes open Safari (bad UX)
- CFNotification is silent and instant
- Falls back to foreground detection if notification fails

### Why App Group Instead of Shared Defaults?

- More reliable across extension boundaries
- Works with macOS Catalyst
- Supports larger data payloads (HTML can be big)

### Why Not Use Native Messaging API?

- Safari Web Extensions on iOS don't fully support native messaging
- App Group + CFNotification is the Apple-recommended approach
- More reliable than URL schemes or custom protocols

### Handling Large HTML Files

Current implementation sends full HTML. For very large pages:
- Consider compression (gzip in JS, decompress in Swift)
- Or extract only recipe-relevant sections
- Monitor App Group storage limits

### Security Considerations

- Extension only runs when user explicitly taps icon (not automatic)
- Only has access to page user is currently viewing
- App Group is sandboxed (only accessible to our app + extension)
- HTML is sent via HTTPS to backend (already authenticated)

## Success Metrics

Once implemented, we'll be able to:
1. ✅ Save paywalled recipes from NYT Cooking, Cook's Illustrated, etc.
2. ✅ Extract recipes from JavaScript-heavy sites
3. ✅ Capture content user is logged in to view
4. ✅ Reduce "bookmarked" recipes that never get parsed
5. ✅ Support premium recipe sites without requiring backend auth

## Questions or Issues?

See troubleshooting section in:
- [SAFARI_WEB_EXTENSION_SETUP.md](SAFARI_WEB_EXTENSION_SETUP.md#troubleshooting)
- [recipe_archive/ios/RecipeExtension/README.md](recipe_archive/ios/RecipeExtension/README.md)

Or check logs:
```bash
# iOS device logs
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.recipearchive"'

# Backend logs
cd tools/recipe-tracer
./recipe-tracer -recipe [ID]
```
