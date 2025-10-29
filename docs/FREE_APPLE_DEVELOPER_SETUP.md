# Free Apple Developer Account Setup

## Overview
You can install and test iOS apps on your own devices (up to 3) using a **free Apple Developer account**. No paid subscription required!

## Limitations of Free Account
- ✅ Install on your own devices (up to 3)
- ✅ App Groups work
- ✅ Share Extensions work
- ✅ All capabilities except push notifications and iCloud
- ⚠️ Apps expire after 7 days (just rebuild to refresh)
- ❌ No TestFlight
- ❌ No App Store distribution

## Setup Instructions

### Step 1: Add Your Apple ID to Xcode (One-Time)

1. Open Xcode
2. Go to **Xcode → Settings** (or Preferences on older versions)
3. Click **Accounts** tab
4. Click **+** (bottom left) → **Add Apple ID**
5. Sign in with your Apple ID
   - If you don't have one, create at https://appleid.apple.com
6. Click **Download Manual Profiles** (if available)

### Step 2: Enable Automatic Signing in Xcode

1. Open the workspace:
   ```bash
   open ios/Runner.xcworkspace
   ```

2. Select **Runner** target (in left sidebar)

3. Go to **Signing & Capabilities** tab

4. Check **✓ Automatically manage signing**

5. Under **Team**, select your Apple ID (should show as "Personal Team")

6. Xcode will show:
   - Bundle Identifier: `com.recipeArchive.RecipeArchive`
   - Provisioning Profile: Automatically created
   - Signing Certificate: Apple Development

7. **Repeat for RecipeArchive target**:
   - Select **RecipeArchive** target
   - Enable automatic signing
   - Select your Team

8. **Repeat for RecipeExtension target** (if exists):
   - Select **RecipeExtension** target
   - Enable automatic signing
   - Select your Team

### Step 3: Configure App Groups (Free Account Supported!)

With automatic signing enabled, Xcode will automatically:
- Create App Group `group.com.recipearchive.shared`
- Add it to your provisioning profiles
- Register it with your Apple ID

**Verify it worked:**
1. In Signing & Capabilities, you should see "App Groups" capability
2. If not, click **+ Capability** → **App Groups**
3. Check that `group.com.recipearchive.shared` is listed

### Step 4: Trust Your Developer Certificate on Device (One-Time per Device)

After installing the app for the first time:

1. On your iPhone/iPad, go to **Settings → General → VPN & Device Management**
2. Under "Developer App", tap your Apple ID
3. Tap **Trust "[Your Name]"**
4. Tap **Trust** again to confirm

Now the app will launch!

## Building for Device

### Method 1: Use the Unified Script (Recommended)

```bash
./scripts/build-ios-unified.sh --prod --device --release
```

This will:
- Build the app with automatic signing
- Show you where the .app is located
- Give instructions for installing

### Method 2: Use Xcode Directly (Easiest)

1. Connect your iPhone via USB
2. Open workspace:
   ```bash
   open ios/Runner.xcworkspace
   ```
3. Select your device from the device dropdown (top center)
4. Click **Run** button (▶️) or press **Cmd+R**

Xcode will:
- Build the app
- Sign it automatically
- Install on your device
- Launch it

## Troubleshooting

### "No profiles for 'com.recipeArchive.RecipeArchive' were found"

**Fix:**
1. Open Xcode → Settings → Accounts
2. Select your Apple ID
3. Click **Download Manual Profiles**
4. Go back to Signing & Capabilities
5. Make sure "Automatically manage signing" is checked

### "Untrusted Developer" message on device

**Fix:**
1. Settings → General → VPN & Device Management
2. Trust your developer certificate (see Step 4 above)

### App crashes immediately on device (but works in simulator)

**Possible causes:**
1. **Not properly signed**: Use Xcode to build and run directly
2. **App Group not configured**: Check Signing & Capabilities tab
3. **Extension signing issue**: Make sure RecipeArchive target is also signed

**Debug:**
```bash
# Check if app is signed
codesign -dv build/ios/iphoneos/Runner.app

# Should show "Authority=Apple Development" or similar
# If it says "unsigned", signing failed
```

### "App expires after 7 days"

This is normal with free accounts. Simply:
1. Rebuild the app
2. Reinstall on device

The 7-day timer resets.

## Installing on Device

### Option A: Via Xcode Devices Window

1. Connect device via USB
2. Open Xcode → Window → Devices and Simulators
3. Select your device
4. Click **+** under "Installed Apps"
5. Navigate to `build/ios/iphoneos/Runner.app`
6. Select it

### Option B: Via Xcode Run

1. Open `ios/Runner.xcworkspace` in Xcode
2. Select your device from dropdown
3. Click Run (▶️)

This is the easiest method - Xcode handles everything.

## Summary

**You DO NOT need a paid Apple Developer account** to:
- Test your app on your own devices
- Use App Groups and Share Extensions
- Develop and iterate

You ONLY need a paid account ($99/year) when you want to:
- Distribute via TestFlight
- Publish to App Store
- Use push notifications or iCloud
- Install on more than 3 devices

For development, the free account is perfect!
