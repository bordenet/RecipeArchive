#!/usr/bin/env bash

################################################################################
# RecipeArchive Extension Version Updater
################################################################################
# PURPOSE: Update version numbers for Chrome and Safari extensions
#   - Increments version in manifest.json files
#   - Updates package.json files
#   - Updates fallback versions in popup.js
#   - Supports patch, minor, and major version bumps
#
# USAGE:
#   ./scripts/update-extension-versions.sh [patch|minor|major]
#
# EXAMPLES:
#   ./scripts/update-extension-versions.sh patch
#   ./scripts/update-extension-versions.sh minor
#   ./scripts/update-extension-versions.sh major
#
# DEPENDENCIES:
#   - sed
#   - jq or node (optional, for parsing manifest.json)
#
# NOTES:
#   - Default version type is 'patch' if not specified
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly VERSION_TYPE="${1:-patch}"

log_header "Browser Extension Version Update (${VERSION_TYPE})"

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
            die "Invalid version type: $type (use: major, minor, patch)"
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
update_chrome_extension() {
    local chrome_dir="$REPO_ROOT/extensions/chrome"

    if [[ ! -d "$chrome_dir" ]]; then
        log_warning "Chrome extension directory not found"
        return 0
    fi

    log_section "Updating Chrome Extension"

    # Get current version from manifest
    local current_version
    current_version=$(get_version_from_manifest "$chrome_dir/manifest.json")
    local new_version
    new_version=$(increment_version "$current_version" "$VERSION_TYPE")

    log_info "Chrome: $current_version → $new_version"

    # Update manifest.json
    if is_macos; then
        sed -i.bak "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$chrome_dir/manifest.json"
        rm "$chrome_dir/manifest.json.bak"
    else
        sed -i "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$chrome_dir/manifest.json"
    fi

    # Update package.json
    if is_macos; then
        sed -i.bak "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$chrome_dir/package.json"
        rm "$chrome_dir/package.json.bak"
    else
        sed -i "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$chrome_dir/package.json"
    fi

    log_success "Chrome extension updated to v$new_version"
}

# Update Safari extension
update_safari_extension() {
    local safari_dir="$REPO_ROOT/extensions/safari"

    if [[ ! -d "$safari_dir" ]]; then
        log_warning "Safari extension directory not found"
        return 0
    fi

    log_section "Updating Safari Extension"

    # Get current version from manifest
    local current_version
    current_version=$(get_version_from_manifest "$safari_dir/manifest.json")
    local new_version
    new_version=$(increment_version "$current_version" "$VERSION_TYPE")

    log_info "Safari: $current_version → $new_version"

    # Update manifest.json
    if is_macos; then
        sed -i.bak "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$safari_dir/manifest.json"
        rm "$safari_dir/manifest.json.bak"
    else
        sed -i "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$safari_dir/manifest.json"
    fi

    # Update package.json
    if is_macos; then
        sed -i.bak "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$safari_dir/package.json"
        rm "$safari_dir/package.json.bak"
    else
        sed -i "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/g" "$safari_dir/package.json"
    fi

    # Update fallback version in popup.js
    if is_macos; then
        sed -i.bak "s/return \"[0-9]\+\.[0-9]\+\.[0-9]\+\"; \/\/ Fallback version/return \"$new_version\"; \/\/ Fallback version/" "$safari_dir/popup.js"
        rm "$safari_dir/popup.js.bak"
    else
        sed -i "s/return \"[0-9]\+\.[0-9]\+\.[0-9]\+\"; \/\/ Fallback version/return \"$new_version\"; \/\/ Fallback version/" "$safari_dir/popup.js"
    fi

    log_success "Safari extension updated to v$new_version"
}

# Main function
main() {
    # Update both extensions
    update_chrome_extension
    update_safari_extension

    log_success "Extension version update complete"
    echo ""
    log_info "Next steps:"
    echo "  1. Review changes: git diff"
    echo "  2. Test extensions with new versions"
    echo "  3. Commit changes: git add . && git commit -m \"Bump extension versions ($VERSION_TYPE)\""
    echo "  4. Tag release: git tag vX.X.X"
    echo ""
    log_info "Version Strategy:"
    echo "  - PATCH (x.x.X): Bug fixes, parser updates"
    echo "  - MINOR (x.X.0): New features, new site support"
    echo "  - MAJOR (X.0.0): Breaking changes, major rewrites"
}

main "$@"
