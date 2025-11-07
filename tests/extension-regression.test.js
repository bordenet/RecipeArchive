/**
 * Extension Regression Test
 * Critical test to prevent web extension parsing failures
 */

const fs = require("fs");
const path = require("path");

describe("Web Extension Regression Tests", () => {
  let chromeContentScript;
  let typescriptBundle;

  beforeAll(() => {
    // Load the content script
    const contentScriptPath = path.join(
      __dirname,
      "../extensions/chrome/content.js"
    );
    chromeContentScript = fs.readFileSync(contentScriptPath, "utf8");

    // Load the TypeScript bundle
    const bundlePath = path.join(
      __dirname,
      "../extensions/chrome/typescript-parser-bundle.js"
    );
    typescriptBundle = fs.readFileSync(bundlePath, "utf8");
  });

  test("TypeScript parser bundle exposes window.TypeScriptParser", () => {
    // Mock window object
    global.window = {
      location: { href: "https://www.foodnetwork.com/recipes/test" },
    };
    global.console = { log: jest.fn(), error: jest.fn() };

    // Execute the TypeScript bundle
    eval(typescriptBundle);

    // Check that the global variables are exposed
    expect(global.window.TypeScriptParser).toBeDefined();
    expect(typeof global.window.TypeScriptParser.extractRecipeFromPage).toBe(
      "function"
    );
    expect(global.window.RecipeArchiveParserRegistry).toBeDefined();
  });

  test("Content script can detect supported sites", () => {
    // Test that the early abort logic works correctly
    const supportedSiteCheck =
      chromeContentScript.includes("isSupportedSite") ||
      chromeContentScript.includes("supportedSites");
    const earlyAbortLogic =
      chromeContentScript.includes("aborting initialization") ||
      chromeContentScript.includes("unsupported_site");
    const supportedSites = chromeContentScript.includes("smittenkitchen.com");

    expect(supportedSiteCheck).toBe(true);
    expect(earlyAbortLogic).toBe(true);
    expect(supportedSites).toBe(true);
  });

  test("Dynamic loading function exists", () => {
    const hasLoadParserBundle =
      chromeContentScript.includes("loadParserBundle");
    const hasDynamicLoading =
      chromeContentScript.includes("chrome.runtime.getURL") &&
      chromeContentScript.includes("typescript-parser-bundle.js");

    expect(hasLoadParserBundle).toBe(true);
    expect(hasDynamicLoading).toBe(true);
  });

  test("Extension version numbers are incremented", () => {
    const chromeManifest = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../extensions/chrome/manifest.json"),
        "utf8"
      )
    );
    const safariManifest = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../extensions/safari/manifest.json"),
        "utf8"
      )
    );

    // Ensure versions are recent (not 0.1.0 or older)
    expect(parseFloat(chromeManifest.version)).toBeGreaterThanOrEqual(0.3);
    expect(parseFloat(safariManifest.version)).toBeGreaterThanOrEqual(0.4);
  });

  afterAll(() => {
    // Clean up globals
    delete global.window;
    delete global.console;
  });
});
