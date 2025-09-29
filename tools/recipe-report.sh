#!/bin/bash

################################################################################
#
# Recipe Archive S3 Reporting Tool Wrapper
#
# This script builds and runs the Go-based reporting tool, which generates
# reports about recipes and parsing failures from the S3 bucket.
#
# USAGE:
#   ./recipe-report.sh [arguments]
#
# ARGUMENTS:
#   All arguments are passed directly to the content-ops Go binary.
#   For example, to get a report for a specific user:
#   ./recipe-report.sh -user user@example.com -password "password"
#
# DEPENDENCIES:
#   - Go
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
TOOL_DIR="$SCRIPT_DIR/content-ops"

echo "🔧 Recipe Archive S3 Reporting Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if binary exists, build if needed
if [[ ! -f "$TOOL_DIR/content-ops" ]]; then
    echo "📦 Building recipe reporting tool..."
    if (cd "$TOOL_DIR" && go build -o content-ops); then
        echo "✅ Build complete"
    else
        echo "❌ Build failed"
        exit 1
    fi
fi

# Run the tool with all passed arguments
cd "$TOOL_DIR"
./content-ops "$@"