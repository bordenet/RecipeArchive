#!/bin/bash

################################################################################
#
# RecipeArchive Flutter App Startup Script
#
# PURPOSE:
#   This script simplifies the process of starting the RecipeArchive Flutter
#   web application for local development. It ensures dependencies are up to
#   date, runs the development server, and attempts to open the application
#   in a web browser.
#
# USAGE:
#   ./start.sh
#
# HOW IT WORKS:
#   1.  Checks if the Flutter SDK is installed.
#   2.  Runs `flutter pub get` to install dependencies.
#   3.  Starts the Flutter development server on port 8080.
#   4.  Attempts to automatically open the application in a web browser.
#
# DEPENDENCIES:
#   - Flutter SDK
#
# NOTES:
#   - This script should be run from the repository root: ./scripts/web-start-dev.sh
#
################################################################################

# Recipe Archive Flutter App Startup Script
echo "🍳 Starting Recipe Archive Flutter App..."

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed or not in PATH"
    echo "Please install Flutter: https://flutter.dev/docs/get-started/install"
    exit 1
fi

# Navigate to Flutter app directory
cd "$REPO_ROOT/recipe_archive"

# Get dependencies
echo "📦 Installing dependencies..."
flutter pub get

# Start Flutter in background and capture output
echo "🚀 Starting Flutter development server..."
flutter run -d chrome --web-port 8080 > flutter_output.log 2>&1 &
FLUTTER_PID=$!

# Wait a moment for the server to start
echo "⏳ Waiting for development server to start..."
sleep 5

# Extract and display the URL
echo ""
echo "🌐 Flutter app should be available at: http://localhost:8080"
echo ""

# Try to open in browser automatically (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔗 Opening Chrome browser automatically..."
    open -a "Google Chrome" "http://localhost:8080"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔗 Opening browser automatically..."
    xdg-open "http://localhost:8080"
fi

echo ""
echo "📱 App is running! Click the URL above if browser didn't open automatically."
echo "🛑 Press Ctrl+C to stop the development server."
echo ""

# Wait for the Flutter process to finish
wait $FLUTTER_PID