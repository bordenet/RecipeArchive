# iOS Builds

**All iOS builds use**: [`./scripts/ios/build.sh`](../../scripts/ios/build.sh)

## Development Builds (fast iteration, simulator)

```bash
./scripts/ios/build.sh --dev --run              # Quick build and run
./scripts/ios/build.sh --dev --simulator --release  # Release for simulator
./scripts/ios/build.sh --dev --clean --run      # Clean build
```

## Production Builds (App Store, TestFlight, device)

```bash
./scripts/ios/build.sh --prod --device --release --version 1.0.1
# Creates .xcarchive at: recipe_archive/ios/build/archives/Runner.xcarchive
# Export IPA via Xcode Organizer for distribution
```

## Critical Architecture Decision

- **NEVER use `flutter build ios` command** - it gets confused by multiple Xcode schemes
- **ALWAYS use Xcode's build system directly** via `xcodebuild`
- Xcode's build phases call Flutter's compilation scripts automatically

## Key Features

- Uses "Runner" scheme with standard Xcode configurations (Debug, Release, Profile)
- Automatic Share Extension embedding verification
- Auto-resets project.pbxproj after build to avoid git noise
- Dev mode: Fast `xcodebuild build` → .app
- Prod mode: `xcodebuild build` with `-allowProvisioningUpdates` → .app (signed)

**⚠️ Xcode 16 Compatibility**: Script auto-downgrades `objectVersion 70` → `60` for CocoaPods compatibility.

