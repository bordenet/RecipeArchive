# Build System Architecture

**Version:** 2.0.0
**Status:** Week 2 Implementation
**Goal:** Predictable, hermetic builds with semantic versioning

## Philosophy

**Amazon Principal Engineer Standards:**

1. **Predictability**: Build output location is 100% deterministic
2. **Hermeticity**: Builds don't fight Git or create noise in diffs
3. **Semantic Naming**: All artifacts include version, platform, and configuration
4. **CI/CD Ready**: Trivial integration with GitHub Actions artifact uploads

## Unified Build Directory Structure

All build artifacts are organized under a single `./build/` directory at repository root:

```
./build/
├── ios/
│   ├── debug/
│   │   ├── RecipeArchive-1.0.0-ios-debug-simulator.app/
│   │   └── artifacts/
│   │       └── Runner.app -> ../RecipeArchive-1.0.0-ios-debug-simulator.app
│   ├── release/
│   │   ├── RecipeArchive-1.0.0-ios-release-simulator.app/
│   │   ├── RecipeArchive-1.0.1-ios-release-device.xcarchive/
│   │   └── artifacts/
│   │       ├── Runner.app -> ../RecipeArchive-1.0.0-ios-release-simulator.app
│   │       └── Runner.xcarchive -> ../RecipeArchive-1.0.1-ios-release-device.xcarchive
│   └── profile/
│       └── artifacts/
├── android/
│   ├── debug/
│   │   ├── RecipeArchive-1.0.0-android-debug.apk
│   │   └── artifacts/
│   │       └── app-debug.apk -> ../RecipeArchive-1.0.0-android-debug.apk
│   ├── release/
│   │   ├── RecipeArchive-1.0.1-android-release.apk
│   │   ├── RecipeArchive-1.0.1-android-release.aab
│   │   └── artifacts/
│   │       ├── app-release.apk -> ../RecipeArchive-1.0.1-android-release.apk
│   │       └── app-release.aab -> ../RecipeArchive-1.0.1-android-release.aab
│   └── profile/
│       └── artifacts/
├── web/
│   ├── debug/
│   │   └── artifacts/
│   ├── release/
│   │   ├── RecipeArchive-1.0.1-web-release.tar.gz
│   │   └── artifacts/
│   │       └── web-release.tar.gz -> ../RecipeArchive-1.0.1-web-release.tar.gz
│   └── profile/
│       └── artifacts/
└── extensions/
    ├── chrome/
    │   └── RecipeArchive-Chrome-1.0.1.zip
    └── safari/
        └── RecipeArchive-Safari-1.0.1.zip
```

## Semantic Artifact Naming

### Pattern

```
{ProjectName}-{Version}-{Platform}-{Configuration}[-{Target}].{Extension}
```

### Examples

| Platform | Configuration | Target | Example |
|----------|--------------|--------|---------|
| iOS | Debug | Simulator | `RecipeArchive-1.0.0-ios-debug-simulator.app` |
| iOS | Release | Device | `RecipeArchive-1.0.1-ios-release-device.xcarchive` |
| Android | Debug | Emulator | `RecipeArchive-1.0.0-android-debug.apk` |
| Android | Release | Device | `RecipeArchive-1.0.1-android-release.aab` |
| Web | Release | - | `RecipeArchive-1.0.1-web-release.tar.gz` |
| Extension | - | Chrome | `RecipeArchive-Chrome-1.0.1.zip` |

### Version Resolution

- **Development builds**: Use `git describe --tags --always --dirty` or fallback to `1.0.0-dev`
- **Production builds**: Require explicit `--version X.Y.Z` flag
- **Version format**: Semantic versioning (MAJOR.MINOR.PATCH)

## Build Script Organization

### Directory Structure

```
scripts/
├── ios/
│   ├── build.sh          # Unified iOS build script (replaces ios-build.sh)
│   ├── setup.sh          # iOS development environment setup
│   ├── simulator.sh      # Launch simulator
│   ├── xcode.sh          # Open Xcode
│   ├── clean.sh          # Clean iOS build artifacts
│   └── help.sh           # iOS development guide
├── android/
│   ├── build.sh          # Unified Android build script (replaces android-build.sh)
│   ├── setup.sh          # Android development environment setup
│   ├── emulator.sh       # Manage emulators
│   ├── run.sh            # Run on emulator/device
│   ├── studio.sh         # Open Android Studio
│   ├── clean.sh          # Clean Android build artifacts
│   └── help.sh           # Android development guide
├── web/
│   ├── build.sh          # Build Flutter web app
│   ├── deploy.sh         # Deploy to S3/CloudFront (replaces web-deploy.sh)
│   ├── deploy-quick.sh   # Fast deploy (skip full build)
│   ├── deploy-simple.sh  # Simplified deployment
│   ├── start-dev.sh      # Local development server
│   └── process-icons.sh  # Icon processing utility
└── extensions/
    └── package.sh        # Package extensions (replaces package-extensions.sh)
```

### Consolidated Top-Level Scripts

Keep only orchestration scripts at repository root:

```
scripts/
├── build-all.sh          # Build all platforms
├── deploy-all.sh         # Deploy all components
├── clean-all.sh          # Clean all build artifacts
└── validate-builds.sh    # Verify all artifacts
```

## Build Output Guarantees

### iOS Builds

**Development (Simulator):**
```bash
./scripts/ios/build.sh --dev --run

# Output location (guaranteed):
./build/ios/debug/RecipeArchive-{VERSION}-ios-debug-simulator.app
./build/ios/debug/artifacts/Runner.app -> (symlink to above)
```

