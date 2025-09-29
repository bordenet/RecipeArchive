#!/bin/bash

################################################################################
#
# RecipeArchive Extension Packaging Script
#
# This script creates distribution packages for both Chrome and Safari extensions
# with semantic versioning.
#
# USAGE:
#   ./package-extensions.sh
#
# DEPENDENCIES:
#   - zip
#   - aws-cli (optional)
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#   - It requires the .env file to be present in the root of the repository if
#     you want to upload the packages to S3.
#
################################################################################

# RecipeArchive Extension Packaging Script
# Creates distribution packages for both Chrome and Safari extensions with semantic versioning

set -e

# Load environment variables from repo root
if [ -f "./.env" ]; then
    export $(cat ./.env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Function to extract version from manifest.json
get_version() {
    local manifest_path="$1"
    if [[ ! -f "$manifest_path" ]]; then
        echo "Error: manifest.json not found at $manifest_path" >&2
        exit 1
    fi
    grep '"version":' "$manifest_path" | sed 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/'
}

# Function to validate semantic version
validate_version() {
    local version="$1"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Error: Invalid semantic version format '$version'. Expected format: x.y.z" >&2
        exit 1
    fi
}

echo "📦 Packaging RecipeArchive Extensions with Semantic Versioning..."

# Create dist directory structure
mkdir -p dist/extensions

# Get versions from manifest files
CHROME_VERSION=$(get_version "extensions/chrome/manifest.json")
SAFARI_VERSION=$(get_version "extensions/safari/manifest.json")

echo "📋 Detected versions:"
echo "  Chrome: v$CHROME_VERSION"
echo "  Safari: v$SAFARI_VERSION"

# Validate versions
validate_version "$CHROME_VERSION"
validate_version "$SAFARI_VERSION"

# Package Chrome Extension
echo "🔧 Packaging Chrome extension v$CHROME_VERSION..."
cd extensions/chrome
CHROME_PACKAGE="RecipeArchive-Chrome-v$CHROME_VERSION.zip"
if ! zip -r "../../dist/extensions/$CHROME_PACKAGE" .
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md" "*.backup" "*.ts" "eslint.config.cjs" > /tmp/package-extensions.log 2>&1; then
    echo "❌ Failed to package Chrome extension. See /tmp/package-extensions.log for details."
    exit 1
fi
cd ../..

# Package Safari Extension  
echo "🍎 Packaging Safari extension v$SAFARI_VERSION..."
cd extensions/safari
SAFARI_PACKAGE="RecipeArchive-Safari-v$SAFARI_VERSION.zip"
if ! zip -r "../../dist/extensions/$SAFARI_PACKAGE" .
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md" "*.backup" "*.ts" "eslint.config.cjs" > /tmp/package-extensions.log 2>&1; then
    echo "❌ Failed to package Safari extension. See /tmp/package-extensions.log for details."
    exit 1
fi
cd ../..

echo "✅ Extensions packaged in dist/extensions/ folder:"
ls -la "dist/extensions/RecipeArchive-Chrome-v$CHROME_VERSION.zip"
ls -la "dist/extensions/RecipeArchive-Safari-v$SAFARI_VERSION.zip"

# Create version manifest for web app consumption
echo "📝 Creating version manifest..."
cat > "dist/extensions/versions.json" << EOF
{
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "extensions": {
    "chrome": {
      "version": "$CHROME_VERSION",
      "filename": "$CHROME_PACKAGE",
      "size": $(ls -la "dist/extensions/$CHROME_PACKAGE" | awk '{print $5}'),
      "downloadUrl": "https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$CHROME_PACKAGE"
    },
    "safari": {
      "version": "$SAFARI_VERSION", 
      "filename": "$SAFARI_PACKAGE",
      "size": $(ls -la "dist/extensions/$SAFARI_PACKAGE" | awk '{print $5}'),
      "downloadUrl": "https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$SAFARI_PACKAGE"
    }
  }
}
EOF

# Upload to S3 (if AWS CLI is available and configured)
if command -v aws &> /dev/null && [ -n "$S3_BUCKET" ]; then
    echo "☁️  Uploading extensions to S3..."
    if ! aws s3 sync dist/extensions/ s3://$S3_BUCKET/extensions/
        --exclude "*" --include "*.zip" --include "versions.json" > /tmp/package-extensions.log 2>&1; then
        echo "❌ Failed to upload extensions to S3. See /tmp/package-extensions.log for details."
        exit 1
    fi
    
    echo "✅ Extensions uploaded to S3 successfully!"
    echo "📍 Chrome: https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$CHROME_PACKAGE"
    echo "📍 Safari: https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/$SAFARI_PACKAGE"
    echo "📍 Versions: https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com/extensions/versions.json"
else
    echo "⚠️  AWS CLI not found or S3_BUCKET not set. Extensions packaged locally only."
    echo "💡 To upload to S3, install AWS CLI, set S3_BUCKET in your .env file and run again."
fi

echo ""
echo "📋 Distribution Instructions:"
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
echo "📦 Files created:"
echo "  - dist/extensions/$CHROME_PACKAGE"
echo "  - dist/extensions/$SAFARI_PACKAGE" 
echo "  - dist/extensions/versions.json"
