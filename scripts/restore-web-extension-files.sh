#!/bin/bash
# restore-web-extension-files.sh
# Restores Safari Web Extension files after Xcode overwrites them

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$SCRIPT_DIR/.."
EXTENSION_DIR="$REPO_ROOT/recipe_archive/ios/RecipeExtension"
BACKUP_DIR="$REPO_ROOT/.web-extension-backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Safari Web Extension File Restoration${NC}"
echo "=========================================="
echo ""

# Check if backup exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}No backup found. Creating backup of current files...${NC}"
    mkdir -p "$BACKUP_DIR"

    # Copy all our implementation files to backup
    cp "$EXTENSION_DIR/manifest.json" "$BACKUP_DIR/" 2>/dev/null || echo "manifest.json not found"
    cp "$EXTENSION_DIR/content.js" "$BACKUP_DIR/" 2>/dev/null || echo "content.js not found"
    cp "$EXTENSION_DIR/popup.html" "$BACKUP_DIR/" 2>/dev/null || echo "popup.html not found"
    cp "$EXTENSION_DIR/popup.js" "$BACKUP_DIR/" 2>/dev/null || echo "popup.js not found"
    cp "$EXTENSION_DIR/background.js" "$BACKUP_DIR/" 2>/dev/null || echo "background.js not found"
    cp "$EXTENSION_DIR/SafariWebExtensionHandler.swift" "$BACKUP_DIR/" 2>/dev/null || echo "SafariWebExtensionHandler.swift not found"
    cp "$EXTENSION_DIR/Info.plist" "$BACKUP_DIR/" 2>/dev/null || echo "Info.plist not found"
    cp "$EXTENSION_DIR/RecipeExtension.entitlements" "$BACKUP_DIR/" 2>/dev/null || echo "RecipeExtension.entitlements not found"
    cp "$EXTENSION_DIR/README.md" "$BACKUP_DIR/" 2>/dev/null || echo "README.md not found"

    echo -e "${GREEN}✓ Backup created at: $BACKUP_DIR${NC}"
fi

echo ""
echo "Restoring files from backup..."
echo ""

# Function to restore a file
restore_file() {
    local filename=$1
    local source="$BACKUP_DIR/$filename"
    local dest="$EXTENSION_DIR/$filename"

    if [ -f "$source" ]; then
        cp "$source" "$dest"
        echo -e "${GREEN}✓${NC} Restored: $filename"
    else
        echo -e "${RED}✗${NC} Missing: $filename (not in backup)"
    fi
}

# Restore all files
restore_file "manifest.json"
restore_file "content.js"
restore_file "popup.html"
restore_file "popup.js"
restore_file "background.js"
restore_file "SafariWebExtensionHandler.swift"
restore_file "Info.plist"
restore_file "RecipeExtension.entitlements"
restore_file "README.md"

# Create images directory if it doesn't exist
mkdir -p "$EXTENSION_DIR/images"
echo -e "${GREEN}✓${NC} Created images directory"

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Restoration complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. In Xcode, verify files are visible in RecipeExtension target"
echo "2. If files are missing, add them: Right-click RecipeExtension → Add Files"
echo "3. Create extension icons in images/ directory"
echo "4. Build and run"
echo ""
