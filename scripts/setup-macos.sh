#!/bin/bash

################################################################################
#
# RecipeArchive Project Setup Script for macOS
#
# This script installs comprehensive development dependencies for the
# RecipeArchive project on macOS.
#
# USAGE:
#   ./setup-macos.sh
#
# NOTES:
#   - This script is designed to be run on macOS only.
#   - It will install a lot of tools and may ask for your password.
#
################################################################################

# Get script directory and repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# RecipeArchive Project Setup Script for macOS
# Enhanced with comprehensive dependency management and confirmation prompts

set -e

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# If a .env file exists in the current directory, source it
if [ -f ".env" ]; then
  # shellcheck disable=SC1091
  source ".env"
fi

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function for timed confirmation (15 seconds default to 'N')
timed_confirm() {
    local message="$1"
    local timeout="${2:-15}"
    local default="${3:-N}"
    
    print_warning "$message"
    echo -n "Continue? [y/N] (auto-${default} in ${timeout}s): "
    
    if read -t "$timeout" -r response; then
        case "$response" in
            [yY]|[yY][eE][sS]) return 0 ;;
            *) return 1 ;;
        esac
    else
        echo ""
        if [ "$default" = "Y" ]; then
            print_info "Timed out, defaulting to YES"
            return 0
        else
            print_info "Timed out, defaulting to NO"
            return 1
        fi
    fi
}

print_info "🚀 RecipeArchive Project Setup Script for macOS"
print_info "This script will install comprehensive development dependencies"

# Ensure we're in the repository root directory
cd "$REPO_ROOT"
print_info "Working from repository root: $REPO_ROOT"

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
  if timed_confirm "Homebrew is required but not installed. Install Homebrew? (Large download ~100MB)"; then
    print_info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if ! command -v brew &> /dev/null; then
      print_error "Homebrew installation failed. Please install Homebrew manually."
      exit 1
    fi
    print_success "Homebrew installed successfully"
  else
    print_error "Homebrew is required for this setup. Exiting."
    exit 1
  fi
else
  print_success "Homebrew already installed"
fi

# Essential development tools
print_info "Installing essential development tools..."

# Install Node.js and npm
if ! command -v node &> /dev/null; then
  print_info "Installing Node.js and npm..."
  brew install node
  if ! command -v node &> /dev/null; then
    print_error "Node.js installation failed. Please install Node.js manually."
    exit 1
  fi
  print_success "Node.js installed: $(node --version)"
else
  print_success "Node.js already installed: $(node --version)"
fi

# Install TypeScript globally
if ! command -v tsc &> /dev/null; then
  print_info "Installing TypeScript globally..."
  timeout 180 npm install -g typescript
  if ! command -v tsc &> /dev/null; then
    print_error "TypeScript installation failed. Please install TypeScript manually."
    exit 1
  fi
  print_success "TypeScript installed: $(tsc --version)"
else
  print_success "TypeScript already installed: $(tsc --version)"
fi

# Install AWS CDK globally
if ! command -v cdk &> /dev/null; then
  print_info "Installing AWS CDK globally..."
  timeout 180 npm install -g aws-cdk@2.87.0
  if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK installation failed. Please install AWS CDK manually."
    exit 1
  fi
  print_success "AWS CDK installed: $(cdk --version)"
else
  print_success "AWS CDK already installed: $(cdk --version)"
fi

# Install Go
if ! command -v go &> /dev/null; then
  print_info "Installing Go..."
  brew install go
  if ! command -v go &> /dev/null; then
    print_error "Go installation failed. Please install Go manually."
    exit 1
  fi
  print_success "Go installed: $(go version)"
else
  print_success "Go already installed: $(go version)"
fi

