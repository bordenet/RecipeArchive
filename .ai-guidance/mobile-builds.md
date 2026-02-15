# Mobile Development Guide

## iOS Builds

**All iOS builds use**: [`./scripts/ios/build.sh`](../scripts/ios/build.sh)

### Development Builds (fast iteration, simulator)
```bash
./scripts/ios/build.sh --dev --run              # Quick build and run
./scripts/ios/build.sh --dev --simulator --release  # Release for simulator
./scripts/ios/build.sh --dev --clean --run      # Clean build
```

### Production Builds (App Store, TestFlight, device)
```bash
./scripts/ios/build.sh --prod --device --release --version 1.0.1
# Creates .xcarchive at: recipe_archive/ios/build/archives/Runner.xcarchive
# Export IPA via Xcode Organizer for distribution
```

### Critical Architecture Decision
- **NEVER use `flutter build ios` command** - it gets confused by multiple Xcode schemes
- **ALWAYS use Xcode's build system directly** via `xcodebuild`
- Xcode's build phases call Flutter's compilation scripts automatically

### Key Features
- Uses "Runner" scheme with standard Xcode configurations (Debug, Release, Profile)
- Automatic Share Extension embedding verification
- Auto-resets project.pbxproj after build to avoid git noise
- Dev mode: Fast `xcodebuild build` → .app
- Prod mode: `xcodebuild build` with `-allowProvisioningUpdates` → .app (signed)

**⚠️ Xcode 16 Compatibility**: Script auto-downgrades `objectVersion 70` → `60` for CocoaPods compatibility.

---

## Android Builds

**All Android builds use**: [`./scripts/android/build.sh`](../scripts/android/build.sh)

### Development Builds (fast iteration, emulator)
```bash
./scripts/android/build.sh --dev --run          # Quick build and run
./scripts/android/build.sh --dev --emulator --release  # Release for emulator
./scripts/android/build.sh --dev --clean --run  # Clean build
```

### Production Builds (Play Store, signed APK/AAB)
```bash
./scripts/android/build.sh --prod --device --release --version 1.0.1
./scripts/android/build.sh --prod --device --release --version 1.0.1 --appbundle  # AAB for Play Store
```

### Critical Architecture Decision
- **Use Gradle build system directly** via `./gradlew` (NOT `flutter build apk`)
- Gradle configurations: debug, release, profile
- Automatic 10-minute timeout protection on all builds
- APK/AAB output verification and symlink organization

### Android Studio Build Fix
If Android Studio fails with "Cannot run program '/opt/homebrew/share/flutter/bin/flutter'" or "spawn helper" errors:

1. **Root cause**: Extended attributes on Flutter binary prevent Android Studio's Java subprocess from executing it
2. **Fix**: Remove extended attributes:
   ```bash
   sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/
   sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/cache/
   sudo xattr -r -d com.apple.quarantine /opt/homebrew/share/flutter/bin/ 2>/dev/null || true
   ```
3. **Verification**: Command-line builds (`./gradlew assembleDebug`) should already work

---

## .env File Management

**Flutter does NOT follow symlinks in asset bundles.**

- **Root .env**: Keep the master `.env` at repository root (gitignored)
- **Flutter .env**: Copy (NOT symlink) to `recipe_archive/.env` for builds
- **Build scripts**: Automatically sync `.env` from root before every build
- **NEVER commit**: `recipe_archive/.env` must stay in `.gitignore`

Both `scripts/android/build.sh` and `scripts/ios/build.sh` automatically copy the root `.env` to `recipe_archive/.env` before building.

