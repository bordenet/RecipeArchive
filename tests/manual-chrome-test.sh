#!/bin/bash

echo "🚀 Chrome Extension End-to-End Test Guide"
echo "=========================================="
echo ""

EXTENSION_PATH="$(cd "$(dirname "$0")/../extensions/chrome" && pwd)"
TEST_URL="http://localhost:8080/test-page"

echo "📋 MANUAL TEST STEPS:"
echo ""
echo "1. 🔧 LOAD EXTENSION IN CHROME:"
echo "   - Open Chrome"
echo "   - Go to chrome://extensions/"
echo "   - Enable 'Developer mode' (toggle in top right)"
echo "   - Click 'Load unpacked'"
echo "   - Select: $EXTENSION_PATH"
echo "   - ✅ Verify: Extension appears with name 'RecipeArchive Chrome Extension'"
echo ""

echo "2. 🌐 OPEN TEST PAGE:"
echo "   - Navigate to: $TEST_URL"
echo "   - ✅ Verify: Page loads with sample recipe content"
echo ""

echo "3. 🖱️ TEST EXTENSION POPUP:"
echo "   - Click the RecipeArchive extension icon in toolbar"
echo "   - ✅ Verify: Popup opens without errors"
echo "   - ✅ Verify: Popup shows current page URL"
echo ""

echo "4. 🍳 TEST RECIPE CAPTURE:"
echo "   - In the popup, click 'Capture Recipe' button"
echo "   - ✅ Verify: Success message appears"
echo "   - ✅ Verify: Recipe data is captured"
echo ""

echo "5. 📊 VERIFY BACKEND STORAGE:"
echo "   - Check mock server for stored recipe"
echo ""

echo "🔍 AUTOMATED CHECKS:"
echo ""

# Check extension files
echo "📁 Extension Files Check:"
if [ -f "$EXTENSION_PATH/manifest.json" ]; then
    echo "✅ manifest.json exists"
else
    echo "❌ manifest.json missing"
fi

if [ -f "$EXTENSION_PATH/popup-test.html" ]; then
    echo "✅ popup-test.html exists"
else
    echo "❌ popup-test.html missing"
fi

if [ -f "$EXTENSION_PATH/content-safe.js" ]; then
    echo "✅ content-safe.js exists"
else
    echo "❌ content-safe.js missing"
fi

if [ -f "$EXTENSION_PATH/background.js" ]; then
    echo "✅ background.js exists"
else
    echo "❌ background.js missing"
fi

echo ""

# Check mock server
echo "🌐 Mock Server Check:"
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Mock server is running"
    
    # Check test page
    if curl -s http://localhost:8080/test-page > /dev/null 2>&1; then
        echo "✅ Test page is accessible"
    else
        echo "❌ Test page not accessible"
    fi
    
    # Check recipes endpoint
    echo ""
    echo "📊 Current recipes in mock server:"
    curl -s http://localhost:8080/api/recipes -H "Authorization: Bearer dev-mock-token" | head -10
    
else
    echo "❌ Mock server not running"
    echo "💡 Start with: cd aws-backend/functions/local-server && go run main.go"
fi

echo ""
echo "🎯 EXPECTED END-TO-END FLOW:"
echo "1. Load extension in Chrome ✓"
echo "2. Navigate to test page ✓"
echo "3. Click extension icon → popup opens ✓"
echo "4. Click 'Capture Recipe' → data captured ✓"
echo "5. Recipe appears in mock server ✓"
echo ""

echo "🔗 Quick Links:"
echo "- Extension path: $EXTENSION_PATH"
echo "- Test page: $TEST_URL"
echo "- Chrome extensions: chrome://extensions/"
echo "- Mock server recipes: http://localhost:8080/api/recipes"
echo ""

echo "✅ Manual test guide complete!"
echo "📖 Follow the steps above to test the Chrome extension end-to-end"
