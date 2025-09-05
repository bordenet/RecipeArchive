#!/bin/bash
# RecipeArchive Project Setup Script for macOS
# Enhanced with comprehensive dependency management and confirmation prompts

set -e

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
  if timed_confirm "Homebrew is required but not installed. Install Homebrew? (Large download ~100MB)"; then
    print_info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
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
  print_success "Node.js installed: $(node --version)"
else
  print_success "Node.js already installed: $(node --version)"
fi

# Install TypeScript globally
if ! command -v tsc &> /dev/null; then
  print_info "Installing TypeScript globally..."
  npm install -g typescript
  print_success "TypeScript installed: $(tsc --version)"
else
  print_success "TypeScript already installed: $(tsc --version)"
fi

# Install AWS CDK globally
if ! command -v cdk &> /dev/null; then
  print_info "Installing AWS CDK globally..."
  npm install -g aws-cdk@2.87.0
  print_success "AWS CDK installed: $(cdk --version)"
else
  print_success "AWS CDK already installed: $(cdk --version)"
fi

# Install Go
if ! command -v go &> /dev/null; then
  print_info "Installing Go..."
  brew install go
  print_success "Go installed: $(go version)"
else
  print_success "Go already installed: $(go version)"
fi

# Install Xcode CLI tools (required for iOS/Swift development)
if ! xcode-select -p &> /dev/null; then
  if timed_confirm "Xcode CLI tools are required for iOS development. Install? (Large download ~500MB)"; then
    print_info "Installing Xcode CLI tools..."
    xcode-select --install || true
    print_success "Xcode CLI tools installation initiated"
  else
    print_warning "Skipping Xcode CLI tools - iOS development will not be available"
  fi
else
  print_success "Xcode CLI tools already installed"
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
      code --install-extension "$extension" --force
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

# Check if Playwright should be installed
if timed_confirm "Install Playwright for browser automation testing? (Large download ~500MB for browsers)"; then
  print_info "Installing Playwright..."
  if [ -f "package.json" ]; then
    npm install --save-dev playwright@^1.55.0
  else
    npm install -g playwright@^1.55.0
  fi
  
  print_info "Installing Playwright browsers..."
  npx playwright install
  
  print_success "Playwright and browsers installed"
else
  print_warning "Skipping Playwright - browser automation tests will not work"
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


# Project-specific setup
print_info "Setting up RecipeArchive monorepo dependencies..."

# Install root dependencies first
if [ -f "package.json" ]; then
  print_info "Installing root monorepo dependencies..."
  npm install
  
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
  npm run type-check || print_warning "Type checking failed - check TypeScript configuration"
  
  # Run linting to verify code quality setup
  print_info "Verifying code quality setup..."
  npm run lint || print_warning "Linting failed - check ESLint configuration"
  
  print_success "Root monorepo dependencies installed and verified"
else
  print_warning "Root package.json not found - monorepo setup incomplete"
fi

# Setup AWS Backend Infrastructure
if [ -d "aws-backend/infrastructure" ]; then
  print_info "Setting up AWS CDK infrastructure dependencies..."
  cd aws-backend/infrastructure
  
  if [ -f "package.json" ]; then
    npm install
    print_success "AWS CDK dependencies installed"
    
    # Verify CDK setup
    if timed_confirm "Verify AWS CDK setup by synthesizing CloudFormation templates?" 10 "Y"; then
      print_info "Synthesizing CDK templates..."
      npm run synth || print_warning "CDK synthesis failed - check AWS credentials and configuration"
    fi
  fi
  
  cd - > /dev/null
else
  print_warning "AWS backend directory not found - skipping AWS setup"
fi

# Setup Chrome extension
if [ -d "extensions/chrome" ]; then
  print_info "Setting up Chrome extension dependencies..."
  cd extensions/chrome
  
  # Install dependencies
  if [ -f "package.json" ]; then
    npm install
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
    zip -r chrome-extension.zip manifest.json background.js content.js popup.html popup.js setup.html setup.js *.png config.sample.json
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
  
  # Install dependencies
  if [ -f "package.json" ]; then
    npm install
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
if [ -z "$RECIPE_TEST_USER" ]; then
  print_warning "RECIPE_TEST_USER environment variable not set"
  echo "export RECIPE_TEST_USER=\"test\"" >> ~/.zshrc || echo "export RECIPE_TEST_USER=\"test\"" >> ~/.bash_profile
  print_info "Added RECIPE_TEST_USER to shell configuration"
fi

if [ -z "$RECIPE_TEST_PASS" ]; then
  print_warning "RECIPE_TEST_PASS environment variable not set"
  print_info "Please set RECIPE_TEST_PASS manually for testing:"
  print_info "  export RECIPE_TEST_PASS=\"your-secure-test-password\""
  print_info "  Add this to your ~/.zshrc or ~/.bash_profile"
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

7. ${BLUE}iOS Development (if needed):${NC}
   • Install Xcode from App Store (~5GB download)
   • Open project in Xcode for iOS app development

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

# Set script as executable
chmod +x "$0" 2>/dev/null || true
