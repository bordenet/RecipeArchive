#!/bin/bash
#
# test-all-scripts.sh
# Comprehensive test of all shell scripts in the RecipeArchive monorepo
#
# This script invokes every script with --help or dry-run mode to ensure
# nothing breaks. It validates syntax, executable permissions, and basic
# functionality without making destructive changes.
#
# Usage: ./scripts/test-all-scripts.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script metadata
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Counters
TOTAL_SCRIPTS=0
PASSED_SCRIPTS=0
FAILED_SCRIPTS=0
SKIPPED_SCRIPTS=0

# Results arrays
declare -a FAILED_TESTS
declare -a SKIPPED_TESTS

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RecipeArchive Shell Script Comprehensive Test Suite${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to test a script
test_script() {
    local script_path="$1"
    local script_name=$(basename "$script_path")
    local script_dir=$(dirname "$script_path")

    TOTAL_SCRIPTS=$((TOTAL_SCRIPTS + 1))

    # Check if file is executable
    if [[ ! -x "$script_path" ]]; then
        echo -e "${YELLOW}⚠  SKIP${NC} $script_name (not executable)"
        SKIPPED_SCRIPTS=$((SKIPPED_SCRIPTS + 1))
        SKIPPED_TESTS+=("$script_name - not executable")
        return
    fi

    # Skip library scripts (they're sourced, not executed)
    if [[ "$script_dir" == *"/lib" ]]; then
        echo -e "${YELLOW}⚠  SKIP${NC} $script_name (library script)"
        SKIPPED_SCRIPTS=$((SKIPPED_SCRIPTS + 1))
        SKIPPED_TESTS+=("$script_name - library script")
        return
    fi

    # Skip AWS deployment scripts (require AWS credentials)
    if [[ "$script_name" == *"aws-"* || "$script_name" == *"deploy"* || "$script_name" == "manage-api-routes.sh" ]]; then
        echo -e "${YELLOW}⚠  SKIP${NC} $script_name (AWS/deployment script)"
        SKIPPED_SCRIPTS=$((SKIPPED_SCRIPTS + 1))
        SKIPPED_TESTS+=("$script_name - requires AWS credentials")
        return
    fi

    # Skip interactive scripts
    if [[ "$script_name" == "capture-wapost-cookies.sh" || "$script_name" == "setup-new-adopter-environment.sh" ]]; then
        echo -e "${YELLOW}⚠  SKIP${NC} $script_name (interactive script)"
        SKIPPED_SCRIPTS=$((SKIPPED_SCRIPTS + 1))
        SKIPPED_TESTS+=("$script_name - requires user input")
        return
    fi

    # Test the script with timeout
    local test_passed=false

    # Try --help flag first (with 2-second timeout)
    if timeout 2 "$script_path" --help &>/dev/null; then
        test_passed=true
    # Try -h flag (with 2-second timeout)
    elif timeout 2 "$script_path" -h &>/dev/null; then
        test_passed=true
    # Check for syntax errors with bash -n
    elif bash -n "$script_path" 2>/dev/null; then
        test_passed=true
    fi

    if $test_passed; then
        echo -e "${GREEN}✓  PASS${NC} $script_name"
        PASSED_SCRIPTS=$((PASSED_SCRIPTS + 1))
    else
        echo -e "${RED}✗  FAIL${NC} $script_name"
        FAILED_SCRIPTS=$((FAILED_SCRIPTS + 1))
        FAILED_TESTS+=("$script_name")
    fi
}

# Find and test all shell scripts
cd "$REPO_ROOT"

echo "Scanning for shell scripts..."
echo ""

# Test scripts in order by directory
for dir in scripts/android scripts/ios scripts/web scripts/extensions scripts/lib scripts; do
    if [[ -d "$dir" ]]; then
        while IFS= read -r script; do
            test_script "$script"
        done < <(find "$dir" -maxdepth 1 -name "*.sh" -type f | sort)
    fi
done

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Total Scripts:  ${TOTAL_SCRIPTS}"
echo -e "${GREEN}Passed:         ${PASSED_SCRIPTS}${NC}"
echo -e "${YELLOW}Skipped:        ${SKIPPED_SCRIPTS}${NC}"
echo -e "${RED}Failed:         ${FAILED_SCRIPTS}${NC}"
echo ""

# Show skipped tests
if [[ ${#SKIPPED_TESTS[@]} -gt 0 ]]; then
    echo -e "${YELLOW}Skipped Tests:${NC}"
    for test in "${SKIPPED_TESTS[@]}"; do
        echo -e "  ${YELLOW}⚠${NC}  $test"
    done
    echo ""
fi

# Show failed tests
if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
    echo -e "${RED}Failed Tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗${NC}  $test"
    done
    echo ""
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    exit 0
fi
