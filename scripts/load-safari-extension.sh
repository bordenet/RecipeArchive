#!/bin/bash
# Script to streamline Safari extension loading for development

echo "🔧 RecipeArchive Safari Extension Loader"
echo "============================================="
echo ""

# Check if Safari is running
if pgrep -x "Safari" > /dev/null; then
    echo "⚠️  Safari is currently running. Please close Safari and run this script again."
    echo "   This ensures a clean extension load."
    exit 1
fi

# Enable Safari Developer mode permanently
echo "🔒 Enabling Safari Developer Features..."
defaults write com.apple.Safari IncludeInternalDebugMenu -bool true
defaults write com.apple.Safari IncludeDevelopMenu -bool true
defaults write com.apple.Safari WebKitDeveloperExtrasEnabledPreferenceKey -bool true

echo "✅ Safari Developer Features Enabled"
echo ""

# Start Safari with extension path ready
echo "🚀 Starting Safari..."
echo "📝 Manual steps required:"
echo ""
echo "1. Safari will open with Developer menu enabled"
echo "2. Go to: Develop → Allow Unsigned Extensions" 
echo "3. Enter your password when prompted"
echo "4. Go to: Safari → Settings → Extensions"
echo "5. Click '+' and select: $(pwd)/../extensions/safari"
echo "6. Enable the RecipeArchive extension"
echo ""
echo "💡 This only needs to be done once per Safari restart"
echo ""

# Open Safari and the extension directory
open -a Safari
open ../extensions/safari

echo "🎯 Ready for extension loading!"
echo "Extension directory opened in Finder for easy selection."