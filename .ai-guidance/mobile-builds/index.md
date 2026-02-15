# Mobile Builds Index

> **When to load:** Overview of mobile build guides

## Sub-Modules

| Module | Description |
|--------|-------------|
| [ios.md](ios.md) | iOS build commands & architecture |
| [android.md](android.md) | Android build commands & fixes |
| [env-files.md](env-files.md) | .env file management |

## Quick Reference

| Platform | Command |
|----------|---------|
| iOS dev | `./scripts/ios/build.sh --dev --run` |
| iOS prod | `./scripts/ios/build.sh --prod --device --release --version X.Y.Z` |
| Android dev | `./scripts/android/build.sh --dev --run` |
| Android prod | `./scripts/android/build.sh --prod --device --release --version X.Y.Z` |

**NEVER use `flutter build ios` or `flutter build apk`** - use scripts directly.

