#!/usr/bin/env bash

################################################################################
# RecipeArchive System Health Diagnostics
################################################################################
# PURPOSE: Component-level health validation for production system
#   - Check all critical services (Web, Lambda, S3, Cognito, API Gateway)
#   - Provide actionable runbook links for failures
#   - Zero prior knowledge required to diagnose issues
#
# USAGE:
#   ./scripts/diagnose-health.sh              # Check all components
#   ./scripts/diagnose-health.sh --web        # Web app only
#   ./scripts/diagnose-health.sh --backend    # Backend services only
#   ./scripts/diagnose-health.sh --mobile     # Mobile build environment
#
# OUTPUT:
#   - Component status with pass/fail indicators
#   - Links to runbooks for failed components
#   - Overall system health summary
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Component flags
CHECK_WEB=true
CHECK_BACKEND=true
CHECK_MOBILE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --web)
            CHECK_BACKEND=false
            CHECK_MOBILE=false
            shift
            ;;
        --backend)
            CHECK_WEB=false
            CHECK_MOBILE=false
            shift
            ;;
        --mobile)
            CHECK_WEB=false
            CHECK_BACKEND=false
            CHECK_MOBILE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--web|--backend|--mobile]"
            echo ""
            echo "Options:"
            echo "  --web      Check web app only"
            echo "  --backend  Check backend services only"
            echo "  --mobile   Check mobile build environment"
            echo "  (no flags) Check all components"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  $1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

check_component() {
    local name="$1"
    local check_command="$2"
    local runbook_link="$3"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    printf "%-40s " "$name"

    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        if [ -n "$runbook_link" ]; then
            echo -e "  ${YELLOW}→ Runbook: $runbook_link${NC}"
        fi
        return 1
    fi
}

# Load environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

print_header "RecipeArchive System Health Check"

# Web App Health
if [ "$CHECK_WEB" = true ]; then
    echo -e "${BLUE}Web Application${NC}"
    check_component "Web App (CloudFront)" \
        "curl -sf -o /dev/null https://d1jcaphz4458q7.cloudfront.net" \
        ""

    check_component "Web App (initial load < 5s)" \
        "test \$(curl -s -o /dev/null -w '%{time_total}' https://d1jcaphz4458q7.cloudfront.net | cut -d. -f1) -lt 5" \
        ""
fi

# Backend Services Health
if [ "$CHECK_BACKEND" = true ]; then
    echo -e "\n${BLUE}Backend Services${NC}"

    # Check AWS CLI is configured
    check_component "AWS CLI configured" \
        "aws sts get-caller-identity" \
        "docs/setup/aws-setup.md"

    # Check Lambda functions exist
    check_component "Lambda: recipes function" \
        "aws lambda get-function --function-name recipes" \
        ""

    check_component "Lambda: background-normalizer function" \
        "aws lambda get-function --function-name background-normalizer" \
        ""

    # Check S3 buckets
    if [ -n "$S3_RECIPE_STORAGE_BUCKET" ]; then
        check_component "S3: Recipe storage bucket" \
            "aws s3 ls s3://$S3_RECIPE_STORAGE_BUCKET" \
            ""
    fi

    # Check Cognito
    if [ -n "$COGNITO_USER_POOL_ID" ]; then
        check_component "Cognito: User pool accessible" \
            "aws cognito-idp describe-user-pool --user-pool-id $COGNITO_USER_POOL_ID" \
            ""
    fi

    # Check API Gateway
    check_component "API Gateway: Accessible" \
        "aws apigateway get-rest-apis" \
        "docs/runbooks/api-gateway-issues.md"
fi

# Mobile Build Environment
if [ "$CHECK_MOBILE" = true ]; then
    echo -e "\n${BLUE}Mobile Build Environment${NC}"

    check_component "Flutter installed" \
        "which flutter" \
        "scripts/setup-macos.sh"

    check_component "Flutter version >= 3.10" \
        "flutter --version | grep -q 'Flutter 3\.[1-9][0-9]\\|Flutter [4-9]'" \
        ""

    check_component "Xcode installed (iOS)" \
        "which xcodebuild" \
        "scripts/ios/setup.sh"

    check_component "Android SDK installed" \
        "test -d ~/Library/Android/sdk" \
        "scripts/android/setup.sh"

    check_component "iOS build script executable" \
        "test -x scripts/ios/build.sh" \
        ""

    check_component "Android build script executable" \
        "test -x scripts/android/build.sh" \
        ""
fi

# Summary
print_header "Health Check Summary"

echo -e "${BLUE}Total Checks:${NC}   $TOTAL_CHECKS"
echo -e "${GREEN}Passed:${NC}        $PASSED_CHECKS"
echo -e "${RED}Failed:${NC}        $FAILED_CHECKS"

echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✓ All systems operational${NC}"
    exit 0
elif [ $FAILED_CHECKS -lt 3 ]; then
    echo -e "${YELLOW}⚠ Some components degraded (see runbooks above)${NC}"
    exit 1
else
    echo -e "${RED}✗ Multiple failures detected - system unhealthy${NC}"
    echo -e "${YELLOW}Run with --help to check specific subsystems${NC}"
    exit 2
fi
