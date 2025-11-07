#!/usr/bin/env bash

################################################################################
# RecipeArchive macOS Development Environment Setup
################################################################################
# PURPOSE: Complete development environment setup for macOS
#   - Installs Homebrew package manager
#   - Installs Flutter SDK
#   - Installs Android Studio and SDK
#   - Installs Xcode Command Line Tools
#   - Installs CocoaPods (modern Ruby via Homebrew)
#   - Installs Node.js and npm
#   - Installs AWS CLI
#   - Installs Go
#   - Installs development tools (git, wget, etc.)
#   - Configures environment variables
#   - Sets up shell configuration
#   - Verifies all installations
#
# USAGE:
#   ./scripts/setup-macos.sh
#
# EXAMPLES:
#   ./scripts/setup-macos.sh
#
# DEPENDENCIES:
#   - macOS (this script is macOS-specific)
#   - Internet connection
#
# NOTES:
#   - macOS only
#   - Run once for initial environment setup
#   - May take 30-60 minutes on first run
#   - Requires admin password for some operations
#   - Installs modern Ruby (not system Ruby)
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Global variable for auto-yes functionality
AUTO_YES=false
VERBOSE=true  # Default to verbose mode

# Helper functions (defined early for use in argument parsing)
print_info()    { [ "$VERBOSE" = true ] && log_info "$1" || true; }
print_success() { [ "$VERBOSE" = true ] && log_success "$1" || true; }
print_warning() { [ "$VERBOSE" = true ] && log_warning "$1" || true; }
print_error()   { log_error "$1"; }  # Always show errors

# Function to display usage information
usage() {
    echo "Usage: $(basename "$0") [OPTIONS]"
    echo "Automates the setup of a comprehensive macOS development environment for RecipeArchive."
    echo ""
    echo "Options:"
    echo "  -y, --yes       Automatically confirm all prompts."
    echo "  -v, --verbose   Show detailed output (verbose mode)."
    echo "  -h, --help      Display this help message and exit."
    echo ""
    echo "Notes:"
    echo "  - Default mode is verbose without --yes (interactive with details)"
    echo "  - Using --yes alone enables compact mode (auto-confirm + minimal output)"
    echo "  - Using --yes --verbose enables verbose mode with auto-confirmation"
    echo ""
    echo "Examples:"
    echo "  $(basename "$0")                # Interactive with verbose output"
    echo "  $(basename "$0") --yes          # Non-interactive with compact output"
    echo "  $(basename "$0") --yes --verbose # Non-interactive with verbose output"
    exit 0
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -y|--yes)
        AUTO_YES=true
        VERBOSE=false  # Compact mode by default with --yes
        shift # past argument
        ;;
        -v|--verbose)
        VERBOSE=true  # Override to verbose mode
        shift # past argument
        ;;
        -h|--help)
        usage
        ;;
        *)
        print_error "Unknown option: $1"
        usage
        ;;
    esac
done

readonly REPO_ROOT="$(get_repo_root)"

# Validate platform
if ! is_macos; then
    die "This script is only for macOS"
fi

# Error tracking for summary report
FAILED_INSTALLS=()

# Section tracking for compact output
CURRENT_SECTION=""
SECTION_STATUS=""
SECTION_FAILURES=()

# Section output functions (compact mode)
section_start() {
    CURRENT_SECTION="$1"
    SECTION_STATUS="in_progress"
    SECTION_FAILURES=()
    if [ "$VERBOSE" = true ]; then
        echo ""
        print_info "$1"
    else
        printf "${COLOR_BLUE}[…]${COLOR_RESET} $1"
    fi
}

section_end() {
    if [ "$VERBOSE" = false ] && [ -n "$CURRENT_SECTION" ]; then
        if [ "${#SECTION_FAILURES[@]}" -gt 0 ]; then
            # Show failed items (space-separated)
            local failed_list="${SECTION_FAILURES[*]}"
            printf "\r\033[K${COLOR_RED}[✗]${COLOR_RESET} $CURRENT_SECTION ${COLOR_RED}($failed_list)${COLOR_RESET}\n"
        else
            # Clean success - no details, clear any lingering text
            printf "\r\033[K${COLOR_GREEN}[✓]${COLOR_RESET} $CURRENT_SECTION\n"
        fi
    fi
    CURRENT_SECTION=""
    SECTION_STATUS=""
    SECTION_FAILURES=()
}

section_update() {
    if [ "$VERBOSE" = false ] && [ -n "$CURRENT_SECTION" ]; then
        # Clear to end of line, then print section with current operation
        printf "\r\033[K${COLOR_BLUE}[…]${COLOR_RESET} $CURRENT_SECTION ${COLOR_DIM}($1)${COLOR_RESET}"
    fi
}

section_fail() {
    SECTION_STATUS="failed"
    # Add failed item to section failures array
    if [ "$VERBOSE" = false ]; then
        SECTION_FAILURES+=("$1")
    fi
}

# Checklist-style output functions (verbose mode)
check_installing() {
    if [ "$VERBOSE" = true ]; then
        printf "[ ] Installing $1..."
    else
        section_update "$1"
    fi
}

check_done() {
    if [ "$VERBOSE" = true ]; then
        printf "\r[✓] Installing $1... Done!\n"
    else
        section_update "$1 ✓"
    fi
}

check_skip() {
    if [ "$VERBOSE" = true ]; then
        printf "\r[→] $1 already installed\n"
    else
        section_update "$1 ✓"
    fi
}

check_exists() {
    if [ "$VERBOSE" = true ]; then
        printf "[✓] $1 already installed\n"
    else
        section_update "$1 ✓"
    fi
}

check_failed() {
    if [ "$VERBOSE" = true ]; then
        printf "\r${COLOR_RED}[✗]${COLOR_RESET} $1 installation failed\n"
    else
        section_update "${COLOR_RED}$1 failed${COLOR_RESET}"
        section_fail "$1"
    fi
    FAILED_INSTALLS+=("$1")
}

# Function for timed confirmation (15 seconds default to 'N')
timed_confirm() {
    local message="$1"
    local timeout="${2:-15}"
    local default_response="${3:-N}"

    if [ "$AUTO_YES" = true ]; then
        print_info "$message (Auto-accepting: YES)"
        return 0
    fi

    print_warning "$message"
    local prompt_options="[y/N]"
    if [ "$default_response" = "Y" ] || [ "$default_response" = "y" ]; then
        prompt_options="[Y/n]"
    fi
    echo -n "Continue? ${prompt_options} (auto-${default_response} in ${timeout}s): "

    if read -t "$timeout" -r response; then
        # Handle empty response (user just pressed Enter)
        if [ -z "$response" ]; then
            if [ "$default_response" = "Y" ] || [ "$default_response" = "y" ]; then
                print_info "Using default: YES"
                return 0
            else
                print_info "Using default: NO"
                return 1
            fi
        fi

        # Handle explicit user response
        case "$response" in
            [yY]|[yY][eE][sS]) return 0 ;;
            [nN]|[nN][oO]) return 1 ;;
            *)
                # Invalid response - use default
                if [ "$default_response" = "Y" ] || [ "$default_response" = "y" ]; then
                    print_warning "Invalid response, using default: YES"
                    return 0
                else
                    print_warning "Invalid response, using default: NO"
                    return 1
                fi
                ;;
        esac
    else
        echo ""
        if [ "$default_response" = "Y" ] || [ "$default_response" = "y" ]; then
            print_info "Timed out, defaulting to YES"
            return 0
        else
            print_info "Timed out, defaulting to NO"
            return 1
        fi
    fi
}

