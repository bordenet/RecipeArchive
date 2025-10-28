# Safari Web Extension Setup Guide

## Problem Statement

iOS Safari's Share Sheet **only provides URLs**, not HTML content. This prevents us from:
- Capturing HTML from paywalled recipe sites (user is logged in, but backend cannot fetch)
- Extracting dynamic content loaded by JavaScript
- Processing recipes that require authentication

## Solution: Safari Web Extension

Safari Web Extensions (iOS 15+) run JavaScript in the page context and can:
✅ Extract full HTML from authenticated/paywalled pages
✅ Access user's logged-in session
✅ Send HTML to native app via App Group
✅ No backend fetching required

## Architecture Flow

```
1. User browses recipe in Safari (logged in if paywalled)
2. User taps Safari Web Extension icon
3. JavaScript extracts HTML from live DOM
4. Swift handler saves to App Group container
5. CFNotification alerts main app
6. Flutter app reads HTML from App Group
7. Flutter sends HTML to backend for parsing
8. Recipe appears with full ingredients/instructions
```

## Setup Instructions

### Prerequisites

- Xcode 14.0+
- iOS 15.0+ deployment target
- Apple Developer account (for code signing)
- RecipeArchive project already open in Xcode

### Step 1: Add Safari Web Extension Target

1. Open Xcode project:
   ```bash
   cd recipe_archive/ios
   open Runner.xcworkspace
   ```

2. In Xcode, select the **Runner** project in navigator

3. Click the **"+"** button at the bottom of the targets list

4. Search for **"Safari Web Extension"**

5. Select **"Safari Web Extension"** template and click **Next**

6. Configure:
   - **Product Name**: `RecipeExtension`
   - **Team**: Your development team
   - **Organization Identifier**: `com.recipearchive`
   - **Bundle Identifier**: `com.recipearchive.RecipeArchive.RecipeExtension`
   - **Language**: Swift
   - **Uncheck** "Include Safari app extension"
   - Click **Finish**

7. Click **Activate** when prompted

### Step 2: Replace Generated Files

1. In Xcode navigator, **delete** the generated `RecipeExtension` folder (Move to Trash)

2. In Finder, drag `recipe_archive/ios/RecipeExtension` folder into Xcode under Runner project

3. In the dialog:
   - ✅ Copy items if needed
   - ✅ Create groups
   - ✅ Add to targets: RecipeExtension
   - Click **Finish**

### Step 3: Configure Extension Target

1. Select **RecipeExtension** target

2. **General Tab**:
   - iOS Deployment Target: **15.0** or higher
   - Signing: Select your team

3. **Build Settings Tab**:
   - Search "Code Signing Entitlements"
   - Set to: `RecipeExtension/RecipeExtension.entitlements`

4. **Signing & Capabilities Tab**:
   - Click **"+ Capability"**
   - Add **App Groups**
   - Enable: `group.com.recipearchive.shared`

### Step 4: Embed Extension in App

1. Select **Runner** target

2. Go to **General** → **Frameworks, Libraries, and Embedded Content**

3. Click **"+"**

4. Select **RecipeExtension.appex**

5. Set to **"Embed & Sign"**

### Step 5: Create Extension Icons

The extension needs icons at multiple sizes. You can use the RecipeArchive app icon as source.

Place these files in `recipe_archive/ios/RecipeExtension/images/`:
- `icon-16.png` (16x16px)
- `icon-32.png` (32x32px)
- `icon-48.png` (48x48px)
- `icon-128.png` (128x128px)

**Quick way to generate icons:**
```bash
cd recipe_archive/ios/RecipeExtension/images

# If you have ImageMagick installed:
# convert ../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 16x16 icon-16.png
# convert ../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 32x32 icon-32.png
# convert ../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 48x48 icon-48.png
# convert ../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 128x128 icon-128.png

# Or create placeholder icons temporarily:
echo "Create icon files manually or use design tool"
```

### Step 6: Update Info.plist URLs

The Runner app needs to handle the custom URL scheme.

1. Open `recipe_archive/ios/Runner/Info.plist`

2. Add URL scheme (if not already present):

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>com.recipearchive</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>recipearchive</string>
        </array>
    </dict>
