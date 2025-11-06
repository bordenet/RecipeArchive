#!/usr/bin/env bash
# Trace file system operations on .eslintrc.cjs to find what's deleting it

set -e

echo "🔍 Starting file system trace for .eslintrc.cjs..."
echo "This will trace ALL file operations on .eslintrc.cjs"
echo "Press Ctrl+C to stop"
echo ""

# Use fs_usage (macOS) to trace file operations
# Filter for .eslintrc.cjs operations
sudo fs_usage -f filesys | grep -i "eslintrc.cjs" &
FS_USAGE_PID=$!

echo "fs_usage running with PID: $FS_USAGE_PID"
echo "Now run: ./validate-monorepo.sh --med in another terminal"
echo ""

# Wait for user to kill
wait $FS_USAGE_PID
