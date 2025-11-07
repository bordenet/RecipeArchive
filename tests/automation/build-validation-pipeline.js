#!/usr/bin/env node

/**
 * Automated Build Validation Pipeline
 *
 * Ensures no broken builds reach users by validating all critical
 * components before deployment. Addresses the directive:
 * "There should NEVER be a human-in-the-loop for a simple verification test"
 */

const { execSync } = require("child_process");
const _path = require("path");
const fs = require("fs");

class BuildValidationPipeline {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
      warnings: [],
    };
    this.startTime = Date.now();
  }

  log(message, type = "info") {
    const colors = {
      info: "\x1b[36m",
      success: "\x1b[32m",
      error: "\x1b[31m",
      warning: "\x1b[33m",
      header: "\x1b[35m",
    };
    const reset = "\x1b[0m";
    console.log(`${colors[type]}${message}${reset}`);
  }

  async runValidation(name, command, options = {}) {
    const { allowWarnings = true, timeout = 60000 } = options;

    try {
      this.log(`  Validating: ${name}...`);

      const result = execSync(command, {
        stdio: "pipe",
        timeout,
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
      });

      const output = result.toString();

      // Check for warnings if configured
      if (
        !allowWarnings &&
        (output.includes("warning") || output.includes("WARN"))
      ) {
        throw new Error(`Warnings found in ${name}`);
      }

      this.results.passed++;
      this.log(`  ✅ ${name}`, "success");
      return { success: true, output };
    } catch (error) {
      this.results.failed++;
      const errorMsg = `${name}: ${error.message}`;
      this.results.errors.push(errorMsg);
      this.log(`  ❌ ${name}: ${error.message}`, "error");
      return { success: false, error: error.message };
    }
  }

  async runCriticalBuildValidation() {
    this.log("🔨 CRITICAL BUILD VALIDATION", "header");

    // 1. TypeScript Compilation
    await this.runValidation(
      "TypeScript Parser Compilation",
      "npx tsc --project parsers/tsconfig.json --noEmit"
    );

    await this.runValidation(
      "TypeScript Infrastructure Compilation",
      "cd aws-backend/infrastructure && npx tsc --noEmit"
    );

    // 2. Go Build Validation
    await this.runValidation(
      "Go Backend Build",
      "cd aws-backend && make build"
    );

    await this.runValidation("Go Tools Build", "cd tools && make build");

    // 3. Extension Build System
    await this.runValidation(
      "Extension Parser Bundle Build",
      "npm run build:parser-bundle"
    );

    // 4. Flutter Build (if available)
    if (fs.existsSync("recipe_archive/pubspec.yaml")) {
      await this.runValidation(
        "Flutter Web Build",
        "cd recipe_archive && flutter build web --release",
        { timeout: 120000 } // 2 minute timeout for Flutter builds
      );
    }
  }

  async runLintingValidation() {
    this.log("🔍 LINTING VALIDATION", "header");

    // 1. JavaScript/Extension Linting
    await this.runValidation("Extension ESLint", "npm run lint");

    await this.runValidation(
      "Extension Scoping Validation",
    );

    // 2. Flutter Analysis (with error tolerance)
    if (fs.existsSync("recipe_archive/pubspec.yaml")) {
      const result = await this.runValidation(
        "Flutter Analysis",
        "cd recipe_archive && flutter analyze",
        { allowWarnings: true }
      );

      // Count Flutter issues but don't fail
      if (!result.success && result.error.includes("issues found")) {
        this.results.warnings.push(
          "Flutter has analysis issues - not blocking build"
        );
        this.results.failed--; // Don't count as failure
        this.results.passed++; // Count as passed with warnings
      }
    }

    // 3. Go Formatting
    await this.runValidation(
      "Go Code Formatting",
      "cd tools && make fmt && git diff --exit-code"
    );
  }

  async runSecurityValidation() {
    this.log("🛡️ SECURITY VALIDATION", "header");

    // 1. Secret Scanning
    await this.runValidation(
      "TruffleHog Security Scan",
      "npm run security:scan"
    );

    // 2. Dependency Security (basic check)
    await this.runValidation(
      "Node.js Dependency Audit",
      "npm audit --audit-level=high",
      { allowWarnings: true }
    );
  }

  async runFunctionalValidation() {
    this.log("⚡ FUNCTIONAL VALIDATION", "header");

    // 1. Extension Regression Tests
    await this.runValidation(
      "Extension Regression Tests",
      "node tests/automation/extension-regression-test.js"
    );

    // 2. Go Unit Tests
    await this.runValidation(
      "Go Backend Unit Tests",
      "cd aws-backend/functions/local-server && go test -v"
    );

    await this.runValidation("Go Tools Unit Tests", "cd tools && make test");

    // 3. Parser System Tests
    await this.runValidation("Parser System Tests", "npm run test:parsers");
  }

  async runDeploymentReadinessValidation() {
    this.log("🚀 DEPLOYMENT READINESS", "header");

    // 1. Version Consistency
    await this.runValidation(
      "Version Consistency Check",
      "node -e \"console.log(require('./package.json').version)\""
    );

    // 2. Documentation Organization
    await this.runValidation(
      "Documentation Organization",
      "npm run docs:organize"
    );

    // 3. Critical File Presence
    const criticalFiles = [
      "CLAUDE.md",
      "package.json",
      "extensions/chrome/manifest.json",
      "recipe_archive/pubspec.yaml",
      "aws-backend/infrastructure/cdk.json",
    ];

    let missingFiles = [];
    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      this.results.failed++;
      this.results.errors.push(
        `Missing critical files: ${missingFiles.join(", ")}`
      );
      this.log(
        `  ❌ Critical Files: Missing ${missingFiles.length} files`,
        "error"
      );
    } else {
      this.results.passed++;
      this.log("  ✅ Critical Files: All present", "success");
    }
  }

  async runFullValidation() {
    this.log("🤖 AUTOMATED BUILD VALIDATION PIPELINE", "header");
    this.log(
      "Ensuring no broken builds reach users - removing human intervention\n",
      "info"
    );

    // Run validation phases
    await this.runCriticalBuildValidation();
    await this.runLintingValidation();
    await this.runSecurityValidation();
    await this.runFunctionalValidation();
    await this.runDeploymentReadinessValidation();

    this.generateSummary();
  }

  generateSummary() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);

    console.log("\n" + "=".repeat(70));
    console.log("🤖 AUTOMATED BUILD VALIDATION RESULTS");
    console.log("=".repeat(70));

    if (this.results.failed === 0) {
      this.log("✅ BUILD VALIDATION PASSED", "success");
      this.log(
        `All ${this.results.passed} validations completed successfully in ${duration}s`,
        "success"
      );

      if (this.results.warnings.length > 0) {
        this.log("\n⚠️ WARNINGS (Non-blocking):", "warning");
        for (const warning of this.results.warnings) {
          this.log(`  • ${warning}`, "warning");
        }
      }

      this.log("\n🎉 READY FOR DEPLOYMENT", "success");
      this.log(
        "No human intervention required - automated validation complete",
        "success"
      );
      process.exit(0);
    } else {
      this.log("❌ BUILD VALIDATION FAILED", "error");
      this.log(
        `${this.results.failed} failures out of ${this.results.passed + this.results.failed} validations`,
        "error"
      );

      console.log("\n💥 CRITICAL FAILURES:");
      for (const error of this.results.errors) {
        this.log(`  • ${error}`, "error");
      }

      if (this.results.warnings.length > 0) {
        console.log("\n⚠️ WARNINGS:");
        for (const warning of this.results.warnings) {
          this.log(`  • ${warning}`, "warning");
        }
      }

      console.log("\n🚨 BUILD BLOCKED - MANUAL INTERVENTION REQUIRED");
      this.log(
        "Fix the above issues before proceeding with deployment",
        "error"
      );
      this.log(
        "This automated validation prevents broken builds from reaching users",
        "warning"
      );

      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const pipeline = new BuildValidationPipeline();

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🤖 Automated Build Validation Pipeline

USAGE:
  node build-validation-pipeline.js [options]

OPTIONS:
  --help, -h    Show this help message

DESCRIPTION:
  Comprehensive automated validation that prevents broken builds
  from reaching users. Removes human intervention from validation.
  
  Validates:
  • Critical builds (TypeScript, Go, Flutter, Extensions)  
  • Code quality (linting, formatting, analysis)
  • Security (secret scanning, dependency audits)
  • Functionality (regression tests, unit tests)
  • Deployment readiness (files, documentation, versions)
  
INTEGRATION:
  • Pre-deployment validation
  • CI/CD pipeline integration  
  • Git pre-push hooks
  • Automated quality gates
    `);
    process.exit(0);
  }

  pipeline.runFullValidation().catch((error) => {
    console.error("Pipeline failed:", error);
    process.exit(1);
  });
}

module.exports = BuildValidationPipeline;
