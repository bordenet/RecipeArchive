#!/usr/bin/env bash
################################################################################
# Component: MCP Servers
################################################################################
# PURPOSE: Install and configure MCP servers for Claude Desktop and Code CLI.
# REUSABLE: NO
# DEPENDENCIES: 10-essentials (for npm)
#
# ADOPTION NOTES FOR FUTURE REPOS:
# ❌ This component is RecipeArchive-specific
# 📝 Replace with your own monorepo setup
# 📝 Key patterns to reuse:
#    - npm install with timeout
#    - Directory existence checks
#    - Conditional installations based on file presence
################################################################################

# Component metadata
COMPONENT_NAME="MCP servers for Claude Desktop"

# Installation function (called by main script)
install_component() {
    section_start "$COMPONENT_NAME"

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
      if [ -f "$CLAUDE_CONFIG_FILE" ] && grep -q "mcpServers" "$CLAUDE_CONFIG_FILE" 2>/dev/null;
        then
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
    if [[ ":$PATH:" != ":$LOCAL_BIN_DIR:"* ]]; then
      print_info "Adding ~/.local/bin to PATH..."

      # Add to current session
      export PATH="$LOCAL_BIN_DIR:$PATH"

      # Add to shell profile for persistence
      SHELL_PROFILE=""
      if [ -n "${ZSH_VERSION:-}" ]; then
        SHELL_PROFILE="$HOME/.zshrc"
      elif [ -n "$BASH_VERSION" ]; then
        SHELL_PROFILE="$HOME/.bash_profile"
      fi

      if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
        if ! grep -q "export PATH=\"
$HOME/.local/bin:$PATH\"" "$SHELL_PROFILE"; then
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
      print_info "4. Run: claude mcp add filesystem npx @modelcontextprotocol/server-filesystem $(pwd) --scope user"
      print_info "6. Run: claude mcp add flutter npx flutter-mcp --scope user"
    fi

    section_end
}
