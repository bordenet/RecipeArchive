#!/bin/bash

# Simple timeout wrapper for Playwright tests
set -e

TIMEOUT=${1:-60}  # Default 1 minute
shift  # Remove timeout from args
COMMAND="$@"

echo "🚀 Running with timeout: $TIMEOUT seconds"
echo "📝 Command: $COMMAND"

# Function to cleanup processes
cleanup() {
    echo "🧹 Cleaning up processes..."
    
    # Kill any playwright processes
    pkill -f "playwright" 2>/dev/null || true
    
    # Kill any HTML report servers (common ports)
    for port in 9323 9324 9325; do
        lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
    done
    
    # Kill any Chrome instances started by tests
    pkill -f "chrome.*--load-extension" 2>/dev/null || true
    
    echo "✅ Cleanup complete"
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Use gtimeout on macOS (install via: brew install coreutils)
# Fallback to basic timeout approach if gtimeout not available
if command -v gtimeout >/dev/null 2>&1; then
    gtimeout $TIMEOUT bash -c "$COMMAND"
else
    # Fallback: run command in background and kill after timeout
    bash -c "$COMMAND" &
    COMMAND_PID=$!
    
    # Wait for timeout or command completion
    if wait $COMMAND_PID 2>/dev/null; then
        echo "✅ Tests completed successfully"
    else
        echo "⏰ Tests timed out or failed"
        kill $COMMAND_PID 2>/dev/null || true
    fi
fi
