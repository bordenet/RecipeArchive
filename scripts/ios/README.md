# iOS Build & Deployment Scripts

Automated scripts for building, testing, and deploying the RecipeArchive iOS app.

## Quick Start

### Run App on Simulator (Recommended)

The fastest way to build and run the app:

```bash
# From repository root
./scripts/build-ios-unified.sh --dev --run
```

**What it does:**
1. Builds debug .app using Xcode
2. Starts simulator if needed
3. Installs app on simulator
4. Launches the app

### Alternative: Step-by-Step

If you prefer more control, use the specialized scripts in this directory.

## Available Scripts

### Main Build Script

**[../build-ios-unified.sh](../build-ios-unified.sh)** - Unified build script for all iOS builds

**Development builds** (fast iteration):
```bash
# Quick debug build and run
./scripts/build-ios-unified.sh --dev --run

# Release build for performance testing
./scripts/build-ios-unified.sh --dev --simulator --release

# Clean build
./scripts/build-ios-unified.sh --dev --clean --run
```

**Production builds** (App Store, TestFlight):
```bash
# Release build for device
./scripts/build-ios-unified.sh --prod --device --release --version 1.0.1

# Creates: recipe_archive/ios/build/Release-iphoneos/Runner.app
# Export IPA via Xcode Organizer for distribution
```

**Features:**
- Direct use of Xcode build system (NOT `flutter build ios`)
- Auto-resets project.pbxproj after build (avoids git noise)
- Share Extension verification
- Build artifact organization with symlinks
- Production-grade error handling

### Critical Architecture Decision

**NEVER use `flutter build ios` command** - it gets confused by multiple Xcode schemes.

**ALWAYS use Xcode's build system directly** via `xcodebuild`:
- Xcode's build phases call Flutter's compilation scripts automatically
- More reliable and avoids scheme ambiguity
- This is the gold standard approach

### Simulator Management

All iOS simulator management is handled by:

**[../build-ios-unified.sh](../build-ios-unified.sh)** with `--run` flag

The script automatically:
- Detects available simulators
- Starts simulator if not running
- Installs and launches app

**Manual simulator commands:**
```bash
# List available simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot <UUID>

# Open Simulator app
open -a Simulator
```

### Build Management

All build operations use the unified script. Individual helper scripts in this directory are for specialized tasks only.

## Build Outputs

### Simulator Builds
```
recipe_archive/ios/build/Debug-iphonesimulator/Runner.app
recipe_archive/ios/build/Release-iphonesimulator/Runner.app
```

Symlinked to:
```
recipe_archive/ios/builds/simulator/debug/Runner.app
recipe_archive/ios/builds/simulator/release/Runner.app
```

### Device Builds
```
recipe_archive/ios/build/Debug-iphoneos/Runner.app
recipe_archive/ios/build/Release-iphoneos/Runner.app
```

Symlinked to:
```
recipe_archive/ios/builds/device/debug/Runner.app
recipe_archive/ios/builds/device/release/Runner.app
```

### Archives (for App Store)
```
recipe_archive/ios/build/archives/Runner.xcarchive
```

Export IPA from archive using Xcode Organizer or command line.

## Xcode Configurations

The project uses standard Xcode configurations:
- `Debug` - Fast development builds with debugging enabled
- `Release` - Optimized production builds
- `Profile` - Performance profiling builds

**Scheme:** `Runner` (standard Flutter app scheme)

## Share Extension

The iOS app includes a Share Extension for capturing recipes from Safari/other apps.

**Implementation:**
- [recipe_archive/ios/RecipeArchive](../../recipe_archive/ios/RecipeArchive/) - Share Extension target
- [recipe_archive/ios/Shared](../../recipe_archive/ios/Shared/) - Shared code (WebViewContentLoader)
- [recipe_archive/ios/Runner](../../recipe_archive/ios/Runner/) - Main app target

**Build verification:**
The unified build script automatically verifies Share Extension is embedded in the final app bundle.

## iOS Recipe Capture Architecture

**Three-tier approach:**
1. **WKWebView Proxy** (primary) - Loads page in background, extracts HTML + images
2. **Web Archive** - Offline capture with embedded resources
3. **URL-only** - Fallback for public content

**Key files:**
- [WebViewContentLoader.swift](../../recipe_archive/ios/Shared/WebViewContentLoader.swift) - WKWebView loader
- [ShareViewController.swift](../../recipe_archive/ios/RecipeArchive/ShareViewController.swift) - Share Extension entry
- [AppDelegate.swift](../../recipe_archive/ios/Runner/AppDelegate.swift) - Flutter integration

See [ADR 002](../../docs/adr/002-ios-recipe-capture-architecture.md) for complete architecture details.

