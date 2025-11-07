// Real Recipe Parser Validation Tool
// Tests actual recipe extraction with real HTML content

console.log("🦪 Real Recipe Parser Testing Tool");
console.log("================================");

// Mock browser environment for the parser bundle
global.window = {};
global.document = {
  title: "Loading...",
  documentElement: { outerHTML: "Loading..." },
};

// Mock fetch for the parser bundle
global.fetch = async (url) => {
  throw new Error(`Fetch not implemented in test environment: ${url}`);
};

// Mock DOMParser for real HTML parsing
class MockDOMParser {
  parseFromString(html, _type) {
    // Simple regex-based HTML parsing for testing
    return {
      documentElement: { outerHTML: html },
      title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "Recipe",
      querySelector: (selector) => {
        // Basic selector support for testing
        if (selector === "script[type=\"application/ld+json\"]") {
          const jsonLdMatch = html.match(
            /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/gi
          );
          if (jsonLdMatch) {
            return {
              textContent: jsonLdMatch[0].replace(/<[^>]*>/g, ""),
            };
          }
        }
        return null;
      },
      querySelectorAll: (selector) => {
        const elements = [];
        // Handle recipe ingredient selectors
        if (selector.includes("ingredient")) {
          const ingredientPatterns = [
            /<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>([^<]+)<\/li>/gi,
            /<li[^>]*>([^<]+)<\/li>/gi, // Generic li elements
          ];
          for (const pattern of ingredientPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
              elements.push({
                textContent: match[1].trim(),
                className: "ingredient",
              });
            }
          }
        }
        // Handle recipe instruction selectors
        if (
          selector.includes("instruction") ||
          selector.includes("method") ||
          selector.includes("steps")
        ) {
          const instructionPatterns = [
            /<li[^>]*class="[^"]*instruction[^"]*"[^>]*>([^<]+)<\/li>/gi,
            /<div[^>]*class="[^"]*instruction[^"]*"[^>]*>([^<]+)<\/div>/gi,
          ];
          for (const pattern of instructionPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
              elements.push({
                textContent: match[1].trim(),
                className: "instruction",
              });
            }
          }
        }
        return elements;
      },
    };
  }
}

global.DOMParser = MockDOMParser;

// Load the TypeScript parser bundle
try {
  require("../../extensions/chrome/typescript-parser-bundle.js");
  console.log("✅ TypeScript parser bundle loaded");
} catch (error) {
  console.error("❌ Failed to load parser bundle:", error.message);
  process.exit(1);
}

// Test URLs with expected data for validation
const testCases = [
  {
    url: "https://smittenkitchen.com/2025/04/simplest-brisket-with-braised-onions/",
    expectedIngredients: [
      "Kosher salt",
      "One (6-pound or 2.75 kg) first-cut beef brisket",
      "Freshly ground black pepper",
      "Vegetable oil",
      "3 pounds (1.35 kg) of yellow onions (about 8 medium)",
      "6 garlic cloves, peeled and smashed",
      "4 tablespoons (65 grams) tomato paste",
      "1 to 1 1/2 pounds (455 to 680 grams) thick carrots, peeled, trimmed, and cut into 1-inch chunks",
    ],
    expectedInstructionCount: 8, // Should have multiple cooking steps
    site: "Smitten Kitchen",
  },
];

async function fetchRealHTML(url) {
  try {
    console.log(`📡 Fetching real HTML from: ${url}`);
    // Use native fetch (Node 18+) or require node-fetch for older versions
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    console.log(`✅ Fetched ${Math.round(html.length / 1024)}KB of HTML`);
    return html;
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error.message);
    return null;
  }
}

async function testRealParsing() {
  if (!global.window.TypeScriptParser) {
    console.error("❌ TypeScript parser not available");
    return;
  }
  console.log("\n🔍 Testing Real Recipe Parsing");
  console.log("------------------------------");
  for (const testCase of testCases) {
    console.log(`\n🎯 Testing: ${testCase.site}`);
    console.log(`📍 URL: ${testCase.url}`);
    // Fetch real HTML content
    const html = await fetchRealHTML(testCase.url);
    if (!html) {
      console.log("❌ Could not fetch HTML, skipping test");
      continue;
    }
    // Test parser detection
    const canHandle = global.window.TypeScriptParser.canTypeScriptParserHandle(
      testCase.url
    );
    console.log(
      `🔍 Parser Detection: ${canHandle ? "✅ Supported" : "❌ Not Supported"}`
    );
    if (!canHandle) {
      console.log("⚠️  Will use JSON-LD fallback");
    }
    // Set up the DOM with real HTML
    global.document = new MockDOMParser().parseFromString(html, "text/html");
    global.window.location = { href: testCase.url };
    try {
      // Extract recipe using the parser system
      const result =
        await global.window.TypeScriptParser.extractRecipeFromPage();
      console.log("📊 Extraction Results:");
      console.log(`   📝 Title: ${result.title || "NOT FOUND"}`);
      console.log(
        `   🥘 Ingredients: ${result.ingredients?.length || 0} found`
      );
      console.log(`   📖 Instructions: ${result.steps?.length || 0} found`);
      console.log(`   🏷️  Source: ${result.source}`);
      // Validate against expected results
      let score = 0;
      let maxScore = 3;
      if (result.title && result.title.toLowerCase().includes("brisket")) {
        console.log("   ✅ Title contains 'brisket'");
        score++;
      } else {
        console.log("   ❌ Title missing or incorrect");
      }
      if (result.ingredients && result.ingredients.length >= 6) {
        console.log(
          `   ✅ Found ${result.ingredients.length} ingredients (expected ~8)`
        );
        score++;
      } else {
        console.log(
          `   ❌ Only found ${result.ingredients?.length || 0} ingredients (expected ~8)`
        );
      }
      if (result.steps && result.steps.length >= 5) {
        console.log(`   ✅ Found ${result.steps.length} instruction steps`);
        score++;
      } else {
        console.log(
          `   ❌ Only found ${result.steps?.length || 0} instruction steps (expected 5+)`
        );
      }
      const successRate = Math.round((score / maxScore) * 100);
      console.log(`\n📈 Success Rate: ${score}/${maxScore} (${successRate}%)`);
      if (successRate >= 80) {
        console.log("🎉 PARSER WORKING CORRECTLY");
      } else if (successRate >= 50) {
        console.log("⚠️  PARSER PARTIALLY WORKING");
      } else {
        console.log("❌ PARSER FAILING");
      }
    } catch (error) {
      console.error("❌ Parser extraction failed:", error.message);
    }
  }
}
// Run the real parser test
testRealParsing().catch(console.error);
