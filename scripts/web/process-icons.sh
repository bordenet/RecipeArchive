#!/usr/bin/env bash

################################################################################
# RecipeArchive Web Icon Generator
################################################################################
# PURPOSE: Generate web icons from iOS source icon
#   - Creates regular icons (192x192, 512x512)
#   - Creates maskable icons with safe zone padding
#   - Creates dark mode variants if available
#   - Generates favicon
#
# USAGE:
#   ./scripts/web/process-icons.sh
#
# EXAMPLES:
#   ./scripts/web/process-icons.sh
#
# DEPENDENCIES:
#   - ImageMagick (convert command)
#
# NOTES:
#   - Source icon: ios/Runner/Assets.xcassets/AppIcon.appiconset/icon-1024.png
#   - Maskable icons use 80% scale to ensure safe zone compliance
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly SOURCE_ICON="$REPO_ROOT/recipe_archive/ios/Runner/Assets.xcassets/AppIcon.appiconset/icon-1024.png"
readonly DARK_SOURCE="$REPO_ROOT/recipe_archive/ios/Runner/Assets.xcassets/AppIcon.appiconset/dark-icon-1024.png"
readonly WEB_ICONS_DIR="$REPO_ROOT/recipe_archive/web/icons"
readonly WEB_DIR="$REPO_ROOT/recipe_archive/web"

log_header "Web Icon Generation"

# Validate dependencies
require_command "convert" "brew install imagemagick"
require_file "$SOURCE_ICON" "Source icon not found: $SOURCE_ICON"

# Create output directory
log_section "Creating Output Directory"
mkdir -p "$WEB_ICONS_DIR"
log_success "Output directory ready: $WEB_ICONS_DIR"

# Generate regular icons
log_section "Generating Regular Icons"
convert "$SOURCE_ICON" -resize 192x192 "${WEB_ICONS_DIR}/Icon-192.png"
log_debug "Created Icon-192.png"
convert "$SOURCE_ICON" -resize 512x512 "${WEB_ICONS_DIR}/Icon-512.png"
log_debug "Created Icon-512.png"
log_success "Regular icons generated"

# Generate maskable icons (with padding for safe zone)
log_section "Generating Maskable Icons"
convert "$SOURCE_ICON" \( +clone -resize 80% -gravity center -extent 192x192 \) "${WEB_ICONS_DIR}/Icon-maskable-192.png"
log_debug "Created Icon-maskable-192.png"
convert "$SOURCE_ICON" \( +clone -resize 80% -gravity center -extent 512x512 \) "${WEB_ICONS_DIR}/Icon-maskable-512.png"
log_debug "Created Icon-maskable-512.png"
log_success "Maskable icons generated (80% scale for safe zone)"

# Generate dark mode icons if source exists
if [[ -f "$DARK_SOURCE" ]]; then
    log_section "Generating Dark Mode Icons"
    convert "$DARK_SOURCE" -resize 192x192 "${WEB_ICONS_DIR}/Icon-dark-192.png"
    log_debug "Created Icon-dark-192.png"
    convert "$DARK_SOURCE" -resize 512x512 "${WEB_ICONS_DIR}/Icon-dark-512.png"
    log_debug "Created Icon-dark-512.png"
    convert "$DARK_SOURCE" \( +clone -resize 80% -gravity center -extent 192x192 \) "${WEB_ICONS_DIR}/Icon-dark-maskable-192.png"
    log_debug "Created Icon-dark-maskable-192.png"
    convert "$DARK_SOURCE" \( +clone -resize 80% -gravity center -extent 512x512 \) "${WEB_ICONS_DIR}/Icon-dark-maskable-512.png"
    log_debug "Created Icon-dark-maskable-512.png"
    log_success "Dark mode icons generated"
else
    log_info "Dark mode source not found, skipping dark icons"
fi

# Generate favicon
log_section "Generating Favicon"
convert "$SOURCE_ICON" -resize 32x32 "$WEB_DIR/favicon.png"
log_success "Favicon generated"

log_success "Web icon generation complete"
