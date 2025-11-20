// RecipeArchive Safari Extension Content Script
// Simple, reliable implementation with comprehensive error handling

console.log("🎯 RecipeArchive content script starting...");

// Global error handler for unhandled exceptions
const DIAGNOSTIC_ENDPOINT = (function resolveDiagnosticEndpoint() {
  try {
    if (typeof CONFIG !== "undefined" && CONFIG.getCurrentAPI) {
      const api = CONFIG.getCurrentAPI();
      if (api && api.diagnostics) {
        return api.diagnostics;
      }
    }
  } catch (_e) {
    // Ignore CONFIG resolution errors and fall back to placeholder
  }
  // Placeholder URL – configure API_BASE_URL via .env and env-config.js for real deployments
  return "https://your-api-gateway-id.execute-api.us-west-2.amazonaws.com/prod/report-error";
})();

// Diagnostic reporting function
async function reportDiagnostic(errorType, error, additionalData = {}) {
  try {
    const diagnosticData = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorType,
      error: error?.message || error?.toString() || "Unknown error",
      timestamp: new Date().toISOString(),
      extension: "safari",
      ...additionalData,
    };

    // Include stack trace if available
    if (error?.stack) {
      diagnosticData.stack = error.stack;
    }

    // Include HTML for parsing errors
    if (errorType === "parsing-error" || errorType === "extraction-error") {
      diagnosticData.html = document.documentElement.outerHTML;
    }

    await fetch(DIAGNOSTIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(diagnosticData),
    });

    console.log("📊 Diagnostic data sent successfully");
  } catch (diagnosticError) {
    console.error("❌ Failed to send diagnostic data:", diagnosticError);
  }
}

// Global error handlers
window.addEventListener("error", (event) => {
  console.error("🚨 Unhandled error:", event.error);
  reportDiagnostic("unhandled-error", event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
  event.preventDefault(); // Prevent error from reaching Safari
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("🚨 Unhandled promise rejection:", event.reason);
  reportDiagnostic("unhandled-rejection", event.reason);
  event.preventDefault(); // Prevent error from reaching Safari
});

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}

function initializeContentScript() {
  console.log("✅ RecipeArchive content script initialized");

  // Simple message listener
  chrome.runtime.onMessage.addListener(
    function messageListener(request, sender, sendResponse) {
      try {
        console.log("📨 RecipeArchive received message:", request);

        if (request.action === "ping") {
          sendResponse({
            status: "pong",
            url: window.location.href,
            title: document.title,
          });
          return true;
        }

        if (request.action === "captureRecipe") {
          console.log("🍳 Starting recipe capture...");

          // Handle async operation properly
          (async () => {
            try {
              const recipeData = await extractRecipeFromPage();
              console.log("🔧 Recipe extraction completed:", recipeData);

              // Simple validation - check if we have meaningful content
              const hasIngredients =
                recipeData &&
                recipeData.ingredients &&
                recipeData.ingredients.length > 0;
              const hasInstructions =
                recipeData &&
                recipeData.instructions &&
                recipeData.instructions.length > 0;

              if (
                recipeData &&
                recipeData.title &&
                (hasIngredients || hasInstructions)
              ) {
                console.log("✅ Recipe extracted successfully");
                sendResponse({ status: "success", data: recipeData });
              } else {
                console.log("⚠️ No meaningful recipe data found");
                const basicRecipe = {
                  title: document.title || "Unknown Recipe",
                  url: window.location.href,
                  timestamp: new Date().toISOString(),
                  ingredients: [],
                  instructions: [],
                  source: "no-recipe-found",
                };
                sendResponse({ status: "success", data: basicRecipe });
              }
            } catch (error) {
              console.error("❌ Recipe extraction error:", error);

              // Report extraction error to diagnostic endpoint
              reportDiagnostic("extraction-error", error, {
                recipeExtractionFailed: true,
                url: window.location.href,
              });

              const errorRecipe = {
                title: document.title || "Unknown Recipe",
                url: window.location.href,
                timestamp: new Date().toISOString(),
                ingredients: [],
                instructions: [],
                source: "extraction-error",
                error: error.message,
              };
              sendResponse({ status: "success", data: errorRecipe });
            }
          })();
          return true;
        }

        sendResponse({ status: "unknown_action", action: request.action });
        return true;
      } catch (error) {
        console.error("❌ RecipeArchive message handling error:", error);

        // Report message handling error to diagnostic endpoint
        reportDiagnostic("message-handling-error", error, {
          action: request?.action,
          requestData: JSON.stringify(request),
        });

        sendResponse({ status: "error", error: error.message });
        return true;
      }
    }
  );
}

