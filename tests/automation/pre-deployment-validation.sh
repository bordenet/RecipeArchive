#!/bin/bash

################################################################################
#
# Pre-Deployment Validation Hook
#
# PURPOSE:
#   This script serves as an automated pre-deployment validation hook to ensure
#   the integrity of the build and prevent broken deployments. It runs a
#   series of critical tests to verify that the extensions, build pipeline,
#   and monorepo are all in a healthy state.
#
# USAGE:
#   ./tests/automation/pre-deployment-validation.sh
#
# HOW IT WORKS:
#   The script executes a series of npm scripts and other validation scripts
#   to perform a comprehensive check of the system. It reports a clear pass/fail
#   summary.
#
# TESTS EXECUTED:
#   - npm run test:extensions
#   - npm run test:build-validation
#   - ./validate-monorepo.sh --p1
#
# DEPENDENCIES:
#   - Node.js and npm
#   - The validation scripts it calls.
#
# NOTES:
#   - This script is intended to be run from the root of the monorepo.
#   - It is designed to be used in a CI/CD pipeline to gate deployments.
#
################################################################################

# Pre-Deployment Validation Hook
# Integrates automated testing into the deployment pipeline
# Addresses: "There should NEVER be a human-in-the-loop for a simple verification test"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}🤖 PRE-DEPLOYMENT VALIDATION HOOK${NC}"
echo "Automated testing to prevent broken builds reaching users"
echo "Location: $ROOT_DIR"
echo ""

cd "$ROOT_DIR"

# Function to run test and handle results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}Running: $test_name${NC}"
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        return 1
    fi
}

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test 1: Extension Regression Tests
echo "==================================================================="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Extension Regression Tests" "npm run test:extensions"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 2: Build Validation Pipeline  
echo "==================================================================="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Build Validation Pipeline" "npm run test:build-validation"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 3: Critical Build Components
echo "==================================================================="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Critical Build Validation" "./validate-monorepo.sh --p1"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Generate Summary
echo ""
echo "==================================================================="
echo -e "${BLUE}🎯 PRE-DEPLOYMENT VALIDATION SUMMARY${NC}"
echo "==================================================================="

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL VALIDATIONS PASSED (${PASSED_TESTS}/${TOTAL_TESTS})${NC}"
    echo -e "${GREEN}🚀 DEPLOYMENT APPROVED - No human intervention required${NC}"
    echo ""
    echo -e "${BLUE}Automated validations completed:${NC}"
    echo "  • Extension regression testing ✓"
    echo "  • Build validation pipeline ✓" 
    echo "  • Critical component validation ✓"
    echo ""
    echo -e "${GREEN}Ready for deployment to production${NC}"
    exit 0
else
    echo -e "${RED}❌ VALIDATION FAILURES (${FAILED_TESTS}/${TOTAL_TESTS} failed)${NC}"
    echo -e "${RED}🚨 DEPLOYMENT BLOCKED${NC}"
    echo ""
    echo -e "${YELLOW}Manual intervention required to fix failures above${NC}"
    echo -e "${YELLOW}These automated checks prevent broken builds from reaching users${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo "  • Extension issues: Check JavaScript scoping and syntax"
    echo "  • Build issues: Check TypeScript/Go compilation errors"
    echo "  • Component issues: Check critical file presence and functionality"
    echo ""
    exit 1
fi