#!/usr/bin/env bash
################################################################################
# Component: Testing Environment Setup
################################################################################
# PURPOSE: Set up the testing environment, including the .env file.
# REUSABLE: NO
# DEPENDENCIES: none
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
COMPONENT_NAME="Testing environment setup"

# Installation function (called by main script)
install_component() {
    section_start "$COMPONENT_NAME"

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
}