// NOTE: Image processing moved to popup context to avoid CORS restrictions
// Content scripts run in website context and cannot fetch cross-origin images

// Helper function to recursively find Recipe objects in JSON-LD
function findRecipe(obj) {
  if (!obj || typeof obj !== "object") return null;

  // Direct Recipe match - handle both string and array @type
  const objType = obj["@type"];
  if (
    objType === "Recipe" ||
    (Array.isArray(objType) && objType.includes("Recipe"))
  ) {
    return obj;
  }

  // Array handling
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }

  // Object property search
  for (const key in obj) {
    if (key === "@graph" || key === "mainEntity" || key.includes("recipe")) {
      const found = findRecipe(obj[key]);
      if (found) return found;
    }
  }

  return null;
}

// Enhanced recipe extraction with TypeScript parser support
async function extractRecipeFromPage() {
  const url = window.location.href;
  console.log("🔍 Extracting recipe from:", url);

  // Try TypeScript parser first (most comprehensive for supported sites)
  if (typeof window.RecipeArchiveParserRegistry !== "undefined") {
    try {
      console.log("🎯 Using TypeScript parser for extraction...");
      const html = document.documentElement.outerHTML;
      const tsRecipe = await window.RecipeArchiveParserRegistry.parseRecipe(
        html,
        url
      );

      if (
        tsRecipe &&
        tsRecipe.title &&
        (tsRecipe.ingredients?.length > 0 || tsRecipe.instructions?.length > 0)
      ) {
        console.log("✅ TypeScript parser found recipe:", tsRecipe.title);
        return tsRecipe;
      } else {
        console.log("⚠️ TypeScript parser did not find a recipe");
      }
    } catch (error) {
      console.warn("⚠️ TypeScript parser error:", error.message);

      // Report TypeScript parser error
      reportDiagnostic("typescript-parser-error", error, {
        parserAvailable:
          typeof window.RecipeArchiveParserRegistry !== "undefined",
      });
    }
  } else {
    console.log("📦 TypeScript parser not available, using fallback methods");
  }

  // Fallback: Try JSON-LD extraction (most reliable for standard sites)
  const jsonLdScripts = document.querySelectorAll(
    "script[type=\"application/ld+json\"]"
  );
  console.log(`🔍 Found ${jsonLdScripts.length} JSON-LD scripts`);

  for (let i = 0; i < jsonLdScripts.length; i++) {
    const script = jsonLdScripts[i];
    try {
      // Clean up common JSON issues
      let jsonText = script.textContent;

      // Remove/replace common problematic control characters (ASCII 0-31)
      // Build control character range dynamically to avoid ESLint no-control-regex
      const controlChars = Array.from({ length: 32 }, (_, i) =>
        String.fromCharCode(i)
      ).join("");
      const controlCharRegex = new RegExp("[" + controlChars + "]+", "g");

      jsonText = jsonText
        .replace(controlCharRegex, " ") // Replace control characters with spaces
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      const jsonData = JSON.parse(jsonText);
      console.log(
        `📊 JSON-LD ${i}:`,
        typeof jsonData,
        Array.isArray(jsonData)
          ? `Array(${jsonData.length})`
          : jsonData["@type"]
      );

      let recipeData = findRecipe(jsonData);

      // Additional debug logging for AllRecipes debugging
      if (!recipeData && Array.isArray(jsonData)) {
        console.log(
          "🔍 Array structure debug:",
          jsonData.map((item) => ({
            type: item["@type"],
            keys: Object.keys(item),
            hasGraph: !!item["@graph"],
            hasMainEntity: !!item.mainEntity,
          }))
        );

        // Deep debug the first array item
        if (jsonData.length > 0) {
          console.log("🔍 First item detailed:", jsonData[0]);

          // Check if it has nested properties we missed
          const firstItem = jsonData[0];
          if (firstItem && typeof firstItem === "object") {
            for (const key in firstItem) {
              const value = firstItem[key];
              if (value && typeof value === "object") {
                console.log(
                  `🔍 Property "${key}":`,
                  Array.isArray(value)
                    ? `Array(${value.length})`
                    : typeof value,
                  value["@type"]
                );
              }
            }
          }
        }
      }

      if (recipeData) {
        console.log("✅ JSON-LD recipe found:", recipeData.name);
        console.log(
          `📋 Ingredients: ${recipeData.recipeIngredient?.length || 0}`
        );
        console.log(
          `📝 Instructions: ${recipeData.recipeInstructions?.length || 0}`
        );

        const ingredients = (recipeData.recipeIngredient || []).map(
          (ingredient) => ({
            text:
              typeof ingredient === "string"
                ? ingredient
                : ingredient.text || ingredient,
          })
        );

        const instructions = (recipeData.recipeInstructions || []).map(
          (instruction, idx) => ({
            stepNumber: idx + 1,
            text:
              typeof instruction === "string"
                ? instruction
                : instruction.text || instruction.name || "",
          })
        );

        if (ingredients.length > 0 || instructions.length > 0) {
          // Extract the raw image URL - don't process it here due to CORS
          const rawImageUrl =
            typeof recipeData.image === "string"
              ? recipeData.image
              : Array.isArray(recipeData.image)
                ? typeof recipeData.image[0] === "string"
                  ? recipeData.image[0]
                  : recipeData.image[0]?.url
                : recipeData.image?.url;

          console.log(
            "🖼️ Found recipe image URL (will process in popup context):",
            rawImageUrl
          );

          const result = {
            title: recipeData.name || document.title,
            url: url,
            author:
              typeof recipeData.author === "string"
                ? recipeData.author
                : recipeData.author?.name || "Unknown",
            ingredients,
            instructions,
            prepTime: recipeData.prepTime,
            cookTime: recipeData.cookTime,
            totalTime: recipeData.totalTime,
            servings: recipeData.recipeYield?.toString(),
            timestamp: new Date().toISOString(),
            source: "json-ld",
          };

          // Include raw image URL for popup to process (no CORS in extension context)
          if (rawImageUrl) {
            result.rawImageUrl = rawImageUrl;
          }

          console.log("🔧 DEBUG: Content script returning recipe data:", {
            title: result.title,
            ingredientsCount: result.ingredients.length,
            instructionsCount: result.instructions.length,
            source: result.source,
            url: result.url,
          });

          return result;
        } else {
          console.log("⚠️ Recipe found but no ingredients/instructions");
        }
      }
    } catch (e) {
      console.warn(`Failed to parse JSON-LD script ${i}:`, e);

      // Report JSON-LD parsing error
      reportDiagnostic("json-ld-parsing-error", e, {
        scriptIndex: i,
        scriptContent: script.textContent?.substring(0, 500), // First 500 chars for debugging
      });
    }
  }

  // Simple DOM fallback for common patterns
  console.log("⚠️ No JSON-LD found, trying simple DOM extraction");

  const title =
    document.querySelector("h1")?.textContent?.trim() || document.title;

  // Look for ingredient lists
  const ingredients = [];
  const ingredientSelectors = [
    ".recipe-ingredients li",
    ".ingredients li",
    "[class*=\"ingredient\"] li",
    "ul li[class*=\"ingredient\"]",
  ];

  for (const selector of ingredientSelectors) {
    document.querySelectorAll(selector).forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length > 2) {
        ingredients.push({ text });
      }
    });
    if (ingredients.length > 0) break;
  }

  // Look for instruction lists
  const instructions = [];
  const instructionSelectors = [
    ".recipe-instructions li",
    ".instructions li",
    ".recipe-directions li",
    "[class*=\"instruction\"] li",
    "ol li[class*=\"step\"]",
  ];

  for (const selector of instructionSelectors) {
    document.querySelectorAll(selector).forEach((el, idx) => {
      const text = el.textContent?.trim();
      if (text && text.length > 5) {
        instructions.push({ stepNumber: idx + 1, text });
      }
    });
    if (instructions.length > 0) break;
  }

  console.log(
    `🔧 DOM extraction found: ${ingredients.length} ingredients, ${instructions.length} instructions`
  );

  return {
    title,
    url: url,
    author: "Unknown",
    ingredients,
    instructions,
    timestamp: new Date().toISOString(),
    source:
      ingredients.length > 0 || instructions.length > 0
        ? "dom-fallback"
        : "no-recipe-found",
  };
}
