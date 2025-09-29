#!/bin/bash

################################################################################
#
# Washington Post Cookie Capture Script
#
# This script makes it easy to capture authentication cookies for Washington Post
# recipe parsing.
#
# USAGE:
#   ./capture-wapost-cookies.sh
#
# DEPENDENCIES:
#   - Go
#   - Google Chrome
#
# NOTES:
#   - This script is designed to be run from the root of the monorepo.
#
################################################################################

# Washington Post Cookie Capture Script
# This script makes it easy to capture authentication cookies for Washington Post recipe parsing

echo "🔐 Washington Post Cookie Capture"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This script will:"
echo "1. Launch a browser window for Washington Post login"
echo "2. Guide you through the authentication process"
echo "3. Save your subscription cookies for automated recipe parsing"
echo ""
echo "Requirements:"
echo "- Active Washington Post subscription"
echo "- Chrome browser installed"
echo ""

# Change to the wapost-cookies directory
cd "$(dirname "$0")/../tools/cmd/wapost-cookies" || {
    echo "❌ ERROR: Could not find wapost-cookies directory"
    exit 1
}

echo "🚀 Starting cookie capture tool..."
echo ""

# Run the Go cookie capture tool
go run main.go