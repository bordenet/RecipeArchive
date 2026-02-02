# Development Conventions

These conventions ensure consistent, maintainable, production-grade automation across the project.

## 1. Dependency Management

- **ALL dependencies** must be installed via [`./scripts/setup-macos.sh`](../scripts/setup-macos.sh)
- Never document manual installation steps without adding them to setup script
- Setup script is the single source of truth for environment configuration

## 2. Shell Scripts for Recurring Tasks

- **Build operations**: Use shell scripts with production-grade error handling
- **Clean builds**: Dedicated scripts (not ad-hoc commands)
- **Deployment**: Simulator/device deployments via scripts
- **AWS operations**: Backend interactions via scripts (see `scripts/aws/lambda.sh`)

### CRITICAL: Single Scripts Directory

- **ALL scripts MUST live in `./scripts/` at repository root**
- **NEVER create scripts directories inside subdirectories** (e.g., recipe_archive/scripts/)
- This reduces complexity and ensures consistent script locations
- Exception: Component-specific scripts embedded in their natural locations (e.g., `package.json` scripts)

### Required Script Elements

- `set -e` for fail-fast behavior
- Clear error messages with exit codes
- Status logging (info, success, error, warning)
- Input validation
- Usage documentation in header comments

## 3. Long-Running Task Safety

**MANDATORY 10-minute timeout** on all long-running operations.

Prevents blocked shells and hung processes. Applies to:
- Emulator/simulator deployments
- Device deployments
- Network operations (downloads, API calls)
- Build operations that might hang

Use `timeout` command or equivalent timing mechanisms.

## 4. Build Hygiene

**NEVER build scripts which modify source files in place.**

All build scripts MUST output to a separate `build/` or `dist/` directory. This prevents accidental source code corruption and ensures reproducible builds.

If you detect this happening, IMMEDIATELY alert the user and fix the build scripts—this is a critical error and work stoppage event until we fix it.

## 5. JavaScript/TypeScript Code Style

Always use double quotes in JavaScript files. This project uses ESLint with double quote enforcement.

- ✅ Correct: `console.log("Checking URL:", url);`
- ❌ Wrong: `console.log('Checking URL:', url);`

Always run `npm run lint -- --fix` after editing JavaScript files to prevent quote style errors.

## 6. Go Code Quality Protocol

**MANDATORY: Always run compilation checks before declaring Go work complete.**

When fixing linting errors or modifying Go code:

1. **Fix the reported linting errors** using golangci-lint output
2. **IMMEDIATELY run `go build`** in the affected directory to check for:
   - Unused imports (especially after removing functions)
   - Type errors
   - Compilation failures
3. **Only declare work complete** after both linting AND compilation pass

**Common Gotcha:** Removing unused functions often leaves behind unused imports. The `go build` check will catch this immediately.

```bash
# Fix linting errors
golangci-lint run ./...

# CRITICAL: Check compilation
go build

# If imports are unused, remove them, then re-run both checks
```

**Why this matters:** Unused imports are compilation errors in Go, not just linting warnings.

