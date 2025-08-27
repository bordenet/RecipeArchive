#!/bin/bash
# Recipe Archive S3 Reporting Tool Wrapper
# Builds and runs the Go-based reporting tool

set -e

TOOL_DIR="/Users/matt/GitHub/RecipeArchive/tools/recipe-report"

echo "🔧 Recipe Archive S3 Reporting Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if binary exists, build if needed
if [[ ! -f "$TOOL_DIR/recipe-report" ]]; then
    echo "📦 Building recipe reporting tool..."
    cd "$TOOL_DIR"
    go build -o recipe-report
    echo "✅ Build complete"
fi

# Run the tool with all passed arguments
cd "$TOOL_DIR"
./recipe-report "$@"