</array>
```

### Step 7: Build and Test

1. Select **Runner** scheme

2. Select target device (iPhone 16e or physical device)

3. Build and run (⌘R)

4. Once installed, open **Safari**

5. Go to **Safari Settings** → **Extensions**

6. Enable **RecipeExtension**

7. Grant permissions when prompted

### Step 8: Test Recipe Extraction

1. In Safari, navigate to: https://www.allrecipes.com/recipe/62696/chicken-parmesan-casserole/

2. Tap the **Extensions** button (puzzle piece icon) in Safari toolbar

3. Select **RecipeExtension**

4. Tap **"Save to RecipeArchive"**

5. You should see: "✓ Recipe saved! Open RecipeArchive app to view."

6. Switch to RecipeArchive app

7. Recipe should appear with **full ingredients and instructions** (not just bookmarked)

## Files Created

```
recipe_archive/ios/RecipeExtension/
├── manifest.json                      # Extension configuration
├── content.js                         # Extracts HTML from pages
├── popup.html                         # User interface
├── popup.js                           # Handles save action
├── background.js                      # Service worker
├── SafariWebExtensionHandler.swift   # Native bridge
├── Info.plist                         # Extension metadata
├── RecipeExtension.entitlements      # App Group permissions
├── README.md                          # Detailed documentation
└── images/                            # Extension icons
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

## Troubleshooting

### Extension doesn't appear in Safari

**Solution:**
- Verify RecipeExtension.appex is embedded in Runner target
- Check Build Phases → Embed Foundation Extensions
- Rebuild and reinstall app
- Enable extension in Safari Settings → Extensions

### "App Group access failed"

**Solution:**
- Both Runner and RecipeExtension must have App Group capability
- App Group ID must match: `group.com.recipearchive.shared`
- Check entitlements files are correctly configured
- Register App Group in Apple Developer Portal if needed

### HTML not captured

**Solution:**
- Open Safari console (develop menu on Mac)
- Check for JavaScript errors in content.js
- Verify manifest.json permissions
- Check domain is allowed in Info.plist

### Recipe shows as "bookmarked" instead of parsed

**Solution:**
- This means HTML wasn't captured/sent
- Check AppDelegate.swift logs for "Received Web Extension notification"
- Verify `shared_recipe.json` contains `"html"` field
- Check backend logs for HTML processing

### Extension works but app doesn't receive notification

**Solution:**
- CFNotificationCenter may have timing issues
- App will still pick up recipe on next foreground (works but slower)
- Check AppDelegate setupWebExtensionListener() is called
- Verify notification name matches: `com.recipearchive.newRecipe`

## Development Tips

### Testing Changes

After modifying JavaScript or Swift:
```bash
cd recipe_archive
flutter clean
flutter build ios --debug
flutter install
```

### Debugging JavaScript

1. On Mac, enable Develop menu in Safari
2. Connect iOS device or simulator
3. Develop → [Device] → [RecipeExtension]
4. Use console.log() liberally in content.js and popup.js

### Debugging Native Code

1. Set breakpoints in SafariWebExtensionHandler.swift
2. Run from Xcode with debugger attached
3. Check console for print() statements

### Testing Paywalled Sites

1. In Safari, log into a paywalled recipe site (e.g., Cook's Illustrated)
2. Navigate to a recipe page
3. Use extension to save - it should work because you're logged in!
4. Backend will receive HTML and parse it successfully

## Migration from Share Extension

Users will have **both** options:

1. **Share Extension** (existing):
   - Works for public recipes
   - Simple share sheet integration
   - Bookmarks paywalled content (URL only)

2. **Web Extension** (new):
   - Works for ALL recipes (including paywalled)
   - Captures full HTML
   - Backend parses everything
   - Better user experience

## Next Steps

1. **Complete Xcode setup** following steps above
2. **Test with public recipe** (AllRecipes, Food Network)
3. **Test with paywalled recipe** (Cook's Illustrated, NYT Cooking)
4. **Monitor CloudWatch logs** to verify backend receives HTML
5. **Update user documentation** to explain new extension

## References

- [Safari Web Extensions - Apple Developer](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
- [Converting a Web Extension for Safari - WWDC20](https://developer.apple.com/videos/play/wwdc2020/10665/)
- [App Groups - Apple Developer](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_application-groups)
