#!/bin/bash

################################################################################
#
# Update Extension Versions Script
#
# This script updates the version of the Chrome and Safari extensions.
#
# USAGE:
#   ./update-extension-versions.sh [patch|minor|major]
#
# EXAMPLE:
#   ./update-extension-versions.sh patch
#
# DEPENDENCIES:
#   - sed
#   - jq or node (optional, for parsing manifest.json)
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

set -e

VERSION_TYPE=${1:-"patch"}  # patch, minor, major
CURRENT_DIR=$(pwd)

echo "🔢 Updating browser extension versions (${VERSION_TYPE})"

# Function to increment version
increment_version() {
    local version=$1
    local type=$2
    
    IFS='.' read -ra ADDR <<< "$version"
    local major=${ADDR[0]}
    local minor=${ADDR[1]}
    local patch=${ADDR[2]}
    
    case $type in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
        *)
            echo "❌ Invalid version type: $type (use: major, minor, patch)"
            exit 1
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# Function to get version from manifest.json
get_version_from_manifest() {
    local manifest_file=$1
    if command -v jq &> /dev/null;
    then
        jq -r .version "$manifest_file"
    elif command -v node &> /dev/null;
    then
        node -p "require('./$manifest_file').version"
    else
        grep -o '"version": "[^"].*"' "$manifest_file" | cut -d'"' -f4
    fi
}

# Update Chrome extension
CHROME_DIR="extensions/chrome"
if [ -d "$CHROME_DIR" ]; then
    echo "📱 Updating Chrome extension version..."
    
    # Get current version from manifest
    CURRENT_VERSION=$(get_version_from_manifest "$CHROME_DIR/manifest.json")
    NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$VERSION_TYPE")
    
    echo "  Chrome: $CURRENT_VERSION → $NEW_VERSION"
    
    # Update manifest.json
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i.bak "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$CHROME_DIR/manifest.json"
        rm "$CHROME_DIR/manifest.json.bak"
    else
        sed -i "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$CHROME_DIR/manifest.json"
    fi
    
    # Update package.json
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i.bak "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$CHROME_DIR/package.json"
        rm "$CHROME_DIR/package.json.bak"
    else
        sed -i "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$CHROME_DIR/package.json"
    fi
    
    echo "  ✅ Chrome extension updated to v$NEW_VERSION"
else
    echo "⚠️ Chrome extension directory not found"
fi

# Update Safari extension
SAFARI_DIR="extensions/safari"
if [ -d "$SAFARI_DIR" ]; then
    echo "🦎 Updating Safari extension version..."
    
    # Get current version from manifest
    CURRENT_VERSION=$(get_version_from_manifest "$SAFARI_DIR/manifest.json")
    NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$VERSION_TYPE")
    
    echo "  Safari: $CURRENT_VERSION → $NEW_VERSION"
    
    # Update manifest.json
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i.bak "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$SAFARI_DIR/manifest.json"
        rm "$SAFARI_DIR/manifest.json.bak"
    else
        sed -i "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$SAFARI_DIR/manifest.json"
    fi
    
    # Update package.json
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i.bak "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$SAFARI_DIR/package.json"
        rm "$SAFARI_DIR/package.json.bak"
    else
        sed -i "s/"version": "$CURRENT_VERSION"/"version": "$NEW_VERSION"/g" "$SAFARI_DIR/package.json"
    fi
    
    # Update fallback version in popup.js
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i.bak "s/return \"[0-9]\+\.[0-9]\+\.[0-9]\+\"; \/\/ Fallback version/return \"$NEW_VERSION\"; \/\/ Fallback version/" "$SAFARI_DIR/popup.js"
        rm "$SAFARI_DIR/popup.js.bak"
    else
        sed -i "s/return \"[0-9]\+\.[0-9]\+\.[0-9]\+\"; \/\/ Fallback version/return \"$NEW_VERSION\"; \/\/ Fallback version/" "$SAFARI_DIR/popup.js"
    fi
    
    echo "  ✅ Safari extension updated to v$NEW_VERSION"
else
    echo "⚠️ Safari extension directory not found"
fi

echo ""
echo "🎉 Extension version update complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Test extensions with new versions"
echo "  3. Commit changes: git add . && git commit -m \"🔢 Bump extension versions ($VERSION_TYPE)\""
echo "  4. Tag release: git tag v$NEW_VERSION"
echo ""
echo "📖 Version Strategy:"
echo "  - PATCH (x.x.X): Bug fixes, parser updates"
echo "  - MINOR (x.X.0): New features, new site support"
echo "  - MAJOR (X.0.0): Breaking changes, major rewrites"
