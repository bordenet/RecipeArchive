# Recipe Archive Scripts

## Philosophy: Automation & Deployment

This directory contains **scripts** focused on automation, build processes, deployment workflows, and operational tasks. Scripts are typically:

- **Automated workflows**: Deployment pipelines, build processes, CI/CD automation
- **Operational tasks**: Infrastructure setup, environment configuration, maintenance
- **Integration processes**: Multi-system orchestration, end-to-end workflows

## Scripts vs Tools Distinction

* **Scripts** (this directory): Automation, deployment, operational workflows
* **Tools** (`/tools` directory): Interactive utilities, data analysis, content management

---

_Scripts are designed for automation and integration into CI/CD pipelines, while tools are designed for interactive use and content operations._

## Available Scripts

### Deployment & Infrastructure (`.sh`)

- **`build-lambda-packages.sh`**: Build all Lambda function packages for AWS CDK deployment
- **`deploy-aws-infrastructure.sh`**: Guides you through the complete AWS setup process, including checking prerequisites, configuring credentials, creating the environment file, and deploying the CDK infrastructure.
- **`aws-deploy-all.sh`**: Deploy web app and all Lambda functions
- **`aws-deploy-lambda.sh`**: Deploy Go Lambda functions to AWS with automatic discovery and builds
- **`aws-deploy-multi-tenant.sh`**: Deploys all components needed for multi-tenant functionality.
- **`aws-deploy-secure-infrastructure.sh`**: Deploys the secure infrastructure with randomized identifiers.
- **`web-deploy.sh`**: Builds and deploys the Flutter web app to CloudFront via S3.
- **`manage-api-routes.sh`**: Provides a centralized, automated, and repeatable way to manage API Gateway routes for the RecipeArchive project.
- **`package-extensions.sh`**: Creates distribution packages for both Chrome and Safari extensions with semantic versioning.
- **`setup-aws-billing-controls.sh`**: Sets up monitoring to help you stay within AWS Free Tier limits.
- **`validate-api-gateway.sh`**: Serves as a standalone validator for API Gateway integrations.

### Mobile Development (`.sh`)

#### iOS Development Scripts
- **`ios-setup.sh`**: Complete iOS development environment setup with device targeting (iPhone 16e, iPad on Mac, iPhone 17 Pro Max)
- **`ios-simulator.sh`**: Automated iOS simulator launcher with device detection
- **`ios-xcode.sh`**: Xcode project launcher with clear user instructions
- **`ios-build.sh`**: Comprehensive build system (debug/release, simulator/device)
- **`ios-help.sh`**: Complete iOS development guide and troubleshooting
- **`ios-clean.sh`**: iOS environment cleanup and reset functionality
- **`ios-run.sh`**: Legacy run script for iOS simulator

#### Android Development Scripts
- **`android-setup.sh`**: Complete Android development environment setup with SDK validation
- **`android-emulator.sh`**: Android Virtual Device (AVD) management - create, start, stop, list emulators
- **`android-run.sh`**: Run RecipeArchive app on Android emulator
- **`android-build.sh`**: Build Android APK files (debug/release configurations)
- **`android-help.sh`**: Complete Android development guide and troubleshooting
- **`android-clean.sh`**: Android environment cleanup and reset functionality
- **`android-studio.sh`**: Android Studio project launcher

### Development & Maintenance (`.sh`)

- **`capture-wapost-cookies.sh`**: Makes it easy to capture authentication cookies for Washington Post recipe parsing.
- **`extension-helper.sh`**: Streamlines testing and reloading for Chrome and Safari extensions.
- **`install-dependencies.sh`**: Ensures all dependencies are properly installed across the monorepo.
- **`load-env.sh`**: Loads environment variables from the .env file in the root of the repository.
- **`normalize-existing-recipes.sh`**: Retroactively normalizes existing recipes with enhanced search metadata by sending them through the background normalization pipeline.
- **`recover-failed-recipes.sh`**: Recovers failed recipe normalizations from the DLQ.
- **`setup-macos.sh`**: Installs comprehensive development dependencies for the RecipeArchive project on macOS.
- **`update-extension-versions.sh`**: Updates the version of the Chrome and Safari extensions.
- **`validate-safari-auth.sh`**: Provides comprehensive testing and validation of the enhanced authentication system for the Safari extension.

### Testing & Validation (`.sh`)

- **`end-to-end-recipe-test.sh`**: Tests the complete pipeline: HTML fixture -> Parser -> AWS Backend -> Flutter App.
- **`quick-test.sh`**: Provides a quick way to test both Chrome and Safari extensions.
- **`search-integration.sh`**: Tests the complete pipeline: Recipe Creation -> Background Normalization -> Search Enhancement.
- **`search-validation.sh`**: Tests the comprehensive search implementation for cost-efficient AWS performance.
- **`test-chrome-extension.sh`**: Helps with manual testing of the Chrome extension.
- **`validate-extension.sh`**: Validates the Chrome extension files.

### Node.js Utilities (`.cjs` & `.js`)

- **`fetch-food-network-margarita.cjs` / `fetch-food-network-margarita.js`**: Fetches a specific margarita recipe from Food Network for testing purposes.
- **`organize-docs.cjs` / `organize-docs.js`**: Automatically moves technical documentation files and configuration files from the root directory to appropriate `docs/` or `tools/linting/` subdirectories to keep the root clean.
- **`save-rendered-fixture-stealth.cjs`**: Saves a fully rendered HTML fixture using Playwright Extra Stealth, handling potential 404s and retries.
- **`save-rendered-fixture.cjs` / `save-rendered-fixture.js`**: Saves a fully rendered HTML fixture using Playwright, handling potential 404s and retries.
- **`mcp-diagnostics-gate.js`**: An MCP-inspired quality gate for Husky pre-commit hooks, validating codebase health using native tools when MCP diagnostics are unavailable.
- **`review-claude-md.js`**: Reviews `CLAUDE.md` on every commit to suggest pruning/consolidation opportunities, aiming to keep the project guide concise and current.