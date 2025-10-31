#!/usr/bin/env bash

################################################################################
# RecipeArchive Flutter Web Development Server
################################################################################
# PURPOSE: Start Flutter web app for local development
#   - Checks Flutter SDK installation
#   - Installs dependencies (flutter pub get)
#   - Starts development server on port 8080
#   - Auto-opens browser
#
# USAGE:
#   ./scripts/web/start-dev.sh
#
# EXAMPLES:
#   ./scripts/web/start-dev.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#
# NOTES:
#   - Press Ctrl+C to stop the development server
#   - Logs to flutter_output.log in recipe_archive directory
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"
readonly DEV_PORT="8080"

log_header "Flutter Web Development Server"

# Validate Flutter
require_command "flutter" "brew install flutter"

# Change to Flutter directory
cd "$FLUTTER_DIR" || die "Failed to change to Flutter directory"

# Install dependencies
log_section "Installing Dependencies"
if ! flutter pub get; then
    die "Failed to install Flutter dependencies"
fi
log_success "Dependencies installed"

# Start development server
log_section "Starting Development Server"
log_info "Starting Flutter on port $DEV_PORT..."

flutter run -d chrome --web-port "$DEV_PORT" > flutter_output.log 2>&1 &
FLUTTER_PID=$!

log_info "Waiting for server to start..."
sleep 5

log_success "Development server started (PID: $FLUTTER_PID)"
echo ""
log_info "Application URL: http://localhost:$DEV_PORT"
echo ""

# Open browser
if is_macos; then
    log_info "Opening Chrome browser..."
    open -a "Google Chrome" "http://localhost:$DEV_PORT" 2>/dev/null || log_warning "Could not auto-open Chrome"
elif is_linux; then
    log_info "Opening browser..."
    xdg-open "http://localhost:$DEV_PORT" 2>/dev/null || log_warning "Could not auto-open browser"
fi

echo ""
log_info "App is running! Press Ctrl+C to stop."
echo ""

# Wait for Flutter process
wait $FLUTTER_PID
