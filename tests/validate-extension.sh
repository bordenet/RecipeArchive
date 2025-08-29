#!/bin/bash

echo "🔍 Validating Chrome extension files..."

EXTENSION_DIR="$(cd "$(dirname "$0")/../extensions/chrome" && pwd)"
cd "$EXTENSION_DIR"

echo "📁 Current directory: $(pwd)"
echo "📄 Files in extension directory:"
ls -la

echo ""
echo "🔧 Checking manifest.json syntax..."
if command -v jq &> /dev/null; then
    jq . manifest.json > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ manifest.json syntax is valid"
    else
        echo "❌ manifest.json has syntax errors"
        jq . manifest.json
    fi
else
    echo "⚠️ jq not installed, using python to check JSON"
    python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ manifest.json syntax is valid"
    else
        echo "❌ manifest.json has syntax errors"
    fi
fi

echo ""
echo "🔧 Checking JavaScript files syntax..."

# Check background.js
echo "Checking background.js..."
node -c background.js 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ background.js syntax is valid"
else
    echo "❌ background.js has syntax errors"
    node -c background.js
fi

# Check content-safe.js
echo "Checking content-safe.js..."
node -c content-safe.js 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ content-safe.js syntax is valid"
else
    echo "❌ content-safe.js has syntax errors"
    node -c content-safe.js
fi

# Check popup.js
if [ -f popup.js ]; then
    echo "Checking popup.js..."
    node -c popup.js 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ popup.js syntax is valid"
    else
        echo "❌ popup.js has syntax errors"
        node -c popup.js
    fi
fi

echo ""
echo "🔧 Checking required files exist..."

required_files=("manifest.json" "background.js" "content-safe.js" "popup-test.html")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
    fi
done

echo ""
echo "🔧 Checking icon files..."
icon_files=("icon16.png" "icon32.png" "icon48.png" "icon128.png")
for icon in "${icon_files[@]}"; do
    if [ -f "$icon" ]; then
        echo "✅ $icon exists"
    else
        echo "❌ $icon is missing"
    fi
done

echo ""
echo "🔧 Checking popup HTML..."
if [ -f "popup-test.html" ]; then
    echo "✅ popup-test.html exists"
    # Basic HTML validation
    if grep -q "<html" popup-test.html && grep -q "</html>" popup-test.html; then
        echo "✅ popup-test.html has basic HTML structure"
    else
        echo "❌ popup-test.html missing basic HTML structure"
    fi
else
    echo "❌ popup-test.html is missing"
fi

echo ""
echo "✅ Extension validation complete"