## Xcode 16 Compatibility

The unified script auto-handles Xcode 16 compatibility:
- Auto-downgrades `objectVersion 70` → `60` for CocoaPods
- Resets project.pbxproj after build to avoid git noise

## Environment Setup

All iOS dependencies are managed via:
```bash
./scripts/setup-macos.sh
```

**Installed components:**
- Xcode Command Line Tools
- CocoaPods
- Flutter iOS toolchain
- iOS simulators

**Never install dependencies manually** - always add them to the setup script.

## Common Workflows

### Daily Development
```bash
# First build of the day
./scripts/build-ios-unified.sh --dev --clean --run

# Subsequent iterations
./scripts/build-ios-unified.sh --dev --run
```

### Testing Performance
```bash
# Release mode on simulator
./scripts/build-ios-unified.sh --dev --simulator --release --run
```

### Testing on Physical Device
```bash
# Debug build
./scripts/build-ios-unified.sh --dev --device --debug

# Install via Xcode: Devices & Simulators → Installed Apps → + → Select .app
```

### Preparing for App Store
```bash
# Create release archive
./scripts/build-ios-unified.sh --prod --device --release --version 1.2.0

# Archive location: recipe_archive/ios/build/archives/Runner.xcarchive

# Export IPA:
# - Open Xcode
# - Window → Organizer
# - Select archive → Distribute App
```

### Manual Installation (Simulator)
```bash
# Build app
./scripts/build-ios-unified.sh --dev --simulator --debug

# Boot simulator
xcrun simctl boot "iPhone 16"
open -a Simulator

# Install
xcrun simctl install booted recipe_archive/ios/build/Debug-iphonesimulator/Runner.app

# Launch
xcrun simctl launch booted com.recipeArchive.recipeArchive
```

## Troubleshooting

### CocoaPods issues
```bash
# Clean pods
cd recipe_archive/ios
pod deintegrate
pod install

# If still failing, reset completely
rm -rf Pods Podfile.lock
pod install
```

### Build fails with scheme errors
This happens if you try to use `flutter build ios`. Solution:

```bash
# Always use Xcode directly via unified script
./scripts/build-ios-unified.sh --dev --run
```

### Simulator won't boot
```bash
# Reset simulator
xcrun simctl erase all

# Restart CoreSimulatorService
sudo killall -9 com.apple.CoreSimulator.CoreSimulatorService
```

### Share Extension not working
```bash
# Verify extension is embedded
ls -la recipe_archive/ios/build/Debug-iphonesimulator/Runner.app/PlugIns/

# Should contain RecipeArchive.appex
```

### Code signing issues
```bash
# Development builds (simulator): No signing required
./scripts/build-ios-unified.sh --dev --simulator

# Device builds: Xcode manages signing automatically
# Ensure Xcode is logged in: Preferences → Accounts
```

## Architecture Notes

**Critical conventions:**
- Use Xcode build system directly (NOT Flutter CLI)
- Always reset project.pbxproj after builds
- Verify Share Extension embedding
- Clear separation between dev and prod modes
- SDK targeting: iphonesimulator vs iphoneos

**Auto-reset mechanism:**
After each build, the script resets `ios/Runner.xcodeproj/project.pbxproj` to avoid polluting git with temporary build settings.

**Script consolidation:**
- ALL scripts live in `./scripts/` at repository root
- Platform-specific scripts in `./scripts/ios/`
- NEVER create scripts directories in subdirectories

See [../../CLAUDE.md](../../CLAUDE.md) for complete development conventions.

## Physical Device Testing

### Via Xcode (Recommended)
1. Connect device via USB
2. Trust computer on device
3. Build: `./scripts/build-ios-unified.sh --dev --device --debug`
4. Open Xcode → Devices & Simulators
5. Select device → Installed Apps → + → Select Runner.app

### Via Command Line
```bash
# List connected devices
xcrun devicectl list

# Install app
xcrun devicectl device install app --device <UUID> recipe_archive/ios/build/Debug-iphoneos/Runner.app

# Launch app
xcrun devicectl device process launch --device <UUID> com.recipeArchive.recipeArchive
```

## Performance Profiling

```bash
# Build with Profile configuration
./scripts/build-ios-unified.sh --dev --simulator --profile --run

# Then use Xcode Instruments for profiling
```

## App Groups (for Share Extension)

The app uses App Groups to share data between main app and Share Extension:

**Group ID:** `group.com.recipeArchive.recipeArchive`

**Configured in:**
- Main app: Runner.entitlements
- Share Extension: RecipeArchive.entitlements

**Usage:** Shared UserDefaults and file storage for captured recipes.
