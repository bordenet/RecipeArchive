# Build Safety Conventions

## Dependency Management

- **ALL dependencies** must be installed via [`./scripts/setup-macos.sh`](../../scripts/setup-macos.sh)
- Never document manual installation steps without adding them to setup script
- Setup script is the single source of truth for environment configuration

## Long-Running Task Safety

**MANDATORY 10-minute timeout** on all long-running operations.

Prevents blocked shells and hung processes. Applies to:
- Emulator/simulator deployments
- Device deployments
- Network operations (downloads, API calls)
- Build operations that might hang

Use `timeout` command or equivalent timing mechanisms.

## Build Hygiene

**NEVER build scripts which modify source files in place.**

All build scripts MUST output to a separate `build/` or `dist/` directory. This prevents accidental source code corruption and ensures reproducible builds.

If you detect this happening, IMMEDIATELY alert the user and fix the build scripts—this is a critical error and work stoppage event until we fix it.

