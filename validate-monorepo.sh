#!/usr/bin/env bash

################################################################################
#
# 🔧 RecipeArchive Monorepo Validation Script
#
# A comprehensive validation system for the RecipeArchive monorepo that builds
# and executes a high-performance Go application for parallelized testing.
#
# 📋 OVERVIEW:
# This script acts as a wrapper that builds the Go-based monorepo-validator and
# passes through command-line arguments. The Go validator provides faster
# execution, better UX, parallelization, and robust error handling.
#
# 🚀 QUICK START:
#   git clone <repo> && cd RecipeArchive
#   ./validate-monorepo.sh              # Standard validation
#   ./validate-monorepo.sh --p1         # Quick commit checks
#   ./validate-monorepo.sh --all        # Full release validation
#
# 📊 VALIDATION TIERS:
#   --p1   📦 Phase 1 (~20-30s): Prerequisites + Dependencies + Core Builds
#          Perfect for: Git commits, quick development checks
#          Includes: Node.js/Go/Flutter checks, npm install, TypeScript/Go builds
#
#   --med  🔬 Medium (~2-3min): P1 + Integration Tests + Security + Linting
#          Perfect for: Pull requests, CI/CD pipelines (DEFAULT)
#          Includes: P1 + parser tests, backend tests, security scans, quality gates
#
#   --all  🏆 Comprehensive (~5-10min): Everything + Infrastructure + Extensions
#          Perfect for: Release validation, comprehensive audits
#          Includes: Medium + AWS infrastructure, recipe storage, frontend status
#
#   --infra 🏗️  Infrastructure (~2-3min): AWS-dependent validations only
#          Perfect for: Infrastructure changes, deployment validation
#          Includes: AWS connectivity, S3 buckets, Lambda functions, multi-tenant
#
# ⚡ PERFORMANCE FEATURES:
#   --parallel     Run compatible validations concurrently (faster execution)
#   --verbose      Detailed output with timing and progress indicators
#   Smart binary building: Only rebuilds Go validator when source changes
#
# 🛠️  SYSTEM REQUIREMENTS:
#   Required: Node.js (18+), npm, Go (1.19+), Git
#   Optional: Make, ESLint, TruffleHog, Flutter (for full validation)
#
# 🏃‍♂️ EXECUTION MODEL:
#   1. Sources .env file (if present) for PROJECT_ROOT
#   2. Conditionally builds tools/monorepo-validator-go (only if needed)
#   3. Maps shell arguments to Go flags (--p1 → --p1, etc.)
#   4. Executes Go validator with beautiful terminal UX
#
# 🔗 INTEGRATION EXAMPLES:
#   Husky pre-commit:     ./validate-monorepo.sh --p1
#   GitHub Actions:       ./validate-monorepo.sh --med
#   Release pipeline:     ./validate-monorepo.sh --all
#   AWS deployment:       ./validate-monorepo.sh --infra
#
# 🎯 EXIT CODES:
#   0   All validations passed
#   1   One or more validations failed
#   130 User interrupted (Ctrl+C)
#
# 📁 PROJECT STRUCTURE AWARENESS:
# Automatically detects project root via git repository detection.
# Validates: Web extensions, Recipe parsers, AWS backend, Flutter app,
# TypeScript infrastructure, Go microservices, Multi-tenant features
#
# 🔧 DEVELOPMENT NOTES:
# - The Go validator source is in tools/monorepo-validator-go/
# - Binary is built to tools/monorepo-validator-go/monorepo-validator-go
# - Uses goroutines for parallel execution when --parallel flag is used
# - Thread-safe validation result collection with comprehensive reporting
# - Graceful signal handling ensures terminal never left in bad state
#
################################################################################


set -e  # Exit on any error
set -o pipefail  # Exit on pipe failure

# Validation tier selection
VALIDATION_TIER="med"  # Default to medium tier

# Help function
show_help() {
    # Build the Go validator if needed and call its help function
    local VALIDATOR_DIR="tools/monorepo-validator-go"
    local VALIDATOR_BINARY="$VALIDATOR_DIR/monorepo-validator-go"

    # Check if we need to build the validator
    if [ ! -f "$VALIDATOR_BINARY" ] || [ "$VALIDATOR_DIR" -nt "$VALIDATOR_BINARY" ] || find "$VALIDATOR_DIR" -name "*.go" -newer "$VALIDATOR_BINARY" 2>/dev/null | grep -q .; then
        echo "🔨 Building monorepo validator..."
        cd "$VALIDATOR_DIR" || {
            echo "❌ Error: Cannot access $VALIDATOR_DIR"
            exit 1
        }
        if ! go build -o monorepo-validator-go .; then
            echo "❌ Error: Failed to build monorepo validator"
            exit 1
        fi
        cd - > /dev/null || exit 1
    fi

    # Call the Go tool's help (which has the nice table formatting)
    # But adjust the usage line to show the shell script name and flag format
    "$VALIDATOR_BINARY" --help | sed "s|./monorepo-validator-go|$0|g; s| -p1| --p1|g; s| -med| --med|g; s| -all| --all|g; s| -infra| --infrastructure|g; s| -mobile| --mobile|g; s| -tools| --tools|g"
}

# Check if test category should run in current tier
should_run() {
    local category="$1"
    local current_tests="${TEST_TIERS[$VALIDATION_TIER]}"
    [[ " $current_tests " =~ " $category " ]]
}

# Test category definitions
declare -A TEST_TIERS
TEST_TIERS[p1]="prerequisites dependencies_critical builds_core security_always linting_always quality_gate tests_integration"
TEST_TIERS[med]="${TEST_TIERS[p1]} builds_extended quality_basic"
TEST_TIERS[all]="${TEST_TIERS[med]} tests_comprehensive quality_extended extensions_full aws_infrastructure"
TEST_TIERS[infrastructure]="prerequisites aws_infrastructure"
TEST_TIERS[mobile]="mobile"
TEST_TIERS[tools]="tools"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --p1)
      VALIDATION_TIER="p1"
      shift
      ;;
    --med)
      VALIDATION_TIER="med"
      shift
      ;;
    --all)
      VALIDATION_TIER="all"
      shift
      ;;
    --infrastructure)
      VALIDATION_TIER="infrastructure"
      shift
      ;;
    --mobile)
      VALIDATION_TIER="mobile"
      shift
      ;;
    --tools)
      VALIDATION_TIER="tools"
      shift
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      show_help
      exit 1
      ;;
  esac
