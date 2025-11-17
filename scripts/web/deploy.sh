#!/usr/bin/env bash

################################################################################
# RecipeArchive Flutter Web App Deployment
################################################################################
# PURPOSE: Build and deploy Flutter web app to CloudFront via S3
#   - Builds Flutter web app in release mode
#   - Uploads to S3 bucket
#   - Invalidates CloudFront cache
#   - Configures static website hosting
#   - Sets proper CORS and caching policies
#
# USAGE:
#   ./scripts/web/deploy.sh
#
# EXAMPLES:
#   ./scripts/web/deploy.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - AWS CLI
#
# ENVIRONMENT VARIABLES:
#   - CLOUDFRONT_DISTRIBUTION_ID
#   - S3_WEB_APP_BUCKET
#   - CLOUDFRONT_URL
#
# NOTES:
#   - Requires .env file configured
#   - Creates S3 bucket if it doesn't exist
#   - Automatic cache invalidation after deployment
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly APP_DIR="$REPO_ROOT/recipe_archive"

# Load environment variables
source "$SCRIPT_DIR/../load-env.sh" || die "Failed to load environment variables"

# Configuration from environment variables
readonly DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E1D19F7SLOJM5H}"
readonly S3_BUCKET="${S3_WEB_APP_BUCKET:-recipearchive-web-app-prod-990537043943}"
readonly CLOUDFRONT_URL="${CLOUDFRONT_URL:-https://d1jcaphz4458q7.cloudfront.net}"

log_header "Flutter Web App Deployment to CloudFront"

# Verify AWS credentials
log_section "Verifying AWS Credentials"
if ! aws sts get-caller-identity > /tmp/deploy-web-app.log 2>&1; then
    die "AWS credentials not configured or invalid. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env"
fi
log_success "AWS credentials verified"

# Check prerequisites
require_command "flutter" "brew install flutter"
require_command "aws" "brew install awscli"

# Check if S3 bucket exists
log_section "Checking S3 Bucket"
if ! aws s3 ls "s3://$S3_BUCKET" > /tmp/deploy-web-app.log 2>&1; then
    log_info "Creating S3 bucket: $S3_BUCKET"
    if ! aws s3 mb "s3://$S3_BUCKET" --region us-west-2 > /tmp/deploy-web-app.log 2>&1; then
        die "Failed to create S3 bucket. See /tmp/deploy-web-app.log"
    fi

    log_info "Configuring bucket for static website hosting..."
    if ! aws s3 website "s3://$S3_BUCKET" \
        --index-document index.html \
        --error-document index.html > /tmp/deploy-web-app.log 2>&1; then
        die "Failed to configure S3 bucket for static website hosting"
    fi
    log_success "S3 bucket created and configured"
else
    log_success "S3 bucket exists"
fi

# Build Flutter web app
log_section "Building Flutter Web App"
log_info "Building Flutter web app for production..."
cd "$APP_DIR"

# Use compatibility flags to avoid build issues
log_info "Building with compatibility flags..."
if ! flutter build web --release --no-tree-shake-icons --no-wasm-dry-run > /tmp/deploy-web-app.log 2>&1; then
    log_error "Flutter build failed. See /tmp/deploy-web-app.log for details."
    log_info "Try: flutter clean && flutter pub get"
    log_info "Then: flutter build web --release --no-tree-shake-icons"
    die "Deployment failed"
fi

log_success "Flutter web app built successfully"

# Build and package extensions with latest configurations
log_section "Building Browser Extensions"
log_info "Building and packaging browser extensions..."
cd "$REPO_ROOT"

# Build extensions with latest parser fixes and configurations
log_info "Building extensions with latest parsers..."
if ! npm run build:extensions > /tmp/deploy-web-app.log 2>&1; then
    log_error "Extension build failed. See /tmp/deploy-web-app.log for details."
    die "Deployment failed"
fi

# Package extensions with semantic versioning and upload to S3
log_info "Packaging extensions with semantic versioning..."
if ! ./scripts/extensions/package.sh > /tmp/deploy-web-app.log 2>&1; then
    log_error "Extension packaging failed. See /tmp/deploy-web-app.log for details."
    die "Deployment failed"
fi

log_success "Extensions built, packaged and uploaded successfully"

# Deploy to S3
log_section "Uploading to S3"
log_info "Uploading to S3..."
if ! aws s3 sync "$APP_DIR/build/web/" s3://$S3_BUCKET/ --delete > /tmp/deploy-web-app.log 2>&1; then
    log_warning "S3 upload encountered issues. Retrying with timeout adjustments..."
    if ! aws s3 sync "$APP_DIR/build/web/" s3://$S3_BUCKET/ --delete \
        --cli-read-timeout 0 --cli-connect-timeout 60 > /tmp/deploy-web-app.log 2>&1; then
        log_error "S3 upload failed. See /tmp/deploy-web-app.log for details."
        die "Deployment failed"
    fi
fi

log_success "Files uploaded to S3 successfully"

# Invalidate CloudFront cache
log_section "Invalidating CloudFront Cache"
log_info "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)

log_info "Invalidation ID: $INVALIDATION_ID"
log_info "Waiting for cache invalidation to complete..."

# Wait for invalidation to complete
aws cloudfront wait invalidation-completed \
    --distribution-id $DISTRIBUTION_ID \
    --id $INVALIDATION_ID

log_success "Cache invalidation completed"
# Get actual extension versions from manifest files
CHROME_VERSION=$(grep '"version":' "$REPO_ROOT/extensions/chrome/manifest.json" | sed 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/' || echo "unknown")
SAFARI_VERSION=$(grep '"version":' "$REPO_ROOT/extensions/safari/manifest.json" | sed 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/' || echo "unknown")

echo ""
log_success "🎉 Deployment successful!"
log_info "📍 Web app URL: $CLOUDFRONT_URL"
echo ""
log_info "Extension distribution features are now live:"
log_info "• Navigate to the hamburger menu → Browser Extensions"
log_info "• Download Chrome extension: Chrome v$CHROME_VERSION"
log_info "• Download Safari extension: Safari v$SAFARI_VERSION"
