#!/usr/bin/env bash
################################################################################
# Component: RecipeArchive Monorepo Setup
################################################################################
# PURPOSE: Install project-specific dependencies for RecipeArchive monorepo.
# REUSABLE: NO - This is specific to RecipeArchive project structure
# DEPENDENCIES: 10-essentials (for npm)
#
# ADOPTION NOTES FOR FUTURE REPOS:
# - This component is NOT reusable - it's specific to RecipeArchive.
# - When adopting this setup script for other projects, you should:
#   1. Delete this component entirely
#   2. Create your own project-specific setup component if needed
#   3. Or handle project-specific setup directly in your main script
################################################################################

# Component metadata
COMPONENT_NAME="RecipeArchive monorepo dependencies"

# Installation function (called by main script)
install_component() {
    section_start "$COMPONENT_NAME"

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
}
