# Week 2: Build Artifact Management - Execution Guide

**Goal:** Reorganize scripts and implement unified build artifacts

## Script Reorganization

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

## Build Script Updates (Next Phase)

Update build scripts to output to `./build/{platform}/{config}/RecipeArchive-{version}-{platform}-{config}.{ext}`:

- `scripts/ios/build.sh`: Output to `./build/ios/{config}/`
- `scripts/android/build.sh`: Output to `./build/android/{config}/`
- `scripts/web/deploy.sh`: Output to `./build/web/release/`

Remove `project.pbxproj` auto-reset and symlink reorganization mechanisms.

## Documentation Updates

Update script references in README.md, COMMANDS.md, and CLAUDE.md to use new paths:
- `./scripts/build-ios.sh` → `./scripts/ios/build.sh`
- `./scripts/build-android.sh` → `./scripts/android/build.sh`
- `./scripts/web-deploy.sh` → `./scripts/web/deploy.sh`

## Commit

```bash
git add -A
git commit -m "refactor: unified build artifact management (Week 2)

- Reorganize scripts into platform directories
- Implement ./build/{platform}/{config}/ structure
- Remove auto-reset mechanisms
- Update documentation references"

git push origin main
```
