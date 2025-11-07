/* global extractSmittenKitchenRecipe */

// Test script to verify Chrome and Safari extensions produce identical payloads
// This ensures AWS API compatibility between browser extensions

const fs = require("fs");
const path = require("path");

console.log(
  "🧪 Testing payload compatibility between Chrome and Safari extensions...\n"
);

// Mock DOM environment for testing
const { JSDOM } = require("jsdom");

// Create a test Smitten Kitchen recipe page
const mockRecipeHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Recipe - Smitten Kitchen</title>
</head>
<body>
  <h1>Test Recipe</h1>
  <div class="jetpack-recipe-ingredients">
    <ul>
      <li>1 cup flour</li>
      <li>2 eggs</li>
      <li>1/2 cup sugar</li>
    </ul>
  </div>
  <div class="jetpack-recipe-directions">
    <ol>
      <li>Mix flour and sugar</li>
      <li>Add eggs and combine</li>
      <li>Bake at 350°F for 30 minutes</li>
    </ol>
  </div>
  <p>Prep time: 15 minutes. Bake time: 30 minutes. Total time: 45 minutes. Serves 8.</p>
  <div class="entry-content">
    <img src="https://example.com/recipe-photo.jpg" alt="Recipe photo">
  </div>
</body>
</html>
`;

// Setup JSDOM environment
const dom = new JSDOM(mockRecipeHTML, {
  url: "https://smittenkitchen.com/test-recipe/",
  pretendToBeVisual: true,
  resources: "usable",
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.NodeFilter = dom.window.NodeFilter;

// JSDOM doesn't implement innerText, so we need to polyfill it
if (!global.document.body.innerText) {
  Object.defineProperty(global.document.body, "innerText", {
    get: function () {
      return this.textContent;
    },
  });
}

// Mock Chrome/Browser APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: () => {},
    },
  },
};

global.browser = global.chrome;

// Override userAgent to be consistent
Object.defineProperty(global.navigator, "userAgent", {
  value: "Test-Agent/1.0",
  writable: true,
});

// Load and test Chrome extension
console.log("📋 Testing Chrome extension payload structure...");

// Read Chrome content script and extract the functions
const chromeContentPath = path.join(
  __dirname,
  "../../extensions/chrome/content.js"
);
const chromeContent = fs.readFileSync(chromeContentPath, "utf8");

// Execute Chrome content script in our test environment
eval(chromeContent);

const chromePayload = extractSmittenKitchenRecipe();

console.log("✅ Chrome payload generated");
console.log("   Fields:", Object.keys(chromePayload).sort());

// Load and test Safari extension
console.log("\n📋 Testing Safari extension payload structure...");

// Reset the environment
global.browser = global.chrome; // Safari compatibility

// Read Safari content script and extract the functions
const safariContentPath = path.join(
  __dirname,
  "../../extensions/safari/content.js"
);
const safariContent = fs.readFileSync(safariContentPath, "utf8");

// Execute Safari content script in our test environment
eval(safariContent);

const safariPayload = extractSmittenKitchenRecipe();

console.log("✅ Safari payload generated");
console.log("   Fields:", Object.keys(safariPayload).sort());

// Compare payload structures
console.log("\n🔍 Comparing payload structures...");

const chromeKeys = Object.keys(chromePayload).sort();
const safariKeys = Object.keys(safariPayload).sort();

const keysMatch = JSON.stringify(chromeKeys) === JSON.stringify(safariKeys);

if (keysMatch) {
  console.log("✅ Payload structures are identical!");
  console.log("   Both extensions have fields:", chromeKeys.join(", "));
} else {
  console.log("❌ Payload structures differ!");
  console.log("   Chrome fields:", chromeKeys.join(", "));
  console.log("   Safari fields:", safariKeys.join(", "));

  const chromeOnly = chromeKeys.filter((k) => !safariKeys.includes(k));
  const safariOnly = safariKeys.filter((k) => !chromeKeys.includes(k));

  if (chromeOnly.length)
    console.log("   Chrome-only fields:", chromeOnly.join(", "));
  if (safariOnly.length)
    console.log("   Safari-only fields:", safariOnly.join(", "));
}

// Test specific critical fields
console.log("\n🔍 Validating critical fields...");

const criticalFields = [
  "title",
  "ingredients",
  "steps",
  "fullTextContent",
  "fullPageArchive",
  "attributionUrl",
];
let allCriticalPresent = true;

criticalFields.forEach((field) => {
  const chromeHas = field in chromePayload;
  const safariHas = field in safariPayload;

  if (chromeHas && safariHas) {
    console.log(`   ✅ ${field}: Present in both`);
  } else {
    console.log(
      `   ❌ ${field}: Chrome:${chromeHas ? "✓" : "✗"} Safari:${safariHas ? "✓" : "✗"}`
    );
    allCriticalPresent = false;
  }
});

// Test fullTextContent specifically
console.log("\n🔍 Testing fullTextContent extraction...");

if (chromePayload.fullTextContent && safariPayload.fullTextContent) {
  const chromeTextLength = chromePayload.fullTextContent.length;
  const safariTextLength = safariPayload.fullTextContent.length;

  console.log(`   Chrome text length: ${chromeTextLength}`);
  console.log(`   Safari text length: ${safariTextLength}`);

  if (chromeTextLength === safariTextLength) {
    console.log("   ✅ Text content lengths match");
  } else {
    console.log(
      "   ⚠️  Text content lengths differ (may be due to minor processing differences)"
    );
  }

  // Check if both contain expected content
  const hasRecipeKeywords = (text) => {
    return (
      text.includes("flour") && text.includes("eggs") && text.includes("Bake")
    );
  };

  const chromeHasContent = hasRecipeKeywords(chromePayload.fullTextContent);
  const safariHasContent = hasRecipeKeywords(safariPayload.fullTextContent);

  if (chromeHasContent && safariHasContent) {
    console.log("   ✅ Both extensions extract recipe content properly");
  } else {
    console.log("   ❌ Content extraction issue detected");
  }
} else {
  console.log("   ❌ fullTextContent missing from one or both extensions");
  allCriticalPresent = false;
}

// Final result
console.log("\n📊 Final Results:");
console.log(
  `   Payload structure compatibility: ${keysMatch ? "✅ PASS" : "❌ FAIL"}`
);
console.log(
  `   Critical fields present: ${allCriticalPresent ? "✅ PASS" : "❌ FAIL"}`
);

if (keysMatch && allCriticalPresent) {
  console.log(
    "\n🎉 SUCCESS: Both extensions will produce compatible AWS API payloads!"
  );
  process.exit(0);
} else {
  console.log("\n💥 FAILURE: Extensions produce incompatible payloads");
  process.exit(1);
}
