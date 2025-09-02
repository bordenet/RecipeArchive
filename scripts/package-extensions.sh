#!/bin/bash

# RecipeArchive Extension Packaging Script
# Creates distribution packages for both Chrome and Safari extensions with semantic versioning

set -e

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
zip -r "../../dist/extensions/$CHROME_PACKAGE" . \
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md" "*.backup" "*.ts" "eslint.config.cjs"
cd ../..

# Package Safari Extension  
echo "🍎 Packaging Safari extension v$SAFARI_VERSION..."
cd extensions/safari
SAFARI_PACKAGE="RecipeArchive-Safari-v$SAFARI_VERSION.zip"
zip -r "../../dist/extensions/$SAFARI_PACKAGE" . \
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md" "*.backup" "*.ts" "eslint.config.cjs"
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
      "size": $(stat -f%z "dist/extensions/$CHROME_PACKAGE"),
      "downloadUrl": "https://recipearchive-storage-dev-990537043943.s3.us-west-2.amazonaws.com/extensions/$CHROME_PACKAGE"
    },
    "safari": {
      "version": "$SAFARI_VERSION", 
      "filename": "$SAFARI_PACKAGE",
      "size": $(stat -f%z "dist/extensions/$SAFARI_PACKAGE"),
      "downloadUrl": "https://recipearchive-storage-dev-990537043943.s3.us-west-2.amazonaws.com/extensions/$SAFARI_PACKAGE"
    }
  }
}
EOF

# Upload to S3 (if AWS CLI is available and configured)
if command -v aws &> /dev/null; then
    echo "☁️  Uploading extensions to S3..."
    aws s3 sync dist/extensions/ s3://recipearchive-storage-dev-990537043943/extensions/ \
        --exclude "*" --include "*.zip" --include "versions.json"
    
    echo "✅ Extensions uploaded to S3 successfully!"
    echo "📍 Chrome: https://recipearchive-storage-dev-990537043943.s3.us-west-2.amazonaws.com/extensions/$CHROME_PACKAGE"
    echo "📍 Safari: https://recipearchive-storage-dev-990537043943.s3.us-west-2.amazonaws.com/extensions/$SAFARI_PACKAGE"
    echo "📍 Versions: https://recipearchive-storage-dev-990537043943.s3.us-west-2.amazonaws.com/extensions/versions.json"
else
    echo "⚠️  AWS CLI not found. Extensions packaged locally only."
    echo "💡 To upload to S3, install AWS CLI and run:"
    echo "   aws s3 sync dist/extensions/ s3://recipearchive-storage-dev-990537043943/extensions/"
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