// Mock implementation of Cheerio for Jest tests
// This provides a minimal implementation that allows parser tests to run

const mockCheerio = {
  load: (html) => {
    // Create a mock jQuery-like object that can be used in tests
    const $ = (selector) => {
      // Handle case where selector might be undefined
      const safeSelector = selector || "";

      // Parse selector to provide appropriate test data
      const mockElement = {
        first: () => mockElement,
        text: () => {
          if (safeSelector.includes("h1") || safeSelector.includes("headline"))
            return "Test Recipe";
          if (safeSelector.includes("ingredient")) return "1 cup flour";
          if (safeSelector.includes("instruction")) return "Mix ingredients";
          return "Mock Text";
        },
        html: () => {
          // Return JSON-LD script content for structured data tests
          if (safeSelector.includes("script[type=\"application/ld+json\"]")) {
            return JSON.stringify({
              "@type": "Recipe",
              name: "Test Recipe",
              recipeIngredient: ["1 cup flour", "2 eggs"],
              recipeInstructions: [
                { text: "Mix flour and eggs" },
                { text: "Bake for 30 minutes" },
              ],
              image: "https://example.com/image.jpg",
            });
          }
          return "<div>Mock HTML</div>";
        },
        attr: (attr) => {
          if (attr === "content") return "https://example.com/image.jpg";
          if (attr === "src") return "https://example.com/image.jpg";
          return null;
        },
        each: (callback) => {
          // Mock multiple elements for lists (ingredients, instructions)
          if (safeSelector.includes("li")) {
            callback(0, {
              textContent: "1 cup flour",
              text: () => "1 cup flour",
            });
            callback(1, {
              textContent: "2 eggs",
              text: () => "2 eggs",
            });
          }
        },
        length: safeSelector.includes("li") ? 2 : 1,
      };

      return mockElement;
    };

    // Add jQuery-like methods to the $ function
    $.text = () => "Mock Document Text";
    $.html = () => html || "<div>Mock HTML</div>";

    return $;
  },
};

// Export for both CommonJS and ES modules
module.exports = mockCheerio;
module.exports.default = mockCheerio;
module.exports.load = mockCheerio.load;
