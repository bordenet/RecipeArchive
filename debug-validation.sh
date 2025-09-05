#!/bin/bash

echo "=== DEBUG VALIDATION ==="

echo "1. Testing prerequisites..."
command -v node && echo "✓ Node.js" || echo "✗ Node.js missing"
command -v npm && echo "✓ npm" || echo "✗ npm missing"  
command -v go && echo "✓ Go" || echo "✗ Go missing"
command -v make && echo "✓ Make" || echo "✗ Make missing"
command -v trufflehog && echo "✓ TruffleHog" || echo "✗ TruffleHog missing"
command -v flutter && echo "✓ Flutter" || echo "✗ Flutter missing (optional)"

echo -e "\n2. Testing security scan..."
if trufflehog git file://. --since-commit HEAD --only-verified --fail > /dev/null 2>&1; then
    echo "✓ Security scan passed"
else
    echo "✗ Security scan failed"
fi

echo -e "\n3. Testing dependency installation..."
echo "  Testing npm install..."
if npm install > /dev/null 2>&1; then
    echo "✓ Root npm install succeeded"
else
    echo "✗ Root npm install failed"
fi

echo "  Testing AWS infrastructure dependencies..."
if [ -d "aws-backend/infrastructure" ]; then
    if (cd aws-backend/infrastructure && npm install > /dev/null 2>&1); then
        echo "✓ AWS infrastructure npm install succeeded"
    else
        echo "✗ AWS infrastructure npm install failed"
    fi
else
    echo "⚠ AWS infrastructure directory not found"
fi

echo "  Testing Safari dependencies..."
if [ -d "extensions/tests/safari" ]; then
    if (cd extensions/tests/safari && npm install > /dev/null 2>&1); then
        echo "✓ Safari npm install succeeded"
    else
        echo "✗ Safari npm install failed"
    fi
else
    echo "⚠ Safari test directory not found"
fi

echo -e "\n4. Testing builds..."
echo "  Testing AWS backend build..."
if [ -d "aws-backend" ] && [ -f "aws-backend/Makefile" ]; then
    if (cd aws-backend && make build > /dev/null 2>&1); then
        echo "✓ AWS backend build succeeded"
    else
        echo "✗ AWS backend build failed"
    fi
else
    echo "⚠ AWS backend or Makefile not found"
fi

echo "  Testing tools build..."
if [ -d "tools" ] && [ -f "tools/Makefile" ]; then
    if (cd tools && make build > /dev/null 2>&1); then
        echo "✓ Tools build succeeded"
    else
        echo "✗ Tools build failed"
    fi
else
    echo "⚠ Tools directory or Makefile not found"
fi

echo -e "\n5. Testing TypeScript compilation..."
if npx tsc --project parsers/tsconfig.json --noEmit > /dev/null 2>&1; then
    echo "✓ Parsers TypeScript compilation succeeded"
else
    echo "✗ Parsers TypeScript compilation failed"
fi

echo -e "\n=== DEBUG COMPLETE ==="