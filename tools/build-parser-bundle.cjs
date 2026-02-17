#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🔨 Building TypeScript parser bundle for browser extensions...");

// Define paths
const projectRoot = path.join(__dirname, "..");
const parsersDir = path.join(projectRoot, "parsers");
const entryFile = path.join(parsersDir, "index.ts");
const lockFile = path.join(parsersDir, ".build-lock");
const chromeBundle = path.join(
  projectRoot,
  "extensions/chrome/typescript-parser-bundle.js"
);
const safariBundle = path.join(
  projectRoot,
  "extensions/safari/typescript-parser-bundle.js"
);

// Acquire lock with timeout to prevent concurrent builds
function acquireLock(maxWaitSeconds = 30) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

   
  while (true) {
    try {
      // Try to create lock file exclusively (fails if exists)
      fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
      return true; // Lock acquired
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error; // Unexpected error
      }

      // Lock file exists - check if it's stale
      try {
        const lockContent = fs.readFileSync(lockFile, "utf8");
        const lockPid = parseInt(lockContent, 10);

        // Check if the process holding the lock is still running
        try {
          process.kill(lockPid, 0); // Signal 0 just checks if process exists
          // Process exists - wait and retry
        } catch {
          // Process doesn't exist - remove stale lock
          fs.unlinkSync(lockFile);
          continue; // Retry acquisition
        }
      } catch {
        // Can't read lock file - remove it
        try {
          fs.unlinkSync(lockFile);
         
        } catch {
          // Best-effort cleanup
        }
        continue; // Retry acquisition
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Failed to acquire build lock after ${maxWaitSeconds}s - another build is in progress`, { cause: error });
      }

      // Wait before retry
      const waitMs = 100;
      execSync(`sleep ${waitMs / 1000}`);
    }
  }
}

// Release lock
function releaseLock() {
  try {
    fs.unlinkSync(lockFile);
  } catch (error) {
    // Ignore errors during cleanup
  }
}

// Create a simple entry point that exports all parsers
const entryContent = `
// TypeScript Parser Bundle Entry Point
import { ParserRegistry } from "./parser-registry";
import { SmittenKitchenParser } from "./sites/smitten-kitchen";
import { FoodNetworkParser } from "./sites/food-network";
import { NYTCookingParser } from "./sites/nyt-cooking";
import { Food52Parser } from "./sites/food52";
import { SeriousEatsParser } from "./sites/serious-eats";
import { AllRecipesParser } from "./sites/allrecipes";
import { EpicuriousParser } from "./sites/epicurious";
import { DamnDeliciousParser } from "./sites/damn-delicious";
import { LoveAndLemonsParser } from "./sites/loveandlemons";
import { FoodAndWineParser } from "./sites/food-and-wine";
import { WashingtonPostParser } from "./sites/washington-post";
import { AlexandrasKitchenParser } from "./sites/alexandras-kitchen";
import { LemonsAndZestParser } from "./sites/lemonsandzest";
import { LauraInTheKitchenParser } from "./sites/laurainthekitchen.com";

// Initialize registry
const registry = ParserRegistry.getInstance();

// Register all parsers
registry.registerParser("smittenkitchen.com", SmittenKitchenParser);
registry.registerParser("foodnetwork.com", FoodNetworkParser);
registry.registerParser("cooking.nytimes.com", NYTCookingParser);
registry.registerParser("food52.com", Food52Parser);
registry.registerParser("seriouseats.com", SeriousEatsParser);
registry.registerParser("allrecipes.com", AllRecipesParser);
registry.registerParser("epicurious.com", EpicuriousParser);
registry.registerParser("damndelicious.net", DamnDeliciousParser);
registry.registerParser("loveandlemons.com", LoveAndLemonsParser);
registry.registerParser("foodandwine.com", FoodAndWineParser);
registry.registerParser("washingtonpost.com", WashingtonPostParser);
registry.registerParser("alexandracooks.com", AlexandrasKitchenParser);
registry.registerParser("lemonsandzest.com", LemonsAndZestParser);
registry.registerParser("laurainthekitchen.com", LauraInTheKitchenParser);

// Export for browser use
if (typeof window !== "undefined") {
    window.RecipeArchiveParserRegistry = registry;

    // Compatibility interface for content scripts
    window.TypeScriptParser = {
        async extractRecipeFromPage() {
            const url = window.location.href;
            const html = document.documentElement.outerHTML;

            try {
                const result = await registry.parseRecipe(html, url);

                if (!result) {
                    return {
                        title: document.title || "Unknown Recipe",
                        url: url,
                        timestamp: new Date().toISOString(),
                        ingredients: [],
                        steps: [],
                        source: "no-parser-found"
                    };
                }

                return result;
            } catch (error) {
                console.error("TypeScriptParser extraction failed:", error);
                return {
                    title: document.title || "Unknown Recipe",
                    url: url,
                    timestamp: new Date().toISOString(),
                    ingredients: [],
                    steps: [],
                    source: "extraction-error",
                    error: error.message
                };
            }
        }
    };
}

console.log("🎯 TypeScript parser bundle loaded");
`;

// Clean up stale locks from crashed/killed processes
// IMPORTANT: Don't blindly delete - check if the PID is still active
// If we delete unconditionally, two processes starting simultaneously could both delete
// and then both create locks, breaking the mutual exclusion guarantee
if (fs.existsSync(lockFile)) {
  try {
    const lockContent = fs.readFileSync(lockFile, "utf8");
    const lockPid = parseInt(lockContent, 10);
    try {
      process.kill(lockPid, 0); // Signal 0 just checks if process exists
      // Process exists - lock is valid, acquireLock() will wait for it
    } catch {
      // Process doesn't exist - lock is stale, safe to remove
      fs.unlinkSync(lockFile);
    }
  } catch {
    // Can't read lock file (corrupted?) - safe to remove
    try {
      fs.unlinkSync(lockFile);
     
    } catch {
      // Best-effort cleanup
    }
  }
}

// Acquire lock to prevent concurrent builds
try {
  acquireLock();
} catch (error) {
  console.error("❌ Failed to acquire build lock:", error.message);
  process.exit(1);
}

// Write entry file
console.log("📝 Creating entry file...");
fs.writeFileSync(entryFile, entryContent);

try {
  // Run esbuild to create bundle, explicitly setting working directory to parsers
  console.log("⚙️  Building bundle with esbuild...");
  const command = `npx esbuild "${entryFile}" --bundle --format=iife --outfile="${chromeBundle}" --platform=browser --target=es2020 --loader:.ts=ts`;
  // Use 'pipe' instead of 'inherit' to avoid stdout/stderr race conditions during parallel validation
  const output = execSync(command, {
    cwd: parsersDir,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (output) console.log(output);

  // Copy to Safari extension
  console.log("📋 Copying bundle to Safari extension...");
  fs.copyFileSync(chromeBundle, safariBundle);

  console.log("✅ Parser bundle built successfully!");
  console.log(`   Chrome: ${chromeBundle}`);
  console.log(`   Safari: ${safariBundle}`);

  // Clean up entry file
  fs.unlinkSync(entryFile);

  // Release lock
  releaseLock();
} catch (error) {
  console.error("❌ Bundle build failed:", error.message);
  if (error.stdout) console.log(error.stdout);
  if (error.stderr) console.error(error.stderr);
  // Clean up entry file on error
  if (fs.existsSync(entryFile)) {
    fs.unlinkSync(entryFile);
  }
  // Release lock on error
  releaseLock();
  throw new Error("Bundle build failed", { cause: error });
}
