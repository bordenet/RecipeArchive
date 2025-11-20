#!/usr/bin/env bash

################################################################################
# RecipeArchive Simple Web Deployment
################################################################################
# PURPOSE: Full build and deploy workflow for Flutter web app
#   - Cleans previous build
#   - Builds Flutter web in release mode
#   - Deploys to S3 with caching headers
#   - Creates CloudFront invalidation
#   - Waits for invalidation to complete
#
# USAGE:
#   ./scripts/web/deploy-simple.sh
#
# EXAMPLES:
#   ./scripts/web/deploy-simple.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - AWS CLI (configured with permissions)
#   - jq (for JSON parsing)
#
# NOTES:
#   - For faster deploys without rebuild, use deploy-quick.sh
#   - Hard refresh browser (Cmd+Shift+R) to see changes
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Load environment variables
load_env_file

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"
readonly S3_BUCKET="${S3_WEB_APP_BUCKET:-recipearchive-web-app-prod-990537043943}"
readonly CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E1D19F7SLOJM5H}"
readonly CLOUDFRONT_URL="${CLOUDFRONT_URL:-https://your-cloudfront-distribution.cloudfront.net}"

# Parse arguments
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    cat << EOF
Usage: $(basename "$0")

Simple web deployment - full build and deploy workflow

Description:
    Cleans previous build, builds Flutter web in release mode, deploys to S3
    with caching headers, creates CloudFront invalidation, and waits for completion.

Prerequisites:
    - Flutter SDK installed
    - AWS CLI configured with permissions
    - jq installed (brew install jq)

Examples:
    $(basename "$0")

Notes:
    - For faster deploys without rebuild, use deploy-quick.sh
    - Hard refresh browser (Cmd+Shift+R) to see changes after deployment
EOF
    exit 0
fi

log_header "Flutter Web Deployment"

# Validate dependencies
require_command "flutter" "brew install flutter"
require_command "aws" "brew install awscli"
require_command "jq" "brew install jq"

# Check AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    die "AWS CLI not configured. Please run 'aws configure' first."
fi

# Navigate to Flutter directory
cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

# Clean previous build
log_section "Cleaning Previous Build"
if [[ -d "build/web" ]]; then
    rm -rf build/web
    log_success "Removed previous build"
fi

# Build Flutter web app
log_section "Building Flutter Web App"
if ! flutter build web --release; then
    die "Flutter build failed"
fi
log_success "Flutter build completed"

# Deploy to S3
log_section "Deploying to S3"
log_info "Bucket: s3://${S3_BUCKET}/"

if ! aws s3 sync build/web/ "s3://${S3_BUCKET}/" --delete --cache-control "public, max-age=86400"; then
    die "S3 deployment failed"
fi
log_success "S3 deployment completed"

# Create CloudFront invalidation
log_section "Creating CloudFront Invalidation"

INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --output json)

if [[ $? -ne 0 ]]; then
    die "CloudFront invalidation failed"
fi

INVALIDATION_ID=$(echo "$INVALIDATION_OUTPUT" | jq -r '.Invalidation.Id')
log_success "CloudFront invalidation created: $INVALIDATION_ID"

# Wait for invalidation to complete
log_section "Waiting for Invalidation"

while true; do
    STATUS=$(aws cloudfront get-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --id "$INVALIDATION_ID" \
        --query 'Invalidation.Status' \
        --output text)

    if [[ "$STATUS" == "Completed" ]]; then
        log_success "CloudFront invalidation completed"
        break
    elif [[ "$STATUS" == "InProgress" ]]; then
        log_debug "Invalidation in progress... waiting 10 seconds"
        sleep 10
    else
        log_warning "Unexpected invalidation status: $STATUS"
        break
    fi
done

# Deployment summary
echo ""
log_success "DEPLOYMENT SUCCESSFUL!"
echo "======================================"
log_info "App URL: $CLOUDFRONT_URL"
log_info "S3 Bucket: $S3_BUCKET"
log_info "CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
log_info "Invalidation ID: $INVALIDATION_ID"
echo ""
log_warning "Changes may take 1-2 minutes to propagate globally"
log_warning "Hard refresh your browser (Cmd+Shift+R / Ctrl+Shift+F5) to see changes"
