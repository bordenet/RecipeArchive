# Code Standardization Status

**Date:** 2025-10-30
**Status:** In Progress

## Shell Script Standardization

### Current State

- **Total Scripts:** 48
- **Migrated:** 1 (2%)
- **Needs Migration:** 46 (96%)
- **One already follows standard:** `scripts/lib/migrate-to-standard.sh`

### Standardization Framework

✅ **Created:**
- `scripts/lib/common.sh` - Standard library with logging, error handling, utilities
- `scripts/STYLE_GUIDE.md` - Comprehensive style guide with examples
- `scripts/lib/migrate-to-standard.sh` - Migration tool and validator

### Standard Features

All scripts should use:
- Standard logging functions (`log_info`, `log_success`, `log_error`, `die`)
- Consistent color scheme from common library
- Standard error handling (`set -euo pipefail`, `init_script`)
- Helper functions (`require_command`, `require_file`, `get_repo_root`)
- Standard header format with PURPOSE, USAGE, EXAMPLES

### Migration Priority

#### Phase 1: Critical Build Scripts (High Use)
- [ ] `scripts/ios/build.sh` (470 lines)
- [ ] `scripts/android/build.sh` (442 lines)
- [ ] `scripts/web/deploy.sh` (varies)
- [ ] `scripts/diagnose-health.sh` (217 lines)

#### Phase 2: Setup & Infrastructure (High Impact)
- [ ] `scripts/setup-macos.sh` (1395 lines) - Should be split into modules first
- [ ] `scripts/aws/lambda.sh` (460 lines)
- [ ] `scripts/aws/all.sh` (539 lines)
- [ ] `scripts/manage-api-routes.sh` (541 lines)

#### Phase 3: Mobile Development
- [ ] `scripts/ios/setup.sh` (319 lines)
- [ ] `scripts/ios/simulator.sh`
- [ ] `scripts/android/setup.sh`
- [ ] `scripts/android/emulator.sh`

#### Phase 4: Utilities & Testing
- [ ] `scripts/extensions/helper.sh`
- [ ] `scripts/end-to-end-recipe-test.sh`
- [ ] `scripts/validate-safari-auth.sh`
- [ ] All remaining scripts

### Migration Process

For each script:

1. **Check Current State:**
   ```bash
   ./scripts/lib/migrate-to-standard.sh --check
   ```

2. **Migrate Script:**
   - Add proper shebang
   - Add standard header
   - Source common library
   - Replace color definitions
   - Replace echo with log_* functions
   - Add error handling
   - Test functionality

3. **Validate:**
   ```bash
   ./scripts/lib/migrate-to-standard.sh --validate
   shellcheck scripts/<script>.sh
   ```

4. **Test:**
   ```bash
   # Run actual script with various options
   ./scripts/<script>.sh --help
   ./scripts/<script>.sh  # Normal operation
   ```

### Example Migration

Before:
```bash
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Building iOS app..."
if flutter build ios; then
    echo -e "${GREEN}✓${NC} Build complete"
else
    echo -e "${RED}✗${NC} Build failed" >&2
    exit 1
fi
```

After:
```bash
#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS Build
################################################################################
# PURPOSE: Build iOS application for simulator or device
# USAGE:
#   ./build.sh [--debug|--release]
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

main() {
    log_header "iOS Build"

    log_info "Building iOS app..."
    require_command "flutter" "brew install flutter"

    if ! flutter build ios &> /tmp/flutter-build.log; then
        die "Build failed, see /tmp/flutter-build.log"
    fi

    log_success "Build complete"
}

main "$@"
```

## Code Refactoring

### Long Files Identified

Files requiring refactoring (>750 lines):

#### Go (4 critical files)
1. **`aws-backend/functions/recipes/main.go`** (2100 lines) 🔴
   - Split into: handlers, services, repositories (8 files)

2. **`tools/cmd/recipe-cli/main.go`** (1078 lines) 🔴
   - Split into: commands, services, utils (8 files)

