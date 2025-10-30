# Week 2: Build Artifact Management - Migration Guide

**Status:** Ready to Execute
**Goal:** Reorganize scripts and implement predictable build artifacts

## Overview

This migration implements Amazon Principal Engineer standards for build artifact management:

1. ✅ **Predictable output locations**: All builds go to `./build/{platform}/{configuration}/`
2. ✅ **Semantic artifact naming**: `RecipeArchive-{version}-{platform}-{configuration}.{ext}`
3. ✅ **Clean script organization**: Platform-specific scripts in `scripts/{platform}/`
4. ✅ **Zero git noise**: No more auto-reset mechanisms or build artifacts in source tree

## Phase 1: Script Reorganization

Execute these git mv commands to reorganize scripts into platform directories:

```bash
cd /Users/matt/GitHub/RecipeArchive

# Move iOS build script
git mv scripts/ios-build.sh scripts/ios/build.sh

# Move Android build script
git mv scripts/android-build.sh scripts/android/build.sh

# Move web scripts
git mv scripts/web-deploy.sh scripts/web/deploy.sh
git mv scripts/web-deploy-quick.sh scripts/web/deploy-quick.sh
git mv scripts/web-deploy-simple.sh scripts/web/deploy-simple.sh
git mv scripts/web-start-dev.sh scripts/web/start-dev.sh
git mv scripts/process-web-icons.sh scripts/web/process-icons.sh

# Move extension packaging script
git mv scripts/package-extensions.sh scripts/extensions/package.sh
```

**Result:** Clean organization matching iOS/Android pattern:

```
scripts/
├── ios/
│   ├── build.sh ← (was ios-build.sh)
│   ├── setup.sh
│   ├── simulator.sh
│   └── ...
├── android/
│   ├── build.sh ← (was android-build.sh)
│   ├── setup.sh
│   ├── emulator.sh
│   └── ...
├── web/
│   ├── deploy.sh ← (was web-deploy.sh)
│   ├── deploy-quick.sh
│   ├── deploy-simple.sh
│   ├── start-dev.sh
│   └── process-icons.sh
└── extensions/
    └── package.sh ← (was package-extensions.sh)
```

## Update .gitignore

The `.gitignore` file already ignores `build/` and `builds/` directories. We'll add an explicit entry for the new unified build directory:

```bash
# Add to .gitignore (after line 48)
# Unified build directory (Week 2: Build Artifact Management)
/build/
```

## Update Build Scripts

After reorganizing, update the build scripts to output to the new unified `./build/` directory structure.

### Changes Required

1. **iOS Build Script** (`scripts/ios/build.sh`):
   - Output to: `./build/ios/{configuration}/RecipeArchive-{version}-ios-{configuration}-{target}.app`
   - Remove `project.pbxproj` auto-reset mechanism
   - Create semantic artifact symlinks in `artifacts/` subdirectory

2. **Android Build Script** (`scripts/android/build.sh`):
   - Output to: `./build/android/{configuration}/RecipeArchive-{version}-android-{configuration}.{ext}`
   - Create semantic artifact symlinks in `artifacts/` subdirectory

3. **Web Deploy Script** (`scripts/web/deploy.sh`):
   - Create build archive: `./build/web/release/RecipeArchive-{version}-web-release.tar.gz`
   - Deploy from predictable location

## Documentation Updates

After script reorganization, update all documentation references:

### Files to Update

1. **README.md**:
   - Line ~205-207: Update mobile build commands
   - Change: `./scripts/build-ios.sh` → `./scripts/ios/build.sh`
   - Change: `./scripts/build-android.sh` → `./scripts/android/build.sh`

2. **COMMANDS.md**:
   - iOS section: Update all `ios-build.sh` references
   - Android section: Update all `android-build.sh` references
   - Add web section with new `scripts/web/` commands

3. **CLAUDE.md**:
   - Update build script references throughout
   - Update iOS/Android build sections

4. **PROJECT_STATUS.md**:
   - Mark Week 2 tasks as complete
   - Update "Upcoming Work" section

## Validation

After reorganization and updates, validate everything works:

```bash
# Validate script locations
test -f scripts/ios/build.sh && echo "✓ iOS build script" || echo "✗ iOS build script missing"
test -f scripts/android/build.sh && echo "✓ Android build script" || echo "✗ Android build script missing"
test -f scripts/web/deploy.sh && echo "✓ Web deploy script" || echo "✗ Web deploy script missing"

# Run full validation suite
./validate-monorepo.sh --all
```

## Rollback Plan

If issues arise, rollback with:

```bash
# Undo script moves
git mv scripts/ios/build.sh scripts/ios-build.sh
git mv scripts/android/build.sh scripts/android-build.sh
git mv scripts/web/deploy.sh scripts/web-deploy.sh
# ... etc

# Revert .gitignore changes
git checkout .gitignore

# Revert documentation
git checkout README.md COMMANDS.md CLAUDE.md PROJECT_STATUS.md
```

## Git Commit Message

After completing all changes:

```bash
git add -A
git commit -m "refactor: implement unified build artifact management (Week 2)

Amazon Principal Engineer Review - Week 2 Implementation

Script Reorganization:
- Move ios-build.sh → scripts/ios/build.sh
- Move android-build.sh → scripts/android/build.sh
- Organize web-*.sh scripts into scripts/web/
- Move package-extensions.sh → scripts/extensions/package.sh

Build System Improvements:
- Create unified ./build/ directory structure
- Implement semantic artifact naming (RecipeArchive-{version}-{platform}-{config})
- Add artifacts/ subdirectories with symlinks for backward compatibility
- Remove auto-reset mechanisms that fight Git

Documentation:
- Add docs/development/build-system.md with complete specification
- Update README.md, COMMANDS.md, CLAUDE.md with new script locations
- Update PROJECT_STATUS.md to mark Week 2 complete

Success Criteria Met:
✓ Build output location is 100% predictable
✓ Zero git noise from build processes
✓ Trivial integration with CI/CD pipelines
✓ Clean script organization by platform"

git push origin main
```

## Next Steps

After Week 2 completion:

- **Week 3**: Health Checks & Operational Runbooks
  - Create `./scripts/diagnose-health.sh`
  - Build structured runbooks in `docs/runbooks/`
  - Implement deterministic reproduction steps for all P0 issues
