#!/usr/bin/env bash

################################################################################
# RecipeArchive System Health Diagnostics
################################################################################
# PURPOSE: Component-level health validation for system
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
# EXAMPLES:
#   ./scripts/diagnose-health.sh
#   ./scripts/diagnose-health.sh --backend
#
# DEPENDENCIES:
#   - aws (AWS CLI)
#   - curl
#   - flutter (for mobile checks)
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

# Component flags
CHECK_WEB=true
CHECK_BACKEND=true
CHECK_MOBILE=false

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Check a single component
check_component() {
    local name="$1"
    local check_command="$2"
    local runbook_link="$3"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    printf "  %-38s " "$name"

    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${COLOR_GREEN}✓${COLOR_RESET}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${COLOR_RED}✗${COLOR_RESET}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        if [[ -n "$runbook_link" ]]; then
            echo -e "    ${COLOR_YELLOW}→ Runbook: $runbook_link${COLOR_RESET}"
        fi
        return 1
    fi
}

# Parse command line arguments
parse_arguments() {
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
            --help|-h)
                cat << EOF
Usage: $(basename "$0") [OPTIONS]

System health diagnostics for RecipeArchive components.

Options:
    --web        Check web application only
    --backend    Check backend services only
    --mobile     Check mobile build environment only
    -h, --help   Show this help message

Examples:
    $(basename "$0")              # Check all components
    $(basename "$0") --backend    # Check only backend services
EOF
                exit 0
                ;;
            *)
                die "Unknown option: $1 (use --help for usage)"
                ;;
        esac
    done
}

# Check web application health
check_web_health() {
    log_section "Web Application"

    check_component "CloudFront endpoint" \
        "curl -sf -o /dev/null https://d1jcaphz4458q7.cloudfront.net" \
        ""

    check_component "Initial load time < 5s" \
        "test \$(curl -s -o /dev/null -w '%{time_total}' https://d1jcaphz4458q7.cloudfront.net | cut -d. -f1) -lt 5" \
        ""
}

# Check backend services health
check_backend_health() {
    log_section "Backend Services"

    # Load environment variables
    if [[ -f "$REPO_ROOT/.env" ]]; then
        source "$REPO_ROOT/.env"
    fi

    # Check AWS CLI
    check_component "AWS CLI configured" \
        "aws sts get-caller-identity" \
        "docs/setup/aws-setup.md"

    # Check Lambda functions
    check_component "Lambda: recipes" \
        "aws lambda get-function --function-name recipes" \
        ""

    check_component "Lambda: background-normalizer" \
        "aws lambda get-function --function-name background-normalizer" \
        ""

    # Check S3 buckets
    if [[ -n "${S3_RECIPE_STORAGE_BUCKET:-}" ]]; then
        check_component "S3: Recipe storage" \
            "aws s3 ls s3://$S3_RECIPE_STORAGE_BUCKET" \
            ""
    fi

    # Check Cognito
    if [[ -n "${COGNITO_USER_POOL_ID:-}" ]]; then
        check_component "Cognito: User pool" \
            "aws cognito-idp describe-user-pool --user-pool-id $COGNITO_USER_POOL_ID" \
            ""
    fi

    # Check API Gateway
    check_component "API Gateway" \
        "aws apigateway get-rest-apis" \
        "docs/runbooks/api-gateway-issues.md"
}

# Check mobile build environment
check_mobile_health() {
    log_section "Mobile Build Environment"

    check_component "Flutter installed" \
        "command -v flutter" \
        "scripts/setup-macos.sh"

    check_component "Flutter version >= 3.10" \
        "flutter --version | grep -q 'Flutter 3\.[1-9][0-9]\\|Flutter [4-9]'" \
        ""

    check_component "Xcode installed" \
        "command -v xcodebuild" \
        "scripts/ios/setup.sh"

    check_component "Android SDK installed" \
        "test -d ~/Library/Android/sdk" \
        "scripts/android/setup.sh"

    check_component "iOS build script" \
        "test -x $REPO_ROOT/scripts/ios/build.sh" \
        ""

    check_component "Android build script" \
        "test -x $REPO_ROOT/scripts/android/build.sh" \
        ""
}

# Print final summary
print_summary() {
    log_header "Health Check Summary"

    echo -e "${COLOR_BLUE}Total Checks:${COLOR_RESET}   $TOTAL_CHECKS"
    echo -e "${COLOR_GREEN}Passed:${COLOR_RESET}        $PASSED_CHECKS"
    echo -e "${COLOR_RED}Failed:${COLOR_RESET}        $FAILED_CHECKS"
    echo ""

    if [[ $FAILED_CHECKS -eq 0 ]]; then
        log_success "All systems operational"
        return 0
    elif [[ $FAILED_CHECKS -lt 3 ]]; then
        log_warning "Some components degraded (see runbooks above)"
        return 1
    else
        log_error "Multiple failures detected - system unhealthy"
        log_info "Run with --help to check specific subsystems"
        return 2
    fi
}

# Main function
main() {
    log_header "RecipeArchive System Health Check"

    # Run appropriate health checks
    [[ "$CHECK_WEB" == true ]] && check_web_health
    [[ "$CHECK_BACKEND" == true ]] && check_backend_health
    [[ "$CHECK_MOBILE" == true ]] && check_mobile_health

    # Print summary and exit with appropriate code
    print_summary
    exit $?
}

# Run script
parse_arguments "$@"
main
