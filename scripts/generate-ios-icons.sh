#!/bin/bash
# generate-ios-icons.sh
# --------------------------
# Generates iOS AppIcon.appiconset images from one 1024×1024 PNG
# Usage: ./generate-ios-icons.sh <1024px-icon>

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path-to-1024px-icon.png>"
  exit 1
fi

SRC_ICON="$1"
OUT_DIR="AppIcon.appiconset"
mkdir -p "$OUT_DIR"

# Declare associative array — note all keys are quoted
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

for key in "${!sizes[@]}"; do
  dim="${sizes[$key]}"
  dest="$OUT_DIR/icon-${dim}.png"
  echo "Generating ${dest} (${dim}×${dim})"
  sips -Z "$dim" "$SRC_ICON" --out "$dest" >/dev/null
  touch -r "$SRC_ICON" "$dest"
done

echo "✅ Icons generated successfully in $OUT_DIR"
