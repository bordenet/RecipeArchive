#!/bin/bash

################################################################################
#
# Automated Test Runner with Timeout and Cleanup
#
# PURPOSE:
#   This script runs automated tests for the Chrome extension with a timeout
#   to prevent them from running indefinitely. It also includes a cleanup
#   mechanism to ensure that any processes started during the test run are
#   terminated.
#
# USAGE:
#   ./tests/automation/run-with-timeout.sh
#
# HOW IT WORKS:
#   1.  Starts a mock server for the tests to interact with.
#   2.  Runs the Playwright tests with a specified timeout.
#   3.  If the tests time out, it generates a partial report.
#   4.  A trap is set to a `cleanup` function that stops the mock server and
#       any other related processes when the script exits.
#
# DEPENDENCIES:
#   - Node.js and npm
#   - Go (for the mock server)
#   - Playwright
#
# NOTES:
#   - This script is intended to be run from the root of the monorepo.
#
################################################################################

# Automated test runner with timeout and cleanup
# This script ensures tests don't run indefinitely and cleans up properly

set -e

echo "🚀 Starting Chrome Extension Automation with Timeout Management"
echo "============================================================"

# Configuration
TEST_TIMEOUT=120  # 2 minutes max for entire test suite
SERVER_PID=""

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    
    # Kill the mock server if we started it
    if [ ! -z "$SERVER_PID" ]; then
        echo "🛑 Stopping mock server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
    fi
    
    # Kill any remaining go processes
    pkill -f "go run main.go" 2>/dev/null || true
    
    # Kill any processes on port 8080
    lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
    
    echo "✅ Cleanup completed"
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Start mock server
echo "🔧 Starting mock server..."
cd aws-backend/functions/local-server
go run main.go &
SERVER_PID=$!
cd ../../..

# Wait for server to start with timeout
echo "⏳ Waiting for server to start (max 30 seconds)..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Mock server started successfully (PID: $SERVER_PID)"
        break
    fi
    sleep 1
done

if [ $i -eq 30 ]; then
    echo "❌ Failed to start mock server within 30 seconds"
    exit 1
fi

# Run tests with timeout
echo "🧪 Running Chrome extension tests (timeout: ${TEST_TIMEOUT}s)..."
cd tests/automation

# Cross-platform timeout function
run_with_timeout() {
    local timeout_duration=$1
    shift
    local command_to_run=("$@")
    
    # Run command in background and get its PID
    "${command_to_run[@]}" &
    local pid=$!
    
    # Wait for either completion or timeout
    local count=0
    while [ $count -lt $timeout_duration ]; do
        if ! kill -0 $pid 2>/dev/null; then
            # Process finished
            wait $pid
            return $?
        fi
        sleep 1
        count=$((count + 1))
    done
    
    # Timeout reached - kill the process
    kill -TERM $pid 2>/dev/null || true
    sleep 1
    kill -KILL $pid 2>/dev/null || true
    wait $pid 2>/dev/null || true
    return 124  # Standard timeout exit code
}

# Use cross-platform timeout to limit test execution
run_with_timeout ${TEST_TIMEOUT} npx playwright test extension-tests/simple-workflow.spec.js --reporter=list || {
    exit_code=$?
    if [ $exit_code -eq 124 ]; then
        echo "⏰ Tests timed out after ${TEST_TIMEOUT} seconds"
        echo "📊 Generating partial test report..."
        npx playwright show-report --host=0.0.0.0 &
        echo "🔗 Test report available at: http://localhost:9323"
    else
        echo "❌ Tests failed with exit code: $exit_code"
    fi
}

echo ""
echo "📝 Test Run Summary:"
echo "- Server PID was: $SERVER_PID"
echo "- Test timeout: ${TEST_TIMEOUT} seconds"
echo "- Screenshots saved in test-results/"
echo "- Cleanup will be performed automatically"