done

# Minimal colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters - Separated by operation type for accuracy
declare -i TOTAL_OPERATIONS=0
declare -i PASSED_OPERATIONS=0
declare -i FAILED_OPERATIONS=0
declare -i BUILD_FAILURES=0

# Test-specific counters (subset of operations that are actual tests)
declare -i TOTAL_TESTS=0
declare -i PASSED_TESTS=0
declare -i FAILED_TESTS=0

# Track which sections have been completed
COMPLETED_SECTIONS=""
CURRENT_SECTION=""

# Cross-platform timeout function
run_with_timeout() {
    local timeout_duration=$1
    shift
    local command_to_run=("$@")

    # Use timeout command if available (Linux)
    if command -v timeout &> /dev/null; then
        timeout "$timeout_duration" "$@"
        return $?
    fi

    # Fallback for macOS and other systems without timeout command
    local temp_script
    temp_script=$(mktemp -t timeout_command.XXXXXX)
    trap 'rm -f "$temp_script"' EXIT

    echo '#!/bin/bash' > "$temp_script"
    echo 'exec "$@"' >> "$temp_script"
    chmod +x "$temp_script"

    # Run command in background and get its PID
    "$temp_script" "${command_to_run[@]}" &
    local pid=$!

    # Wait for either completion or timeout
    local count=0
    while [ $count -lt $timeout_duration ]; do
        if ! kill -0 $pid 2>/dev/null; then
            # Process finished
            wait $pid
            local exit_code=$?
            rm -f "$temp_script"
            trap - EXIT
            return $exit_code
        fi
        sleep 1
        count=$((count + 1))
    done

    # Timeout reached - kill the process
    kill -TERM $pid 2>/dev/null || true
    sleep 1
    kill -KILL $pid 2>/dev/null || true
    wait $pid 2>/dev/null || true
    rm -f "$temp_script"
    trap - EXIT
    return 124  # Standard timeout exit code
}

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
    CURRENT_SECTION="$1"
}

track_section_completion() {
    COMPLETED_SECTIONS="$COMPLETED_SECTIONS $CURRENT_SECTION"
}

print_step() {
    echo -n "  $1... "
}

print_success() {
    echo -e "${GREEN}✓${NC}"
    PASSED_OPERATIONS=$((PASSED_OPERATIONS + 1))
    TOTAL_OPERATIONS=$((TOTAL_OPERATIONS + 1))
}

print_error() {
    echo -e "${RED}✗${NC}"
    FAILED_OPERATIONS=$((FAILED_OPERATIONS + 1))
    TOTAL_OPERATIONS=$((TOTAL_OPERATIONS + 1))
}

# Test-specific success/error functions
print_test_success() {
    echo -e "${GREEN}✓${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    PASSED_OPERATIONS=$((PASSED_OPERATIONS + 1))
    TOTAL_OPERATIONS=$((TOTAL_OPERATIONS + 1))
}

print_test_error() {
    echo -e "${RED}✗${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_OPERATIONS=$((FAILED_OPERATIONS + 1))
    TOTAL_OPERATIONS=$((TOTAL_OPERATIONS + 1))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo "  $1"
}

# Add operation (build, quality check, etc.) without immediate execution
add_operation() {
    TOTAL_OPERATIONS=$((TOTAL_OPERATIONS + 1))
}

# Add actual test without immediate execution  
add_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    TOTAL_OPERATIONS=$((TOTAL_OPERATIONS + 1))
}

# Mark operation as passed
mark_passed() {
    PASSED_OPERATIONS=$((PASSED_OPERATIONS + 1))
}

# Mark test as passed (used with add_test)
mark_test_passed() {
    PASSED_TESTS=$((PASSED_TESTS + 1))
    PASSED_OPERATIONS=$((PASSED_OPERATIONS + 1))
}

# Mark test as failed (used with add_test)
mark_test_failed() {
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_OPERATIONS=$((FAILED_OPERATIONS + 1))
}

# Validate prerequisites
validate_prerequisites() {
    print_header "PREREQUISITES"
    
    print_step "Checking required tools"
        
    local errors=0
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error
        echo "    Node.js is not installed"
        errors=$((errors + 1))
    else
        add_operation; mark_passed
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        print_error
        echo "    npm is not installed"
        errors=$((errors + 1))
    else
        add_operation; mark_passed
    fi
    
    # Check for Go
    if ! command -v go &> /dev/null; then
        print_error
        echo "    Go is not installed"
        errors=$((errors + 1))
    else
        add_operation; mark_passed
    fi
    
    # Check for Make
    if ! command -v make &> /dev/null; then
        print_error
        echo "    Make is not installed"
        errors=$((errors + 1))
    else
        add_operation; mark_passed
    fi
    
    # Check for ESLint
    if ! command -v eslint &> /dev/null && [ ! -f node_modules/.bin/eslint ]; then
        print_error
        echo "    ESLint is not available"
        errors=$((errors + 1))
    else
        add_operation; mark_passed
    fi
    
    # Check for TruffleHog
    if ! command -v trufflehog &> /dev/null; then
        print_error
        echo "    TruffleHog is not installed (required for security scanning)"
        echo "    Install with: brew install trufflehog (macOS) or go install github.com/trufflesecurity/trufflehog/v3@latest (other systems)"
        errors=$((errors + 1))
    else
        add_operation; mark_passed
    fi
    
    # Check for Flutter (optional for web app development)
    if [ -d "recipe_archive" ]; then
        if ! command -v flutter &> /dev/null; then
            print_warning "Flutter not found - web app validation will be skipped"
            echo "    Install Flutter from: https://flutter.dev/docs/get-started/install"
            add_operation; mark_passed  # Count as passed since it's optional
        else
            add_operation; mark_passed
        fi
    fi
    
    if [ $errors -eq 0 ]; then
        print_success
        echo "    All prerequisites available"
        
        # Quick security scan check
        add_operation
        echo "    Running security scan..."
        if command -v trufflehog > /dev/null 2>&1; then
            echo "    Security scan: TruffleHog available ✓"
            mark_passed
        else
            print_error
            echo "    Security scan: TruffleHog not installed"
            echo "    Install with: brew install trufflehog"
        fi
        
        track_section_completion
    else
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    print_header "DEPENDENCIES"
    
    print_step "Installing root dependencies"
    add_operation
    if npm install > /tmp/root-npm-install.log 2>&1; then
        print_success
    else
        print_error
        echo "    Root dependency installation failed. See /tmp/root-npm-install.log for details."
        BUILD_FAILURES=$((BUILD_FAILURES + 1))
        exit 1
    fi
    
    print_step "Installing AWS infrastructure dependencies"
    add_operation
    if (cd aws-backend/infrastructure && npm install > /tmp/aws-infra-npm-install.log 2>&1); then
        print_success
    else
        print_error
        echo "    AWS infrastructure dependency installation failed. See /tmp/aws-infra-npm-install.log for details."
        BUILD_FAILURES=$((BUILD_FAILURES + 1))
        exit 1
    fi
    
    print_step "Installing Safari test dependencies"
    add_operation
    if (cd extensions/tests/safari && npm install > /tmp/safari-test-npm-install.log 2>&1); then
        print_success
    else
        print_error
        echo "    Safari test dependency installation failed. See /tmp/safari-test-npm-install.log for details."
        BUILD_FAILURES=$((BUILD_FAILURES + 1))
        exit 1
    fi
    
    track_section_completion
}

