#!/usr/bin/env bash

################################################################################
# RecipeArchive Android Development Setup
################################################################################
# PURPOSE: Set up complete Android development environment
#   - Checks for Flutter SDK
#   - Verifies Java (JDK) installation
#   - Locates or helps install Android SDK
#   - Configures environment variables
#   - Installs Android SDK components (platform-tools, build-tools, etc.)
#   - Accepts Android licenses
#
# USAGE:
#   ./scripts/android/setup.sh
#
# EXAMPLES:
#   ./scripts/android/setup.sh
#
# DEPENDENCIES:
#   - Flutter SDK
#   - Java Development Kit (JDK)
#   - Android Studio (recommended) or Android SDK Command-line tools
#
# NOTES:
#   - Run once before starting Android development
#   - May ask for password for certain operations
#   - Sets up ANDROID_HOME environment variable
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

log_header "Android Development Setup"

# Check prerequisites
log_section "Checking Prerequisites"

require_command "flutter" "https://docs.flutter.dev/get-started/install"
log_success "Flutter is installed"

require_command "java" "brew install openjdk"
log_success "Java (JDK) is installed"

# Find Android SDK
log_section "Locating Android SDK"
ANDROID_SDK_ROOT=""

ANDROID_SDK_ROOT=""
if [ -d "$HOME/Library/Android/sdk" ]; then
    ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
elif [ -d "/usr/local/share/android-sdk" ]; then
    ANDROID_SDK_ROOT="/usr/local/share/android-sdk"
elif [ ! -z "$ANDROID_HOME" ]; then
    ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [ -z "$ANDROID_SDK_ROOT" ]; then
    log_error "Android SDK not found."
    echo "Please install Android Studio or set the ANDROID_HOME environment variable."
    die "Setup failed"
fi

export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

log_success "Android SDK found at: $ANDROID_SDK_ROOT"

# Check for command-line tools
if ! command_exists sdkmanager; then
    log_error "Android command-line tools are not installed or not in your PATH."
    echo "Please install them via Android Studio (SDK Manager > SDK Tools > Android SDK Command-line Tools)."
    die "Setup failed"
fi
log_success "Android command-line tools are available."

# Accept licenses
log_info "Accepting Android SDK licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || log_warning "Could not auto-accept licenses. Manual intervention may be required."
log_success "Android licenses checked."

# Install necessary packages
log_info "Installing required SDK packages (platform-tools, emulator, build-tools)..."
sdkmanager "platform-tools" "emulator" "build-tools;34.0.0" > /dev/null
log_success "SDK packages are up to date."

# Navigate to project root and Flutter directory
cd "$REPO_ROOT"

log_info "Project root: $REPO_ROOT"

# Navigate to Flutter project directory
readonly FLUTTER_DIR="$REPO_ROOT/recipe_archive"

if [ ! -f "$FLUTTER_DIR/pubspec.yaml" ]; then
    log_error "Cannot find Flutter project. Expected pubspec.yaml in $FLUTTER_DIR"
    die "Setup failed"
fi

cd "$FLUTTER_DIR"
log_info "Flutter project directory: $FLUTTER_DIR"

# Get Flutter dependencies
log_info "Getting Flutter dependencies..."
flutter pub get

# Run flutter doctor
log_info "Running flutter doctor to verify setup..."
flutter doctor

log_success "Android setup complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Run: ./scripts/android-emulator.sh  # To start the emulator"
echo "2. Run: ./scripts/android-run.sh       # To run the app"
echo "3. Run: ./scripts/android-build.sh      # To build the app"
echo ""
echo "📚 For more options, see: ./scripts/android-help.sh"