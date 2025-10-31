# RecipeArchive Shell Script Style Guide

**Purpose:** Ensure all shell scripts appear written by the same engineer

## Core Principles

1. **Consistency over cleverness** - Readable, maintainable code
2. **Fail fast** - Use `set -euo pipefail` in all scripts
3. **Clear messages** - Every action should log what it's doing
4. **Standard library** - Use `scripts/lib/common.sh` for all common functions

## File Structure

### Header Template

Every script must start with this exact structure:

```bash
#!/usr/bin/env bash

################################################################################
# RecipeArchive <Script Purpose>
################################################################################
# PURPOSE: <One sentence description>
#   - <Key responsibility 1>
#   - <Key responsibility 2>
#
# USAGE:
#   ./<script-name> [options]
#   ./<script-name> --help
#
# EXAMPLES:
#   ./<script-name> --example-flag
#
# DEPENDENCIES:
#   - <Tool 1>
#   - <Tool 2>
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh" || source "$SCRIPT_DIR/lib/common.sh"

# Initialize script (sets up error handling, traps)
init_script

# Script-specific variables
readonly SCRIPT_NAME="$(basename "$0")"
readonly REPO_ROOT="$(get_repo_root)"
```

### Main Script Body

```bash
# Parse arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                print_usage
                exit 0
                ;;
            --option)
                OPTION_VALUE="$2"
                shift 2
                ;;
            *)
                die "Unknown option: $1 (use --help for usage)"
                ;;
        esac
    done
}

# Print usage information
print_usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Description:
    <Script description>

Options:
    -h, --help         Show this help message
    --option VALUE     Description of option

Examples:
    $SCRIPT_NAME --option value
EOF
}

# Main function
main() {
    log_header "<Script Name>"

    log_section "Step 1: Description"
    # Do work
    log_success "Step 1 complete"

    log_section "Step 2: Description"
    # Do work
    log_success "Step 2 complete"

    log_success "All operations completed successfully"
}

# Run main function
parse_arguments "$@"
main
```

## Logging Standards

### Use Standard Logging Functions

**Always use the common library functions** - never use raw `echo`:

```bash
# Good
log_info "Starting deployment"
log_success "Deployment complete"
log_warning "No .env file found, using defaults"
log_error "Deployment failed: bucket not found"

# Bad
echo "Starting deployment"
echo -e "\033[0;32m✓\033[0m Deployment complete"
echo "WARNING: No .env file found"
```

### Logging Levels

| Function | Use Case | Example |
|----------|----------|---------|
| `log_info` | Standard informational messages | "Validating environment..." |
| `log_success` | Operation completed successfully | "Build complete" |
| `log_warning` | Non-fatal issues | "Cache disabled, performance may be slower" |
| `log_error` | Errors (script continues) | "Failed to upload file.txt" |
| `die` | Fatal errors (script exits) | "AWS credentials not configured" |
| `log_debug` | Debug information (only if DEBUG=1) | "Using bucket: s3://example" |
| `log_header` | Major section divider | "iOS Build - RecipeArchive" |
| `log_section` | Minor section divider | "Step 1: Environment Validation" |

### Message Format

```bash
# Action in progress (present continuous)
log_info "Building iOS application..."

# Action complete (past tense)
log_success "iOS application built"

# Error messages (what failed + why)
log_error "Failed to build iOS application: Xcode not found"

# Debug messages (key-value pairs)
log_debug "build_config=release target=simulator version=1.0.0"
```

## Error Handling

### Required Error Handling

```bash
# At top of every script
set -euo pipefail
init_script  # Sets up ERR trap

# For critical operations
if ! aws s3 ls "s3://$BUCKET" &> /dev/null; then
    die "S3 bucket not found: $BUCKET"
fi

# For expected failures
if ! some_command 2> /dev/null; then
    log_warning "Optional operation failed, continuing"
fi
```

### Command Validation

```bash
# Check required commands exist
require_command "flutter" "brew install flutter"
require_command "aws" "brew install awscli"

# Check required files exist
require_file "$REPO_ROOT/.env" "Copy .env.example to .env"
require_directory "$IOS_DIR" "Run script from repository root"
```

## Variable Naming

### Conventions

```bash
# Constants (readonly, uppercase with underscores)
readonly SCRIPT_NAME="deploy.sh"
readonly DEFAULT_REGION="us-west-2"
readonly MAX_RETRIES=3

# Configuration (uppercase)
BUILD_MODE="debug"
TARGET_PLATFORM="ios"
ENABLE_CACHE=true

# Local variables (lowercase with underscores)
local build_output="/tmp/build"
local retry_count=0
local user_input=""

# Paths (uppercase, end with _DIR or _FILE)
readonly SCRIPT_DIR="$(get_script_dir)"
readonly REPO_ROOT="$(get_repo_root)"
readonly BUILD_DIR="$REPO_ROOT/build"
readonly CONFIG_FILE="$REPO_ROOT/.env"
```

## Argument Parsing

### Standard Pattern

