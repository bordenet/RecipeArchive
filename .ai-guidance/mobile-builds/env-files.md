# .env File Management

**Flutter does NOT follow symlinks in asset bundles.**

- **Root .env**: Keep the master `.env` at repository root (gitignored)
- **Flutter .env**: Copy (NOT symlink) to `recipe_archive/.env` for builds
- **Build scripts**: Automatically sync `.env` from root before every build
- **NEVER commit**: `recipe_archive/.env` must stay in `.gitignore`

Both `scripts/android/build.sh` and `scripts/ios/build.sh` automatically copy the root `.env` to `recipe_archive/.env` before building.

