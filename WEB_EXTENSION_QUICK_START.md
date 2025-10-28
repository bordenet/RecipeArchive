# Safari Web Extension - Quick Start

## Problem We're Solving

iOS Safari Share Sheet **only provides URLs** (`["public.url"]`), not HTML. This prevents:
- ❌ Capturing recipes from paywalled sites (user is logged in, backend cannot fetch)
- ❌ Processing JavaScript-rendered content
- ❌ Supporting premium recipe sites

## Solution

Safari Web Extension that extracts full HTML from authenticated browser context and sends to Flutter app.

## Setup (3 Steps)

### 1. Create Extension Target in Xcode

```bash
cd recipe_archive/ios && open Runner.xcworkspace
```

In Xcode:
1. Click **Runner** project → **"+"** at bottom of targets
2. Select **"Safari Web Extension"** template
3. Name: `RecipeExtension`, Bundle ID: `com.recipearchive.RecipeArchive.RecipeExtension`
4. Click **Finish** → **Activate**

**⚠️ Xcode will overwrite our files!**

### 2. Restore Our Implementation

Close Xcode, then:

```bash
# From repository root
./scripts/restore-web-extension-files.sh
```

This restores all our custom code that Xcode overwrote.

### 3. Configure and Build

Reopen Xcode:

```bash
cd recipe_archive/ios && open Runner.xcworkspace
```

1. **RecipeExtension target** → **Signing & Capabilities** → Add **App Groups** → Enable `group.com.recipearchive.shared`
2. **Runner target** → **General** → **Frameworks** → Add **RecipeExtension.appex** → Set to **"Embed & Sign"**
3. Build and run (⌘R)

## Testing

1. Open Safari on device/simulator
2. Settings → Extensions → Enable **RecipeExtension**
3. Navigate to: https://www.allrecipes.com/recipe/62696/chicken-parmesan-casserole/
4. Tap **Extensions** icon (puzzle piece) → **RecipeExtension** → **Save to RecipeArchive**
5. Switch to RecipeArchive app
6. ✅ Recipe should appear with **full ingredients/instructions** (not just bookmarked!)

## Troubleshooting

### Files missing in Xcode?
```bash
./scripts/restore-web-extension-files.sh
```

### Extension doesn't appear in Safari?
- Verify RecipeExtension.appex is embedded in Runner target
- Clean build (Shift+⌘K), rebuild

### "App Group access failed"?
- Both Runner and RecipeExtension must have App Groups capability
- Both must use: `group.com.recipearchive.shared`

## Complete Documentation

- **Quick Start**: This file
- **Detailed Setup**: [XCODE_WEB_EXTENSION_SETUP.md](XCODE_WEB_EXTENSION_SETUP.md)
- **Architecture**: [SAFARI_WEB_EXTENSION_SUMMARY.md](SAFARI_WEB_EXTENSION_SUMMARY.md)
- **Technical Details**: [recipe_archive/ios/RecipeExtension/README.md](recipe_archive/ios/RecipeExtension/README.md)

## Key Files

```
recipe_archive/ios/RecipeExtension/     # Our implementation
├── manifest.json                       # Extension config
├── content.js                          # HTML extraction
├── popup.html/popup.js                 # User interface
├── background.js                       # Service worker
└── SafariWebExtensionHandler.swift    # Native bridge

scripts/restore-web-extension-files.sh  # Restoration script
.web-extension-backup/                  # Backup location
```

## What This Does

```
User browses recipe (logged in if paywalled)
    ↓
Taps Web Extension icon in Safari
    ↓
JavaScript extracts full HTML from page
    ↓
Saves to App Group container
    ↓
CFNotification alerts Flutter app
    ↓
Flutter sends HTML to backend
    ↓
Backend parses → recipe with ingredients/instructions
```

## Advantages

✅ Works with paywalled content (uses user's login)
✅ Captures JavaScript-rendered HTML
✅ No backend fetching needed
✅ Extracts structured recipe data (JSON-LD)
✅ Better parsing success rate

## Share Extension vs Web Extension

| Feature | Share Extension | Web Extension |
|---------|----------------|---------------|
| User Action | Share button | Extensions icon |
| HTML Capture | ❌ URL only | ✅ Full HTML |
| Paywalled Sites | ❌ Bookmark | ✅ Full parse |
| Already Setup | ✅ Yes | ⏳ This guide |

**Keep both!** Share Extension for quick bookmarks, Web Extension for full parsing.
