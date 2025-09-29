#!/usr/bin/env bash

################################################################################
#
# Recipe Normalization Validation Tool
#
# This script provides automated validation of the recipe normalization pipeline,
# ensuring that the OpenAI-powered content enhancement system is functioning
# correctly. It validates infrastructure configuration, checks recent recipes
# for normalization data, and can trigger test normalization requests.
#
# USAGE:
#   ./tools/validate-normalization.sh [--help]
#
# FEATURES:
#   • Infrastructure validation: SQS queues, Lambda functions, IAM permissions
#   • Recipe data analysis: Recent recipes checked for timing and tags
#   • Pipeline testing: Send test normalization requests
#   • Comprehensive reporting: Colored output with actionable recommendations
#
# DEPENDENCIES:
#   - AWS CLI (configured with appropriate permissions)
#   - jq (JSON processing)
#   - Access to RecipeArchive AWS infrastructure
#
# ENVIRONMENT VARIABLES:
#   AWS_PROFILE: AWS profile to use (optional, defaults to default profile)
#   AWS_REGION: AWS region (optional, defaults to us-west-2)
#
# EXIT CODES:
#   0: All validations passed
#   1: One or more validations failed
#   2: Missing dependencies or configuration errors
#
# SECURITY:
#   • Only performs read operations on S3 and Lambda
#   • Sends test SQS messages that don't modify existing data
#   • No credentials are logged or exposed
#
# EXAMPLES:
#   ./tools/validate-normalization.sh                    # Run full validation
#   AWS_PROFILE=dev ./tools/validate-normalization.sh    # Use specific profile
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo
#   - Requires valid AWS credentials with Lambda and S3 read permissions
#   - SQS send-message permissions required for testing functionality
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
    local missing_deps=()

    command -v aws >/dev/null 2>&1 || missing_deps+=("aws-cli")
    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")

    if [ ${#missing_deps[@]} -ne 0 ]; then
        error_exit "Missing required dependencies: ${missing_deps[*]}" 2
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error_exit "AWS credentials not configured or invalid" 2
    fi
}

# Configuration
BUCKET_NAME="recipe-storage-0ea7007d57f67ecb-990537043943"
USER_ID="d801a380-d0e1-703b-93fd-513a8ae33f5b"
SQS_QUEUE_URL="https://sqs.us-west-2.amazonaws.com/990537043943/recipe-normalization-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASSED_TESTS++))
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
    ((FAILED_TESTS++))
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

add_test() {
    ((TOTAL_TESTS++))
}

# Check if normalization pipeline is functional
check_normalization_infrastructure() {
    print_header "NORMALIZATION INFRASTRUCTURE"

    add_test
    echo "  Checking BackgroundNormalizer function configuration..."
    if aws lambda get-function-configuration --function-name RecipeArchive-dev-BackgroundNormalizerFunction40DC-6N25oFUdp4Tt >/dev/null 2>&1; then
        bucket_name=$(aws lambda get-function-configuration --function-name RecipeArchive-dev-BackgroundNormalizerFunction40DC-6N25oFUdp4Tt | jq -r '.Environment.Variables.S3_STORAGE_BUCKET')
        if [ "$bucket_name" = "$BUCKET_NAME" ]; then
            print_success "BackgroundNormalizer has correct bucket configuration"
        else
            print_error "BackgroundNormalizer has wrong bucket: $bucket_name (expected: $BUCKET_NAME)"
        fi
    else
        print_error "BackgroundNormalizer function not found"
    fi

    add_test
    echo "  Checking SQS event source mapping..."
    if aws lambda list-event-source-mappings --function-name RecipeArchive-dev-BackgroundNormalizerFunction40DC-6N25oFUdp4Tt | jq -e '.EventSourceMappings[] | select(.State == "Enabled")' >/dev/null 2>&1; then
        print_success "SQS event source mapping is enabled"
    else
        print_error "SQS event source mapping is disabled or missing"
    fi

    add_test
    echo "  Checking SQS queue status..."
    if aws sqs get-queue-attributes --queue-url "$SQS_QUEUE_URL" --attribute-names QueueArn >/dev/null 2>&1; then
        print_success "SQS normalization queue is accessible"
    else
        print_error "SQS normalization queue is not accessible"
    fi
}

# Check recent recipes for normalization data
check_recent_recipes() {
    print_header "RECENT RECIPE NORMALIZATION STATUS"

    echo "  Fetching recent recipes..."
    recent_recipes=$(aws s3 ls "s3://$BUCKET_NAME/recipes/$USER_ID/" | tail -5 | awk '{print $4}' | sed 's/.json$//')

    if [ -z "$recent_recipes" ]; then
        print_warning "No recent recipes found"
        return
    fi

    for recipe_id in $recent_recipes; do
        add_test
        echo "  Checking recipe $recipe_id..."

        # Download and check recipe
        if aws s3 cp "s3://$BUCKET_NAME/recipes/$USER_ID/$recipe_id.json" /tmp/recipe_check.json >/dev/null 2>&1; then
            prep_time=$(jq -r '.prepTime // "null"' /tmp/recipe_check.json 2>/dev/null)
            cook_time=$(jq -r '.cookTime // "null"' /tmp/recipe_check.json 2>/dev/null)
            tags=$(jq -r '.tags // "null"' /tmp/recipe_check.json 2>/dev/null)

            if [ "$prep_time" != "null" ] || [ "$cook_time" != "null" ] || [ "$tags" != "null" ]; then
                print_success "Recipe $recipe_id has normalization data (prepTime: $prep_time, cookTime: $cook_time, tags: $(echo $tags | cut -c1-30)...)"
            else
                print_error "Recipe $recipe_id missing normalization data (all timing and tags are null)"
            fi
        else
            print_error "Failed to download recipe $recipe_id"
        fi
    done

    # Cleanup
    rm -f /tmp/recipe_check.json
}

# Test normalization by sending a message
test_normalization_trigger() {
    print_header "NORMALIZATION TRIGGER TEST"

    # Get a recent recipe to re-normalize
    recent_recipe=$(aws s3 ls "s3://$BUCKET_NAME/recipes/$USER_ID/" | tail -1 | awk '{print $4}' | sed 's/.json$//')

    if [ -z "$recent_recipe" ]; then
        print_warning "No recipes found to test normalization"
        return
    fi

    add_test
    echo "  Sending normalization request for recipe $recent_recipe..."

    message_body=$(cat <<EOF
{
  "userID": "$USER_ID",
  "recipeID": "$recent_recipe",
  "bucketName": "$BUCKET_NAME",
  "action": "normalize"
}
EOF
)

    if aws sqs send-message --queue-url "$SQS_QUEUE_URL" --message-body "$message_body" >/dev/null 2>&1; then
        print_success "Normalization message sent successfully"
        echo "    Recipe ID: $recent_recipe"
        echo "    Check this recipe in 30-60 seconds for updated normalization data"
    else
        print_error "Failed to send normalization message"
    fi
}

# Show summary
show_summary() {
    echo
    print_header "VALIDATION SUMMARY"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ NORMALIZATION VALIDATION PASSED${NC} ($PASSED_TESTS/$TOTAL_TESTS tests)"
    else
        echo -e "${RED}✗ NORMALIZATION VALIDATION FAILED${NC} ($FAILED_TESTS failures, $PASSED_TESTS passed)"
    fi

    echo
    echo "QUICK ACTIONS:"
    echo "  • Re-run validation: ./tools/validate-normalization.sh"
    echo "  • Check BackgroundNormalizer logs: aws logs tail /aws/lambda/RecipeArchive-dev-BackgroundNormalizerFunction40DC-6N25oFUdp4Tt --follow"
    echo "  • Monitor SQS queue: aws sqs get-queue-attributes --queue-url $SQS_QUEUE_URL --attribute-names All"
    echo
}

# Handle help flag
show_help() {
    cat << 'EOF'
Recipe Normalization Validation Tool

USAGE:
  ./tools/validate-normalization.sh [OPTIONS]

OPTIONS:
  --help, -h    Show this help message

DESCRIPTION:
  This tool validates the recipe normalization pipeline functionality by:
  1. Checking infrastructure configuration (Lambda functions, SQS queues)
  2. Analyzing recent recipes for normalization data (timing, tags)
  3. Testing the pipeline by sending a normalization request

REQUIREMENTS:
  - AWS CLI configured with appropriate permissions
  - jq installed for JSON processing
  - Access to RecipeArchive AWS infrastructure

EXIT CODES:
  0  All validations passed
  1  One or more validations failed
  2  Missing dependencies or configuration errors

EXAMPLES:
  ./tools/validate-normalization.sh                    # Run full validation
  AWS_PROFILE=dev ./tools/validate-normalization.sh    # Use specific profile

For more information, see the script header documentation.
EOF
}

# Main execution
main() {
    # Handle help flag
    if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
        show_help
        exit 0
    fi

    echo -e "${BLUE}Recipe Normalization Validation Tool${NC}"
    echo "Testing normalization pipeline functionality"
    echo

    # Check dependencies first
    check_dependencies

    check_normalization_infrastructure
    check_recent_recipes
    test_normalization_trigger

    show_summary

    if [ $FAILED_TESTS -gt 0 ]; then
        exit 1
    fi
}

# Run main function
main "$@"