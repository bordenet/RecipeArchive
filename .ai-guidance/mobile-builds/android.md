# Android Builds

**All Android builds use**: [`./scripts/android/build.sh`](../../scripts/android/build.sh)

## Development Builds (fast iteration, emulator)

```bash
./scripts/android/build.sh --dev --run          # Quick build and run
./scripts/android/build.sh --dev --emulator --release  # Release for emulator
./scripts/android/build.sh --dev --clean --run  # Clean build
```

## Production Builds (Play Store, signed APK/AAB)

```bash
./scripts/android/build.sh --prod --device --release --version 1.0.1
./scripts/android/build.sh --prod --device --release --version 1.0.1 --appbundle  # AAB
```

## Critical Architecture Decision

- **Use Gradle build system directly** via `./gradlew` (NOT `flutter build apk`)
- Gradle configurations: debug, release, profile
- Automatic 10-minute timeout protection on all builds
- APK/AAB output verification and symlink organization

## Android Studio Build Fix

If Android Studio fails with "Cannot run program '/opt/homebrew/share/flutter/bin/flutter'" or "spawn helper" errors:

1. **Root cause**: Extended attributes on Flutter binary prevent Android Studio's Java subprocess from executing it
2. **Fix**: Remove extended attributes:
   ```bash
   sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/
   sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/cache/
   sudo xattr -r -d com.apple.quarantine /opt/homebrew/share/flutter/bin/ 2>/dev/null || true
   ```
3. **Verification**: Command-line builds (`./gradlew assembleDebug`) should already work

