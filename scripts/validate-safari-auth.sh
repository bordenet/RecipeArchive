#!/bin/bash

################################################################################
#
# Safari Extension AWS Cognito Authentication Validation Script
#
# This script provides comprehensive testing and validation of the enhanced
# authentication system for the Safari extension.
#
# USAGE:
#   ./validate-safari-auth.sh
#
# DEPENDENCIES:
#   - Node.js
#   - npm
#   - jq
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires the .env file to be present in the root of the repository.
#
################################################################################

# Safari Extension AWS Cognito Authentication Validation Script
# Comprehensive testing and validation of the enhanced authentication system

set -e

# Load environment variables from repo root
if [ -f "./.env" ]; then
    export $(cat ./.env | grep -v '^#' | grep -v '^$' | xargs)
fi

echo "🔐 Safari Extension Authentication Validation"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [[ ! -f "extensions/safari/manifest.json" ]]; then
    print_error "Please run this script from the RecipeArchive root directory"
    exit 1
fi

print_status "Validating Safari extension authentication system..."

# 1. Verify all required files exist
print_status "Checking required authentication files..."

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
        print_success "✓ $file"
    else
        print_error "✗ $file (missing)"
        missing_files+=("$file")
    fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
    print_error "Missing required files. Please ensure all files are present."
    exit 1
fi

# 2. Check manifest.json configuration
print_status "Validating manifest.json configuration..."

if grep -q "auth-enhanced.js" extensions/safari/manifest.json; then
    print_success "✓ Enhanced authentication scripts included in web_accessible_resources"
else
    print_warning "⚠ Enhanced authentication scripts may not be properly configured in manifest.json"
fi

if grep -q '"permissions".*"storage"' extensions/safari/manifest.json; then
    print_success "✓ Storage permission included"
else
    print_error "✗ Storage permission missing"
fi

# 3. Validate AWS Cognito configuration
print_status "Checking AWS Cognito configuration..."

if [ -z "$COGNITO_USER_POOL_ID" ] || [ -z "$COGNITO_APP_CLIENT_ID" ]; then
    print_error "Missing Cognito configuration in .env file. Please set COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID."
    exit 1
fi

if grep -q "$COGNITO_USER_POOL_ID" extensions/safari/config.js; then
    print_success "✓ Cognito User Pool ID configured"
else
    print_error "✗ Cognito User Pool ID not found in config.js"
fi

if grep -q "$COGNITO_APP_CLIENT_ID" extensions/safari/config.js; then
    print_success "✓ Cognito Client ID configured"
else
    print_error "✗ Cognito Client ID not found in config.js"
fi

if grep -q "$AWS_REGION" extensions/safari/config.js; then
    print_success "✓ AWS region configured"
else
    print_error "✗ AWS region not found in config.js"
fi

# 4. Check for security patterns
print_status "Validating security implementation..."

if grep -q "validateEmail\|validatePassword" extensions/safari/auth-enhanced.js; then
    print_success "✓ Input validation implemented"
else
    print_warning "⚠ Input validation may be missing"
fi

if grep -q "authErrorHandler\|AuthErrorHandler" extensions/safari/auth-enhanced.js; then
    print_success "✓ Error handling system implemented"
else
    print_warning "⚠ Enhanced error handling may be missing"
fi

if grep -q "authPerformanceMonitor" extensions/safari/auth-enhanced.js; then
    print_success "✓ Performance monitoring implemented"
else
    print_warning "⚠ Performance monitoring may be missing"
fi

# 5. Check for retry logic
print_status "Validating retry and resilience features..."

if grep -q "executeWithRetry\|_executeWithRetry" extensions/safari/cognito-auth.js; then
    print_success "✓ Retry logic implemented"
else
    print_warning "⚠ Retry logic may be missing"
fi

if grep -q "shouldRetry\|getRetryDelay" extensions/safari/auth-enhanced.js; then
    print_success "✓ Retry strategies implemented"
else
    print_warning "⚠ Retry strategies may be missing"
fi

# 6. Check authentication flow completeness
print_status "Validating authentication flow completeness..."

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
        print_success "✓ $method method implemented"
    else
        print_error "✗ $method method missing"
    fi
done

# 7. Check UI integration
print_status "Validating UI integration..."

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
        print_success "✓ $element UI element handled"
    else
        print_warning "⚠ $element UI element may not be properly handled"
    fi
done

# 8. Run ESLint validation
print_status "Running code quality checks..."

if npm run lint > /tmp/validate-safari-auth.log 2>&1; then
    print_success "✓ Code passes linting checks"
else
    print_error "✗ Linting errors found. See /tmp/validate-safari-auth.log for details."
fi

# 9. Check for debugging features
print_status "Validating debugging and monitoring features..."

if grep -q "AuthDashboard" extensions/safari/auth-dashboard.js; then
    print_success "✓ Authentication dashboard implemented"
else
    print_warning "⚠ Authentication dashboard may be missing"
fi

if grep -q "getDiagnostics\|getAverageTime" extensions/safari/auth-enhanced.js; then
    print_success "✓ Diagnostic features implemented"
else
    print_warning "⚠ Diagnostic features may be missing"
fi

# 10. Environment variable validation
print_status "Checking environment variable configuration..."

if [[ -f ".env" ]]; then
    if grep -q "DEV_TEST_EMAIL" .env; then
        print_success "✓ Development test email configured"
    else
        print_warning "⚠ DEV_TEST_EMAIL not found in .env"
    fi
    
    if grep -q "DEV_TEST_PASSWORD" .env; then
        print_success "✓ Development test password configured"
    else
        print_warning "⚠ DEV_TEST_PASSWORD not found in .env"
    fi
else
    print_warning "⚠ .env file not found - create from .env.example for local development"
fi

# 11. Security scan
print_status "Running security scan..."

if npm run security:scan > /tmp/validate-safari-auth.log 2>&1; then
    print_success "✓ No secrets detected in codebase"
else
    print_error "✗ Security scan failed - check for exposed credentials. See /tmp/validate-safari-auth.log for details."
fi

# 12. Generate validation report
print_status "Generating validation report..."

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

print_success "Validation report saved to: $report_file"

# Final summary
echo ""
echo "=========================================="
echo "🎯 AUTHENTICATION SYSTEM VALIDATION COMPLETE"
echo "=========================================="

if [[ ${#missing_files[@]} -eq 0 ]]; then
    print_success "✅ All required files present"
else
    print_error "❌ ${#missing_files[@]} files missing"
fi

if npm run lint > /dev/null 2>&1; then
    print_success "✅ Code quality checks passed"
else
    print_error "❌ Code quality issues found"
fi

if npm run security:scan > /dev/null 2>&1; then
    print_success "✅ Security scan passed"
else
    print_error "❌ Security issues detected"
fi

echo ""
print_status "Next steps:"
echo "1. Load the Safari extension in Safari Developer menu"
echo "2. Test authentication flow with the configured Cognito user pool"
echo "3. Use Cmd+Shift+A to open the authentication dashboard for debugging"
echo "4. Monitor performance and error logs during testing"
echo ""
print_status "For detailed debugging, check the authentication dashboard (Cmd+Shift+A)"
print_status "Report saved to: $report_file"