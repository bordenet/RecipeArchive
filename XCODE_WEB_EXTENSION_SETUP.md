# Safari Web Extension - Xcode Setup (Simplified)

## Problem: Xcode Overwrites Our Files

When you create a Safari Web Extension target in Xcode, it generates template files that overwrite our custom implementation. This guide shows you how to work around that.

## Solution: Use Our Restoration Script

### Step 1: Create Extension Target in Xcode

1. Open Xcode project:
   ```bash
   cd recipe_archive/ios
   open Runner.xcworkspace
   ```

2. In Xcode:
   - Click on **Runner** project in navigator
   - Click **"+"** at bottom of targets list
   - Search for **"Safari Web Extension"**
   - Click **Next**

3. Configure:
   - **Product Name**: `RecipeExtension`
   - **Bundle Identifier**: `com.recipearchive.RecipeArchive.RecipeExtension`
   - **Language**: Swift
   - **Uncheck** "Include Safari app extension"
   - Click **Finish**
   - Click **Activate** when prompted

**Xcode will now generate template files and overwrite our implementation.**

### Step 2: Restore Our Implementation

Close Xcode and run our restoration script:

```bash
# From repository root
./scripts/restore-web-extension-files.sh
```

This script:
- ✅ Restores all our custom files
- ✅ Maintains proper file structure
- ✅ Creates images directory
- ✅ Keeps backups in `.web-extension-backup/`

### Step 3: Reopen Xcode and Verify

```bash
cd recipe_archive/ios
open Runner.xcworkspace
```

In Xcode navigator, expand **RecipeExtension** and verify you see:
- ✅ manifest.json
- ✅ content.js
- ✅ popup.html
- ✅ popup.js
- ✅ background.js
- ✅ SafariWebExtensionHandler.swift
- ✅ Info.plist
- ✅ RecipeExtension.entitlements
- ✅ images/ (folder)

**If files are missing:**
1. Right-click **RecipeExtension** folder
2. Select **"Add Files to 'RecipeExtension'..."**
3. Navigate to `recipe_archive/ios/RecipeExtension/`
4. Select missing files
5. Ensure **"Add to targets: RecipeExtension"** is checked
6. Click **Add**

### Step 4: Configure Extension Target

1. Select **RecipeExtension** target

2. **General Tab**:
   - iOS Deployment Target: **15.0**
   - Signing: Select your development team

3. **Signing & Capabilities Tab**:
   - If "App Groups" is not listed, click **"+ Capability"**
   - Add **App Groups**
   - Enable: `group.com.recipearchive.shared`

4. **Build Settings Tab**:
   - Search: "Code Signing Entitlements"
   - Set to: `RecipeExtension/RecipeExtension.entitlements`

### Step 5: Embed Extension in Runner App

1. Select **Runner** target

2. **General Tab** → **Frameworks, Libraries, and Embedded Content**

3. Click **"+"**

4. Select **RecipeExtension.appex**

5. Change dropdown from "Do Not Embed" to **"Embed & Sign"**

### Step 6: Create Extension Icons

Extension needs icons at multiple sizes. Quick way:

```bash
cd recipe_archive/ios/RecipeExtension/images

# Create placeholder icons (or use actual app icon resized)
# You can skip this for now - extension will work but show default icon

# If you have ImageMagick:
# convert ../../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 16x16 icon-16.png
# convert ../../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 32x32 icon-32.png
# convert ../../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 48x48 icon-48.png
# convert ../../Runner/Assets.xcassets/AppIcon.appiconset/[source].png -resize 128x128 icon-128.png
```

**Icons can be added later** - extension will work without them (shows default icon).

### Step 7: Build and Test

1. In Xcode, select **Runner** scheme

2. Select target device (iPhone 16e simulator or physical device)

3. Build and run (⌘R)

4. Once installed, open **Safari**

5. Go to **Safari Settings** → **Extensions**

6. Enable **RecipeExtension**

7. Test it:
   - Navigate to: https://www.allrecipes.com/recipe/62696/chicken-parmesan-casserole/
   - Tap **Extensions** button (puzzle piece icon)
   - Select **RecipeExtension**
   - Tap **"Save to RecipeArchive"**
   - Switch to RecipeArchive app
   - Recipe should appear with full ingredients/instructions

## Troubleshooting

### "Files not found" when building

Run the restoration script again:
```bash
./scripts/restore-web-extension-files.sh
```

### Extension target shows red/missing files

1. In Xcode, delete references to missing files
2. Right-click RecipeExtension → Add Files
3. Navigate to `recipe_archive/ios/RecipeExtension/`
4. Select all files
5. Ensure "Add to targets: RecipeExtension" is checked

### "App Group access failed" at runtime

1. Verify Runner target has App Groups capability
2. Verify RecipeExtension target has App Groups capability
3. Both must use: `group.com.recipearchive.shared`
4. Check entitlements files are correctly set in Build Settings

### Extension doesn't appear in Safari Settings

1. Check that RecipeExtension.appex is embedded in Runner app
2. Verify bundle identifier: `com.recipearchive.RecipeArchive.RecipeExtension`
3. Clean build folder (Shift + ⌘K)
4. Rebuild and reinstall

## File Locations Reference

```
recipe_archive/ios/
├── RecipeExtension/              # Our implementation (source of truth)
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   ├── background.js
│   ├── SafariWebExtensionHandler.swift
│   ├── Info.plist
│   ├── RecipeExtension.entitlements
│   ├── README.md
│   └── images/
│       └── ICONS_NEEDED.txt
│
├── Runner/
│   └── AppDelegate.swift         # Updated with CFNotification listener
│
└── RecipeArchive/                # Share Extension (existing)
    └── ShareViewController.swift

.web-extension-backup/            # Backup of our files (auto-created)
└── [all extension files backed up here]
```

## Quick Reference

**Restore files after Xcode overwrites them:**
```bash
./scripts/restore-web-extension-files.sh
```

**View backup location:**
```bash
ls -la .web-extension-backup/
```

**Clean and rebuild:**
```bash
cd recipe_archive
flutter clean
flutter build ios --debug
flutter install
```

## Next Steps After Setup

Once the extension is working:

1. **Test with paywalled site** - Log into NYT Cooking or Cook's Illustrated, save a recipe
2. **Verify HTML capture** - Check CloudWatch logs show HTML processing
3. **Monitor recipe parsing** - Use `./tools/recipe-tracer/recipe-tracer -recipe [ID]`
4. **Update icons** - Replace placeholders with actual RecipeArchive icons
5. **Document for users** - Create guide explaining how to enable extension

## Key Differences: Share Extension vs Web Extension

| Feature | Share Extension | Web Extension |
|---------|----------------|---------------|
| Location | ios/RecipeArchive/ | ios/RecipeExtension/ |
| User Action | Share button → RecipeArchive | Extensions icon → RecipeExtension |
| Data Captured | URL only | Full HTML + URL |
| Works with Paywalls | ❌ No | ✅ Yes |
| Setup Required | Already done | This guide |

**Both can coexist!** Users can use Share Extension for quick bookmarks and Web Extension for full parsing.
