# Setup Script Refactoring Guide

## Overview
Refactor `scripts/setup-macos.sh` (1630 lines) into a modular, reusable structure suitable for copying across multiple repos.

**Goal**: Keep the excellent UX (verbose/compact modes, section tracking) while making components pluggable.

## Target Structure

```
scripts/
├── setup-macos.sh              # Main orchestrator (~350 lines)
├── lib/
│   └── common.sh              # Keep as-is (colors, logging)
└── setup-components/          # NEW directory for all components
    ├── 00-homebrew.sh         # Package manager
    ├── 10-essentials.sh       # Node, TypeScript, AWS CDK, Go, Xcode CLI
    ├── 20-mobile.sh           # Flutter, Java, Android, iOS/CocoaPods
    ├── 30-web-tools.sh        # VS Code + extensions, Git, ImageMagick
    ├── 40-browser-tools.sh    # Playwright, Jest
    ├── 50-utilities.sh        # jq, wget, curl, tree, git-lfs, etc.
    ├── 60-recipearchive.sh    # Monorepo npm setup, extensions, AWS CDK
    ├── 70-testing.sh          # .env loading
    └── 80-mcp.sh              # Claude Desktop & Code CLI MCP servers
```

## Component Template

Every component file follows this pattern:

```bash
#!/usr/bin/env bash
################################################################################
# Component: [NAME]
################################################################################
# PURPOSE: Install and configure [DESCRIPTION]
# REUSABLE: [YES/NO - mark if this can be copied to other repos]
# DEPENDENCIES: [List other component numbers if any, or "none"]
#
# ADOPTION NOTES FOR FUTURE REPOS:
# - [What to change when copying to a new repo]
# - [What to keep as-is]
# - [Any project-specific considerations]
################################################################################

# Component metadata
readonly COMPONENT_NAME="[Human-readable name for section_start]"

# Installation function (called by main script)
install_component() {
    section_start "$COMPONENT_NAME"

    # Use existing helper functions:
    # - check_installing "Tool name"
    # - check_done "Tool name"
    # - check_exists "Tool name (version)"
    # - check_failed "Tool name"
    # - timed_confirm "Question?" [timeout] [default]
    # - print_info / print_success / print_warning / print_error

    # Example pattern:
    if ! command -v tool &> /dev/null; then
        check_installing "Tool"
        brew install tool > /dev/null 2>&1
        if ! command -v tool &> /dev/null; then
            check_failed "Tool"
        else
            check_done "Tool"
        fi
    else
        check_exists "Tool ($(tool --version))"
    fi

    section_end
}
```

## Main Script Structure

The refactored `setup-macos.sh` should contain:

### 1. Header (lines 1-36)
Keep as-is: shebang, documentation header

### 2. Framework Setup (lines 37-258)
Keep as-is:
- Source common.sh
- Global variables (AUTO_YES, VERBOSE, FAILED_INSTALLS, etc.)
- Helper functions (print_*, check_*, section_*, timed_confirm)
- Argument parsing
- Platform validation

### 3. Component Discovery & Execution (NEW - ~50 lines)
```bash
log_header "RecipeArchive Project Setup for macOS"
cd "$REPO_ROOT"

# Discover and execute components
COMPONENTS_DIR="$SCRIPT_DIR/setup-components"

if [ ! -d "$COMPONENTS_DIR" ]; then
    die "Components directory not found: $COMPONENTS_DIR"
fi

# Source all components in numeric order
for component_file in "$COMPONENTS_DIR"/*.sh; do
    if [ -f "$component_file" ]; then
        # ADOPTION NOTE: Component sourcing happens here
        # Each component exports an install_component() function
        source "$component_file"

        # Execute the component's installation
        # ADOPTION NOTE: All helper functions (check_*, section_*, etc.)
        # are available to components via bash's function scope
        install_component

        # ADOPTION NOTE: Component failures are tracked automatically
        # via check_failed() which populates FAILED_INSTALLS array
    fi
done
```

### 4. Final Summary (lines 1309-1488)
Keep mostly as-is, but add comment:
```bash
# ADOPTION NOTE FOR FUTURE REPOS:
# Update this summary section with your project-specific commands
# and documentation links. The error reporting logic below this
# should remain unchanged.
```

## Refactoring Steps

### Step 1: Create Directory Structure
```bash
mkdir -p scripts/setup-components
```

### Step 2: Extract Components (one at a time, test after each)

**Start with easiest (utilities):**

1. Copy lines 784-849 (Additional utilities section)
2. Wrap in component template
3. Save as `scripts/setup-components/50-utilities.sh`
4. Mark as `REUSABLE: YES`
5. Add adoption note: "Copy as-is to any repo, no changes needed"
6. Test by commenting out original code and running script

