#!/usr/bin/env bash

################################################################################
# RecipeArchive Safari Extension Authentication Validation
################################################################################
# PURPOSE: Comprehensive authentication system testing and validation
#   - Verifies all required authentication files exist
#   - Validates manifest.json configuration
#   - Checks AWS Cognito configuration
#   - Validates security patterns (input validation, error handling)
#   - Verifies retry logic and resilience features
#   - Tests authentication flow completeness
#   - Validates UI integration
#   - Runs code quality and security scans
#   - Generates validation report
#
# USAGE:
#   ./scripts/validate-safari-auth.sh
#
# EXAMPLES:
#   ./scripts/validate-safari-auth.sh
#
# DEPENDENCIES:
#   - Node.js
#   - npm
#   - jq
#
# ENVIRONMENT VARIABLES:
#   Required in .env:
#   - COGNITO_USER_POOL_ID
#   - COGNITO_APP_CLIENT_ID
#   - AWS_REGION
#
# NOTES:
#   - Generates report in tools/reports/
#   - Creates logs at /tmp for troubleshooting
#   - Requires .env file configured
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

# Load environment variables
if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
fi

log_header "Safari Extension Authentication Validation"

# Check if we're in the correct directory
require_file "$REPO_ROOT/extensions/safari/manifest.json" "Please run this script from the RecipeArchive root directory"

cd "$REPO_ROOT" || die "Failed to change to repository root"

# 1. Verify all required files exist
log_info "Checking required authentication files..."

