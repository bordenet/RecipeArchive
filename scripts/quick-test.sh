#!/bin/bash
# Quick Extension Test - One command to test both browsers
# Usage: ./scripts/quick-test.sh

echo "🚀 RecipeArchive Extension Quick Test"
echo "==============================================="

echo ""
echo "🔄 Step 1: Reload Extensions"
echo "Chrome: Opening chrome://extensions/"
open -a "Google Chrome" "chrome://extensions/"

echo "Safari: Opening Safari preferences"
open -a Safari

echo ""
echo "⏱️  Waiting 3 seconds for browsers to load..."
sleep 3

echo ""
echo "🧪 Step 2: Opening Test Recipe Page"
echo "Chrome test page:"
open -a "Google Chrome" "https://smittenkitchen.com/2019/05/chocolate-peanut-butter-pie/"

echo "Safari test page:"  
open -a Safari "https://loveandlemons.com/banana-bread-recipe/"

echo ""
echo "✅ Quick Test Setup Complete!"
echo ""
echo "📋 Next Manual Steps (2 minutes total):"
echo "1. Chrome: Reload extension → Test on Smitten Kitchen page"
echo "2. Safari: Toggle extension → Test on Love & Lemons page"
echo ""
echo "🎯 Success Criteria:"
echo "✓ Extension popup opens in <1 second"
echo "✓ Authentication status shows correctly"
echo "✓ Recipe capture completes in <3 seconds"
echo "✓ No JavaScript console errors"