# Install Xcode CLI tools (required for iOS/Swift development)
if ! xcode-select -p &> /dev/null; then
  if timed_confirm "Xcode CLI tools are required for iOS development. Install? (Large download ~500MB)"; then
    print_info "Installing Xcode CLI tools..."
    xcode-select --install
    print_info "Please follow the on-screen instructions to install the Xcode CLI tools."
    print_info "Waiting for installation to complete..."
    max_wait=300 # 5 minutes
    wait_interval=10
    waited=0
    while [ $waited -lt $max_wait ]; do
      if xcode-select -p &> /dev/null; then
        print_success "Xcode CLI tools installed successfully"
        break
      fi
      sleep $wait_interval
      waited=$((waited + wait_interval))
    done
    if ! xcode-select -p &> /dev/null; then
      print_error "Xcode CLI tools installation timed out. Please complete the installation and run this script again."
      exit 1
    fi
  else
    print_warning "Skipping Xcode CLI tools - iOS development will not be available"
  fi
else
  print_success "Xcode CLI tools already installed"
fi

# Mobile Development Setup
print_info "Setting up mobile development environment..."

# Flutter SDK Installation
if ! command -v flutter &> /dev/null; then
  if timed_confirm "Flutter SDK is required for mobile app development. Install? (Large download ~1GB)"; then
    print_info "Installing Flutter SDK via Homebrew..."
    brew install flutter
    
    # Add Flutter to PATH (prioritize Flutter's Dart over Homebrew's)
    FLUTTER_PATH="/opt/homebrew/share/flutter/bin"
    export PATH="$FLUTTER_PATH:$PATH"
    
    # Configure Flutter to use correct Android SDK
    flutter config --android-sdk "$ANDROID_HOME" > /dev/null 2>&1 || true
    
    # Add to shell profile
    SHELL_PROFILE=""
    if [ -n "$ZSH_VERSION" ]; then
      SHELL_PROFILE="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
      SHELL_PROFILE="$HOME/.bash_profile"
    fi
    
    if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
      if ! grep -q "export PATH=\"/opt/homebrew/share/flutter/bin:\$PATH\"" "$SHELL_PROFILE"; then
        echo "export PATH=\"/opt/homebrew/share/flutter/bin:\$PATH\"" >> "$SHELL_PROFILE"
        print_success "Added Flutter to PATH in $SHELL_PROFILE"
      fi
    fi
    
    print_success "Flutter SDK installed: $(flutter --version | head -1)"
  else
    print_warning "Skipping Flutter - mobile development will not be available"
  fi
else
  print_success "Flutter already installed: $(flutter --version | head -1)"
  
  # Ensure Flutter is configured correctly even if already installed
  FLUTTER_PATH="/opt/homebrew/share/flutter/bin"
  export PATH="$FLUTTER_PATH:$PATH"
  flutter config --android-sdk "$ANDROID_HOME" > /dev/null 2>&1 || true
fi

# Android Development Setup
if timed_confirm "Set up Android development environment?"; then
  print_info "Setting up Android development..."
  
  # Install Android Studio
  if [ ! -d "/Applications/Android Studio.app" ]; then
    if timed_confirm "Install Android Studio? (Large download ~2GB)"; then
      print_info "Installing Android Studio..."
      brew install --cask android-studio
      print_success "Android Studio installed"
    else
      print_warning "Skipping Android Studio installation. You can install it manually later."
    fi
  else
    print_success "Android Studio already installed"
  fi
  
  # Install Android SDK command-line tools
  if ! command -v sdkmanager &> /dev/null; then
    if timed_confirm "Install Android SDK command-line tools?"; then
      print_info "Installing Android SDK command-line tools..."
      brew install --cask android-commandlinetools
      print_success "Android SDK command-line tools installed"
    else
      print_warning "Skipping Android SDK installation. Android development will not be available."
    fi
  else
    print_success "Android SDK command-line tools already installed"
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
    print_info "Installing Android platform-tools and system image..."
    timeout 300 sdkmanager "platform-tools" "system-images;android-33;google_apis;x86_64" > /dev/null 2>&1 || true
    print_success "Android platform-tools and system image installed"
  fi
  
  # Install Android command-line tools and accept licenses
  if command -v sdkmanager &> /dev/null; then
    print_info "Installing Android command-line tools..."
    timeout 30 sdkmanager "cmdline-tools;latest" > /dev/null 2>&1 || true

    print_info "Accepting Android SDK licenses..."
    timeout 60 bash -c "yes | flutter doctor --android-licenses" > /dev/null 2>&1 || print_warning "'flutter doctor --android-licenses' timed out or failed. Please run it manually."
    print_success "Android SDK setup completed"
  fi
  
  print_success "Android development environment configured"
  print_warning "MANUAL STEP: Complete Android Studio setup if needed"
  print_info "1. Open Android Studio (first launch will complete SDK setup)"
  print_info "2. Follow setup wizard if prompted"
  print_info "3. Install additional SDK components as needed"