log_header "RecipeArchive Project Setup for macOS"
cd "$REPO_ROOT"

section_start "Package manager"

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
  if timed_confirm "Homebrew is required but not installed. Install Homebrew? (Large download ~100MB)"; then
    check_installing "Homebrew"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" > /dev/null 2>&1
    if ! command -v brew &> /dev/null; then
      print_error "Homebrew installation failed. Please install Homebrew manually."
      die "Setup failed"
    fi
    check_done "Homebrew"
  else
    print_error "Homebrew is required for this setup. Exiting."
    die "Setup failed"
  fi
else
  check_exists "Homebrew"
fi

section_end

section_start "Essential development tools"

# Install Node.js and npm
if ! command -v node &> /dev/null; then
  check_installing "Node.js"
  brew install node > /dev/null 2>&1
  if ! command -v node &> /dev/null; then
    print_error "Node.js installation failed. Please install Node.js manually."
    die "Setup failed"
  fi
  check_done "Node.js"
else
  check_exists "Node.js ($(node --version))"
fi

# Install TypeScript globally
if ! command -v tsc &> /dev/null; then
  check_installing "TypeScript"
  timeout 180 npm install -g typescript > /dev/null 2>&1
  if ! command -v tsc &> /dev/null; then
    print_error "TypeScript installation failed. Please install TypeScript manually."
    die "Setup failed"
  fi
  check_done "TypeScript"
else
  check_exists "TypeScript ($(tsc --version))"
fi

# Install AWS CDK globally
if ! command -v cdk &> /dev/null; then
  check_installing "AWS CDK"
  timeout 180 npm install -g aws-cdk@2.87.0 > /dev/null 2>&1
  if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK installation failed. Please install AWS CDK manually."
    die "Setup failed"
  fi
  check_done "AWS CDK"
else
  check_exists "AWS CDK ($(cdk --version))"
fi

# Install Go
if ! command -v go &> /dev/null; then
  check_installing "Go"
  brew install go > /dev/null 2>&1
  if ! command -v go &> /dev/null; then
    print_error "Go installation failed. Please install Go manually."
    die "Setup failed"
  fi
  check_done "Go"
else
  check_exists "Go ($(go version | awk '{print $3}'))"
fi

# Install golangci-lint (Go linter)
if ! command -v golangci-lint &> /dev/null; then
  check_installing "golangci-lint"
  brew install golangci-lint > /dev/null 2>&1
  if ! command -v golangci-lint &> /dev/null; then
    print_error "golangci-lint installation failed. Please install manually."
    die "Setup failed"
  fi
  check_done "golangci-lint"
else
  check_exists "golangci-lint ($(golangci-lint --version | head -1 | awk '{print $4}'))"
fi

# Install Xcode CLI tools (required for iOS/Swift development)
if ! xcode-select -p &> /dev/null; then
  if timed_confirm "Xcode CLI tools are required for iOS development. Install? (Large download ~500MB)"; then
    print_info "Installing Xcode CLI tools (follow on-screen prompts)..."
    xcode-select --install
    max_wait=300 # 5 minutes
    wait_interval=10
    waited=0
    while [ $waited -lt $max_wait ]; do
      if xcode-select -p &> /dev/null; then
        print_success "Xcode CLI tools installed"
        break
      fi
      sleep $wait_interval
      waited=$((waited + wait_interval))
    done
    if ! xcode-select -p &> /dev/null; then
      print_error "Xcode CLI tools installation timed out. Please complete the installation and run this script again."
      die "Setup failed"
    fi
  else
    print_warning "Skipping Xcode CLI tools - iOS development will not be available"
  fi
else
  check_exists "Xcode CLI tools"
fi

section_end

section_start "Mobile development environment"

# Java Development Kit (required for Android)
# MUST be installed BEFORE any Android SDK operations
# Check if Java is actually working, not just if the command exists (macOS has a stub)
java_working=false
# The macOS stub at /usr/bin/java returns 0 but outputs an error message
# Real Java outputs version info without errors
if java -version 2>&1 | grep -q "openjdk\|java version"; then
  java_working=true
fi