3. **`aws-backend/functions/recipes/parser.go`** (771 lines) 🟡
   - Split into: json-ld, html, site-specific parsers (5 files)

4. **`aws-backend/functions/invitation-manager-s3/main.go`** (743 lines) 🟡
   - Split into: handlers, services (4 files)

#### Dart (8 screens/services)
1. **`recipe_archive/lib/screens/recipe_detail_screen.dart`** (1286 lines) 🔴
   - Split into: screen, widgets (10), controllers (3) (14 files)

2. **`recipe_archive/lib/screens/recipe_edit_screen.dart`** (903 lines) 🔴
   - Split into: screen, widgets (5), controllers (2) (8 files)

3. **`recipe_archive/lib/screens/home_screen.dart`** (842 lines) 🟡
   - Split into: screen, widgets (5), controllers (2) (8 files)

4. **`recipe_archive/lib/screens/advanced_search_screen.dart`** (833 lines) 🟡
   - Split into: screen, widgets (3), controllers (2) (6 files)

5. **`recipe_archive/lib/services/recipe_service.dart`** (825 lines) 🟡
   - Split into: main service, CRUD, search, import, cache (5 files)

6. **`recipe_archive/lib/screens/extensions_screen.dart`** (822 lines) 🟡
   - Split into: screen, widgets (3), services (4 files)

#### Shell Scripts (3 large scripts)
1. **`scripts/setup-macos.sh`** (1395 lines) 🔴
   - Split into: orchestrator + 7 module scripts (8 files)

2. **`scripts/manage-api-routes.sh`** (541 lines) 🟡
   - Split into: main + validation + repair (3 files)

3. **`scripts/aws-deploy-all.sh`** (539 lines) 🟡
   - Split into: orchestrator + deployment modules (3 files)

### Token Savings

**Before Refactoring:**
- Loading `recipes/main.go` (2100 lines) = ~8,400 tokens
- Loading `recipe_detail_screen.dart` (1286 lines) = ~5,144 tokens
- **Total for top 2:** ~13,544 tokens

**After Refactoring:**
- Loading `search_handlers.go` + `search_service.go` (400 lines) = ~1,600 tokens
- Loading `recipe_detail_screen.dart` + `recipe_header.dart` (330 lines) = ~1,320 tokens
- **Total for same work:** ~2,920 tokens
- **Savings:** ~10,624 tokens (78% reduction)

### Refactoring Priority

See [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) for detailed execution plan.

**Priority Order:**
1. Lambda functions (highest maintenance frequency)
2. Flutter screens (UI changes frequently)
3. Services (referenced by many screens)
4. Shell scripts (lower priority)

## Action Plan

### Immediate Next Steps

1. **Shell Script Standardization (This Week)**
   - Migrate critical build scripts (iOS, Android, web)
   - Migrate diagnostic scripts
   - Validate all migrations

2. **Code Refactoring Planning (Next Week)**
   - Review [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)
   - Start with `recipes/main.go` (highest impact)
   - Create test suite before refactoring

3. **Continuous Improvement**
   - New scripts must use common library
   - New code files must stay <750 lines
   - Regular audits for compliance

## Tools

- `./scripts/lib/migrate-to-standard.sh --check` - List scripts needing migration
- `./scripts/lib/migrate-to-standard.sh --validate` - Validate migrated scripts
- `./scripts/lib/migrate-to-standard.sh --help` - Show migration guide
- `shellcheck scripts/**/*.sh` - Lint all shell scripts

## Success Metrics

### Shell Scripts
- [ ] All scripts use common library (48/48)
- [ ] All scripts pass shellcheck
- [ ] All scripts have --help flag
- [ ] Average script length <300 lines

### Code Files
- [ ] No file >750 lines in production code
- [ ] Average file size <300 lines
- [ ] Test coverage maintained
- [ ] No circular dependencies

## Related

- [STYLE_GUIDE.md](../../scripts/STYLE_GUIDE.md) - Shell script style guide
- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - Long file refactoring plan
- [PROJECT_STATUS.md](../../PROJECT_STATUS.md) - System health dashboard