else
  print_warning "Skipping Android setup - Android development will not be available"
fi

# iOS Development Setup
if timed_confirm "Set up iOS development environment?"; then
  print_info "Setting up iOS development..."
  
  # Check if Xcode is installed
  if [ ! -d "/Applications/Xcode.app" ]; then
    print_warning "Xcode not found. Please install from App Store:"
    print_info "1. Open App Store"
    print_info "2. Search for 'Xcode'"
    print_info "3. Install Xcode (~15GB download)"
    print_info "4. Run this script again after installation"
  else
    print_success "Xcode already installed"
    
    # Install modern Ruby (required for CocoaPods)
    if ! brew list ruby &> /dev/null; then
      if timed_confirm "Install modern Ruby for CocoaPods?"; then
        print_info "Installing modern Ruby via Homebrew..."
        brew install ruby
        
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
            print_success "Added Homebrew Ruby to PATH in $SHELL_PROFILE"
          fi
        fi
        
        print_success "Modern Ruby installed: $(/opt/homebrew/opt/ruby/bin/ruby --version)"
      else
        print_warning "Skipping Ruby installation. CocoaPods installation may fail."
      fi
    else
      print_success "Modern Ruby already installed via Homebrew"
      export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
    fi
    
    # Install CocoaPods with modern Ruby
    if ! /opt/homebrew/opt/ruby/bin/gem list cocoapods | grep -q cocoapods; then
      if timed_confirm "Install CocoaPods for iOS development?"; then
        print_info "Installing CocoaPods with modern Ruby..."
        /opt/homebrew/opt/ruby/bin/gem install cocoapods
        print_success "CocoaPods installed"
      else
        print_warning "Skipping CocoaPods installation. iOS development may not work correctly."
      fi
    else
      print_success "CocoaPods already installed"
    fi
    
    # Set up iOS development team (will be configured in .env)
    print_info "iOS development environment ready"
    print_warning "MANUAL STEP: Configure Apple Developer account in Xcode"
    print_info "1. Open Xcode"
    print_info "2. Go to Preferences > Accounts"
    print_info "3. Add your Apple ID"
    print_info "4. Select your development team"
  fi
else
  print_warning "Skipping iOS setup - iOS development will not be available"
fi

