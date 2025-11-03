#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS Icon Generator
################################################################################
# PURPOSE: Generate iOS AppIcon.appiconset from 1024x1024 PNG
#   - Creates all required iOS icon sizes
#   - Uses sips for native macOS image processing
#   - Preserves file timestamps
#
# USAGE:
#   ./scripts/generate-ios-icons.sh <path-to-1024px-icon.png>
#
# EXAMPLES:
#   ./scripts/generate-ios-icons.sh icon-1024.png
#   ./scripts/generate-ios-icons.sh ~/Downloads/app-icon.png
#
# DEPENDENCIES:
#   - sips (macOS built-in)
#
# NOTES:
#   - Generates all standard iOS icon sizes (20pt to 1024pt)
#   - Output directory: AppIcon.appiconset
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Validate arguments
if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <path-to-1024px-icon.png>"
    exit 1
fi

readonly SRC_ICON="$1"
readonly OUT_DIR="AppIcon.appiconset"

log_header "iOS Icon Generation"

# Validate source icon
require_file "$SRC_ICON" "Source icon not found: $SRC_ICON"

# Check platform
if ! is_macos; then
    die "This script requires macOS (uses sips command)"
fi

# Create output directory
log_section "Creating Output Directory"
mkdir -p "$OUT_DIR"
log_success "Output directory: $OUT_DIR"

# Define icon sizes
declare -A sizes=(
    ["20x20@2x"]="40"
    ["20x20@3x"]="60"
    ["29x29@1x"]="29"
    ["29x29@2x"]="58"
    ["29x29@3x"]="87"
    ["40x40@1x"]="40"
    ["40x40@2x"]="80"
    ["40x40@3x"]="120"
    ["60x60@2x"]="120"
    ["60x60@3x"]="180"
    ["76x76@1x"]="76"
    ["76x76@2x"]="152"
    ["83.5x83.5@2x"]="167"
    ["1024x1024@1x"]="1024"
)

# Generate icons
log_section "Generating Icons"
for key in "${!sizes[@]}"; do
    dim="${sizes[$key]}"
    dest="$OUT_DIR/icon-${dim}.png"
    log_debug "Generating ${dest} (${dim}×${dim})"
    sips -Z "$dim" "$SRC_ICON" --out "$dest" >/dev/null
    touch -r "$SRC_ICON" "$dest"
done

log_success "Icons generated successfully in $OUT_DIR"
