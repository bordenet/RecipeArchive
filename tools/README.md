# Recipe Archive Tools

## Philosophy: Interactive Utilities & Content Management

This directory contains **tools** focused on interactive utilities, data analysis, and content operations. Tools are typically:

- **Interactive utilities**: Command-line programs for data analysis and reporting
- **Content management**: Recipe data operations, user management, content moderation
- **Development utilities**: Debugging tools, data inspection, manual operations

## Tools vs Scripts Distinction

**Tools** (this directory): Interactive utilities, data analysis, content management
**Scripts** (`/scripts` directory): Automation, deployment, operational workflows

---

_Tools are designed for interactive use and manual operations, while scripts are designed for automation and CI/CD integration._

## Available Tools

### Shell Scripts (`.sh`)

- **`analyze-extension-errors.sh`**: Downloads and analyzes diagnostic data from the S3 bucket to identify and categorize errors related to the Chrome and Safari browser extensions.
- **`analyze-flutter-errors.sh`**: Analyzes diagnostic data stored in an S3 bucket to identify and categorize Flutter-specific errors.
- **`harvest-diagnostic-errors.sh`**: Extracts diagnostic data from CloudWatch logs for the Diagnostics Lambda function.
- **`purge-obsolete-functions.sh`**: Provides automated identification and removal of obsolete Lambda functions to prevent issues with stray binaries, outdated configurations, and resource conflicts.
- **`recipe-report.sh`**: Builds and runs the Go-based reporting tool, which generates reports about recipes and parsing failures from the S3 bucket.
- **`test-deployment-scripts.sh`**: Runs a series of checks to ensure that all critical deployment scripts are functional.
- **`test-s3-access.sh`**: Tests access to the S3 bucket and uploads a sample recipe and a sample parsing failure.
- **`validate-normalization.sh`**: Provides automated validation of the recipe normalization pipeline, ensuring that the OpenAI-powered content enhancement system is functioning correctly.

### Test Data Scripts (`tools/testdata`)

- **`copy-allrecipes-html.sh`**: Copies a cached HTML file from the system's temporary directory to the `tools/testdata` directory.
- **`fetch-*.sh`**: A collection of scripts that fetch the HTML content of a recipe and saves it as a fixture for parser development and testing.

### Node.js Scripts (`.cjs`)

- **`enhanced-security-scan.cjs`**: Provides comprehensive security scanning beyond TruffleHog, specifically targeting hardcoded credentials and sensitive patterns within the codebase.
- **`build-extension-env.cjs`**: Reads environment variables from `.env` and injects them into browser extension JavaScript files at build time, replacing placeholders like `__ENV_VAR_NAME__`.
- **`build-parser-bundle.cjs`**: Builds a TypeScript parser bundle for browser extensions using `esbuild`, creating a single JavaScript file that includes all recipe parsers.
- **`focused-scoping-validator.cjs`**: A focused JavaScript scoping validator that specifically targets `try/catch` variable scoping issues, such as the `tokenResult`-style bugs.
- **`scoping-validator.cjs`**: An advanced JavaScript variable scoping validator that uses AST-based analysis to catch complex scoping bugs that ESLint might miss, including `try/catch` scope violations.

### Go Tools

- **`content-ops`**: A multi-tenant content operations utility for analyzing recipes across all tenants in AWS S3. It supports pagination for large datasets and provides operational insights for multi-tenant management.
- **`recipe-tracer`**: An end-to-end tracing tool that tracks recipe processing through S3, SQS, and CloudWatch logs, providing a chronological view of all events and a summary of the processing status.
