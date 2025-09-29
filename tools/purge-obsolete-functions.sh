#!/usr/bin/env bash

################################################################################
#
# Lambda Function Cleanup Tool
#
# This script provides automated identification and removal of obsolete Lambda
# functions to prevent issues with stray binaries, outdated configurations,
# and resource conflicts. It maintains a whitelist of current active functions
# and flags any others as candidates for cleanup.
#
# USAGE:
#   ./tools/purge-obsolete-functions.sh [OPTIONS]
#
# OPTIONS:
#   --purge, -p   Automatically delete identified obsolete functions
#   --help, -h    Show help message
#
# FEATURES:
#   • Active function detection: Identifies current infrastructure functions
#   • Obsolete function analysis: Shows details of outdated functions
#   • Safe deletion: Confirmation prompts and detailed reporting
#   • Comprehensive logging: Colored output with clear status indicators
#
# DEPENDENCIES:
#   - AWS CLI (configured with appropriate permissions)
#   - Access to RecipeArchive AWS Lambda infrastructure
#
# ENVIRONMENT VARIABLES:
#   AWS_PROFILE: AWS profile to use (optional, defaults to default profile)
#   AWS_REGION: AWS region (optional, defaults to us-west-2)
#
# EXIT CODES:
#   0: All functions are current (no obsolete functions found)
#   1: Obsolete functions found (and not purged)
#   2: Missing dependencies or configuration errors
#
# SECURITY:
#   • Performs read-only operations by default
#   • Requires explicit --purge flag for destructive operations
#   • Shows detailed function information before deletion
#   • Confirmation prompts for safety
#
# EXAMPLES:
#   ./tools/purge-obsolete-functions.sh              # Scan only
#   ./tools/purge-obsolete-functions.sh --purge      # Scan and delete
#   AWS_PROFILE=dev ./tools/purge-obsolete-functions.sh  # Use specific profile
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo
#   - Requires AWS Lambda admin permissions for deletion operations
#   - Functions are identified as obsolete based on naming patterns
#   - Always review the list before confirming deletion
#
################################################################################

set -e          # Exit immediately on any error
set -o pipefail # Exit on pipe failure
set -o nounset  # Exit on undefined variables

# Error handling function
error_exit() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    exit "${2:-1}"
}

