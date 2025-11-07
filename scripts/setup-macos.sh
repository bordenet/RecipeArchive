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

# Discover and execute components
COMPONENTS_DIR="$SCRIPT_DIR/setup-components"

if [ ! -d "$COMPONENTS_DIR" ]; then
    die "Components directory not found: $COMPONENTS_DIR"
fi

# Source all components in numeric order
for component_file in "$COMPONENTS_DIR"/*.sh; do
    if [ -f "$component_file" ]; then
        # ADOPTION NOTE: Component sourcing happens here
        # Each component exports an install_component() function
        source "$component_file"

        # Execute the component's installation
        # ADOPTION NOTE: All helper functions (check_*, section_*, etc.)
        # are available to components via bash's function scope
        install_component

        # ADOPTION NOTE: Component failures are tracked automatically
        # via check_failed() which populates FAILED_INSTALLS array
    fi
done

# Final setup summary and manual steps
if [ "$VERBOSE" = true ]; then
  echo ""
  print_info "Setup completed! Summary and next steps..."
fi

# ADOPTION NOTE FOR FUTURE REPOS:
# Update this summary section with your project-specific commands
# and documentation links. The error reporting logic below this
# should remain unchanged.
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