**Production (Device Archive):**
```bash
./scripts/ios/build.sh --prod --device --release --version 1.0.1

# Output location (guaranteed):
./build/ios/release/RecipeArchive-1.0.1-ios-release-device.xcarchive
./build/ios/release/artifacts/Runner.xcarchive -> (symlink to above)
```

### Android Builds

**Development (Emulator):**
```bash
./scripts/android/build.sh --dev --run

# Output location (guaranteed):
./build/android/debug/RecipeArchive-{VERSION}-android-debug.apk
./build/android/debug/artifacts/app-debug.apk -> (symlink to above)
```

**Production (Signed APK):**
```bash
./scripts/android/build.sh --prod --device --release --version 1.0.1

# Output location (guaranteed):
./build/android/release/RecipeArchive-1.0.1-android-release.apk
./build/android/release/artifacts/app-release.apk -> (symlink to above)
```

**Production (App Bundle):**
```bash
./scripts/android/build.sh --prod --device --release --version 1.0.1 --appbundle

# Output location (guaranteed):
./build/android/release/RecipeArchive-1.0.1-android-release.aab
./build/android/release/artifacts/app-release.aab -> (symlink to above)
```

### Web Builds

**Development:**
```bash
./scripts/web/start-dev.sh

# No artifacts (uses flutter run -d chrome)
```

**Production:**
```bash
./scripts/web/build.sh --release --version 1.0.1

# Output location (guaranteed):
./build/web/release/RecipeArchive-1.0.1-web-release.tar.gz
./build/web/release/artifacts/web-release.tar.gz -> (symlink to above)
```

## Git Integration

### .gitignore

```gitignore
# Unified build directory (all platforms)
/build/

# Legacy build directories (to be removed)
recipe_archive/build/
recipe_archive/ios/builds/
recipe_archive/android/builds/
```

### Zero Git Noise

**Eliminated mechanisms:**

- ❌ No more `project.pbxproj` auto-reset after iOS builds
- ❌ No more symlink reorganization that changes timestamps
- ❌ No more build artifact cleanup in pre-commit hooks

**New approach:**

- ✅ All build outputs go to `/build/` (git-ignored)
- ✅ Build scripts are hermetic (don't modify source tree)
- ✅ Developers can build anytime without git noise

## CI/CD Integration

### GitHub Actions Artifact Upload

```yaml
- name: Build iOS Release
  run: ./scripts/ios/build.sh --prod --device --release --version ${{ github.ref_name }}

- name: Upload iOS Archive
  uses: actions/upload-artifact@v3
  with:
    name: ios-release
    path: ./build/ios/release/RecipeArchive-*.xcarchive
```

### Predictable Paths for Automation

All artifact paths follow this pattern:

```bash
# iOS
./build/ios/{configuration}/RecipeArchive-{version}-ios-{configuration}-{target}.{ext}

# Android
./build/android/{configuration}/RecipeArchive-{version}-android-{configuration}.{ext}

# Web
./build/web/{configuration}/RecipeArchive-{version}-web-{configuration}.tar.gz
```

Scripts can glob for artifacts reliably:

```bash
# Find latest iOS release archive
ls -t ./build/ios/release/RecipeArchive-*-ios-release-device.xcarchive | head -1

# Find latest Android release APK
ls -t ./build/android/release/RecipeArchive-*-android-release.apk | head -1
```

## Migration Path

### Phase 1: Create New Structure (Week 2)

1. ✅ Create `./build/` directory structure
2. ✅ Update iOS build script to output to new location
3. ✅ Update Android build script to output to new location
4. ✅ Create web build scripts in `scripts/web/`
5. ✅ Update `.gitignore` for unified build directory

### Phase 2: Reorganize Scripts (Week 2)

1. ✅ Move `ios-build.sh` → `scripts/ios/build.sh`
2. ✅ Move `android-build.sh` → `scripts/android/build.sh`
3. ✅ Move `web-*.sh` → `scripts/web/`
4. ✅ Update all script references in documentation

### Phase 3: Remove Legacy Mechanisms (Week 2)

1. ✅ Remove `project.pbxproj` auto-reset from iOS script
2. ✅ Remove build artifact symlink reorganization
3. ✅ Remove legacy `recipe_archive/ios/builds/` references
4. ✅ Remove legacy `recipe_archive/android/builds/` references

### Phase 4: Update Documentation (Week 2)

1. ✅ Update [README.md](../../README.md) with new paths
2. ✅ Update [COMMANDS.md](../../COMMANDS.md) with new script locations
3. ✅ Update [.claude/instructions.md](../../.claude/instructions.md) AI instructions and governance
4. ✅ Update [PROJECT_STATUS.md](../../PROJECT_STATUS.md) to mark Week 2 complete

## Success Criteria

- [x] Build output location is 100% predictable
- [x] Zero git noise from build processes
- [x] Trivial integration with CI/CD pipelines
- [x] All artifacts include semantic version in filename
- [x] Symlinks in `artifacts/` subdirectories for backward compatibility

## Appendix: Build Script Template

All platform build scripts follow this structure:

```bash
#!/usr/bin/env bash
set -e

# 1. Parse arguments (--dev/--prod, --debug/--release, --version)
# 2. Determine version (explicit or auto-detect)
# 3. Set output path: ./build/{platform}/{configuration}/RecipeArchive-{version}-{platform}-{configuration}.{ext}
# 4. Run platform build system (Xcode, Gradle, Flutter)
# 5. Copy/move artifact to predictable output path
# 6. Create symlink in artifacts/ subdirectory
# 7. Verify artifact exists at expected location
# 8. Print success message with artifact path
```

**Key principle**: Build scripts are responsible for organizing their own output. The build system doesn't rely on external cleanup scripts or git hooks.
