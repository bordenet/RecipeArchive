# Husky Git Hooks

This directory contains Git hooks managed by Husky to maintain code quality and repository integrity.

## Pre-Commit Hooks

The following checks run automatically before every commit:

### 1. Binary Check (`check-binaries`)
**Purpose**: Prevents compiled binaries from being committed to the repository.

**What it checks**:
- Mach-O executables (macOS binaries)
- ELF executables (Linux binaries)
- PE executables (Windows binaries)
- Go tool binaries matching patterns like `tools/*/tool-name`
- Root-level binaries like `monorepo-validator`

**Why**: Binaries are platform-specific and should be built from source. Checking them in bloats the repository and causes cross-platform issues.

**Example failure**:
```bash
❌ ERROR: Compiled binaries detected in staged files

The following binaries should NOT be committed:
  ✗ tools/s3-cleanup/s3-cleanup
  ✗ monorepo-validator
```

**How to fix**:
```bash
# Unstage the binary
git reset HEAD tools/s3-cleanup/s3-cleanup

# Ensure it's in .gitignore
git add .gitignore

# Remove from repo if already tracked
git rm --cached tools/s3-cleanup/s3-cleanup
```

### 2. Test Files Check (`check-test-files`)
**Purpose**: Prevents test files and reports from cluttering the repository root.

**What it checks**:
- Files matching `*test*`, `*validation*`, or `*report*` in root directory
- Excludes proper test directories (`tests/`, `test-results/`)

**How to fix**: Move files to appropriate directories:
- Test files → `tests/` or `extensions/*/tests/`
- Validation reports → `tools/reports/`
- Test results → `test-results/`

### 3. PRD Protection (`protect-prds`)
**Purpose**: Prevents accidental deletion of critical Product Requirements Documents.

**Protected files**:
- `docs/requirements/browser-extension.md`
- `docs/requirements/aws-backend.md`
- `docs/requirements/website.md`
- `docs/requirements/ios-app.md`

### 4. Standard Tests (`pre-commit`)
**Purpose**: Runs standard test suite via npm.

**What it runs**:
1. Binary check
2. `npm test` (executes Go recipe-cli test suite)

## How It Works

When you run `git commit`, Husky intercepts and runs `.husky/pre-commit`:

```bash
#!/usr/bin/env bash

# Check for compiled binaries
.husky/check-binaries

# Run standard tests
npm test
```

If any check fails, the commit is blocked and you'll see an error message with instructions.

## Disabling Hooks (Not Recommended)

In emergencies only:
```bash
git commit --no-verify -m "Emergency commit"
```

**Warning**: Bypassing hooks can introduce quality issues. Only use in genuine emergencies.

## Adding New Hooks

1. Create executable script in `.husky/`:
   ```bash
   touch .husky/my-new-check
   chmod +x .husky/my-new-check
   ```

2. Add to `.husky/pre-commit`:
   ```bash
   .husky/my-new-check
   ```

3. Use clear error messages with emojis and fix instructions
4. Document in this README

## Exit Codes

- `0`: Check passed
- `1`: Check failed (blocks commit)
- `130`: User interrupted (Ctrl+C)
