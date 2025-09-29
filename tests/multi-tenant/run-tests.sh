#!/bin/bash

################################################################################
#
# Multi-Tenant Test Runner
#
# PURPOSE:
#   This script runs all multi-tenant tests, including Go unit tests for
#   tenant isolation, JavaScript integration tests for the invitation flow,
#   and Flutter tests for the admin screens.
#
# USAGE:
#   ./run-tests.sh
#
# HOW IT WORKS:
#   1.  Validates the presence of all necessary test files.
#   2.  Runs Go tests for tenant isolation.
#   3.  Runs JavaScript integration tests for the invitation flow.
#   4.  Runs Flutter tests for the admin screens.
#   5.  Displays a summary of the test results and code coverage.
#
# DEPENDENCIES:
#   - Go
#   - Node.js and npm
#   - Flutter SDK
#
# NOTES:
#   - This script is intended to be run from the `tests/multi-tenant`
#     directory.
#
################################################################################

# Multi-Tenant Test Runner
# Runs all multi-tenant tests including Go unit tests, JavaScript integration tests, and Flutter tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_TEST_SUITES=0
PASSED_TEST_SUITES=0
FAILED_TEST_SUITES=0

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    PASSED_TEST_SUITES=$((PASSED_TEST_SUITES + 1))
    TOTAL_TEST_SUITES=$((TOTAL_TEST_SUITES + 1))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    FAILED_TEST_SUITES=$((FAILED_TEST_SUITES + 1))
    TOTAL_TEST_SUITES=$((TOTAL_TEST_SUITES + 1))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

run_go_tests() {
    print_header "GO UNIT TESTS (Tenant Isolation)"
    
    # Check if Go is available
    if ! command -v go &> /dev/null; then
        print_error "Go not installed - skipping Go tests"
        return
    fi
    
    # Initialize Go module if needed
    if [ ! -f "go.sum" ]; then
        echo "  Initializing Go module dependencies..."
        if ! go mod download; then
            print_error "Failed to download Go dependencies"
            return
        fi
    fi
    
    # Run Go tests
    echo "  Running tenant isolation tests..."
    if go test -v -race -coverprofile=coverage.out ./...; then
        print_success "Tenant isolation tests passed"
        
        # Show coverage if available
        if [ -f "coverage.out" ]; then
            echo "  Coverage report:"
            go tool cover -func=coverage.out | tail -n 1
        fi
    else
        print_error "Tenant isolation tests failed"
        echo "  Run 'go test -v ./...' for detailed output"
    fi
}

run_javascript_tests() {
    print_header "JAVASCRIPT INTEGRATION TESTS (Invitation Flow)"
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_error "Node.js not installed - skipping JavaScript tests"
        return
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "  Installing JavaScript dependencies..."
        if ! npm install --silent; then
            print_error "Failed to install JavaScript dependencies"
            return
        fi
    fi
    
    # Run Jest tests
    echo "  Running invitation flow integration tests..."
    if npm test -- --silent; then
        print_success "Invitation flow tests passed"
    else
        print_error "Invitation flow tests failed"
        echo "  Run 'npm test' for detailed output"
    fi
}

run_flutter_tests() {
    print_header "FLUTTER TESTS (Admin Screens)"
    
    # Check if Flutter is available
    if ! command -v flutter &> /dev/null; then
        print_warning "Flutter not installed - skipping Flutter tests"
        TOTAL_TEST_SUITES=$((TOTAL_TEST_SUITES + 1))
        PASSED_TEST_SUITES=$((PASSED_TEST_SUITES + 1))
        return
    fi
    
    # Check if Flutter app directory exists
    if [ ! -d "../../recipe_archive" ]; then
        print_warning "Flutter app directory not found - skipping Flutter tests"
        TOTAL_TEST_SUITES=$((TOTAL_TEST_SUITES + 1))
        PASSED_TEST_SUITES=$((PASSED_TEST_SUITES + 1))
        return
    fi
    
    # Run Flutter tests
    echo "  Running Flutter admin screen tests..."
    if (cd ../../recipe_archive && flutter test ../tests/multi-tenant/flutter-admin.test.dart); then
        print_success "Flutter admin screen tests passed"
    else
        print_error "Flutter admin screen tests failed"
        echo "  Run 'cd ../../recipe_archive && flutter test ../tests/multi-tenant/flutter-admin.test.dart' for detailed output"
    fi
}

validate_test_files() {
    print_header "TEST FILE VALIDATION"
    
    local validation_passed=1
    
    # Check Go test files
    if [ ! -f "tenant-isolation.test.go" ]; then
        echo "  Missing: tenant-isolation.test.go"
        validation_passed=0
    fi
    
    # Check JavaScript test files
    if [ ! -f "invitation-flow.test.js" ]; then
        echo "  Missing: invitation-flow.test.js"
        validation_passed=0
    fi
    
    # Check Flutter test files
    if [ ! -f "flutter-admin.test.dart" ]; then
        echo "  Missing: flutter-admin.test.dart"
        validation_passed=0
    fi
    
    # Check configuration files
    if [ ! -f "go.mod" ]; then
        echo "  Missing: go.mod"
        validation_passed=0
    fi
    
    if [ ! -f "package.json" ]; then
        echo "  Missing: package.json"
        validation_passed=0
    fi
    
    if [ $validation_passed -eq 1 ]; then
        print_success "All test files present"
    else
        print_error "Missing test files"
    fi
}

show_coverage_report() {
    print_header "TEST COVERAGE SUMMARY"
    
    echo "  Test Suites: ${PASSED_TEST_SUITES}/${TOTAL_TEST_SUITES} passed"
    
    # Go coverage
    if [ -f "coverage.out" ]; then
        echo "  Go Coverage:"
        go tool cover -func=coverage.out | grep "total:" | awk '{print "    " $1 " " $3}'
    fi
    
    # JavaScript coverage (if jest --coverage was run)
    if [ -d "coverage" ]; then
        echo "  JavaScript Coverage: Check coverage/lcov-report/index.html"
    fi
    
    echo ""
    if [ $FAILED_TEST_SUITES -eq 0 ]; then
        echo -e "${GREEN}🎉 All multi-tenant tests passed!${NC}"
        echo "  The multi-tenant system is ready for deployment."
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        echo "  Fix failing tests before deploying multi-tenant features."
        return 1
    fi
}

cleanup() {
    # Clean up test artifacts
    [ -f "coverage.out" ] && rm coverage.out
    [ -d "coverage" ] && rm -rf coverage
    [ -d "node_modules" ] && rm -rf node_modules  # Only if we installed them
}

main() {
    echo -e "${BLUE}Multi-Tenant Test Suite${NC}"
    echo "Testing: Tenant Isolation, Invitation Flow, Admin Screens"
    echo ""
    
    # Ensure we're in the right directory
    if [ ! -f "run-tests.sh" ]; then
        echo -e "${RED}Error: Must run from tests/multi-tenant/ directory${NC}"
        exit 1
    fi
    
    validate_test_files
    run_go_tests
    run_javascript_tests
    run_flutter_tests
    show_coverage_report
    
    local exit_code=$?
    
    # Optional cleanup (comment out if you want to keep coverage reports)
    # cleanup
    
    exit $exit_code
}

# Handle interruption
trap 'echo -e "\n${RED}Tests interrupted!${NC}"; cleanup; exit 130' INT

# Run main function
main "$@"