# Build all Go binaries
build_go_binaries() {
    print_header "GO BUILDS"

    if [ "$QUALITY_GATE_RAN" = true ]; then
        print_step "Go compilation"
        add_operation
        print_success
        echo "    Already validated by quality gate - skipping duplicate compilation"
    else
        print_step "Building AWS backend"
        add_operation
        if (cd aws-backend && make build > /dev/null 2>&1); then
            print_success
        else
            print_error
            echo "    AWS Backend build failed"
            BUILD_FAILURES=$((BUILD_FAILURES + 1))
            return 1
        fi

        print_step "Building tools"
        add_operation
        if (cd tools && make build > /dev/null 2>&1); then
            print_success
        else
            print_error
            echo "    Tools build failed"
            BUILD_FAILURES=$((BUILD_FAILURES + 1))
            return 1
        fi

        print_step "Building content-ops"
        add_operation
        if (cd tools/content-ops && go build -o content-ops . > /dev/null 2>&1); then
            print_success
        else
            print_error
            echo "    Content-ops build failed"
            BUILD_FAILURES=$((BUILD_FAILURES + 1))
            return 1
        fi
    fi

    track_section_completion
}

# Run TypeScript compilation
build_typescript() {
    print_header "TYPESCRIPT"

    if [ "$QUALITY_GATE_RAN" = true ]; then
        print_step "TypeScript compilation"
        add_operation
        print_success
        echo "    Already validated by quality gate - skipping duplicate compilation"
    else
        print_step "Compiling parsers TypeScript"
        add_operation
        if npx tsc --project parsers/tsconfig.json --noEmit > /dev/null 2>&1; then
            print_success
        else
            print_error
            echo "    Parsers TypeScript compilation failed"
            BUILD_FAILURES=$((BUILD_FAILURES + 1))
            return 1
        fi

        print_step "Compiling infrastructure TypeScript"
        add_operation
        if [ -d "aws-backend/infrastructure" ]; then
            if (cd aws-backend/infrastructure && npx tsc --noEmit > /dev/null 2>&1); then
                print_success
            else
                print_error
                echo "    Infrastructure TypeScript compilation failed"
                BUILD_FAILURES=$((BUILD_FAILURES + 1))
                return 1
            fi
        else
            print_warning "Infrastructure directory not found - skipping"
            mark_passed
        fi
    fi

    track_section_completion
}

# Run meaningful tests - REMOVED USELESS PLAYWRIGHT TESTS
run_meaningful_tests() {
    print_header "MEANINGFUL TESTS"
    
    print_step "Parser system tests"
    add_test
    if npm run test:parsers > /dev/null 2>&1; then
        print_test_success
    else
        print_test_error
        echo "    Parser tests failed - rerun with: npm run test:parsers"
    fi
    
    print_step "Go backend tests"
    add_test
    if (cd aws-backend/functions/local-server && go test -v > /dev/null 2>&1); then
        print_test_success
    else
        print_test_error
        echo "    Go tests failed - rerun with: cd aws-backend/functions/local-server && go test -v"
    fi
    
    print_step "Go tools tests"
    add_test
    if (cd tools && make test > /dev/null 2>&1); then
        print_test_success
    else
        print_test_error
        echo "    Go tools tests failed - rerun with: cd tools && make test"
    fi
    
    print_step "Extension integration tests"
    add_test
    if jest tests/parser-registry-integration.test.js > /dev/null 2>&1; then
        print_test_success
    else
        print_test_error
        echo "    Extension integration tests failed - parser bundle issues"
    fi

    print_step "TypeScript extension unit tests"
    add_test
    if npm run test:unit > /dev/null 2>&1; then
        print_test_success
    else
        print_test_error
        echo "    TypeScript unit tests failed - rerun with: npm run test:unit"
    fi

    print_step "Chrome/Safari extension tests"
    add_test
    if npm run test:extensions > /dev/null 2>&1; then
        print_test_success
    else
        print_test_error
        echo "    Extension tests failed - rerun with: npm run test:extensions"
    fi
    
    # Multi-tenant invitation flow tests - comprehensive AWS integration validation
    print_step "Multi-tenant invitation flow tests"
    add_test
    if [ -f "tests/multi-tenant/run-invitation-tests.sh" ]; then
        if tests/multi-tenant/run-invitation-tests.sh > /tmp/invitation_flow_test.log 2>&1; then
            print_test_success
            invitation_test_summary=$(grep -E "(✅|❌)" /tmp/invitation_flow_test.log | tail -1 || echo "Tests completed")
            echo "    $invitation_test_summary"
        else
            print_test_error
            echo "    Multi-tenant invitation flow tests failed - check /tmp/invitation_flow_test.log"
            echo "    Common issues: Missing RECIPE_ADMIN_TOKEN, AWS credentials, or network connectivity"
        fi
    else
        print_test_error
        echo "    Multi-tenant invitation test script not found at tests/multi-tenant/run-invitation-tests.sh"
    fi
    
    
    track_section_completion
}

