# Android Build & Deployment Scripts

Automated scripts for building, testing, and deploying the RecipeArchive Android app.

## Quick Start

### Run App on Emulator (Recommended)

The fastest way to build and run the app:

```bash
# From repository root
./scripts/android-build.sh --dev --run
```

**What it does:**
1. Checks if emulator is running (starts it if not)
2. Builds debug APK using Gradle
3. Installs APK on emulator
4. Launches the app

### Alternative: Step-by-Step

If you prefer more control:

```bash
# 1. Start emulator
./scripts/android/emulator.sh start

# 2. Build and run
./scripts/android/run.sh
```

## Available Scripts

### Main Build Script

**[../android-build.sh](../android-build.sh)** - Build script for all Android builds

**Development builds** (fast iteration):
```bash
# Quick debug build and run
./scripts/android-build.sh --dev --run

# Release build for performance testing
./scripts/android-build.sh --dev --emulator --release

# Clean build
./scripts/android-build.sh --dev --clean --run
```

**Production builds** (Play Store):
```bash
# Signed release APK
./scripts/android-build.sh --prod --device --release --version 1.0.1

# App Bundle (AAB) for Play Store
./scripts/android-build.sh --prod --device --release --version 1.0.1 --appbundle
```

**Features:**
- Direct use of Gradle build system (NOT `flutter build`)
- 10-minute timeout protection
- Automatic emulator management
- Build artifact organization with symlinks
- Production-grade error handling

### Emulator Management

**[emulator.sh](emulator.sh)** - Manage Android Virtual Devices

```bash
# Start emulator (creates if needed)
./scripts/android/emulator.sh start

# Stop running emulator
./scripts/android/emulator.sh stop

# List available emulators
./scripts/android/emulator.sh list

# Check emulator status
./scripts/android/emulator.sh status

# Create new emulator
./scripts/android/emulator.sh create
```

### App Runner

**[run.sh](run.sh)** - Launch app on running emulator

```bash
./scripts/android/run.sh
```

Auto-starts emulator if not running, then launches the app using `flutter run`.

### Build Management

**[clean.sh](clean.sh)** - Clean build artifacts

```bash
./scripts/android/clean.sh
```

Removes Flutter build cache, Gradle cache, and build outputs.

### Android Studio

**[studio.sh](studio.sh)** - Launch Android Studio

```bash
./scripts/android/studio.sh
```

Opens Android Studio with the RecipeArchive project.

## Build Outputs

### Debug Builds
```
recipe_archive/build/app/outputs/flutter-apk/app-debug.apk
```

Symlinked to:
```
recipe_archive/android/builds/debug/app-debug.apk
```

### Release APK
```
recipe_archive/build/app/outputs/apk/release/app-release.apk
```

### App Bundle (AAB)
```
recipe_archive/build/app/outputs/bundle/release/app-release.aab
```

## Android Studio Build Issues

If Android Studio fails with "Cannot run program '/opt/homebrew/share/flutter/bin/flutter'" errors:

**Root cause:** Extended attributes on Flutter binary prevent Android Studio's Java subprocess from executing it.

**Fix:**
```bash
sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/
sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/cache/
sudo xattr -r -d com.apple.quarantine /opt/homebrew/share/flutter/bin/ 2>/dev/null || true
```

**Note:** Command-line builds (`./gradlew assembleDebug`) already work; this only fixes Android Studio IDE builds.

## Environment Setup

All Android dependencies are managed via:
```bash
./scripts/setup-macos.sh
```

**Never install dependencies manually** - always add them to the setup script to maintain consistency.

## Gradle Build System

This project uses Gradle directly (NOT `flutter build apk/appbundle`):

**Why:**
- More reliable and predictable builds
- Better incremental compilation
- Consistent with iOS approach (using native build tools)
- Avoids Flutter CLI configuration issues

**Gradle configurations:**
- `debug` - Fast development builds with debugging enabled
- `release` - Optimized production builds
- `profile` - Performance profiling builds

## Common Workflows

### Daily Development
```bash
# First build of the day
./scripts/android-build.sh --dev --clean --run

# Subsequent iterations
./scripts/android-build.sh --dev --run
```

### Testing Performance
```bash
# Release mode on emulator
./scripts/android-build.sh --dev --emulator --release --run
```

### Preparing for Play Store
```bash
# Create signed App Bundle
./scripts/android-build.sh --prod --device --release --version 1.2.0 --appbundle

# Output: recipe_archive/build/app/outputs/bundle/release/app-release.aab
```

### Manual Installation
```bash
# Build APK
./scripts/android-build.sh --dev --emulator --debug

# Start emulator if needed
./scripts/android/emulator.sh start

# Install manually
adb install -r recipe_archive/build/app/outputs/flutter-apk/app-debug.apk

# Launch app
adb shell monkey -p com.recipeArchive.recipe_archive -c android.intent.category.LAUNCHER 1
```

## Troubleshooting

### Emulator won't start
```bash
# Check available emulators
./scripts/android/emulator.sh list

# If none exist, create one
./scripts/android/emulator.sh create

# Check emulator logs
cat ~/Library/Logs/Android/emulator.log
```

### Build fails
```bash
# Clean everything
./scripts/android/clean.sh

# Rebuild
./scripts/android-build.sh --dev --clean --run
```

### ADB connection issues
```bash
# Restart ADB server
adb kill-server
adb start-server
adb devices
```

## Architecture Notes

**Critical conventions:**
- All scripts use 10-minute timeout protection
- Direct Gradle usage (not Flutter CLI)
- Automatic build artifact organization
- Clear separation between dev and prod modes
- Production-grade error handling with `set -e`

**Script consolidation:**
- ALL scripts live in `./scripts/` at repository root
- Platform-specific scripts in `./scripts/android/`
- NEVER create scripts directories in subdirectories

See [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for complete development conventions.