# Java Development Kit (required for Android)
if ! command -v java &> /dev/null; then
  print_info "Installing Java Development Kit..."
  brew install openjdk@17
  
  # Add Java to PATH
  JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  export JAVA_HOME
  export PATH="$JAVA_HOME/bin:$PATH"
  
  # Add to shell profile
  SHELL_PROFILE=""
  if [ -n "$ZSH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
  elif [ -n "$BASH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi
  
  if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
    if ! grep -q "JAVA_HOME" "$SHELL_PROFILE"; then
      cat >> "$SHELL_PROFILE" <<EOF

# Java Development
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH=\$JAVA_HOME/bin:\$PATH
EOF
      print_success "Added Java environment variables to $SHELL_PROFILE"
    fi
  fi
  
  print_success "Java Development Kit installed"
else
  print_success "Java already installed: $(java -version 2>&1 | head -1)"
fi

# AWS CLI
if ! command -v aws &> /dev/null; then
  print_info "Installing AWS CLI..."
  brew install awscli
  print_success "AWS CLI installed: $(aws --version)"
else
  print_success "AWS CLI already installed: $(aws --version)"
fi

# Essential tools for web extension development
print_info "Installing web development tools..."

# ImageMagick (for icon generation)
if ! command -v magick &> /dev/null; then
  print_info "Installing ImageMagick for icon processing..."
  brew install imagemagick
  print_success "ImageMagick installed"
else
  print_success "ImageMagick already installed"
fi

# Git (usually pre-installed but ensure latest)
if ! command -v git &> /dev/null; then
  print_info "Installing Git..."
  brew install git
  print_success "Git installed"
else
  print_success "Git already available: $(git --version)"
fi

# Large installations with confirmation prompts
print_info "Checking for large development tools..."

# Visual Studio Code
if ! command -v code &> /dev/null; then
  if timed_confirm "Visual Studio Code is recommended for development. Install? (Large download ~200MB)"; then
    print_info "Installing Visual Studio Code..."
    brew install --cask visual-studio-code
    print_success "Visual Studio Code installed"
  else
    print_warning "Skipping VS Code - you can install it later with: brew install --cask visual-studio-code"
  fi
else
  print_success "Visual Studio Code already installed"
fi

# VS Code Extensions (if VS Code is available)
if command -v code &> /dev/null; then
  print_info "Installing comprehensive VS Code extensions..."
  
  # Essential extensions for our tech stack
  declare -a extensions=(
    "golang.go"                                    # Go language support
    "dbaeumer.vscode-eslint"                      # ESLint for JavaScript/TypeScript
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
  
  for extension in "${extensions[@]}"; do
    if ! code --list-extensions | grep -q "$extension"; then
      print_info "Installing $extension..."
      if code --install-extension "$extension" --force; then
        print_success "$extension installed successfully"
      else
        print_error "Failed to install $extension"
      fi
    else
      print_success "$extension already installed"
    fi
  done
  
  print_success "VS Code extensions installation complete"
else
  print_warning "VS Code not available - skipping extensions"
fi

# Install browser automation tools
print_info "Setting up browser automation and testing tools..."

if timed_confirm "Install/update Playwright browsers? (~500MB download)" 10 "Y"; then
  print_info "Installing Playwright browsers..."
  if npx playwright install; then
    print_success "Playwright browsers installed"
  else
    print_error "Playwright browser installation failed. Please run 'npx playwright install' manually."
  fi
else
  print_warning "Skipping Playwright browser installation. Browser automation tests will not work."
fi

# Install Jest testing framework globally (for compatibility)
if ! command -v jest &> /dev/null; then
  print_info "Installing Jest testing framework..."
  npm install -g jest@^29.5.0
  print_success "Jest installed globally"
else
  print_success "Jest already available"
fi

# Additional development tools
print_info "Installing additional development utilities..."

# jq for JSON processing
if ! command -v jq &> /dev/null; then
  print_info "Installing jq for JSON processing..."
  brew install jq
  print_success "jq installed"
else
  print_success "jq already installed"
fi

# coreutils for timeout command (needed for multi-tenant tests)
if ! command -v gtimeout &> /dev/null; then
  print_info "Installing coreutils for timeout command..."
  brew install coreutils
  print_success "coreutils installed (gtimeout available)"
else
  print_success "coreutils already installed"
fi

# curl and wget (usually pre-installed but ensure availability)
if ! command -v curl &> /dev/null; then
  brew install curl
fi

if ! command -v wget &> /dev/null; then
  brew install wget
fi

# Tree for directory visualization
if ! command -v tree &> /dev/null; then
  print_info "Installing tree for directory visualization..."
  brew install tree
  print_success "tree installed"
fi

# Git repository tools for large file management and history cleanup
if ! command -v bfg &> /dev/null; then
  print_info "Installing BFG Repo-Cleaner for git history cleanup..."
  brew install bfg
  print_success "BFG Repo-Cleaner installed"
else
  print_success "BFG Repo-Cleaner already installed"
fi

if ! command -v git-lfs &> /dev/null; then
  print_info "Installing Git Large File Storage..."
  brew install git-lfs
  # Initialize git-lfs for the user
  git lfs install --system 2>/dev/null || git lfs install 2>/dev/null || true
  print_success "Git LFS installed and initialized"
else
  print_success "Git LFS already installed"
fi

if ! command -v git-filter-repo &> /dev/null; then
  print_info "Installing git-filter-repo for advanced history rewriting..."
  brew install git-filter-repo
  print_success "git-filter-repo installed"
else
  print_success "git-filter-repo already installed"
fi

# Project-specific setup
print_info "Setting up RecipeArchive monorepo dependencies..."

# Install root dependencies first
if [ -f "package.json" ]; then
  print_info "Installing root monorepo dependencies..."
  timeout 300 npm install
  
  # Set up pre-commit hooks
  print_info "Setting up Git pre-commit hooks..."
  npx husky init || true
  
  # Build shared types package
  if [ -d "packages/shared-types" ]; then
    print_info "Building shared types package..."
    cd packages/shared-types
    npm run build
    cd - > /dev/null
    print_success "Shared types package built successfully"
  fi
  
  # Run type checking to verify setup
  print_info "Verifying TypeScript configuration..."
  npm run ts-check || print_warning "Type checking failed - check TypeScript configuration"
  
  # Run linting to verify code quality setup
  print_info "Verifying code quality setup..."
  npm run lint || { print_error "Linting failed - check ESLint configuration"; exit 1; }
  
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
    timeout 180 npm install
    print_success "AWS CDK dependencies installed"

    # Check if Lambda functions are built
    if [ ! -d "../functions/dist" ] || [ -z "$(ls -A ../functions/dist 2>/dev/null)" ]; then
      print_info "Lambda function packages not found. They will be built during CDK deployment."
      print_info "To build them now, run: cd aws-backend/functions && make build"
    else
      print_success "Lambda function packages already built"
    fi

    # Verify CDK setup
    if timed_confirm "Verify AWS CDK setup by synthesizing CloudFormation templates?" 10 "Y"; then
      print_info "Synthesizing CDK templates..."
      npm run synth || print_warning "CDK synthesis failed - check AWS credentials and configuration"
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
    timeout 180 npm install
    print_success "Chrome extension dependencies installed"

    # Run tests to verify setup
    if timed_confirm "Run Chrome extension tests to verify setup?" 10 "Y"; then
      npm test || print_warning "Some tests may have failed - check configuration"
      npm run lint || print_warning "Linting issues found - run 'npm run lint:fix' to resolve"
    fi
  fi
  
  # Create extension package
  if [ -f "manifest.json" ]; then
    print_info "Packing Chrome extension for distribution..."
    zip -r chrome-extension.zip . -x "node_modules/*" -x "chrome-extension.zip"
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
    timeout 180 npm install
    print_success "Safari extension dependencies installed"

    # Run tests to verify setup
    if timed_confirm "Run Safari extension tests to verify setup?" 10 "Y"; then
      npm test || print_warning "Some tests may have failed - check configuration"
      npm run lint || print_warning "Linting issues found - run 'npm run lint:fix' to resolve"
    fi
  fi

  cd - > /dev/null
else
  print_warning "Safari extension directory not found - skipping Safari setup"
fi

# Run cross-platform compatibility test
if [ -f "test-payload-compatibility.js" ]; then
  if timed_confirm "Run cross-platform payload compatibility test?" 10 "Y"; then
    print_info "Running payload compatibility test..."
    node test-payload-compatibility.js || print_warning "Payload compatibility test failed - check extension implementations"
  fi
fi

# Environment variable setup for testing
print_info "Setting up testing environment..."
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  print_info "Creating .env file from .env.example..."
  cp .env.example .env
  print_success ".env file created."
fi

print_info "Loading environment variables from .env file..."
source "$REPO_ROOT/scripts/load-env.sh"

# MCP Server Setup for Claude Desktop
print_info "Setting up MCP (Model Context Protocol) servers for Claude Desktop..."

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
  timeout 300 npm install -g @modelcontextprotocol/server-github @eslint/mcp flutter-mcp mcp-jest browser-mcp mcp-framework --force || print_warning "MCP server installation timed out or failed"

  print_success "MCP servers installation completed"

  # Create or update Claude Desktop configuration
  if timed_confirm "Configure Claude Desktop MCP servers automatically?" 10 "Y"; then
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
    "eslint": {
      "command": "npx",
      "args": ["-y", "@eslint/mcp@latest"],
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
    echo "  ✅ GitHub MCP - Repository management, issues, PRs"
    echo "  ✅ ESLint MCP - Code linting and quality checks"
    echo "  ✅ Flutter MCP - Flutter/Dart development tools"
    echo "  ✅ Dart MCP - Official Dart tooling integration"
    echo "  ✅ NPM Commands MCP - Package management automation"
    echo "  ✅ Jest MCP - Testing framework integration"
    echo "  ✅ Browser MCP - Browser automation for web development"

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
  timeout 300 npm install -g @modelcontextprotocol/server-github @eslint/mcp flutter-mcp mcp-jest browser-mcp mcp-framework --force || print_warning "MCP server installation timed out or failed"
  print_success "MCP servers installation completed"

  print_info "To complete MCP setup after installing Claude Desktop:"
  print_info "1. Install Claude Desktop from https://claude.ai/download"
  print_info "2. Run this script again to configure MCP servers"
fi

# Claude Code MCP Server Setup
print_info "Setting up MCP servers for Claude Code CLI..."

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
    print_info "Adding GitHub MCP server to Claude Code..."
    timeout 30 claude mcp add github npx @modelcontextprotocol/server-github --scope user 2>/dev/null || print_warning "GitHub MCP server setup failed - may require authentication"
  else
    print_success "GitHub MCP server already configured"
  fi

  # Add filesystem MCP server for project directory
  if ! timeout 10 claude mcp list 2>/dev/null | grep -q "filesystem"; then
    print_info "Adding filesystem MCP server for project directory..."
    timeout 30 claude mcp add filesystem npx @modelcontextprotocol/server-filesystem "$(pwd)" --scope user 2>/dev/null || print_warning "Filesystem MCP server setup failed"
  else
    print_success "Filesystem MCP server already configured"
  fi

  # Add ESLint MCP server
  if ! timeout 10 claude mcp list 2>/dev/null | grep -q "eslint"; then
    print_info "Adding ESLint MCP server..."
    timeout 30 claude mcp add eslint npx @eslint/mcp --scope user 2>/dev/null || print_warning "ESLint MCP server setup failed"
  else
    print_success "ESLint MCP server already configured"
  fi

  # Add Flutter MCP server
  if ! timeout 10 claude mcp list 2>/dev/null | grep -q "flutter"; then
    print_info "Adding Flutter MCP server..."
    timeout 30 claude mcp add flutter npx flutter-mcp --scope user 2>/dev/null || print_warning "Flutter MCP server setup failed"
  else
    print_success "Flutter MCP server already configured"
  fi

  print_success "Claude Code MCP servers configured"
  print_info "Configured MCP servers for Claude Code:"
  echo "  ✅ GitHub - Repository operations and issue management"
  echo "  ✅ Filesystem - Project file operations"
  echo "  ✅ ESLint - Code quality and linting"
  echo "  ✅ Flutter - Dart/Flutter development tools"

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
  print_info "5. Run: claude mcp add eslint npx @eslint/mcp --scope user"
  print_info "6. Run: claude mcp add flutter npx flutter-mcp --scope user"
fi

# Final setup summary and manual steps
print_info "Setup completed! Summary and next steps..."

# Installation summary
cat <<EOM

${GREEN}✅ INSTALLATION SUMMARY${NC}
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
   • Husky + lint-staged (pre-commit hooks)
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
   • Claude Code: GitHub, Filesystem, ESLint, Flutter integration
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

${YELLOW}📋 MANUAL STEPS REQUIRED${NC}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ${BLUE}Load Chrome Extension:${NC}
   • Open Chrome → chrome://extensions/
   • Enable "Developer Mode"
   • Click "Load unpacked" → select extensions/chrome/

2. ${BLUE}Load Safari Extension:${NC}
   • Open Safari → Preferences → Extensions
   • Enable Developer Extensions
   • Load extensions/safari/ (may require Xcode build)

3. ${BLUE}Configure AWS Credentials:${NC}
   • Run: aws configure
   • Enter AWS Access Key, Secret Key, Region (us-west-2)
   • Verify: aws sts get-caller-identity

4. ${BLUE}Deploy AWS Infrastructure:${NC}
   • Navigate: cd aws-backend/infrastructure
   • Deploy: npm run deploy
   • Note the outputs (API Gateway URL, Cognito User Pool ID)

5. ${BLUE}Test Monorepo Setup:${NC}
   • Restart terminal to load environment variables
   • Run: npm run lint (should pass)
   • Run: npm run type-check (should pass)
   • Run: npm run build (should build shared types)

6. ${BLUE}Test Extensions:${NC}
   • Run Chrome tests: cd extensions/chrome && npm test
   • Run Safari tests: cd extensions/safari && npm test
   • Run compatibility: npm run test (from root)

7. ${BLUE}MCP Server Setup:${NC}
   • Claude Desktop: Add GitHub Personal Access Token to config file
   • Claude Desktop: Restart application to load MCP servers
   • Claude Code: Set GITHUB_TOKEN environment variable for authentication
   • Test MCP functionality: "List my GitHub repositories"
   • Optional: Install AWS MCP servers with Python/uvx

8. ${BLUE}Mobile Development Setup:${NC}
   • Complete Android Studio setup (install SDK, accept licenses)
   • Install Xcode from App Store (~15GB download)
   • Configure Apple Developer account in Xcode
   • Run: flutter doctor (should show no issues)
   • Test mobile validation: ./validate-monorepo.sh --mobile

9. ${BLUE}Mobile Environment Variables:${NC}
   • Update .env with actual Android SDK paths
   • Add iOS development team ID and bundle identifier
   • Configure mobile app signing certificates

${GREEN}🚀 QUICK START COMMANDS${NC}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Test monorepo setup
npm run lint && npm run type-check && npm run build

# Test Chrome extension
cd extensions/chrome && npm test && npm run lint

# Test Safari extension  
cd extensions/safari && npm test && npm run lint

# Deploy AWS infrastructure
cd aws-backend/infrastructure && npm run deploy

# Test cross-platform compatibility
node tests/integration/test-payload-compatibility.js

# Test mobile development setup
./validate-monorepo.sh --mobile

# Build mobile apps (after setup complete)
cd recipe_archive && ./scripts/build-mobile.sh both debug

# Format all code
npm run format

# Create new config files
cp extensions/chrome/config.sample.json extensions/chrome/config.json
cp extensions/safari/config.sample.json extensions/safari/config.json

${BLUE}📖 Documentation:${NC}
• Project guide: ../docs/development/claude-context.md
• Chrome extension: ./extensions/chrome/README.md  
• Safari extension: ./extensions/safari/README.md

EOM

# Mobile Development Validation
if command -v flutter &> /dev/null; then
  print_info "Running Flutter doctor to validate mobile setup..."
  timeout 60 flutter doctor || print_warning "Flutter doctor found issues or timed out - see output above"

  # Run mobile validation if available
  if [ -f "$REPO_ROOT/validate-monorepo.sh" ]; then
    print_info "Running mobile app validation..."
    timeout 120 "$REPO_ROOT/validate-monorepo.sh" --mobile || print_warning "Mobile validation found issues or timed out"
  fi
fi

print_success "🎉 RecipeArchive development environment setup complete!"

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