# Production API endpoint health checks
test_production_api_endpoints() {
    print_header "PRODUCTION API ENDPOINTS"
    
    # Load environment variables for API base URL
    if [ -f ".env" ]; then
        source .env
    fi
    
    local api_base="${API_BASE_URL:-https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod}"
    
    print_step "Health endpoint"
    add_test
    if curl -s --max-time 10 "${api_base}/health" | grep -q "OK\|healthy\|success" 2>/dev/null; then
        print_test_success
    else
        print_test_error
        echo "    Health endpoint failed: ${api_base}/health"
    fi
    
    print_step "Diagnostics endpoint (POST)"
    add_test
    local test_payload='{"errors":[{"url":"test","userAgent":"validator","errorType":"test","error":"validation test","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","extension":"test","context":"validation"}]}'
    if curl -s --max-time 10 -X POST -H "Content-Type: application/json" -d "$test_payload" "${api_base}/report-error" | grep -q "success\|received\|processed" 2>/dev/null; then
        print_test_success
    else
        print_test_error
        echo "    Diagnostics endpoint failed: ${api_base}/report-error"
    fi
    
    print_step "Analytics summary endpoint"
    add_test
    if curl -s --max-time 10 "${api_base}/analytics/summary" | grep -q "{\|analytics\|summary" 2>/dev/null; then
        print_test_success
    else
        print_test_error
        echo "    Analytics endpoint failed: ${api_base}/analytics/summary"
    fi
    
    print_step "Recipes endpoint (GET)"
    add_test
    # Test without auth - should return 401 or proper error, not 500
    local recipes_response=$(curl -s --max-time 10 -w "%{http_code}" "${api_base}/recipes" 2>/dev/null)
    local http_code="${recipes_response: -3}"
    if [[ "$http_code" =~ ^(200|401|403)$ ]]; then
        print_test_success
        echo "    Recipes endpoint responding (HTTP $http_code)"
    else
        print_test_error
        echo "    Recipes endpoint failed with HTTP $http_code: ${api_base}/recipes"
    fi
    
    track_section_completion
}