```bash
parse_arguments() {
    # Set defaults
    local mode=""
    local verbose=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                print_usage
                exit 0
                ;;
            --mode)
                mode="$2"
                shift 2
                ;;
            --verbose|-v)
                verbose=true
                shift
                ;;
            --debug)
                export DEBUG=1
                shift
                ;;
            *)
                die "Unknown option: $1 (use --help for usage)"
                ;;
        esac
    done

    # Validate required arguments
    [[ -z "$mode" ]] && die "Missing required argument: --mode"

    # Export for use in script
    MODE="$mode"
    VERBOSE="$verbose"
}
```

## Path Resolution

### Standard Pattern

```bash
# Always resolve paths relative to known locations
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(get_repo_root)"  # Uses common library
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"

# Never use relative paths like ../..
# Bad
cd ../..

# Good
cd "$REPO_ROOT"
```

## Functions

### Naming

```bash
# Verbs for actions
build_application() { }
deploy_to_aws() { }
validate_environment() { }

# Questions return 0 (true) or 1 (false)
is_macos() { [[ "$(uname)" == "Darwin" ]]; }
has_aws_credentials() { aws sts get-caller-identity &> /dev/null; }

# Get functions return values via stdout
get_version() { echo "1.0.0"; }
get_bucket_name() { echo "recipe-storage-$AWS_ACCOUNT_ID"; }
```

### Structure

```bash
# Function with clear purpose and error handling
build_ios_app() {
    local config="${1:-debug}"
    local target="${2:-simulator}"

    log_section "Building iOS app (config=$config, target=$target)"

    require_command "xcodebuild"
    require_directory "$IOS_DIR"

    if ! xcodebuild build -scheme Runner -configuration "$config" &> /tmp/xcodebuild.log; then
        log_error "Xcode build failed, see /tmp/xcodebuild.log"
        return 1
    fi

    log_success "iOS app built successfully"
    return 0
}
```

## Comments

### When to Comment

```bash
# Good comments explain WHY, not WHAT

# Auto-detect version from git tags, fallback to pubspec.yaml
if git describe --tags &> /dev/null; then
    VERSION=$(git describe --tags --always)
else
    VERSION=$(grep "^version:" pubspec.yaml | cut -d' ' -f2)
fi

# Flutter's build system has a race condition with CocoaPods
# Sleep 2 seconds to ensure Podfile is written before running pod install
sleep 2
pod install

# Bad comments (obvious from code)
# Set mode to dev
MODE="dev"

# Build the app
flutter build ios
```

### Header Comments

Only use header comments for:
1. File-level documentation (PURPOSE, USAGE, EXAMPLES)
2. Complex algorithm explanations
3. Workarounds for known issues

## Testing

### Validation Checklist

Before committing any script:

- [ ] Script has proper header with PURPOSE and USAGE
- [ ] Uses `source "...lib/common.sh"`
- [ ] Calls `init_script` after sourcing common library
- [ ] Uses `log_*` functions (no raw `echo`)
- [ ] Has `--help` flag that prints usage
- [ ] Uses `readonly` for constants
- [ ] Validates required commands with `require_command`
- [ ] Handles errors with `die` or explicit error messages
- [ ] Uses `get_repo_root` instead of hardcoded `../..`
- [ ] Works when run from any directory

### Manual Testing

```bash
# Test from repository root
cd /path/to/RecipeArchive
./scripts/ios/build.sh --help

# Test from script directory
cd /path/to/RecipeArchive/scripts/ios
./build.sh --help

# Test with missing dependencies
mv /usr/local/bin/flutter /usr/local/bin/flutter.bak
./scripts/ios/build.sh  # Should fail with clear message

# Test error handling
./scripts/ios/build.sh --invalid-flag  # Should show usage
```

## Anti-Patterns

### Never Do This

```bash
# Don't use raw echo with color codes
echo -e "\033[0;32mSuccess\033[0m"

# Don't use cd without validation
cd ../../recipe_archive

# Don't ignore errors
flutter build ios || true

# Don't use unclear variable names
x="debug"
tmp="/tmp/build"

# Don't use magic numbers
sleep 5  # Why 5 seconds?

# Don't duplicate common code
RED='\033[0;31m'
GREEN='\033[0;32m'
# (Use common library instead)

# Don't use inconsistent naming
some_var="value"
AnotherVar="value"
Yet-Another-Var="value"
```

## Migration Plan

To standardize existing scripts:

1. Add `scripts/lib/common.sh` to repository
2. Update one script at a time (start with most-used)
3. For each script:
   - Add proper header
   - Source common library
   - Replace all `echo` with `log_*` functions
   - Replace color definitions with common library
   - Add `--help` flag
   - Test thoroughly
4. Scripts to prioritize:
   - `scripts/ios/build.sh`
   - `scripts/android/build.sh`
   - `scripts/web/deploy.sh`
   - `scripts/setup-macos.sh`
   - `scripts/diagnose-health.sh`

## Examples

### Minimal Script

```bash
#!/usr/bin/env bash

################################################################################
# RecipeArchive Hello World
################################################################################
# PURPOSE: Example script demonstrating standardized style
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

main() {
    log_header "Hello World Example"
    log_info "Hello from RecipeArchive!"
    log_success "Example complete"
}

main "$@"
```

### Full-Featured Script

See `scripts/ios/build.sh` or `scripts/android/build.sh` for complete examples following all conventions.
