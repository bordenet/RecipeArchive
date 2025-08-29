#!/bin/bash

# RecipeArchive Extension Packaging Script
# Creates distribution packages for both Chrome and Safari extensions

set -e

echo "📦 Packaging RecipeArchive Extensions..."

# Create dist directory
mkdir -p dist

# Package Chrome Extension
echo "🔧 Packaging Chrome extension..."
cd extensions/chrome
zip -r ../../dist/RecipeArchive-Chrome-$(date +%Y%m%d).zip . \
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md"
cd ../..

# Package Safari Extension
echo "🍎 Packaging Safari extension..."
cd extensions/safari
zip -r ../../dist/RecipeArchive-Safari-$(date +%Y%m%d).zip . \
    -x "*.DS_Store" "node_modules/*" "package-lock.json" "package.json" "*.md"
cd ../..

echo "✅ Extensions packaged in dist/ folder:"
ls -la dist/RecipeArchive-*-$(date +%Y%m%d).zip

echo ""
echo "📋 Distribution Instructions:"
echo ""
echo "Chrome Extension:"
echo "  - For testing: Extract ZIP and load unpacked in chrome://extensions/"
echo "  - For .crx: Use chrome://extensions/ > Pack Extension"
echo "  - For Web Store: Upload ZIP to Chrome Developer Dashboard"
echo ""
echo "Safari Extension:"
echo "  - For testing: Friends need 'Allow Unsigned Extensions' in Safari > Develop menu"
echo "  - For App Store: Upload ZIP to App Store Connect"
echo "  - For Developer ID: Sign with certificates and notarize"