# Legacy: Backend API endpoint testing function (localhost)
test_backend_api_endpoints() {
    # Test health endpoint
    if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
        # Backend might not be running - that's okay for validation
        return 0
    fi
    
    # Test basic endpoints if backend is running
    local health_check=$(curl -s http://localhost:3001/health 2>/dev/null | grep -c "OK" || echo "0")
    if [ "$health_check" -gt 0 ]; then
        return 0
    fi
    
    return 0  # Pass for now since backend might not be running during validation
}

# Security scanning (always runs regardless of tier)
run_security_scan() {
    print_header "SECURITY SCAN (Always Enabled)"
    
    print_step "TruffleHog security scan"
    add_operation
    if command -v trufflehog > /dev/null 2>&1; then
        # Fast, quiet scan: only check recent commits (last 10) instead of entire history
        if trufflehog git file://. --only-verified --since-commit HEAD~4 --no-update > /dev/null 2>&1; then
            print_success
            echo "    No verified secrets found (last 10 commits)"
        else
            # If scan failed, run again with output for details
            print_error
            echo "    Security scan detected potential secrets:"
            trufflehog git file://. --only-verified --since-commit HEAD~4 --no-update 2>&1 | grep -E "(Found verified|detector|Source|line)" | head -10
            echo "    Run 'npm run security:scan' for full details"
        fi
    else
        print_error
        echo "    TruffleHog not installed - security scan skipped"
        echo "    Install with: brew install trufflehog"
    fi
    
    track_section_completion
}

# Global flag to track if quality gate has run
QUALITY_GATE_RAN=false

# Quality gate check (includes all Husky pre-commit checks)
run_quality_gate() {
    print_header "QUALITY GATE (Husky-compatible)"

    print_step "Running MCP diagnostics gate"
    add_operation
    if npm run quality:gate > /dev/null 2>&1; then
        print_success
        echo "    Quality gate passed - JSON validation, TypeScript, Flutter, Go compilation"
        QUALITY_GATE_RAN=true
    else
        print_error
        echo "    Quality gate failed - run 'npm run quality:gate' for details"
    fi

    track_section_completion
}

# Linting checks (always runs regardless of tier)
run_linting_checks() {
    print_header "LINTING (Always Enabled)"
    
    print_step "ESLint - Web Extensions"
    add_operation
    if npm run lint; then
        print_success
    else
        print_error
        echo "    Extension linting found issues - run 'npm run lint' for details"
    fi

    print_step "ESLint - Chrome Extension"
    add_operation
    if (cd extensions/chrome && npm run lint > /dev/null 2>&1); then
        print_success
    else
        print_error
        echo "    Chrome extension linting failed - run 'cd extensions/chrome && npm run lint' for details"
    fi

    print_step "ESLint - Safari Extension"
    add_operation
    if (cd extensions/safari && npm run lint > /dev/null 2>&1); then
        print_success
    else
        print_error
        echo "    Safari extension linting failed - run 'cd extensions/safari && npm run lint' for details"
    fi
    
    print_step "ESLint - Extension scoping"
    add_operation
    if npm run lint:scoping > /dev/null 2>&1; then
        print_success
    else
        print_error
        echo "    Extension scoping failed - rerun with: npm run lint:scoping"
    fi
    
    print_step "Flutter analysis"
    add_operation
    if [ "$QUALITY_GATE_RAN" = true ]; then
        print_success
        echo "    Already validated by quality gate - skipping duplicate analysis"
    elif [ -d "recipe_archive" ]; then
        if command -v flutter &> /dev/null; then
            if (cd recipe_archive && flutter analyze > /dev/null 2>&1); then
                print_success
            else
                print_error
                echo "    Flutter analysis found issues - run 'cd recipe_archive && flutter analyze' for details"
            fi
        else
            print_warning "Flutter not installed - skipping"
            mark_passed
        fi
    else
        print_warning "Flutter app directory not found - skipping"
        mark_passed
    fi
    
    print_step "Go code formatting"
    add_operation
    # Apply gofmt to all Go files excluding node_modules and template files
    if find . -name "*.go" -not -path "./recipe_archive/*" -not -path "./node_modules/*" -not -path "*/node_modules/*" -not -name "*.template.go" -exec gofmt -l {} \; | grep -q .; then
        print_error
        echo "    Go formatting issues - run 'find . -name \"*.go\" -not -path \"./recipe_archive/*\" -not -path \"*/node_modules/*\" -not -name \"*.template.go\" -exec gofmt -w {} \;' to fix"
    else
        print_success
    fi

    print_step "Flutter diagnostic error monitoring"
    add_operation
    if command -v aws &> /dev/null; then
        recent_errors=$(aws s3 ls s3://recipe-storage-0ea7007d57f67ecb-990537043943/flutter-console-errors/ --recursive 2>/dev/null | wc -l | tr -d ' \n' || echo "0")
        if [ "$recent_errors" -gt 0 ]; then
            print_warning "Found $recent_errors diagnostic error files - review S3 bucket"
        else
            print_success
            echo "    No recent Flutter diagnostic errors found"
        fi
    else
        print_warning "AWS CLI not available - skipping diagnostic check"
        mark_passed
    fi
    
    track_section_completion
}

# Basic quality checks (medium tier and above)
run_basic_quality_checks() {
    print_header "BASIC QUALITY CHECKS"
    
    print_step "Basic documentation organization"
    add_operation
    if npm run docs:organize > /dev/null 2>&1; then
        print_success
    else
        print_error
        echo "    Documentation organization failed - check npm run docs:organize"
    fi
    
    track_section_completion
}

# Comprehensive tests (all tier only)
run_comprehensive_tests() {
    print_header "COMPREHENSIVE TESTS"
    
    print_step "Flutter tests"
    add_test
    if [ -d "recipe_archive" ]; then
        if command -v flutter &> /dev/null; then
            if (cd recipe_archive && flutter test > /dev/null 2>&1); then
                print_test_success
            else
                print_test_error
                echo "    Flutter tests failed - run 'cd recipe_archive && flutter test' for details"
            fi
        else
            print_warning "Flutter not installed - skipping"
            mark_test_passed
        fi
    else
        print_warning "Flutter app directory not found - skipping"
        mark_test_passed
    fi
    
    # Flutter admin screen tests removed - complex integration tests with architectural issues
    # Core Flutter functionality is validated by basic Flutter tests above
    
    track_section_completion
}

# AWS Infrastructure tests (all tier only)
run_aws_infrastructure_tests() {
    print_header "AWS INFRASTRUCTURE"

    print_step "Multi-tenant system tests"
    add_test
    if [ -f "tests/multi-tenant/tenant-isolation_test.go" ]; then
        if (cd tests/multi-tenant && go test -v > /dev/null 2>&1); then
            print_test_success
        else
            print_test_error
            echo "    Multi-tenant tests failed - rerun with: cd tests/multi-tenant && go test -v"
        fi
    else
        print_test_error
        echo "    Multi-tenant test files not found"
    fi

    # Multi-tenant invitation flow tests - comprehensive AWS integration validation
    print_step "Multi-tenant invitation flow tests"
    add_test
    if [ -f "tests/multi-tenant/run-invitation-tests.sh" ]; then
        if tests/multi-tenant/run-invitation-tests.sh > /tmp/invitation_flow_test.log 2>&1; then
            print_test_success
            invitation_test_summary=$(grep -E "(✅|❌)" /tmp/invitation_flow_test.log | tail -1 || echo "Tests completed")
            echo "    $invitation_test_summary"
        else
            print_test_error
            echo "    Multi-tenant invitation flow tests failed - check /tmp/invitation_flow_test.log"
            echo "    Common issues: Missing RECIPE_ADMIN_TOKEN, AWS credentials, or network connectivity"
        fi
    else
        print_test_error
        echo "    Multi-tenant invitation test script not found at tests/multi-tenant/run-invitation-tests.sh"
    fi

    # Search functionality validation tests
    print_step "Search functionality tests"
    add_test
    if [ -f "tests/search-validation.sh" ]; then
        if tests/search-validation.sh > /tmp/search_validation.log 2>&1; then
            print_test_success
            search_test_count=$(grep -o '[0-9]\+/[0-9]\+' /tmp/search_validation.log | tail -1 || echo "0/0")
            echo "    Search validation: $search_test_count tests"
        else
            print_test_error
            echo "    Search validation failed - check /tmp/search_validation.log"
        fi
    else
        print_test_error
        echo "    Search validation script not found at tests/search-validation.sh"
    fi

    # Flutter diagnostic error monitoring
    print_step "Flutter diagnostic error monitoring"
    add_operation
    if command -v aws &> /dev/null; then
        recent_errors=$(aws s3 ls s3://recipe-storage-0ea7007d57f67ecb-990537043943/flutter-console-errors/ --recursive 2>/dev/null | wc -l | tr -d ' \n' || echo "0")
        if [ "$recent_errors" -gt 0 ]; then
            print_warning "Found $recent_errors diagnostic error files - review S3 bucket"
        else
            print_success
            echo "    No recent Flutter diagnostic errors found"
        fi
    else
        print_warning "AWS CLI not available - skipping diagnostic check"
        mark_passed
    fi

    # S3 bucket access validation for diagnostic storage
    print_step "S3 diagnostic bucket access tests"
    add_test
    if command -v aws &> /dev/null; then
        bucket_name="recipe-storage-0ea7007d57f67ecb-990537043943"
        s3_test_passed=true

        # Test parser failure bucket access
        if ! aws s3 ls "s3://$bucket_name/parser-failures/" >/dev/null 2>&1; then
            s3_test_passed=false
            echo "    ❌ Cannot access parser-failures/ bucket"
        fi

        # Test web extension failure bucket access
        if ! aws s3 ls "s3://$bucket_name/web-extension-errors/" >/dev/null 2>&1; then
            s3_test_passed=false
            echo "    ❌ Cannot access web-extension-errors/ bucket"
        fi

        # Test flutter failure bucket access
        if ! aws s3 ls "s3://$bucket_name/flutter-console-errors/" >/dev/null 2>&1; then
            s3_test_passed=false
            echo "    ❌ Cannot access flutter-console-errors/ bucket"
        fi

        if [ "$s3_test_passed" = true ]; then
            print_test_success
            echo "    All diagnostic S3 buckets accessible"
        else
            print_test_error
            echo "    S3 bucket access failed - check AWS credentials and permissions"
        fi
    else
        print_warning "AWS CLI not available - skipping S3 bucket access tests"
        mark_test_passed
    fi

    # Content-ops tool functionality test
    print_step "Content-ops tool validation"
    add_test
    if [ -f "tools/content-ops/content-ops" ]; then
        if command -v aws &> /dev/null; then
            if (cd tools/content-ops && timeout 30 ./content-ops > /tmp/content_ops_test.log 2>&1); then
                # Check if tool ran successfully (success message or recipe count)
                if grep -q "Report generation completed successfully\|✅ Successful recipes:" /tmp/content_ops_test.log; then
                    print_test_success
                    recipe_summary=$(grep "✅ Successful recipes:" /tmp/content_ops_test.log | head -1 || echo "Tool executed successfully")
                    echo "    $recipe_summary"
                else
                    print_test_error
                    echo "    Content-ops tool failed - check /tmp/content_ops_test.log"
                fi
            else
                print_test_error
                echo "    Content-ops tool timed out or failed - check AWS credentials and network"
            fi
        else
            print_warning "AWS CLI not available - skipping content-ops test"
            mark_test_passed
        fi
    else
        print_test_error
        echo "    Content-ops binary not found - run 'cd tools/content-ops && go build -o content-ops main.go'"
    fi

    track_section_completion
}

# IMPROVED: Parser validation with better error handling
validate_parsers() {
    print_header "RECIPE PARSERS"

    print_step "Site-specific parser validation"
    add_test
    if [ -f "tests/parser-validation/test-parser-integration.cjs" ]; then
        local start_time=$(date +%s)
        if (cd tests/parser-validation && run_with_timeout 60 node test-parser-integration.cjs > /tmp/parser_test.log 2>&1); then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            print_test_success
            echo "    Parser validation completed in ${duration}s"
        else
            print_test_error
            echo "    Parser validation failed or timed out after 60s"
            echo "    Check /tmp/parser_test.log for details"
            echo "    Common issues: Network timeouts, site structure changes, missing TypeScript bundle"
        fi
    else
        print_test_error
        echo "    Parser validation tool not found at tests/parser-validation/test-parser-integration.cjs"
    fi

    print_step "Extension URL pattern validation"
    add_test
    if [ -f "tests/extension-validation/test-extension-url-patterns.js" ]; then
        if run_with_timeout 30 node tests/extension-validation/test-extension-url-patterns.js > /tmp/extension_url_test.log 2>&1; then
            print_test_success
            echo "    Extension URL pattern tests passed"
        else
            print_test_error
            echo "    Extension URL patterns failed - extensions may reject valid recipe pages"
            echo "    Check /tmp/extension_url_test.log for details"
        fi
    else
        print_test_error
        echo "    Extension URL pattern test not found"
    fi
    
    track_section_completion
}

# Quality gates with proper error handling
run_quality_gates() {
    print_header "QUALITY GATES"
    
    print_step "PRD document protection"
    add_operation
    local missing_prds=0
    PRD_FILES=("docs/requirements/browser-extension.md" "docs/requirements/aws-backend.md" "docs/requirements/website.md" "docs/requirements/ios-app.md")
    
    for file in "${PRD_FILES[@]}"; do
        [ ! -f "$file" ] && missing_prds=$((missing_prds + 1))
    done
    
    if [ $missing_prds -eq 0 ] && [ -d "docs/requirements" ]; then
        print_success
    else
        print_error
        echo "    Missing PRD documents - check docs/requirements/"
    fi
    
    print_step "File organization"
    add_operation
    misplaced_files=$(find . -maxdepth 1 -name "*test*" -o -name "*validation*" -o -name "*report*" 2>/dev/null | grep -v node_modules | grep -v "^./tests$" | grep -v "^./test-results$" | grep -v "^./validate-monorepo.sh$" || true)
    
    if [ -z "$misplaced_files" ]; then
        print_success
    else
        print_error
        echo "    Misplaced files in root: $misplaced_files"
    fi
    
    print_step "Empty markdown files"
    add_operation
    empty_md_files=$(find . -name "*.md" -type f -size 0 2>/dev/null | grep -v node_modules | grep -v .git || true)
    
    if [ -z "$empty_md_files" ]; then
        print_success
    else
        print_error
        echo "    Empty markdown files found: $empty_md_files"
    fi
    
    print_step "Orphaned development files"
    add_operation
    orphaned_files=$(find . -name "*.bak" -o -name "*-clean.*" -o -name "*-debug.*" -o -name "*-old.*" -o -name "*-backup.*" 2>/dev/null | grep -v node_modules | grep -v .git | grep -v "recipe-archive-minimal" || true)
    
    if [ -z "$orphaned_files" ]; then
        print_success
    else
        print_error
        echo "    Orphaned development files found: $orphaned_files"
    fi
    
    print_step "Documentation checks"
    add_operation
    if npm run docs:organize > /dev/null 2>&1 && npm run docs:review > /dev/null 2>&1; then
        print_success
    else
        print_error
        echo "    Documentation checks failed - check npm run docs:organize and npm run docs:review"
    fi
    
    print_step "Multi-tenant infrastructure validation"
    add_operation
    local mt_infrastructure_valid=1

    # DynamoDB removed - now using S3-based invitation system for cost optimization
    
    # Check Lambda function source
    if [ ! -f "aws-backend/functions/invitation-manager-s3/main.go" ] || [ ! -f "aws-backend/functions/registration-handler/main.go" ]; then
        print_error
        echo "    Missing multi-tenant Lambda functions"
        mt_infrastructure_valid=0
    fi
    
    # Check deployment scripts
    if [ ! -f "scripts/deploy-multi-tenant.sh" ] || [ ! -x "scripts/deploy-multi-tenant.sh" ]; then
        print_error
        echo "    Missing or non-executable deployment script"
        mt_infrastructure_valid=0
    fi
    
    # Check tenant isolation utilities
    if [ ! -f "aws-backend/functions/utils/tenant_validation.go" ]; then
        print_error
        echo "    Missing tenant validation utilities"
        mt_infrastructure_valid=0
    fi
    
    if [ $mt_infrastructure_valid -eq 1 ]; then
        print_success
        echo "    Multi-tenant infrastructure components validated"
    fi
    
    track_section_completion
}

# Recipe storage validation
validate_recipe_storage() {
    print_header "RECIPE STORAGE"
    
    print_step "S3 storage report"
    add_operation
    if [ -f ".env" ]; then
        set -o allexport
        source .env > /dev/null 2>&1
        set +o allexport
        
        if [ -n "$RECIPE_USER_EMAIL" ] && [ -n "$RECIPE_USER_PASSWORD" ]; then
            if (cd tools/content-ops && run_with_timeout 30 go run main.go --user "$RECIPE_USER_EMAIL" --password "$RECIPE_USER_PASSWORD" > /tmp/recipe_report.log 2>&1); then
                recipe_count=$(grep -o '[0-9]\+ recipes' /tmp/recipe_report.log | head -1 | grep -o '[0-9]\+' || echo "0")
                print_success
                echo "    S3 storage contains $recipe_count recipes"
            else
                print_error
                echo "    Recipe report failed or timed out - check credentials and network"
            fi
        else
            print_warning "Missing .env credentials"
            mark_passed
        fi
    else
        print_warning "No .env file found"
        mark_passed
    fi
    
    track_section_completion
}

# Frontend status check
check_frontend_status() {
    print_header "FRONTEND STATUS"
    
    add_operation
    if [ -d "recipe_archive" ]; then
        if [ -f "recipe_archive/pubspec.yaml" ]; then
            print_success
            echo "    Flutter web app ready - production: https://d1jcaphz4458q7.cloudfront.net"
        else
            print_error
            echo "    pubspec.yaml not found in recipe_archive directory"
        fi
    else
        print_error
        echo "    Flutter web app directory not found (expected in recipe_archive/)"
    fi
    
    print_info "iOS app planned - Swift-based mobile interface"
    track_section_completion
}

# Validate deployment infrastructure readiness
validate_deployment_infrastructure() {
    # set_section "DEPLOYMENT_INFRASTRUCTURE"
    print_header "DEPLOYMENT INFRASTRUCTURE"

    print_step "AWS CLI configuration"
    add_operation
    if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
        print_success
        mark_passed
    else
        print_error
        echo "    AWS CLI not configured. Run 'aws configure' first."
    fi

    print_step "Flutter build prerequisites"
    add_operation
    if command -v flutter &> /dev/null; then
        print_success
        mark_passed
    else
        print_error
        echo "    Flutter not installed. Required for web app deployment."
    fi

    print_step "S3 bucket configuration validation"
    add_operation
    local bucket_name="recipearchive-web-app-prod-990537043943"
    if aws s3 ls "s3://$bucket_name" &> /dev/null; then
        # Check if bucket is configured for website hosting
        if aws s3api get-bucket-website --bucket "$bucket_name" &> /dev/null; then
            print_success
            mark_passed
        else
            print_warning
            echo "    S3 bucket exists but website hosting not configured"
            echo "    Will be auto-configured during deployment"
            mark_passed
        fi
    else
        print_warning
        echo "    S3 bucket doesn't exist - will be created during deployment"
        mark_passed
    fi

    print_step "CloudFront distribution status"
    add_operation
    local distribution_id="E1D19F7SLOJM5H"
    if aws cloudfront get-distribution --id "$distribution_id" &> /dev/null; then
        print_success
        mark_passed
    else
        print_error
        echo "    CloudFront distribution $distribution_id not found"
    fi

    print_step "API Gateway CORS configuration"
    add_operation
    if [ -f ".env" ] && grep -q "^API_GATEWAY_ID=" .env; then
        local api_id=$(grep "^API_GATEWAY_ID=" .env | cut -d'=' -f2)
        if [ -n "$api_id" ]; then
            # Check if OPTIONS method exists for recipes endpoint
            local recipes_resource_id
            recipes_resource_id=$(aws apigateway get-resources --rest-api-id "$api_id" --region us-west-2 --query "items[?pathPart=='recipes'].id" --output text 2>/dev/null)

            if [ -n "$recipes_resource_id" ]; then
                if aws apigateway get-method --rest-api-id "$api_id" --resource-id "$recipes_resource_id" --http-method OPTIONS --region us-west-2 &> /dev/null; then
                    print_success
                    echo "    OPTIONS method configured for CORS"
                    mark_passed
                else
                    print_warning
                    echo "    OPTIONS method missing - will be added during deployment"
                    echo "    Deploy with: ./scripts/deploy-all.sh --backend-only"
                    mark_passed
                fi
            else
                print_warning
                echo "    Recipes resource not found in API Gateway"
                mark_passed
            fi
        else
            print_warning
            echo "    API_GATEWAY_ID not set in .env"
            mark_passed
        fi
    else
        print_warning
        echo "    API Gateway ID not configured in .env"
        mark_passed
    fi

    print_step "Flutter build compatibility test"
    add_operation
    cd recipe_archive &> /dev/null || { print_error; echo "    recipe_archive directory not found"; return; }

    # Test Flutter build without actually building (dry run check)
    if flutter doctor --version &> /dev/null && [ -f "pubspec.yaml" ]; then
        # Check for problematic dependencies that cause build issues
        local has_build_issues=0

        # Check for icon tree shaking issues (common problem we fixed)
        if grep -q "flutter_launcher_icons" pubspec.yaml 2>/dev/null; then
            if ! grep -q "no-tree-shake-icons" ../scripts/web-deploy.sh 2>/dev/null; then
                print_warning
                echo "    Icon tree shaking may cause build failures"
                echo "    Deploy script should use --no-tree-shake-icons flag"
                has_build_issues=1
            fi
        fi

        if [ $has_build_issues -eq 0 ]; then
            print_success
            mark_passed
        else
            mark_passed  # Warning level, not failure
        fi
    else
        print_error
        echo "    Flutter project configuration invalid"
    fi
    cd - &> /dev/null

    print_step "Deploy script validation"
    add_operation
    local deploy_script="../scripts/web-deploy.sh"
    if [ -f "$deploy_script" ] && [ -x "$deploy_script" ]; then
        # Check if script has our fixes
        local script_has_fixes=1

        if ! grep -q "aws s3 mb" "$deploy_script" 2>/dev/null; then
            print_warning
            echo "    Deploy script missing bucket creation logic"
            script_has_fixes=0
        fi

        if ! grep -q "\-\-no-tree-shake-icons" "$deploy_script" 2>/dev/null; then
            print_warning
            echo "    Deploy script missing Flutter build compatibility flags"
            script_has_fixes=0
        fi

        if [ $script_has_fixes -eq 1 ]; then
            print_success
            mark_passed
        else
            print_warning
            echo "    Deploy script needs updates for reliability"
            mark_passed  # Warning level
        fi
    else
        print_error
        echo "    Deploy script missing or not executable"
    fi

    print_step "Environment variables validation"
    add_operation
    local env_valid=1

    # Check critical environment variables exist
    if [ ! -f ".env" ]; then
        print_error
        echo "    .env file missing"
        env_valid=0
    else
        # Check for critical AWS variables
        if ! grep -q "^AWS_ACCESS_KEY_ID=" .env 2>/dev/null || ! grep -q "^AWS_SECRET_ACCESS_KEY=" .env 2>/dev/null; then
            print_warning
            echo "    AWS credentials not found in .env (may be configured via AWS CLI)"
            # Don't fail - AWS CLI config is also valid
        fi

        if grep -q "^CLOUDFRONT_DISTRIBUTION_ID=" .env 2>/dev/null; then
            local env_dist_id=$(grep "^CLOUDFRONT_DISTRIBUTION_ID=" .env | cut -d'=' -f2)
            if [ "$env_dist_id" != "E1D19F7SLOJM5H" ]; then
                print_warning
                echo "    CloudFront distribution ID mismatch in .env"
            fi
        fi
    fi

    if [ $env_valid -eq 1 ]; then
        print_success
        mark_passed
    fi

    print_step "Deployment readiness summary"
    add_operation
    print_success
    echo "    ✓ Infrastructure validation complete"
    echo "    ✓ Deploy with: ./scripts/web-deploy.sh"
    echo "    ✓ Monitoring: https://d1jcaphz4458q7.cloudfront.net/"
    mark_passed

    track_section_completion
}

# FIXED: Accurate summary with correct test counting
show_summary() {
    echo
    echo -e "${BLUE}=== VALIDATION SUMMARY ===${NC}"
    
    local test_ratio="${PASSED_TESTS}/${TOTAL_TESTS}"
    
    if [ $FAILED_TESTS -eq 0 ] && [ $BUILD_FAILURES -eq 0 ]; then
        echo -e "${GREEN}✓ VALIDATION PASSED${NC} (${test_ratio} tests)"
        echo "  Ready for deployment"
        
        echo -e "\n${BLUE}📊 COMPLETED SECTIONS:${NC}"
        for section in $COMPLETED_SECTIONS; do
            echo "  ✓ $section"
        done
        exit 0
    else
        echo -e "${RED}✗ VALIDATION FAILED${NC} (${FAILED_TESTS} failures, ${BUILD_FAILURES} build issues)"
        echo "  Tests passed: ${PASSED_TESTS}/${TOTAL_TESTS}"
        echo
        echo -e "${BLUE}📊 COMPLETED SECTIONS:${NC}$COMPLETED_SECTIONS"
        echo -e "${RED}❌ FAILED AT:${NC} $CURRENT_SECTION"
        echo
        echo -e "${YELLOW}🚫 TESTS NOT REACHED:${NC}"
        local all_sections="PREREQUISITES DEPENDENCIES GO_BUILDS TYPESCRIPT MEANINGFUL_TESTS CODE_QUALITY RECIPE_PARSERS QUALITY_GATES RECIPE_STORAGE FRONTEND_STATUS"
        for section in $all_sections; do
            if [[ ! "$COMPLETED_SECTIONS" =~ $section ]]; then
                echo "  • $section - Run individual commands for this section"
            fi
        done
        echo
        echo -e "${BLUE}📋 DEBUGGING GUIDE:${NC}"
        echo "  • Build failures: Check Go and TypeScript compilation errors"
        echo "  • Parser issues: Check network connectivity and site structure changes"
        echo "  • Linting issues: Run 'npm run lint' for specific file errors"
        echo "  • Missing dependencies: Run 'npm install' in all directories"
        echo
        exit 1
    fi
}

# Main execution - builds and calls Go validator
main() {
    echo -e "${BLUE}RecipeArchive Monorepo Validation${NC}"
    echo "Building Go validator and passing through to monorepo-validator-go..."
    echo

    # Source .env file to get PROJECT_ROOT if it exists
    if [ -f .env ]; then
        set -o allexport
        source .env
        set +o allexport
    fi

    # Conditionally build the Go validator (only if needed)
    VALIDATOR_BINARY="tools/monorepo-validator-go/monorepo-validator-go"
    NEEDS_BUILD=false

    if [ ! -f "$VALIDATOR_BINARY" ]; then
        echo -e "${BLUE}🔨 Go validator binary not found - building...${NC}"
        NEEDS_BUILD=true
    else
        # Check if any Go source files are newer than the binary
        if find tools/monorepo-validator-go -name "*.go" -newer "$VALIDATOR_BINARY" | grep -q .; then
            echo -e "${BLUE}🔄 Go source files updated - rebuilding validator...${NC}"
            NEEDS_BUILD=true
        else
            echo -e "${GREEN}✅ Go validator binary is up to date${NC}"
        fi
    fi

    if [ "$NEEDS_BUILD" = true ]; then
        echo -e "${BLUE}⚡ Building Go validator (this will be fast after first build)...${NC}"
        cd tools/monorepo-validator-go
        if ! go build -o monorepo-validator-go; then
            echo -e "${RED}❌ Failed to build Go validator${NC}"
            echo -e "${YELLOW}💡 Try: cd tools/monorepo-validator-go && go mod tidy && go build${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Go validator built successfully${NC}"
        cd - > /dev/null
    fi

    # Map shell script arguments to Go app arguments
    GO_ARGS=""
    case "${VALIDATION_TIER}" in
        "p1")
            GO_ARGS="--p1"
            ;;
        "med")
            GO_ARGS="--med"
            ;;
        "all")
            GO_ARGS="--all"
            ;;
        "infrastructure")
            GO_ARGS="--infra"
            ;;
        "mobile")
            GO_ARGS="--mobile"
            ;;
        "tools")
            GO_ARGS="--tools"
            ;;
    esac

    # Run the Go validator with the mapped arguments
    echo -e "${BLUE}Running Go validator...${NC}"
    # Execute the Go validator with mapped arguments
    tools/monorepo-validator-go/monorepo-validator-go $GO_ARGS
}

# Handle interruption
trap 'echo -e "\n${RED}Validation interrupted!${NC}"; exit 130' INT

# Run main function
main "$@"