**Continue with:**
1. `40-browser-tools.sh` (lines 750-782)
2. `30-web-tools.sh` (lines 641-747)
3. `00-homebrew.sh` (lines 163-183)
4. `10-essentials.sh` (lines 185-265)
5. `20-mobile.sh` (lines 268-638) - **largest component**
6. `60-recipearchive.sh` (lines 852-1007) - **project-specific**
7. `70-testing.sh` (lines 1009-1048)
8. `80-mcp.sh` (lines 1051-1307)

### Step 3: Update Main Script
1. Delete all extracted installation code
2. Add component discovery loop
3. Test that all components execute in order
4. Verify error tracking still works

### Step 4: Add Adoption Comments
In **each reusable component** (00, 10, 20, 30, 40, 50), add:
```bash
# ADOPTION NOTES FOR FUTURE REPOS:
# ✅ This component is fully reusable - copy as-is
# ✅ All tools installed are universally useful
# ⚠️  Review VS Code extensions list if using component 30
# ⚠️  Review mobile toolchain if you don't need Flutter (component 20)
```

In **project-specific components** (60, 70, 80), add:
```bash
# ADOPTION NOTES FOR FUTURE REPOS:
# ❌ This component is RecipeArchive-specific
# 📝 Replace with your own monorepo setup
# 📝 Key patterns to reuse:
#    - npm install with timeout
#    - Directory existence checks
#    - Conditional installations based on file presence
```

## Testing Checklist

After refactoring:
- [ ] Run `./scripts/setup-macos.sh --yes` (compact mode)
- [ ] Run `./scripts/setup-macos.sh` (verbose mode)
- [ ] Run `./scripts/setup-macos.sh --yes --verbose` (both)
- [ ] Verify all sections execute in correct order
- [ ] Verify failure tracking works (manually break a component)
- [ ] Verify final summary displays correctly
- [ ] Check that FAILED_INSTALLS array populates on errors

## Future Repo Adoption Process

When copying to a new repo:

1. **Copy framework files:**
   ```bash
   cp scripts/setup-macos.sh new-repo/scripts/
   cp scripts/lib/common.sh new-repo/scripts/lib/
   ```

2. **Copy reusable components:**
   ```bash
   cp scripts/setup-components/00-homebrew.sh new-repo/scripts/setup-components/
   cp scripts/setup-components/10-essentials.sh new-repo/scripts/setup-components/
   cp scripts/setup-components/20-mobile.sh new-repo/scripts/setup-components/
   # ... etc for components marked REUSABLE: YES
   ```

3. **Create project-specific components:**
   ```bash
   # Create 60-myproject.sh with your repo's specific setup
   # Follow the component template above
   ```

4. **Update main script header:**
   - Change project name in documentation
   - Update description of what gets installed
   - Update final summary section

5. **Test and iterate:**
   - Run setup script
   - Remove unneeded components
   - Add new components as needed

## Key Design Principles

1. **No over-engineering**: Just bash files sourced in order
2. **Numeric prefixes**: Control execution order (00, 10, 20...)
3. **Standard interface**: Every component exports `install_component()`
4. **Self-documenting**: Each component has adoption notes
5. **Helper functions**: All check_* and section_* functions available to components
6. **Error tracking**: Automatic via check_failed() and FAILED_INSTALLS array
7. **No config files**: Just copy/delete .sh files to enable/disable components

## Benefits

**For RecipeArchive:**
- Each component ~50-150 lines (easier to understand)
- Can test components individually
- Clear separation of concerns

**For future repos:**
- Copy 5-7 universal components without modification
- Add 1-2 project-specific components
- Same great UX (verbose/compact modes)
- Total setup time: ~15 minutes vs hours of rewriting

## Example: Adopting in a New Python/Django Repo

```bash
# Copy reusable components
scripts/setup-components/
├── 00-homebrew.sh       # ✅ Copy as-is
├── 10-essentials.sh     # ✅ Copy as-is (skip AWS CDK if not needed)
├── 30-web-tools.sh      # ✅ Copy as-is (update VS Code extensions)
├── 50-utilities.sh      # ✅ Copy as-is

# Create new components
├── 60-python.sh         # NEW: Python, Poetry, virtualenv
└── 70-django.sh         # NEW: Django project setup
```

Total reused code: ~600 lines
New code needed: ~200 lines
Time saved: Several hours

## Notes for Implementation Agent

- Start with `50-utilities.sh` - it's the simplest extraction
- Test after EVERY component extraction
- Don't refactor all at once - incremental approach is safer
- Keep git commits small (one component per commit)
- The main script's helper functions become a "framework" that components use
- Components are just organized chunks of the existing code - no logic changes needed
