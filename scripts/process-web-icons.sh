#!/bin/bash

# Ensure ImageMagick is available
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is required but not installed. Please install it first:"
    echo "brew install imagemagick"
    exit 1
fi

# Set paths
SOURCE_ICON="ios/Runner/Assets.xcassets/AppIcon.appiconset/icon-1024.png"
WEB_ICONS_DIR="web/icons"

# Create web icons directory if it doesn't exist
mkdir -p "$WEB_ICONS_DIR"

# Generate regular icons
convert "$SOURCE_ICON" -resize 192x192 "${WEB_ICONS_DIR}/Icon-192.png"
convert "$SOURCE_ICON" -resize 512x512 "${WEB_ICONS_DIR}/Icon-512.png"

# Generate maskable icons (with padding to ensure safe zone)
# Maskable icons need padding to ensure the main content is within the safe zone
# Safe zone is 40% of the width/height centered
convert "$SOURCE_ICON" \( +clone -resize 80% -gravity center -extent 192x192 \) "${WEB_ICONS_DIR}/Icon-maskable-192.png"
convert "$SOURCE_ICON" \( +clone -resize 80% -gravity center -extent 512x512 \) "${WEB_ICONS_DIR}/Icon-maskable-512.png"

# Generate dark mode icons
DARK_SOURCE="ios/Runner/Assets.xcassets/AppIcon.appiconset/dark-icon-1024.png"
if [ -f "$DARK_SOURCE" ]; then
    # Generate dark mode icons
    convert "$DARK_SOURCE" -resize 192x192 "${WEB_ICONS_DIR}/Icon-dark-192.png"
    convert "$DARK_SOURCE" -resize 512x512 "${WEB_ICONS_DIR}/Icon-dark-512.png"
    convert "$DARK_SOURCE" \( +clone -resize 80% -gravity center -extent 192x192 \) "${WEB_ICONS_DIR}/Icon-dark-maskable-192.png"
    convert "$DARK_SOURCE" \( +clone -resize 80% -gravity center -extent 512x512 \) "${WEB_ICONS_DIR}/Icon-dark-maskable-512.png"
fi

# Generate favicon
convert "$SOURCE_ICON" -resize 32x32 "web/favicon.png"

echo "Web icons generated successfully"