required_files=(
    "extensions/safari/popup.html"
    "extensions/safari/popup.js"
    "extensions/safari/auth.html"
    "extensions/safari/auth.js"
    "extensions/safari/cognito-auth.js"
    "extensions/safari/auth-enhanced.js"
    "extensions/safari/auth-dashboard.js"
    "extensions/safari/config.js"
    "extensions/safari/manifest.json"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        log_success "✓ $file"
    else
        log_error "✗ $file (missing)"
        missing_files+=("$file")
    fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
    log_error "Missing required files. Please ensure all files are present."
    die "Validation failed"
fi

# 2. Check manifest.json configuration
log_info "Validating manifest.json configuration..."

if grep -q "auth-enhanced.js" extensions/safari/manifest.json; then
    log_success "✓ Enhanced authentication scripts included in web_accessible_resources"
else
    log_warning "⚠ Enhanced authentication scripts may not be properly configured in manifest.json"
fi

if grep -q '"permissions".*"storage"' extensions/safari/manifest.json; then
    log_success "✓ Storage permission included"
else
    log_error "✗ Storage permission missing"
fi

# 3. Validate AWS Cognito configuration
log_info "Checking AWS Cognito configuration..."

if [ -z "$COGNITO_USER_POOL_ID" ] || [ -z "$COGNITO_APP_CLIENT_ID" ]; then
    log_error "Missing Cognito configuration in .env file. Please set COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID."
    die "Validation failed"
fi

if grep -q "$COGNITO_USER_POOL_ID" extensions/safari/config.js; then
    log_success "✓ Cognito User Pool ID configured"
else
    log_error "✗ Cognito User Pool ID not found in config.js"
fi

if grep -q "$COGNITO_APP_CLIENT_ID" extensions/safari/config.js; then
    log_success "✓ Cognito Client ID configured"
else
    log_error "✗ Cognito Client ID not found in config.js"
fi

if grep -q "$AWS_REGION" extensions/safari/config.js; then
    log_success "✓ AWS region configured"
else
    log_error "✗ AWS region not found in config.js"
fi

# 4. Check for security patterns
log_info "Validating security implementation..."

if grep -q "validateEmail\|validatePassword" extensions/safari/auth-enhanced.js; then
    log_success "✓ Input validation implemented"
else
    log_warning "⚠ Input validation may be missing"
fi

if grep -q "authErrorHandler\|AuthErrorHandler" extensions/safari/auth-enhanced.js; then
    log_success "✓ Error handling system implemented"
else
    log_warning "⚠ Enhanced error handling may be missing"
fi

if grep -q "authPerformanceMonitor" extensions/safari/auth-enhanced.js; then
    log_success "✓ Performance monitoring implemented"
else
    log_warning "⚠ Performance monitoring may be missing"
fi

# 5. Check for retry logic
log_info "Validating retry and resilience features..."

if grep -q "executeWithRetry\|_executeWithRetry" extensions/safari/cognito-auth.js; then
    log_success "✓ Retry logic implemented"
else
    log_warning "⚠ Retry logic may be missing"
fi

if grep -q "shouldRetry\|getRetryDelay" extensions/safari/auth-enhanced.js; then
    log_success "✓ Retry strategies implemented"
else
    log_warning "⚠ Retry strategies may be missing"
fi

# 6. Check authentication flow completeness
log_info "Validating authentication flow completeness..."

auth_methods=(
    "signIn"
    "signUp"
    "confirmSignUp"
    "signOut"
    "getCurrentUser"
    "getAccessToken"
    "getIdToken"
)

for method in "${auth_methods[@]}"; do
    if grep -q "$method" extensions/safari/cognito-auth.js; then
        log_success "✓ $method method implemented"
    else
        log_error "✗ $method method missing"
    fi
done

# 7. Check UI integration
log_info "Validating UI integration..."

ui_elements=(
    "authSection"
    "captureBtn"
    "authButton"
    "logoutButton"
    "userInfo"
    "message"
)

for element in "${ui_elements[@]}"; do
    if grep -q "$element" extensions/safari/popup.js; then
        log_success "✓ $element UI element handled"
    else
        log_warning "⚠ $element UI element may not be properly handled"
    fi
done

# 8. Run ESLint validation
log_info "Running code quality checks..."

if npm run lint > /tmp/validate-safari-auth.log 2>&1; then
    log_success "✓ Code passes linting checks"
else
    log_error "✗ Linting errors found. See /tmp/validate-safari-auth.log for details."
fi

# 9. Check for debugging features
log_info "Validating debugging and monitoring features..."

if grep -q "AuthDashboard" extensions/safari/auth-dashboard.js; then
    log_success "✓ Authentication dashboard implemented"
else
    log_warning "⚠ Authentication dashboard may be missing"
fi

if grep -q "getDiagnostics\|getAverageTime" extensions/safari/auth-enhanced.js; then
    log_success "✓ Diagnostic features implemented"
else
    log_warning "⚠ Diagnostic features may be missing"
fi

# 10. Environment variable validation
log_info "Checking environment variable configuration..."

if [[ -f ".env" ]]; then
    if grep -q "DEV_TEST_EMAIL" .env; then
        log_success "✓ Development test email configured"
    else
        log_warning "⚠ DEV_TEST_EMAIL not found in .env"
    fi
    
    if grep -q "DEV_TEST_PASSWORD" .env; then
        log_success "✓ Development test password configured"
    else
        log_warning "⚠ DEV_TEST_PASSWORD not found in .env"
    fi
else
    log_warning "⚠ .env file not found - create from .env.example for local development"
fi

# 11. Security scan
log_info "Running security scan..."

if npm run security:scan > /tmp/validate-safari-auth.log 2>&1; then
    log_success "✓ No secrets detected in codebase"
else
    log_error "✗ Security scan failed - check for exposed credentials. See /tmp/validate-safari-auth.log for details."
fi

# 12. Generate validation report
log_info "Generating validation report..."

# Ensure reports directory exists
mkdir -p tools/reports

report_file="tools/reports/safari-auth-validation-$(date +%Y%m%d-%H%M%S).txt"
{
    echo "Safari Extension Authentication Validation Report"
    echo "Generated: $(date)"
    echo "=============================================="
    echo ""
    echo "Files Checked: ${#required_files[@]}"
    echo "Missing Files: ${#missing_files[@]}"
    echo ""
    echo "Configuration Status:"
    echo "- Cognito User Pool: $(grep -q "$COGNITO_USER_POOL_ID" extensions/safari/config.js && echo "✓ Configured" || echo "✗ Missing")"
    echo "- Cognito Client ID: $(grep -q "$COGNITO_APP_CLIENT_ID" extensions/safari/config.js && echo "✓ Configured" || echo "✗ Missing")"
    echo "- AWS Region: $(grep -q "$AWS_REGION" extensions/safari/config.js && echo "✓ Configured" || echo "✗ Missing")"
    echo ""
    echo "Security Features:"
    echo "- Input Validation: $(grep -q "validateEmail" extensions/safari/auth-enhanced.js && echo "✓ Implemented" || echo "✗ Missing")"
    echo "- Error Handling: $(grep -q "AuthErrorHandler" extensions/safari/auth-enhanced.js && echo "✓ Implemented" || echo "✗ Missing")"
    echo "- Performance Monitoring: $(grep -q "authPerformanceMonitor" extensions/safari/auth-enhanced.js && echo "✓ Implemented" || echo "✗ Missing")"
    echo "- Retry Logic: $(grep -q "executeWithRetry" extensions/safari/cognito-auth.js && echo "✓ Implemented" || echo "✗ Missing")"
    echo ""
    echo "Authentication Methods:"
    for method in "${auth_methods[@]}"; do
        echo "- $method: $(grep -q "$method" extensions/safari/cognito-auth.js && echo "✓ Available" || echo "✗ Missing")"
    done
} > "$report_file"

log_success "Validation report saved to: $report_file"

# Final summary
echo ""
echo "=========================================="
echo "🎯 AUTHENTICATION SYSTEM VALIDATION COMPLETE"
echo "=========================================="

if [[ ${#missing_files[@]} -eq 0 ]]; then
    log_success "✅ All required files present"
else
    log_error "❌ ${#missing_files[@]} files missing"
fi

if npm run lint > /dev/null 2>&1; then
    log_success "✅ Code quality checks passed"
else
    log_error "❌ Code quality issues found"
fi

if npm run security:scan > /dev/null 2>&1; then
    log_success "✅ Security scan passed"
else
    log_error "❌ Security issues detected"
fi

echo ""
log_info "Next steps:"
echo "1. Load the Safari extension in Safari Developer menu"
echo "2. Test authentication flow with the configured Cognito user pool"
echo "3. Use Cmd+Shift+A to open the authentication dashboard for debugging"
echo "4. Monitor performance and error logs during testing"
echo ""
log_info "For detailed debugging, check the authentication dashboard (Cmd+Shift+A)"
log_info "Report saved to: $report_file"