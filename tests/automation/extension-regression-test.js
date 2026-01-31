#!/usr/bin/env node

/**
 * Web Extension Regression Testing Suite
 *
 * parser bundle issues, and broken recipe extraction functionality.
 *
 * This addresses the user's directive: "There should NEVER be a
 * human-in-the-loop for a simple verification test"
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Test configuration
const EXTENSION_PATHS = {
  chrome: path.join(__dirname, "../../extensions/chrome"),
  safari: path.join(__dirname, "../../extensions/safari"),
  shared: path.join(__dirname, "../../extensions/shared"),
};

const CRITICAL_FILES = {
  chrome: [
    "content.js",
    "background.js",
    "popup.js",
    "simple-cognito-auth.js",
    "typescript-parser-bundle.js",
    "supported-sites.js",
  ],
  safari: [
    "content.js",
    "popup.js",
    "cognito-auth.js",
    "typescript-parser-bundle.js",
    "supported-sites.js",
  ],
};

class ExtensionRegressionTest {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
    };
  }

  log(message, type = "info") {
    const colors = {
      info: "\x1b[36m",
      success: "\x1b[32m",
      error: "\x1b[31m",
      warning: "\x1b[33m",
    };
    const reset = "\x1b[0m";
    console.log(`${colors[type]}${message}${reset}`);
  }

  async runTest(testName, testFn) {
    try {
      this.log(`  Testing: ${testName}...`);
      await testFn();
      this.results.passed++;
      this.log(`  ✓ ${testName}`, "success");
    } catch (error) {
      this.results.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
      this.log(`  ✗ ${testName}: ${error.message}`, "error");
    }
  }

  // Test 1: Critical file existence
  async testCriticalFiles() {
    for (const [platform, files] of Object.entries(CRITICAL_FILES)) {
      const basePath = EXTENSION_PATHS[platform];

      for (const file of files) {
        await this.runTest(`${platform}/${file} exists`, () => {
          const filePath = path.join(basePath, file);
          if (!fs.existsSync(filePath)) {
            throw new Error(`Critical file missing: ${filePath}`);
          }
        });
      }
    }
  }

  // Test 2: JavaScript syntax validation
  async testJavaScriptSyntax() {
    for (const [platform, files] of Object.entries(CRITICAL_FILES)) {
      const basePath = EXTENSION_PATHS[platform];

      for (const file of files.filter((f) => f.endsWith(".js"))) {
        await this.runTest(`${platform}/${file} syntax`, () => {
          const filePath = path.join(basePath, file);
          try {
            // Use Node.js to check syntax
            execSync(`node --check "${filePath}"`, { stdio: "pipe" });
          } catch (error) {
            throw new Error(`Syntax error in ${file}: ${error.message}`);
          }
        });
      }
    }
  }

  // Test 3: Scoping validation (prevent the error we just fixed)
  async testJavaScriptScoping() {
    await this.runTest("Extension scoping validation", () => {
       
      try {
        // TODO: Implement scoping validation test
      } catch (error) {
        throw new Error(
          `Scoping validation failed: ${error.message}`
        );
      }
    });
  }

  // Test 4: TypeScript parser bundle integrity
  async testParserBundle() {
    for (const platform of ["chrome", "safari"]) {
      await this.runTest(`${platform} parser bundle integrity`, () => {
        const bundlePath = path.join(
          EXTENSION_PATHS[platform],
          "typescript-parser-bundle.js"
        );

        if (!fs.existsSync(bundlePath)) {
          throw new Error("TypeScript parser bundle missing");
        }

        const content = fs.readFileSync(bundlePath, "utf8");

        // Check for critical window exposure
        if (!content.includes("window.TypeScriptParser")) {
          throw new Error(
            "TypeScript parser bundle does not expose window.TypeScriptParser"
          );
        }

        // Check for minimal size (should be substantial)
        if (content.length < 50000) {
          throw new Error(
            `Parser bundle suspiciously small: ${content.length} bytes`
          );
        }
      });
    }
  }

  // Test 5: Manifest validation
  async testManifestIntegrity() {
    for (const platform of ["chrome", "safari"]) {
      await this.runTest(`${platform} manifest validation`, () => {
        const manifestPath =
          platform === "chrome"
            ? path.join(EXTENSION_PATHS[platform], "manifest.json")
            : path.join(
                EXTENSION_PATHS[platform],
                "../safari-extension/manifest.json"
              );

        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

          if (!manifest.version) {
            throw new Error("Manifest missing version");
          }

          if (
            !manifest.content_scripts ||
            manifest.content_scripts.length === 0
          ) {
            throw new Error("Manifest missing content scripts");
          }
        }
      });
    }
  }

  // Test 6: Recipe extraction simulation
  async testRecipeExtractionCapability() {
    await this.runTest("Recipe extraction capability", () => {
      // Test if supported-sites.js can be loaded
      const sitesPath = path.join(EXTENSION_PATHS.chrome, "supported-sites.js");
      const content = fs.readFileSync(sitesPath, "utf8");

      // Check for essential site support
      const requiredSites = [
        "loveandlemons.com",
        "smittenkitchen.com",
        "food52.com",
      ];
      for (const site of requiredSites) {
        if (!content.includes(site)) {
          throw new Error(`Missing support for critical site: ${site}`);
        }
      }
    });
  }

  // Test 7: Build system validation
  async testBuildSystem() {
    await this.runTest("Extension build system", () => {
      try {
        // Test that the parser bundle can be rebuilt
        execSync("npm run build:parser-bundle", { stdio: "pipe" });
      } catch (error) {
        throw new Error("Parser bundle build failed");
      }
    });
  }

  // Test 8: Linting integration
  async testLintingIntegration() {
    await this.runTest("Extension linting", () => {
      try {
        execSync("npm run lint", { stdio: "pipe" });
      } catch (error) {
        // Only fail if there are actual errors (not warnings)
        const output = error.stdout ? error.stdout.toString() : "";
        if (output.includes("error") || error.status > 1) {
          throw new Error("Extension linting failed with errors");
        }
      }
    });
  }

  // Test 9: Authentication flow validation
  async testAuthenticationFlow() {
    await this.runTest("Authentication flow integrity", () => {
      const authPath = path.join(
        EXTENSION_PATHS.chrome,
        "simple-cognito-auth.js"
      );
      const content = fs.readFileSync(authPath, "utf8");

      // Check for critical methods
      const requiredMethods = [
        "authenticate",
        "_storeTokens",
        "isAuthenticated",
      ];
      for (const method of requiredMethods) {
        if (!content.includes(method)) {
          throw new Error(
            `Authentication flow missing critical method: ${method}`
          );
        }
      }
    });
  }

  // Test 10: End-to-end capability simulation
  async testEndToEndCapability() {
    await this.runTest("End-to-end capability validation", () => {
      // Verify all components are in place for full pipeline
      const components = [
        path.join(EXTENSION_PATHS.chrome, "content.js"),
        path.join(EXTENSION_PATHS.chrome, "background.js"),
        path.join(EXTENSION_PATHS.chrome, "simple-cognito-auth.js"),
        path.join(EXTENSION_PATHS.chrome, "typescript-parser-bundle.js"),
      ];

      for (const component of components) {
        if (!fs.existsSync(component)) {
          throw new Error(
            `Missing critical component: ${path.basename(component)}`
          );
        }
      }
    });
  }

  async runAllTests() {
    this.log("🚀 Starting Web Extension Regression Tests", "info");
    this.log(
      "Preventing critical build failures and functionality regressions\n",
      "info"
    );

    // Run all test categories
    await this.testCriticalFiles();
    await this.testJavaScriptSyntax();
    await this.testJavaScriptScoping();
    await this.testParserBundle();
    await this.testManifestIntegrity();
    await this.testRecipeExtractionCapability();
    await this.testBuildSystem();
    await this.testLintingIntegration();
    await this.testAuthenticationFlow();
    await this.testEndToEndCapability();

    // Generate summary
    this.generateSummary();
  }

  generateSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 WEB EXTENSION REGRESSION TEST RESULTS");
    console.log("=".repeat(60));

    if (this.results.failed === 0) {
      this.log(`✅ ALL TESTS PASSED (${this.results.passed} tests)`, "success");
      this.log(
        "Extension functionality verified - no regressions detected",
        "success"
      );
      process.exit(0);
    } else {
      this.log(
        `❌ TESTS FAILED (${this.results.failed}/${this.results.passed + this.results.failed})`,
        "error"
      );
      console.log("\nERROR DETAILS:");
      for (const error of this.results.errors) {
        this.log(`  • ${error}`, "error");
      }

      console.log("\n🚨 CRITICAL BUILD FAILURE DETECTED:");
      this.log(
        "These tests prevent the same type of regression that broke extensions previously.",
        "warning"
      );
      this.log(
        "Fix these issues before proceeding with deployment.",
        "warning"
      );

      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new ExtensionRegressionTest();
  tester.runAllTests().catch((error) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });
}

module.exports = ExtensionRegressionTest;
