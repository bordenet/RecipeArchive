#!/usr/bin/env bash

################################################################################
# RecipeArchive Extension Packaging Script
################################################################################
# PURPOSE: Create distribution packages for Chrome and Safari extensions
#   - Extracts versions from manifest.json files
#   - Validates semantic versioning
#   - Creates ZIP packages excluding dev files
#   - Generates version manifest JSON
#   - Optionally uploads to S3
#
# USAGE:
#   ./scripts/extensions/package.sh
#
# EXAMPLES:
#   ./scripts/extensions/package.sh
#
# DEPENDENCIES:
#   - zip
#   - aws-cli (optional, for S3 upload)
#
# ENVIRONMENT VARIABLES:
#   - S3_RECIPE_STORAGE_BUCKET: S3 bucket for extensions storage
#   - AWS_REGION: AWS region for S3 upload
#
# NOTES:
#   - Creates packages in dist/extensions/ directory
#   - Excludes node_modules, TypeScript sources, dev files
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Load environment variables
readonly REPO_ROOT="$(get_repo_root)"
if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
fi

# Script variables
readonly CHROME_DIR="$REPO_ROOT/extensions/chrome"
readonly SAFARI_DIR="$REPO_ROOT/extensions/safari"
readonly DIST_DIR="$REPO_ROOT/dist/extensions"
readonly EXTENSIONS_BUCKET="${S3_RECIPE_STORAGE_BUCKET:-$S3_WEB_APP_BUCKET}"
readonly AWS_REGION="${AWS_REGION:-us-west-2}"

log_header "Extension Packaging with Semantic Versioning"

# Function to extract version from manifest.json
get_version() {
    local manifest_path="$1"
    require_file "$manifest_path" "manifest.json not found at $manifest_path"
    grep '"version":' "$manifest_path" | sed 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/'
}

# Function to validate semantic version
validate_version() {
    local version="$1"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        die "Invalid semantic version format '$version'. Expected format: x.y.z"
    fi
}

# Create dist directory
log_section "Preparing Distribution Directory"
mkdir -p "$DIST_DIR"
log_success "Distribution directory ready: $DIST_DIR"

# Get versions from manifest files
log_section "Reading Extension Versions"

CHROME_VERSION=$(get_version "$CHROME_DIR/manifest.json")
SAFARI_VERSION=$(get_version "$SAFARI_DIR/manifest.json")

log_info "Detected versions:"
echo "  Chrome: v$CHROME_VERSION"
echo "  Safari: v$SAFARI_VERSION"

# Validate versions
validate_version "$CHROME_VERSION"
validate_version "$SAFARI_VERSION"
log_success "Version validation passed"

# Package Chrome Extension
log_section "Packaging Chrome Extension v$CHROME_VERSION"

cd "$CHROME_DIR" || die "Failed to change to Chrome directory"
CHROME_PACKAGE="RecipeArchive-Chrome-v$CHROME_VERSION.zip"

if ! zip -r "$DIST_DIR/$CHROME_PACKAGE" . \
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md" "*.backup" "*.ts" "eslint.config.cjs" \
    > /tmp/package-extensions.log 2>&1; then
    die "Failed to package Chrome extension. See /tmp/package-extensions.log for details."
fi

cd "$REPO_ROOT" || die "Failed to return to repo root"
log_success "Chrome extension packaged: $CHROME_PACKAGE"

# Package Safari Extension
log_section "Packaging Safari Extension v$SAFARI_VERSION"

cd "$SAFARI_DIR" || die "Failed to change to Safari directory"
SAFARI_PACKAGE="RecipeArchive-Safari-v$SAFARI_VERSION.zip"

if ! zip -r "$DIST_DIR/$SAFARI_PACKAGE" . \
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md" "*.backup" "*.ts" "eslint.config.cjs" \
    > /tmp/package-extensions.log 2>&1; then
    die "Failed to package Safari extension. See /tmp/package-extensions.log for details."
fi

cd "$REPO_ROOT" || die "Failed to return to repo root"
log_success "Safari extension packaged: $SAFARI_PACKAGE"

# Display package info
echo ""
log_info "Packaged extensions:"
ls -lh "$DIST_DIR/$CHROME_PACKAGE"
ls -lh "$DIST_DIR/$SAFARI_PACKAGE"

# Create version manifest
log_section "Creating Version Manifest"

cat > "$DIST_DIR/versions.json" << EOF
{
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "extensions": {
    "chrome": {
      "version": "$CHROME_VERSION",
      "filename": "$CHROME_PACKAGE",
      "size": $(stat -f%z "$DIST_DIR/$CHROME_PACKAGE" 2>/dev/null || stat -c%s "$DIST_DIR/$CHROME_PACKAGE"),
      "downloadUrl": "https://$EXTENSIONS_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$CHROME_PACKAGE"
    },
    "safari": {
      "version": "$SAFARI_VERSION",
      "filename": "$SAFARI_PACKAGE",
      "size": $(stat -f%z "$DIST_DIR/$SAFARI_PACKAGE" 2>/dev/null || stat -c%s "$DIST_DIR/$SAFARI_PACKAGE"),
      "downloadUrl": "https://$EXTENSIONS_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$SAFARI_PACKAGE"
    }
  }
}
EOF

log_success "Version manifest created: versions.json"

# Upload to S3 if available
if command -v aws &> /dev/null && [[ -n "$EXTENSIONS_BUCKET" ]]; then
    log_section "Uploading to S3"

    if ! aws s3 sync "$DIST_DIR/" "s3://$EXTENSIONS_BUCKET/extensions/" \
        --exclude "*" --include "*.zip" --include "versions.json" \
        > /tmp/package-extensions.log 2>&1; then
        die "Failed to upload extensions to S3. See /tmp/package-extensions.log for details."
    fi

    log_success "Extensions uploaded to S3"
    echo ""
    log_info "Download URLs:"
    echo "  Chrome: https://$EXTENSIONS_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$CHROME_PACKAGE"
    echo "  Safari: https://$EXTENSIONS_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$SAFARI_PACKAGE"
    echo "  Versions: https://$EXTENSIONS_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/versions.json"
else
    log_warning "AWS CLI not found or EXTENSIONS_BUCKET not set. Extensions packaged locally only."
    log_info "To upload to S3, install AWS CLI and set S3_RECIPE_STORAGE_BUCKET in .env file"
fi

# Distribution instructions
echo ""
log_section "Distribution Instructions"

echo ""
echo "Chrome Extension (v$CHROME_VERSION):"
echo "  - For testing: Extract ZIP and load unpacked in chrome://extensions/"
echo "  - For .crx: Use chrome://extensions/ > Pack Extension"
echo "  - For Web Store: Upload ZIP to Chrome Developer Dashboard"
echo ""
echo "Safari Extension (v$SAFARI_VERSION):"
echo "  - For testing: Enable 'Allow Unsigned Extensions' in Safari > Develop menu"
echo "  - For App Store: Upload ZIP to App Store Connect"
echo "  - For Developer ID: Sign with certificates and notarize"
echo ""
log_info "Files created:"
echo "  - dist/extensions/$CHROME_PACKAGE"
echo "  - dist/extensions/$SAFARI_PACKAGE"
echo "  - dist/extensions/versions.json"
