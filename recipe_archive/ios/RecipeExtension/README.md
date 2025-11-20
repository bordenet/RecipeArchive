# Safari Web Extension for RecipeArchive

## What This Does

This Safari Web Extension extracts full HTML content from recipe webpages (including paywalled sites) and sends it to the RecipeArchive app for parsing.

## Why We Need This

iOS Safari's Share Sheet **only provides URLs** (`["public.url"]`), not HTML content. This prevents:
- Capturing recipes from paywalled sites (user is logged in, but backend cannot fetch)
- Extracting content from JavaScript-heavy sites
- Processing recipes that require authentication

## How It Works

1. User browses to recipe page in Safari (logged in if paywalled)
2. User taps Web Extension icon in Safari toolbar
3. JavaScript extracts full HTML from the live page
4. Swift handler saves HTML to App Group container
5. CFNotificationCenter notifies the main app
6. Flutter app reads HTML and sends to backend
7. Backend parses recipe with full ingredients/instructions

## Files

- `manifest.json` - Extension configuration (permissions, scripts, icons)
- `content.js` - Runs on all web pages, extracts HTML and recipe schema
- `popup.html` - User interface shown when extension icon is tapped
- `popup.js` - Handles save button and App Group communication
- `background.js` - Service worker for background tasks
- `SafariWebExtensionHandler.swift` - Native bridge to App Group
- `Info.plist` - Extension metadata and website access permissions
- `RecipeExtension.entitlements` - App Group capability
- `images/` - Extension icons (16, 32, 48, 128px)

## Setup

**See [SAFARI_WEB_EXTENSION_SETUP.md](../../../../docs/technical/SAFARI_WEB_EXTENSION_SETUP.md) for complete setup instructions.**

Key steps:
1. Add Safari Web Extension target in Xcode
2. Configure App Groups capability
3. Embed extension in Runner app
4. Create extension icons
5. Build and enable in Safari Settings

## Architecture

```
┌─────────────┐
│   Safari    │ User browses recipe (logged in if paywalled)
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  content.js         │ Extracts HTML + recipe schema
│  (JavaScript)       │ document.documentElement.outerHTML
└──────┬──────────────┘
       │
       ▼
┌──────────────────────────┐
│  popup.js                │ User taps "Save" button
│  (JavaScript)            │
└──────┬───────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│  SafariWebExtensionHandler.swift  │ Writes to App Group
│  (Native Swift)                    │ shared_recipe.json
└──────┬─────────────────────────────┘
       │
       ▼
┌────────────────────────┐
│  CFNotification        │ com.recipearchive.newRecipe
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  AppDelegate.swift     │ Receives notification
│  (Runner app)          │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  home_screen.dart      │ Processes shared recipe
│  (Flutter)             │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  recipe_service.dart   │ POST to backend with HTML
│  (Flutter)             │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  AWS Lambda            │ Parses HTML → recipe data
│  (Backend)             │
└────────────────────────┘
```

## Advantages Over Share Extension

| Feature | Share Extension | Web Extension |
|---------|----------------|---------------|
| HTML Capture | ❌ URL only | ✅ Full HTML |
| Paywalled Sites | ❌ Bookmark only | ✅ Full parse |
| JS-rendered Content | ❌ No | ✅ Yes |
| Structured Data | ❌ No | ✅ JSON-LD schema |
| Setup | Simple | Requires Xcode |

## Testing

1. Build and run the app with the extension embedded
2. Open Safari on device/simulator
3. Go to Safari Settings → Extensions
4. Enable RecipeExtension
5. Navigate to https://www.allrecipes.com/recipe/62696/chicken-parmesan-casserole/
6. Tap Extensions icon (puzzle piece)
7. Tap "Save to RecipeArchive"
8. Switch back to RecipeArchive app
9. Verify recipe appears with full ingredients and instructions

## Troubleshooting

### Extension doesn't appear in Safari
- Verify extension is embedded in Runner target (Xcode → General → Embedded Content)
- Check that bundle identifier is correct: `com.recipearchive.RecipeArchive.RecipeExtension`
- Rebuild and reinstall the app

### "App Group access failed"
- Both Runner and RecipeExtension must have App Group capability
- App Group ID must be: `group.com.recipearchive.shared`
- Check entitlements files are correctly configured

### HTML not captured
- Open Safari developer console (Mac: Develop menu → device → extension)
- Check for JavaScript errors in content.js
- Verify manifest.json permissions are correct

### Recipe shows as "bookmarked" instead of parsed
- Check that `shared_recipe.json` contains `"html"` field
- Verify CFNotification is being received by AppDelegate
- Check CloudWatch logs for backend HTML processing

## Development

### Debugging JavaScript
1. On Mac, enable Develop menu in Safari preferences
2. Connect iOS device or open simulator
3. Develop → [Device Name] → [RecipeExtension]
4. Use console.log() in content.js and popup.js

### Debugging Swift
1. Set breakpoints in SafariWebExtensionHandler.swift
2. Run from Xcode with debugger attached
3. Check console for logger output

### Testing Changes
```bash
cd recipe_archive
flutter clean
flutter build ios --debug
flutter install
```

## Security

- Extension only runs when user explicitly taps icon (not automatic)
- Only has access to the currently visible page
- App Group is sandboxed (only accessible by RecipeArchive app and extension)
- HTML is sent via HTTPS to authenticated backend

## References

- [Safari Web Extensions - Apple Developer](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
- [Converting a Web Extension for Safari - WWDC20](https://developer.apple.com/videos/play/wwdc2020/10665/)
- [Web Extensions Browser API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)