# Dependency check function
check_dependencies() {
    # Check for AWS CLI
    if ! command -v aws >/dev/null 2>&1; then
        error_exit "AWS CLI not found. Please install and configure AWS CLI." 2
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error_exit "AWS credentials not configured or invalid" 2
    fi

    # Check Lambda permissions
    if ! aws lambda list-functions --max-items 1 >/dev/null 2>&1; then
        error_exit "Insufficient permissions to list Lambda functions" 2
    fi
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

# Current active functions (based on CDK infrastructure)
declare -A ACTIVE_FUNCTIONS
ACTIVE_FUNCTIONS["RecipesFunction"]="Recipe CRUD operations"
ACTIVE_FUNCTIONS["BackgroundNormalizerFunction"]="SQS-triggered recipe normalization"
ACTIVE_FUNCTIONS["ContentNormalizerFunction"]="HTTP API recipe normalization"
ACTIVE_FUNCTIONS["ImageUploadFunction"]="Image upload handling"
ACTIVE_FUNCTIONS["HealthFunction"]="Health check endpoint"
ACTIVE_FUNCTIONS["DiagnosticsFunctionF"]="Error diagnostics endpoint"
ACTIVE_FUNCTIONS["DiagnosticProcessorFunction"]="Diagnostic data processing"
ACTIVE_FUNCTIONS["InvitationManagerFunction"]="User invitation management"
ACTIVE_FUNCTIONS["RegistrationHandlerFunction"]="User registration handling"
ACTIVE_FUNCTIONS["RecipeAnalyticsAggregator"]="Analytics aggregation"

# Find obsolete functions
find_obsolete_functions() {
    print_header "SCANNING FOR OBSOLETE LAMBDA FUNCTIONS"

    echo "  Fetching all Lambda functions..."
    all_functions=$(aws lambda list-functions --query 'Functions[].FunctionName' --output text)

    obsolete_functions=()
    active_count=0

    for function_name in $all_functions; do
        is_active=false

        # Check if function matches any active function pattern
        for active_pattern in "${!ACTIVE_FUNCTIONS[@]}"; do
            if [[ "$function_name" == *"$active_pattern"* ]]; then
                is_active=true
                print_success "Active: $function_name (${ACTIVE_FUNCTIONS[$active_pattern]})"
                ((active_count++))
                break
            fi
        done

        if [ "$is_active" = false ]; then
            obsolete_functions+=("$function_name")
            print_warning "Obsolete: $function_name"
        fi
    done

    echo
    echo "  Summary: $active_count active functions, ${#obsolete_functions[@]} obsolete functions found"

    if [ ${#obsolete_functions[@]} -eq 0 ]; then
        echo -e "${GREEN}✓ No obsolete functions found${NC}"
        return 0
    fi

    return 1
}

# Show obsolete function details
show_obsolete_details() {
    if [ ${#obsolete_functions[@]} -eq 0 ]; then
        return
    fi

    print_header "OBSOLETE FUNCTION DETAILS"

    for func in "${obsolete_functions[@]}"; do
        echo "  Checking $func..."

        # Get function details
        last_modified=$(aws lambda get-function-configuration --function-name "$func" --query 'LastModified' --output text 2>/dev/null || echo "Unknown")
        runtime=$(aws lambda get-function-configuration --function-name "$func" --query 'Runtime' --output text 2>/dev/null || echo "Unknown")

        echo "    Last Modified: $last_modified"
        echo "    Runtime: $runtime"
        echo
    done
}

# Purge obsolete functions
purge_obsolete_functions() {
    if [ ${#obsolete_functions[@]} -eq 0 ]; then
        return
    fi

    print_header "PURGING OBSOLETE FUNCTIONS"

    echo -e "${YELLOW}⚠ WARNING: This will permanently delete ${#obsolete_functions[@]} Lambda functions${NC}"
    echo "Obsolete functions to be deleted:"
    for func in "${obsolete_functions[@]}"; do
        echo "  - $func"
    done
    echo

    read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Purge cancelled."
        return
    fi

    for func in "${obsolete_functions[@]}"; do
        echo "  Deleting $func..."
        if aws lambda delete-function --function-name "$func" 2>/dev/null; then
            print_success "Deleted $func"
        else
            print_error "Failed to delete $func"
        fi
    done
}

# Show summary
show_summary() {
    print_header "CLEANUP SUMMARY"

    if [ ${#obsolete_functions[@]} -eq 0 ]; then
        echo -e "${GREEN}✓ LAMBDA CLEANUP COMPLETE${NC}"
        echo "  All functions are current and active"
    else
        echo -e "${YELLOW}⚠ OBSOLETE FUNCTIONS FOUND${NC}"
        echo "  Run with --purge flag to delete obsolete functions"
        echo "  Or delete manually using: aws lambda delete-function --function-name FUNCTION_NAME"
    fi

    echo
    echo "MONITORING:"
    echo "  • List all functions: aws lambda list-functions"
    echo "  • Function details: aws lambda get-function-configuration --function-name FUNCTION_NAME"
    echo "  • Re-run cleanup: ./tools/purge-obsolete-functions.sh"
}

# Handle help flag
show_help() {
    cat << 'EOF'
Lambda Function Cleanup Tool

USAGE:
  ./tools/purge-obsolete-functions.sh [OPTIONS]

OPTIONS:
  --purge, -p   Delete identified obsolete functions after confirmation
  --help, -h    Show this help message

DESCRIPTION:
  This tool identifies Lambda functions that are not part of the current
  active infrastructure and optionally deletes them to prevent conflicts
  with stray binaries and outdated configurations.

ACTIVE FUNCTION PATTERNS:
  - RecipesFunction: Recipe CRUD operations
  - BackgroundNormalizerFunction: SQS-triggered recipe normalization
  - ContentNormalizerFunction: HTTP API recipe normalization
  - ImageUploadFunction: Image upload handling
  - HealthFunction: Health check endpoint
  - DiagnosticsFunctionF: Error diagnostics endpoint
  - DiagnosticProcessorFunction: Diagnostic data processing
  - InvitationManagerFunction: User invitation management
  - RegistrationHandlerFunction: User registration handling
  - RecipeAnalyticsAggregator: Analytics aggregation

SAFETY:
  - Functions are identified as obsolete based on naming patterns
  - Detailed function information shown before deletion
  - Confirmation prompts required for deletion
  - No functions deleted without explicit --purge flag

EXAMPLES:
  ./tools/purge-obsolete-functions.sh              # Scan only
  ./tools/purge-obsolete-functions.sh --purge      # Scan and delete
  AWS_PROFILE=dev ./tools/purge-obsolete-functions.sh  # Use specific profile

For more information, see the script header documentation.
EOF
}

# Main execution
main() {
    local purge_flag=false

    # Parse command line arguments
    for arg in "$@"; do
        case $arg in
            --help|-h)
                show_help
                exit 0
                ;;
            --purge|-p)
                purge_flag=true
                ;;
            *)
                error_exit "Unknown option: $arg. Use --help for usage information."
                ;;
        esac
    done

    echo -e "${BLUE}Lambda Function Cleanup Tool${NC}"
    echo "Identifying and managing obsolete Lambda functions"
    echo

    # Check dependencies first
    check_dependencies

    if find_obsolete_functions; then
        # No obsolete functions found
        show_summary
        exit 0
    fi

    show_obsolete_details

    # Check for purge flag
    if [ "$purge_flag" = true ]; then
        purge_obsolete_functions
    fi

    show_summary

    if [ ${#obsolete_functions[@]} -gt 0 ] && [ "$purge_flag" = false ]; then
        echo -e "${YELLOW}Run with --purge flag to delete obsolete functions${NC}"
        exit 1
    fi
}

# Run main function
main "$@"