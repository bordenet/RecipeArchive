#!/usr/bin/env bash

################################################################################
# RecipeArchive Quick Web Deployment
################################################################################
# PURPOSE: Deploy existing Flutter web build to S3 and invalidate CloudFront
#   - Skips build step for speed
#   - Syncs build/web to S3
#   - Invalidates CloudFront cache
#   - Ideal for rapid deployment iterations
#
# USAGE:
#   ./scripts/web/deploy-quick.sh
#
# EXAMPLES:
#   ./scripts/web/deploy-quick.sh
#
# DEPENDENCIES:
#   - AWS CLI (configured with appropriate permissions)
#   - Existing Flutter web build in recipe_archive/build/web
#
# NOTES:
#   - Run 'flutter build web' first if build doesn't exist
#   - Use deploy-simple.sh for full build+deploy workflow
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly BUILD_DIR="$REPO_ROOT/recipe_archive/build/web"
readonly S3_BUCKET="recipearchive-web-app-prod-990537043943"
readonly CLOUDFRONT_DISTRIBUTION_ID="E1D19F7SLOJM5H"

log_header "Quick Web Deployment"

# Validate build exists
require_directory "$BUILD_DIR" "No build found at $BUILD_DIR. Run 'flutter build web' first or use deploy-simple.sh"

# Validate AWS CLI
require_command "aws" "brew install awscli"

# Deploy to S3
log_section "Deploying to S3"
log_info "Syncing build to s3://${S3_BUCKET}/"

if ! aws s3 sync "$BUILD_DIR/" "s3://${S3_BUCKET}/" --delete; then
    die "S3 sync failed"
fi

log_success "Deployed to S3"

# Invalidate CloudFront
log_section "Invalidating CloudFront Cache"

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

if [[ -z "$INVALIDATION_ID" ]]; then
    die "CloudFront invalidation failed"
fi

log_success "CloudFront invalidated (ID: $INVALIDATION_ID)"
echo ""
log_info "Application URL: https://d1jcaphz4458q7.cloudfront.net"