if [ "$java_working" = false ]; then
  # Check if Java is installed but just needs configuration
  if [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
    # Java is installed, just needs PATH configuration
    check_exists "Java (needs PATH configuration)"
    JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
    export JAVA_HOME
    export PATH="$JAVA_HOME/bin:$PATH"
  else
    # Actually install Java
    check_installing "Java Development Kit"
    brew install openjdk@17 > /dev/null 2>&1

    # Add Java to PATH
    JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
    export JAVA_HOME
    export PATH="$JAVA_HOME/bin:$PATH"
    check_done "Java Development Kit"
  fi

  # Add to shell profile
  SHELL_PROFILE=""
  if [ -n "${ZSH_VERSION:-}" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
  elif [ -n "${BASH_VERSION:-}" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi

  if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
    if ! grep -q "JAVA_HOME" "$SHELL_PROFILE"; then
      cat >> "$SHELL_PROFILE" <<EOF

# Java Development
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH=\$JAVA_HOME/bin:\$PATH
EOF
    fi
  fi
else
  check_exists "Java ($(java -version 2>&1 | head -1 | awk -F '"' '{print $2}'))"

  # Ensure JAVA_HOME is set even if Java is already installed
  if [ -z "${JAVA_HOME:-}" ] && [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

# Flutter SDK Installation
if ! command -v flutter &> /dev/null; then
  if timed_confirm "Flutter SDK is required for mobile app development. Install? (Large download ~1GB)"; then
    check_installing "Flutter SDK"
    brew install flutter > /dev/null 2>&1

    # Add Flutter to PATH (prioritize Flutter's Dart over Homebrew's)
    FLUTTER_PATH="/opt/homebrew/share/flutter/bin"
    export PATH="$FLUTTER_PATH:$PATH"

    # Configure Flutter to use correct Android SDK
    flutter config --android-sdk "$ANDROID_HOME" > /dev/null 2>&1 || true

    # Add to shell profile
    SHELL_PROFILE=""
    if [ -n "${ZSH_VERSION:-}" ]; then
      SHELL_PROFILE="$HOME/.zshrc"
    elif [ -n "${BASH_VERSION:-}" ]; then
      SHELL_PROFILE="$HOME/.bash_profile"
    fi

    if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
      if ! grep -q "export PATH=\"/opt/homebrew/share/flutter/bin:\$PATH\"" "$SHELL_PROFILE"; then
        echo "export PATH=\"/opt/homebrew/share/flutter/bin:\$PATH\"" >> "$SHELL_PROFILE"
      fi
    fi

    check_done "Flutter SDK"
  else
    print_warning "Skipping Flutter - mobile development will not be available"
  fi
else
  # Get Flutter version quietly by suppressing verbose output
  FLUTTER_VERSION=$(flutter --version 2>&1 | grep "Flutter" | head -1 | awk '{print $2}' || echo "")
  if [ -n "$FLUTTER_VERSION" ]; then
    check_exists "Flutter ($FLUTTER_VERSION)"
  else
    check_exists "Flutter"
  fi

  # Ensure Flutter is configured correctly even if already installed
  FLUTTER_PATH="/opt/homebrew/share/flutter/bin"
  export PATH="$FLUTTER_PATH:$PATH"

  # Set ANDROID_HOME if it exists
  ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  if [ -d "$ANDROID_HOME" ]; then
    export ANDROID_HOME
    flutter config --android-sdk "$ANDROID_HOME" > /dev/null 2>&1 || true
  fi
fi

# Android Development Setup
android_setup_needed=false
if [ ! -d "/Applications/Android Studio.app" ] || ! command -v sdkmanager &> /dev/null; then
  android_setup_needed=true
fi

if [ "$android_setup_needed" = true ]; then
  if timed_confirm "Set up Android development environment?"; then
  print_info "Setting up Android development..."

  # CRITICAL: Verify Java is available before proceeding with Android SDK
  if ! java -version &> /dev/null; then
    print_error "Java is required for Android development but is not available"
    print_error "This is a critical setup error - Java should have been installed earlier"
    die "Java installation failed - cannot proceed with Android setup"
  fi

  # Install Android Studio
  if [ ! -d "/Applications/Android Studio.app" ]; then
    if timed_confirm "Install Android Studio? (Large download ~2GB)"; then
      check_installing "Android Studio"
      brew install --cask android-studio > /dev/null 2>&1
      check_done "Android Studio"
    else
      print_warning "Skipping Android Studio installation. You can install it manually later."
    fi
  else
    check_exists "Android Studio"
  fi

  # Install Android SDK command-line tools
  if ! command -v sdkmanager &> /dev/null; then
    if timed_confirm "Install Android SDK command-line tools?"; then
      check_installing "Android SDK tools"
      brew install --cask android-commandlinetools > /dev/null 2>&1
      check_done "Android SDK tools"
    else
      print_warning "Skipping Android SDK installation. Android development will not be available."
    fi
  else
    check_exists "Android SDK tools"
  fi

  # Set up Android SDK environment variables
  ANDROID_HOME="$HOME/Library/Android/sdk"
  export ANDROID_HOME
  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

  # Add to shell profile
  SHELL_PROFILE=""
  if [ -n "$ZSH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
  elif [ -n "$BASH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi

  if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
    if ! grep -q "ANDROID_HOME" "$SHELL_PROFILE"; then
      cat >> "$SHELL_PROFILE" <<EOF

# Android Development
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH
EOF
      print_success "Added Android environment variables to $SHELL_PROFILE"
    fi
  fi

  # Install platform-tools and a system image
  if command -v sdkmanager &> /dev/null; then
    check_installing "Android platform-tools"
    timeout 300 sdkmanager "platform-tools" "system-images;android-33;google_apis;x86_64" > /dev/null 2>&1 || true
    check_done "Android platform-tools"
  fi

  # Install Android command-line tools and accept licenses
  if command -v sdkmanager &> /dev/null; then
    timeout 30 sdkmanager "cmdline-tools;latest" > /dev/null 2>&1 || true

    print_info "Accepting Android SDK licenses..."
    yes | flutter doctor --android-licenses > /dev/null 2>&1 || print_warning "Failed to accept Android licenses. Run 'flutter doctor --android-licenses' manually."
  fi

  print_success "Android development configured"
  print_warning "MANUAL STEP: Complete Android Studio setup if needed"
  print_info "1. Open Android Studio (first launch will complete SDK setup)"
  print_info "2. Follow setup wizard if prompted"
  print_info "3. Install additional SDK components as needed"
  else
    print_warning "Skipping Android setup - Android development will not be available"
  fi
else
  check_exists "Android development"

  # Update Android SDK components (default YES)
  if command -v sdkmanager &> /dev/null; then
    # CRITICAL: Verify Java is available before running SDK operations
    if ! java -version &> /dev/null; then
      print_warning "Java is not available - skipping Android SDK updates"
    else
      # Set up environment for sdkmanager
      ANDROID_HOME="$HOME/Library/Android/sdk"
      export ANDROID_HOME
      export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

    # Fix cmdline-tools path inconsistency BEFORE prompting (Android Studio upgrade issue)
    CMDLINE_DIR="$ANDROID_HOME/cmdline-tools"
    if [ -d "$CMDLINE_DIR" ]; then
      # Find the actual latest version directory (latest-2, latest-3, etc.)
      LATEST_VERSION=$(find "$CMDLINE_DIR" -maxdepth 1 -type d \( -name "latest-*" -o -name "[0-9]*" \) | sort -V | tail -1)

      if [ -n "$LATEST_VERSION" ]; then
        EXPECTED_TARGET=$(basename "$LATEST_VERSION")

        # Check if 'latest' exists and what it is
        if [ -L "$CMDLINE_DIR/latest" ]; then
          # It's a symlink - verify it points to the right place
          CURRENT_TARGET=$(readlink "$CMDLINE_DIR/latest")
          if [ "$CURRENT_TARGET" != "$EXPECTED_TARGET" ]; then
            print_info "Updating cmdline-tools symlink: $CURRENT_TARGET -> $EXPECTED_TARGET"
            rm "$CMDLINE_DIR/latest"
            ln -s "$EXPECTED_TARGET" "$CMDLINE_DIR/latest"
            print_success "Command-line tools symlink updated"
          fi
        elif [ -d "$CMDLINE_DIR/latest" ]; then
          # It's a directory (Android Studio bug) - replace with symlink
          print_info "Replacing cmdline-tools directory with symlink: latest -> $EXPECTED_TARGET"
          rm -rf "$CMDLINE_DIR/latest"
          ln -s "$EXPECTED_TARGET" "$CMDLINE_DIR/latest"
          print_success "Command-line tools path fixed"
        elif [ ! -e "$CMDLINE_DIR/latest" ]; then
          # Doesn't exist - create symlink
          print_info "Creating cmdline-tools symlink: latest -> $EXPECTED_TARGET"
          ln -s "$EXPECTED_TARGET" "$CMDLINE_DIR/latest"
          print_success "Command-line tools symlink created"
        fi
      fi
    fi

      # Automatically update SDK components
      print_info "Updating Android SDK components..."

      # Update SDK manager itself
      UPDATE_OUTPUT=$(timeout 120 sdkmanager --update 2>&1 || true)
      if echo "$UPDATE_OUTPUT" | grep -q "Update available"; then
        print_info "Applying SDK updates..."
      fi

      # Update platform-tools, build-tools, and latest platform
      yes | sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-34" > /dev/null 2>&1 || true

      # Update emulator
      timeout 120 sdkmanager "emulator" > /dev/null 2>&1 || true

      # Check if updates were applied
      if echo "$UPDATE_OUTPUT" | grep -q "No updates available"; then
        print_info "No SDK updates available"
      else
        print_success "Android SDK components updated"
      fi
    fi
  fi
fi

# iOS Development Setup
ios_setup_needed=false
if [ ! -d "/Applications/Xcode.app" ] || ! command -v pod &> /dev/null; then
  ios_setup_needed=true
fi

if [ "$ios_setup_needed" = true ]; then
  if timed_confirm "Set up iOS development environment?"; then
  # Check if Xcode is installed
  if [ ! -d "/Applications/Xcode.app" ]; then
    print_warning "Xcode not found. Install from App Store and run script again."
  else
    check_exists "Xcode"
    
    # Install modern Ruby (required for CocoaPods)
    if ! brew list ruby &> /dev/null; then
      if timed_confirm "Install modern Ruby for CocoaPods?"; then
        check_installing "Ruby"
        brew install ruby > /dev/null 2>&1

        # Add Homebrew Ruby to PATH
        RUBY_PATH="/opt/homebrew/opt/ruby/bin"
        export PATH="$RUBY_PATH:$PATH"

        # Add to shell profile
        SHELL_PROFILE=""
        if [ -n "$ZSH_VERSION" ]; then
          SHELL_PROFILE="$HOME/.zshrc"
        elif [ -n "$BASH_VERSION" ]; then
          SHELL_PROFILE="$HOME/.bash_profile"
        fi

        if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
          if ! grep -q "export PATH=\"$RUBY_PATH:\$PATH\"" "$SHELL_PROFILE"; then
            echo "export PATH=\"$RUBY_PATH:\$PATH\"" >> "$SHELL_PROFILE"
          fi
        fi

        check_done "Ruby"
      else
        print_warning "Skipping Ruby installation. CocoaPods installation may fail."
      fi
    else
      check_exists "Ruby"
      export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
    fi

    # Install CocoaPods with modern Ruby
    if ! /opt/homebrew/opt/ruby/bin/gem list cocoapods | grep -q cocoapods; then
      if timed_confirm "Install CocoaPods for iOS development?"; then
        check_installing "CocoaPods"
        sudo gem install cocoapods > /dev/null 2>&1 || true
        /opt/homebrew/opt/ruby/bin/gem install cocoapods > /dev/null 2>&1 || true
        check_done "CocoaPods"

        # Add Ruby gems bin to PATH (where pod executable is installed)
        RUBY_GEMS_BIN="/opt/homebrew/lib/ruby/gems/3.4.0/bin"
        export PATH="$RUBY_GEMS_BIN:$PATH"

        # Add to shell profile for persistence
        SHELL_PROFILE=""
        if [ -n "$ZSH_VERSION" ]; then
          SHELL_PROFILE="$HOME/.zshrc"
        elif [ -n "$BASH_VERSION" ]; then
          SHELL_PROFILE="$HOME/.bash_profile"
        fi

        if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
          if ! grep -q "export PATH=\"$RUBY_GEMS_BIN:\$PATH\"" "$SHELL_PROFILE"; then
            echo "export PATH=\"$RUBY_GEMS_BIN:\$PATH\"" >> "$SHELL_PROFILE"
          fi
        fi

        # Verify 'pod' command is now available
        if ! command -v pod &> /dev/null; then
            print_error "CocoaPods installed but 'pod' command not found in PATH. Please restart your terminal."
            die "Setup failed"
        fi
      else
        brew install cocoapods > /dev/null 2>&1 || true
        print_warning "Skipping CocoaPods installation."
      fi
    else
      check_exists "CocoaPods"
      # Ensure gems bin is in PATH even if CocoaPods already installed
      RUBY_GEMS_BIN="/opt/homebrew/lib/ruby/gems/3.4.0/bin"
      export PATH="$RUBY_GEMS_BIN:$PATH"
    fi

    # Install SwiftLint for code quality
    if ! command -v swiftlint &> /dev/null; then
      if timed_confirm "Install SwiftLint for Swift code quality checks?"; then
        check_installing "SwiftLint"
        brew install swiftlint > /dev/null 2>&1
        check_done "SwiftLint"
      else
        print_warning "Skipping SwiftLint installation."
      fi
    else
      check_exists "SwiftLint"
    fi

    print_success "iOS development configured"
    print_warning "MANUAL: Configure Apple Developer account in Xcode (Preferences > Accounts)"
  fi
  fi
fi



# AWS CLI
if ! aws --version &> /dev/null; then
  check_installing "AWS CLI"
  brew reinstall awscli > /dev/null 2>&1
  if ! aws --version &> /dev/null; then
    print_error "AWS CLI reinstall failed. Please check your Homebrew and Python setup."
    die "Setup failed"
  fi
  check_done "AWS CLI"
else
  check_exists "AWS CLI ($(aws --version | awk '{print $1}'))"
fi

section_end

section_start "Web development tools"

# ImageMagick (for icon generation)
if ! command -v magick &> /dev/null; then
  check_installing "ImageMagick"
  brew install imagemagick > /dev/null 2>&1
  check_done "ImageMagick"
else
  check_exists "ImageMagick"
fi

# Git (usually pre-installed but ensure latest)
if ! command -v git &> /dev/null; then
  check_installing "Git"
  brew install git > /dev/null 2>&1
  check_done "Git"
else
  check_exists "Git ($(git --version | awk '{print $3}'))"
fi

# Visual Studio Code
if ! command -v code &> /dev/null; then
  if timed_confirm "Visual Studio Code is recommended for development. Install? (Large download ~200MB)"; then
    check_installing "Visual Studio Code"
    brew install --cask visual-studio-code > /dev/null 2>&1
    check_done "Visual Studio Code"
  else
    print_warning "Skipping VS Code - you can install it later with: brew install --cask visual-studio-code"
  fi
else
  check_exists "Visual Studio Code"
fi



# Install VS Code extensions
if command -v code &> /dev/null; then
  if timed_confirm "Install VS Code extensions from .vscode/extensions.txt?"; then
    if [ -f ".vscode/extensions.txt" ]; then
      print_info "Installing VS Code extensions from .vscode/extensions.txt..."
      while IFS= read -r extension; do
        if [ -n "$extension" ]; then
          # Use 'code --install-extension' but suppress all output for already-installed extensions
          if ! code --list-extensions 2>/dev/null | grep -q "^${extension}$"; then
            check_installing "$extension"
            if code --install-extension "$extension" > /dev/null 2>&1; then
              check_done "$extension"
            else
              check_failed "$extension"
            fi
          fi
        fi
      done < ".vscode/extensions.txt"
      print_success "Extensions from .vscode/extensions.txt installed"
    else
      print_warning "No .vscode/extensions.txt found. Skipping extension installation."
    fi
  fi

  print_info "Installing comprehensive VS Code extensions..."

  # Essential extensions for our tech stack
  declare -a extensions=(
    "golang.go"                                    # Go language support
    "ms-vscode.vscode-typescript-next"            # TypeScript support
    "ms-vscode.vscode-node-azure-pack"            # Node.js development
    "amazonwebservices.aws-toolkit-vscode"        # AWS development
    "hashicorp.terraform"                         # Infrastructure as Code
    "ms-vscode-remote.remote-containers"          # Container development
    "ms-vscode-remote.remote-ssh"                 # Remote development
    "vscode-icons-team.vscode-icons"              # File icons
    "redhat.vscode-yaml"                          # YAML support
    "ms-python.python"                            # Python support (for automation)
    "bradlc.vscode-tailwindcss"                   # Tailwind CSS (future web app)
    "esbenp.prettier-vscode"                      # Code formatting
    "ms-vscode.test-adapter-converter"            # Testing support
    "hbenl.vscode-test-explorer"                  # Test explorer
    "ms-playwright.playwright"                    # Playwright test support
  )

  new_installs=0
  already_installed=0

  for extension in "${extensions[@]}"; do
    if ! code --list-extensions 2>/dev/null | grep -q "^${extension}$"; then
      check_installing "$extension"
      if code --install-extension "$extension" --force > /dev/null 2>&1; then
        check_done "$extension"
        new_installs=$((new_installs + 1))
      else
        check_failed "$extension"
      fi
    else
      already_installed=$((already_installed + 1))
    fi
  done

  if [ $new_installs -gt 0 ]; then
    print_success "Installed $new_installs new VS Code extensions"
  fi
  if [ $already_installed -gt 0 ]; then
    print_info "$already_installed extensions already installed"
  fi
fi

section_end

section_start "Browser automation and testing tools"

# Check if Playwright browsers are already installed
playwright_browsers_installed=false
if [ -d "$HOME/Library/Caches/ms-playwright" ] && [ -n "$(ls -A "$HOME/Library/Caches/ms-playwright" 2>/dev/null)" ]; then
  playwright_browsers_installed=true
fi

if [ "$playwright_browsers_installed" = true ]; then
  check_exists "Playwright browsers"
else
  if timed_confirm "Install Playwright browsers? (~500MB download)" 10 "N"; then
    check_installing "Playwright browsers"
    if npx playwright install > /dev/null 2>&1; then
      check_done "Playwright browsers"
    else
      check_failed "Playwright browsers"
    fi
  else
    print_warning "Skipping Playwright browsers."
  fi
fi

# Install Jest testing framework globally (for compatibility)
if ! command -v jest &> /dev/null; then
  check_installing "Jest"
  npm install -g jest@^29.5.0 > /dev/null 2>&1
  check_done "Jest"
else
  check_exists "Jest"
fi

section_end

section_start "Additional utilities"

# jq for JSON processing
if ! command -v jq &> /dev/null; then
  check_installing "jq"
  brew install jq > /dev/null 2>&1
  check_done "jq"
else
  check_exists "jq"
fi

# coreutils for timeout command (needed for multi-tenant tests)
if ! command -v gtimeout &> /dev/null; then
  check_installing "coreutils"
  brew install coreutils > /dev/null 2>&1
  check_done "coreutils"
else
  check_exists "coreutils"
fi

# curl and wget (usually pre-installed but ensure availability)
if ! command -v curl &> /dev/null; then
  check_installing "curl"
  brew install curl > /dev/null 2>&1
  check_done "curl"
fi

if ! command -v wget &> /dev/null; then
  check_installing "wget"
  brew install wget > /dev/null 2>&1
  check_done "wget"
fi

# Tree for directory visualization
if ! command -v tree &> /dev/null; then
  check_installing "tree"
  brew install tree > /dev/null 2>&1
  check_done "tree"
fi

# Git repository tools for large file management and history cleanup
if ! command -v bfg &> /dev/null; then
  check_installing "BFG Repo-Cleaner"
  brew install bfg > /dev/null 2>&1
  check_done "BFG Repo-Cleaner"
else
  check_exists "BFG Repo-Cleaner"
fi

if ! command -v git-lfs &> /dev/null; then
  check_installing "Git LFS"
  brew install git-lfs > /dev/null 2>&1
  git lfs install --system 2>/dev/null || git lfs install 2>/dev/null || true
  check_done "Git LFS"
else
  check_exists "Git LFS"
fi

if ! command -v git-filter-repo &> /dev/null; then
  check_installing "git-filter-repo"
  brew install git-filter-repo > /dev/null 2>&1
  check_done "git-filter-repo"
else
  check_exists "git-filter-repo"
fi

section_end

section_start "RecipeArchive monorepo setup"

# Install root dependencies first
if [ -f "package.json" ]; then
  print_info "Installing root monorepo dependencies..."
  timeout 300 npm install > /dev/null 2>&1

  # Set up pre-commit hooks
  print_info "Setting up Git pre-commit hooks..."
  npx husky init > /dev/null 2>&1 || true

  # Build shared types package
  if [ -d "packages/shared-types" ]; then
    print_info "Building shared types package..."
    (cd packages/shared-types && npm run build > /dev/null 2>&1)
    print_success "Shared types package built successfully"
  fi

  # Run type checking to verify setup
  print_info "Verifying TypeScript configuration..."
  npm run ts-check > /dev/null 2>&1 || print_warning "Type checking failed - check TypeScript configuration"

  print_success "Root monorepo dependencies installed and verified"
else
  print_warning "Root package.json not found - monorepo setup incomplete"
fi

# Setup AWS Backend Infrastructure
if [ -d "aws-backend/infrastructure" ]; then
  print_info "Setting up AWS CDK infrastructure dependencies..."
  cd aws-backend/infrastructure

  # Create CDK app entry point if missing
  if [ ! -f "bin/recipe-archive.ts" ]; then
    print_info "Creating missing CDK app entry point..."
    mkdir -p bin
    cat > bin/recipe-archive.ts <<'EOF'
#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RecipeArchiveStack } from "../lib/recipe-archive-stack";
import * as dotenv from "dotenv";

// Load environment variables from .env file if it exists
dotenv.config({ path: "../../.env" });

const app = new cdk.App();

// Get admin email from environment variable or use default
const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

// Create the main stack
new RecipeArchiveStack(app, "RecipeArchiveStack", {
  environment: "production",
  adminEmail: adminEmail,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
  description: "RecipeArchive production infrastructure stack",
});

app.synth();
EOF
    print_success "Created bin/recipe-archive.ts"
  fi

  if [ -f "package.json" ]; then
    timeout 180 npm install > /dev/null 2>&1
    print_success "AWS CDK dependencies installed"

    # Check if Lambda functions are built
    if [ ! -d "../functions/dist" ] || [ -z "$(ls -A ../functions/dist 2>/dev/null)" ]; then
      print_info "Lambda functions will be built during CDK deployment"
    else
      print_success "Lambda function packages already built"
    fi

    # Only verify CDK setup if Lambda functions are built
    if [ -d "../functions/dist" ] && [ -n "$(ls -A ../functions/dist 2>/dev/null)" ]; then
      if timed_confirm "Verify AWS CDK setup by synthesizing CloudFormation templates?" 10 "N"; then
        print_info "Synthesizing CDK templates..."
        npm run synth > /dev/null 2>&1 || print_warning "CDK synthesis failed - check AWS credentials and configuration"
      fi
    else
      print_info "CDK synthesis will be performed during deployment"
    fi
  fi

  # Return to repository root explicitly
  cd "$REPO_ROOT"
else
  print_warning "AWS backend directory not found - skipping AWS setup"
fi

# Setup Chrome extension
if [ -d "extensions/chrome" ]; then
  print_info "Setting up Chrome extension dependencies..."
  cd extensions/chrome

  # Fix quote style in env-config.js if it exists
  if [ -f "env-config.js" ]; then
    print_info "Fixing quote style in env-config.js..."
    sed -i.bak "s/typeof window !== 'undefined'/typeof window !== \"undefined\"/g" env-config.js
    sed -i.bak "s/typeof module !== 'undefined'/typeof module !== \"undefined\"/g" env-config.js
    rm -f env-config.js.bak
  fi

  # Install dependencies
  if [ -f "package.json" ]; then
    timeout 180 npm install > /dev/null 2>&1
    print_success "Chrome extension dependencies installed"
  fi

  # Create extension package
  if [ -f "manifest.json" ]; then
    print_info "Packing Chrome extension for distribution..."
    zip -r chrome-extension.zip . -x "node_modules/*" -x "chrome-extension.zip" > /dev/null 2>&1
    print_success "Chrome extension packed as chrome-extension.zip"
  fi

  cd - > /dev/null
else
  print_warning "Chrome extension directory not found - skipping Chrome setup"
fi

# Setup Safari extension
if [ -d "extensions/safari" ]; then
  print_info "Setting up Safari extension dependencies..."
  cd extensions/safari

  # Fix quote style in env-config.js if it exists
  if [ -f "env-config.js" ]; then
    print_info "Fixing quote style in env-config.js..."
    sed -i.bak "s/typeof window !== 'undefined'/typeof window !== \"undefined\"/g" env-config.js
    sed -i.bak "s/typeof module !== 'undefined'/typeof module !== \"undefined\"/g" env-config.js
    rm -f env-config.js.bak
  fi

  # Install dependencies
  if [ -f "package.json" ]; then
    timeout 180 npm install > /dev/null 2>&1
    print_success "Safari extension dependencies installed"
  fi

  cd - > /dev/null
else
  print_warning "Safari extension directory not found - skipping Safari setup"
fi

# Install extension test dependencies (do not run tests - that's for validate-monorepo.sh)
if [ -d "extensions/tests/safari" ]; then
  cd extensions/tests/safari

  # Install test dependencies if needed
  if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    print_info "Installing extension test dependencies..."
    timeout 180 npm install > /dev/null 2>&1
    print_success "Extension test dependencies installed"
  fi

  cd - > /dev/null
fi

section_end

section_start "Testing environment setup"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    print_info "Creating .env file from .env.example..."
    cp .env.example .env
    print_success ".env file created from template."
    print_warning "IMPORTANT: Edit .env and configure your AWS credentials and other settings"
  else
    print_warning ".env file not found and no .env.example template available"
    print_info "The .env file is optional for basic setup but required for:"
    print_info "  - AWS deployment and testing"
    print_info "  - Multi-tenant testing"
    print_info "  - Production deployments"
    print_info "You can create one later by copying .env.example"
  fi
fi

# Try to load environment variables if .env exists
if [ -f ".env" ]; then
  if [ "$VERBOSE" = true ]; then
    # Verbose mode: show all output from load-env.sh
    if source "$REPO_ROOT/scripts/load-env.sh"; then
      : # Success message already printed by load-env.sh
    else
      print_warning "Failed to load .env file - some features may not work"
      print_info "Edit .env to fix any syntax errors or missing required variables"
    fi
  else
    # Compact mode: suppress output from load-env.sh
    section_update "Loading .env"
    if source "$REPO_ROOT/scripts/load-env.sh" >/dev/null 2>&1; then
      section_update ".env loaded ✓"
    else
      section_update "Failed to load .env"
      section_fail ".env"
    fi
  fi
else
  print_info "Skipping .env load (file not present) - basic development will work"
fi

section_end

section_start "MCP servers for Claude Desktop"

# Check if Claude Desktop is installed
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

if [ -d "/Applications/Claude.app" ]; then
  print_success "Claude Desktop detected"

  # Create config directory if it doesn't exist
  if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    print_info "Creating Claude Desktop configuration directory..."
    mkdir -p "$CLAUDE_CONFIG_DIR"
  fi

  # Install MCP servers globally
  print_info "Installing MCP servers for development workflow..."

  # Install core MCP servers with timeout

  print_success "MCP servers installation completed"

  # Check if Claude Desktop MCP configuration already exists
  mcp_already_configured=false
  if [ -f "$CLAUDE_CONFIG_FILE" ] && grep -q "mcpServers" "$CLAUDE_CONFIG_FILE" 2>/dev/null; then
    mcp_already_configured=true
  fi

  # Create or update Claude Desktop configuration
  if [ "$mcp_already_configured" = true ]; then
    print_success "Claude Desktop MCP servers already configured"
  elif timed_confirm "Configure Claude Desktop MCP servers automatically?" 10 "N"; then
    print_info "Creating Claude Desktop MCP configuration..."

    # Load AWS credentials from .env if available
    AWS_ACCESS_KEY_ID=""
    AWS_SECRET_ACCESS_KEY=""
    AWS_REGION="us-west-2"

    if [ -f ".env" ]; then
      print_info "Loading AWS credentials from .env file..."
      AWS_ACCESS_KEY_ID=$(grep "^AWS_ACCESS_KEY_ID=" .env | cut -d'=' -f2)
      AWS_SECRET_ACCESS_KEY=$(grep "^AWS_SECRET_ACCESS_KEY=" .env | cut -d'=' -f2)
      AWS_REGION=$(grep "^AWS_REGION=" .env | cut -d'=' -f2 || echo "us-west-2")
    fi

    # Create comprehensive MCP configuration
    cat > "$CLAUDE_CONFIG_FILE" <<EOF
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": ""
      }
    },
      "command": "npx",
      "env": {}
    },
    "flutter-mcp": {
      "command": "npx",
      "args": ["-y", "flutter-mcp"],
      "env": {}
    },
    "dart-mcp": {
      "command": "dart",
      "args": ["mcp-server"],
      "env": {}
    },
    "npm-commands": {
      "command": "npx",
      "args": ["-y", "npm-command-runner-mcp"],
      "env": {}
    },
    "mcp-jest": {
      "command": "npx",
      "args": ["-y", "mcp-jest"],
      "env": {}
    },
    "browser-mcp": {
      "command": "npx",
      "args": ["-y", "browser-mcp"],
      "env": {}
    }
  }
}
EOF

    # Update with AWS credentials if available
    if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
      print_info "AWS credentials found - adding AWS MCP server configuration..."
      # Note: AWS MCP servers use Python/uvx, not npm
      print_warning "AWS MCP servers require Python/uvx installation (not included in this setup)"
    fi

    print_success "Claude Desktop MCP configuration created at: $CLAUDE_CONFIG_FILE"

    # Display configured servers
    print_info "Configured MCP servers:"
    print_info "  • GitHub MCP - Repository management, issues, PRs"
    print_info "  • Flutter MCP - Flutter/Dart development tools"
    print_info "  • Dart MCP - Official Dart tooling integration"
    print_info "  • NPM Commands MCP - Package management automation"
    print_info "  • Jest MCP - Testing framework integration"
    print_info "  • Browser MCP - Browser automation for web development"

    print_warning "IMPORTANT: Add your GitHub Personal Access Token to the configuration:"
    print_info "1. Generate token at: https://github.com/settings/personal-access-tokens"
    print_info "2. Edit: $CLAUDE_CONFIG_FILE"
    print_info "3. Add token to GITHUB_PERSONAL_ACCESS_TOKEN field"
    print_info "4. Restart Claude Desktop"

  else
    print_warning "Skipping MCP configuration - you can set it up manually later"
    print_info "MCP servers are installed globally and ready to configure"
  fi

else
  print_warning "Claude Desktop not found - installing MCP servers for future use"

  # Install MCP servers anyway for when Claude Desktop is installed
  print_info "Installing MCP servers globally..."
  print_success "MCP servers installation completed"

  print_info "To complete MCP setup after installing Claude Desktop:"
  print_info "1. Install Claude Desktop from https://claude.ai/download"
  print_info "2. Run this script again to configure MCP servers"
fi

section_end

section_start "MCP servers for Claude Code CLI"

# Ensure ~/.local/bin directory exists
LOCAL_BIN_DIR="$HOME/.local/bin"
if [ ! -d "$LOCAL_BIN_DIR" ]; then
  print_info "Creating ~/.local/bin directory..."
  mkdir -p "$LOCAL_BIN_DIR"
  print_success "Created ~/.local/bin directory"
fi

# Add ~/.local/bin to PATH if not already present
if [[ ":$PATH:" != *":$LOCAL_BIN_DIR:"* ]]; then
  print_info "Adding ~/.local/bin to PATH..."

  # Add to current session
  export PATH="$LOCAL_BIN_DIR:$PATH"

  # Add to shell profile for persistence
  SHELL_PROFILE=""
  if [ -n "$ZSH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
  elif [ -n "$BASH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi

  if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
    if ! grep -q "export PATH=\"\$HOME/.local/bin:\$PATH\"" "$SHELL_PROFILE"; then
      echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_PROFILE"
      print_success "Added ~/.local/bin to PATH in $SHELL_PROFILE"
    fi
  fi
fi

# Install Claude Code CLI if not available
if ! command -v claude &> /dev/null; then
  print_info "Installing Claude Code CLI..."

  # Try multiple installation methods
  if timed_confirm "Install Claude Code CLI? This enables advanced MCP server integration." 10 "Y"; then

    # Method 1: Try npm global install
    if command -v npm &> /dev/null; then
      print_info "Installing via npm..."
      timeout 120 npm install -g @anthropics/claude-cli || print_warning "npm installation failed or timed out, trying alternative method"
    fi

    # Method 2: Try downloading binary directly
    if ! command -v claude &> /dev/null; then
      print_info "Downloading Claude Code CLI binary..."

      # Detect architecture
      ARCH=$(uname -m)
      if [ "$ARCH" = "arm64" ]; then
        CLAUDE_URL="https://storage.googleapis.com/anthropic-cli/claude-macos-arm64"
      else
        CLAUDE_URL="https://storage.googleapis.com/anthropic-cli/claude-macos-x64"
      fi

      # Download and install
      if curl -L "$CLAUDE_URL" -o "$LOCAL_BIN_DIR/claude" 2>/dev/null; then
        chmod +x "$LOCAL_BIN_DIR/claude"
        print_success "Claude Code CLI binary installed"
      else
        print_warning "Failed to download Claude Code CLI binary"
      fi
    fi

    # Method 3: Manual installation instructions
    if ! command -v claude &> /dev/null; then
      print_warning "Automatic installation failed. Manual installation required:"
      print_info "1. Visit: https://claude.ai/cli"
      print_info "2. Download the appropriate binary for macOS"
      print_info "3. Move to ~/.local/bin/claude and make executable"
      print_info "4. Restart terminal and run this script again"
    fi
  else
    print_warning "Skipping Claude Code CLI installation"
  fi
fi

# Check if Claude Code CLI is available after installation attempt
if command -v claude &> /dev/null; then
  print_success "Claude Code CLI detected"

  # Configure essential MCP servers for Claude Code
  print_info "Configuring MCP servers for Claude Code development workflow..."

  # Add GitHub MCP server (requires authentication)
  if ! timeout 10 claude mcp list 2>/dev/null | grep -q "github"; then
    check_installing "GitHub MCP server"
    if timeout 30 claude mcp add github npx @modelcontextprotocol/server-github --scope user 2>/dev/null; then
      check_done "GitHub MCP server"
    else
      check_failed "GitHub MCP server"
    fi
  else
    check_exists "GitHub MCP server"
  fi

  # Add filesystem MCP server for project directory
  if ! timeout 10 claude mcp list 2>/dev/null | grep -q "filesystem"; then
    check_installing "Filesystem MCP server"
    if timeout 30 claude mcp add filesystem npx @modelcontextprotocol/server-filesystem "$(pwd)" --scope user 2>/dev/null; then
      check_done "Filesystem MCP server"
    else
      check_failed "Filesystem MCP server"
    fi
  else
    check_exists "Filesystem MCP server"
  fi

  # Add Flutter MCP server
  if ! timeout 10 claude mcp list 2>/dev/null | grep -q "flutter"; then
    check_installing "Flutter MCP server"
    if timeout 30 claude mcp add flutter npx flutter-mcp --scope user 2>/dev/null; then
      check_done "Flutter MCP server"
    else
      check_failed "Flutter MCP server"
    fi
  else
    check_exists "Flutter MCP server"
  fi

  print_warning "IMPORTANT: Set up GitHub authentication:"
  print_info "1. Generate a GitHub Personal Access Token"
  print_info "2. Set GITHUB_TOKEN environment variable or configure in Claude Code"

else
  print_warning "Claude Code CLI not found after installation attempts"
  print_info "To set up Claude Code MCP servers manually later:"
  print_info "1. Install Claude Code CLI from https://claude.ai/cli"
  print_info "2. Ensure ~/.local/bin is in your PATH"
  print_info "3. Run: claude mcp add github npx @modelcontextprotocol/server-github --scope user"
  print_info "4. Run: claude mcp add filesystem npx @modelcontextprotocol/server-filesystem \$(pwd) --scope user"
  print_info "6. Run: claude mcp add flutter npx flutter-mcp --scope user"
fi

section_end

# Final setup summary and manual steps
if [ "$VERBOSE" = true ]; then
  echo ""
  print_info "Setup completed! Summary and next steps..."
fi

# Installation summary (use while loop with echo -e to interpret ANSI escape sequences)
while IFS= read -r line || [ -n "$line" ]; do echo -e "$line"; done <<EOM

${COLOR_GREEN}✅ INSTALLATION SUMMARY${COLOR_RESET}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️  Core Tools Installed:
   • Homebrew (package manager)
   • Node.js and npm (JavaScript runtime)
   • TypeScript (language compiler)
   • Go (backend development)
   • AWS CLI (cloud deployment)
   • AWS CDK (infrastructure as code)
   • Git (version control)
   • ImageMagick (icon processing)

📝 Development Environment:
   • Visual Studio Code (IDE)
   • ESLint + Prettier (code quality)
   • Jest (testing framework)
   • Comprehensive VS Code extensions
   • Environment variables configured

🧪 Testing Infrastructure:
   • Jest (unit testing)
   • Playwright (browser automation)
   • Cross-platform compatibility tests
   • Authentication test setup
   • TypeScript compilation verification

🤖 MCP Servers for AI Development:
   • Claude Desktop: GitHub, ESLint, Flutter/Dart, Jest, Browser, NPM Commands
   • Claude Code: GitHub, Filesystem, ESLint, Flutter
   • Cross-platform AI-powered development workflow
   • Repository management and code quality automation

📦 Monorepo Dependencies:
   • Root workspace configured
   • Shared types package built
   • Chrome extension ready
   • Safari extension ready
   • AWS CDK infrastructure ready
   • All npm dependencies installed
   • Extension packages created

${COLOR_YELLOW}📋 MANUAL STEPS REQUIRED${COLOR_RESET}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ${COLOR_BLUE}Load Chrome Extension:${COLOR_RESET}
   • Open Chrome → chrome://extensions/
   • Enable "Developer Mode"
   • Click "Load unpacked" → select extensions/chrome/

2. ${COLOR_BLUE}Load Safari Extension:${COLOR_RESET}
   • Open Safari → Preferences → Extensions
   • Enable Developer Extensions
   • Load extensions/safari/ (may require Xcode build)

3. ${COLOR_BLUE}Configure AWS Credentials:${COLOR_RESET}
   • Run: aws configure
   • Enter AWS Access Key, Secret Key, Region (us-west-2)
   • Verify: aws sts get-caller-identity

4. ${COLOR_BLUE}Deploy AWS Infrastructure:${COLOR_RESET}
   • Navigate: cd aws-backend/infrastructure
   • Deploy: npm run deploy
   • Note the outputs (API Gateway URL, Cognito User Pool ID)

5. ${COLOR_BLUE}Test Monorepo Setup:${COLOR_RESET}
   • Restart terminal to load environment variables
   • Run: npm run type-check (should pass)
   • Run: npm run build (should build shared types)

6. ${COLOR_BLUE}Test Extensions:${COLOR_RESET}
   • Run Chrome tests: cd extensions/chrome && npm test
   • Run Safari tests: cd extensions/safari && npm test
   • Run compatibility: npm run test (from root)

7. ${COLOR_BLUE}MCP Server Setup:${COLOR_RESET}
   • Claude Desktop: Add GitHub Personal Access Token to config file
   • Claude Desktop: Restart application to load MCP servers
   • Claude Code: Set GITHUB_TOKEN environment variable for authentication
   • Test MCP functionality: "List my GitHub repositories"
   • Optional: Install AWS MCP servers with Python/uvx

8. ${COLOR_BLUE}Mobile Development Setup:${COLOR_RESET}
   • Complete Android Studio setup (install SDK, accept licenses)
   • Install Xcode from App Store (~15GB download)
   • Configure Apple Developer account in Xcode
   • Run: flutter doctor (should show no issues)
   • Test mobile validation: ./validate-monorepo.sh --mobile

9. ${COLOR_BLUE}Mobile Environment Variables:${COLOR_RESET}
   • Update .env with actual Android SDK paths
   • Add iOS development team ID and bundle identifier
   • Configure mobile app signing certificates

${COLOR_GREEN}🚀 QUICK START COMMANDS${COLOR_RESET}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Validate entire monorepo (tests, builds, linting)
./validate-monorepo.sh --all

# Deploy AWS infrastructure
cd aws-backend/infrastructure && npm run deploy

# Build mobile apps
./scripts/ios/build.sh --dev --run
./scripts/android/build.sh --dev --run

# Format all code
npm run format

${COLOR_BLUE}📖 Documentation:${COLOR_RESET}
• Project guide: ./docs/development/claude-context.md
• Chrome extension: ./extensions/chrome/README.md
• Safari extension: ./extensions/safari/README.md

EOM

echo ""

# Display error report only if there were failures
if [ ${#FAILED_INSTALLS[@]} -gt 0 ]; then
  echo ""
  log_header "Installation Issues Detected"
  print_error "The following components failed to install:"
  echo ""
  for failed_item in "${FAILED_INSTALLS[@]}"; do
    print_error "  • $failed_item"
  done
  echo ""
  print_warning "Recommended Actions:"
  print_info "1. Try running the script again: ./scripts/setup-macos.sh --yes"
  print_info "2. Check error messages above for specific failures"
  print_info "3. Install failed components manually"
  print_info "4. Run validation to check what's working: ./validate-monorepo.sh --all"
  echo ""
fi

# Check if .env file exists and show critical warning if not
if [ ! -f ".env" ]; then
  print_warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  print_warning "⚠️  CRITICAL: .env FILE REQUIRED"
  print_warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  print_error "No .env file found! You MUST create one before proceeding."
  print_info ""
  print_info "The .env file contains essential configuration:"
  print_info "• AWS credentials and region"
  print_info "• S3 bucket names"
  print_info "• Cognito User Pool ID and Client ID"
  print_info "• API Gateway endpoints"
  print_info "• Admin authentication tokens"
  print_info ""
  print_info "How to create your .env file:"
  if [ -f ".env.example" ]; then
    print_info "1. Copy the template: cp .env.example .env"
    print_info "2. Edit .env and fill in your values"
  else
    print_info "1. Create .env file in repository root"
    print_info "2. Add required environment variables (see documentation)"
  fi
  print_info "3. Configure AWS credentials: aws configure"
  print_info "4. Deploy infrastructure to get endpoint values"
  print_info ""
  print_warning "Without .env file, validate-monorepo.sh --all WILL FAIL"
  print_warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  print_info ""
fi

print_info "To validate your setup, run: ./validate-monorepo.sh --all"

print_info ""
print_info "🔧 Next Steps for AWS Setup:"
print_info "1. Set up AWS account and IAM user (see docs/setup/aws-setup.md)"
print_info "2. Configure AWS CLI: aws configure"
print_info "3. Set up Free Tier monitoring: ./scripts/setup-aws-billing-controls.sh"
print_info "4. Bootstrap CDK: cd aws-backend/infrastructure && npx cdk bootstrap"
print_info "5. Deploy infrastructure: npx cdk deploy"
print_info ""
print_info "📖 Documentation:"
print_info "• AWS setup guide: ./docs/setup/aws-setup.md"
print_info "• Project guide: ./docs/development/claude-context.md"
print_info "• Chrome extension: ./extensions/chrome/README.md"
print_info "• Safari extension: ./extensions/safari/README.md"
print_info ""
print_warning "⚠️  Important:"
print_info "• Check your email and confirm SNS subscription after running billing controls"
print_info "• Monitor AWS Free Tier usage regularly to avoid charges"
print_info "• Restart your terminal to ensure all environment variables are loaded"
