#!/usr/bin/env bash

################################################################################
# RecipeArchive Safari Web Extension Restoration
################################################################################
# PURPOSE: Restore Safari Web Extension files after Xcode overwrites them
#   - Creates backup of extension files if none exists
#   - Restores all extension files from backup
#   - Validates restoration was successful
#   - Ensures images directory exists
#
# USAGE:
#   ./scripts/restore-web-extension-files.sh
#
# EXAMPLES:
#   ./scripts/restore-web-extension-files.sh
#
# NOTES:
#   - Run this after Xcode build if extension files were overwritten
#   - Backup is created in .web-extension-backup directory
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly EXTENSION_DIR="$REPO_ROOT/recipe_archive/ios/RecipeExtension"
readonly BACKUP_DIR="$REPO_ROOT/.web-extension-backup"

log_header "Safari Web Extension File Restoration"

# Create backup if it doesn't exist
create_backup_if_needed() {
    if [[ -d "$BACKUP_DIR" ]]; then
        return 0
    fi

    log_section "Creating Backup"
    log_warning "No backup found. Creating backup of current files..."

    mkdir -p "$BACKUP_DIR"

    local files=(
        "manifest.json"
        "content.js"
        "popup.html"
        "popup.js"
        "background.js"
        "SafariWebExtensionHandler.swift"
        "Info.plist"
        "RecipeExtension.entitlements"
        "README.md"
    )

    for file in "${files[@]}"; do
        if [[ -f "$EXTENSION_DIR/$file" ]]; then
            cp "$EXTENSION_DIR/$file" "$BACKUP_DIR/"
            log_debug "Backed up: $file"
        else
            log_debug "Skipped (not found): $file"
        fi
    done

    log_success "Backup created at: $BACKUP_DIR"
}

create_backup_if_needed

log_section "Restoring Files from Backup"

# Function to restore a file
restore_file() {
    local filename="$1"
    local source="$BACKUP_DIR/$filename"
    local dest="$EXTENSION_DIR/$filename"

    if [[ -f "$source" ]]; then
        cp "$source" "$dest"
        log_debug "Restored: $filename"
        return 0
    else
        log_warning "Missing: $filename (not in backup)"
        return 1
    fi
}

# Restore all extension files
main() {
    local files=(
        "manifest.json"
        "content.js"
        "popup.html"
        "popup.js"
        "background.js"
        "SafariWebExtensionHandler.swift"
        "Info.plist"
        "RecipeExtension.entitlements"
        "README.md"
    )

    local restored=0
    local missing=0

    for file in "${files[@]}"; do
        if restore_file "$file"; then
            restored=$((restored + 1))
        else
            missing=$((missing + 1))
        fi
    done

    # Create images directory if it doesn't exist
    mkdir -p "$EXTENSION_DIR/images"
    log_debug "Ensured images directory exists"

    log_success "Restoration complete ($restored restored, $missing missing)"
    echo ""
    log_info "Next steps:"
    echo "  1. In Xcode, verify files are visible in RecipeExtension target"
    echo "  2. If files are missing, add them: Right-click RecipeExtension → Add Files"
    echo "  3. Create extension icons in images/ directory"
    echo "  4. Build and run"
}

main "$@"
