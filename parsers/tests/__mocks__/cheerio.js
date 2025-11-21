// Mock implementation of Cheerio for Jest tests
// This provides a minimal implementation that allows parser tests to run

const mockCheerio = {
  load: (html) => {
    // Create a mock jQuery-like object that can be used in tests
    const $ = (selector) => {
      // Handle case where selector might be undefined or an element object
      if (typeof selector === "object" && selector !== null) {
        // If selector is already an element object, return it wrapped with full API
        const wrappedElement = {
          text: () => selector.text ? selector.text() : selector.textContent || "Mock Text",
          html: () => selector.html ? selector.html() : "<div>Mock HTML</div>",
          attr: (attr) => selector.attr ? selector.attr(attr) : null,
          first: () => wrappedElement,
          find: (newSelector) => $(newSelector), // Support chaining
          nextAll: (newSelector) => $(newSelector), // Support chaining
          each: (callback) => {
            // For wrapped elements, call callback once with the element
            callback(0, selector);
          },
          length: 1,
        };
        return wrappedElement;
      }

      const safeSelector = selector || "";

      // Parse selector to provide appropriate test data
      const mockElement = {
        first: () => mockElement,
        nextAll: (newSelector) => $(newSelector), // Create new element with new selector
        find: (newSelector) => $(newSelector), // Create new element with new selector
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
          // Check if this is a selector that should return list items
          const shouldReturnList =
            safeSelector.includes("li") ||
            safeSelector.includes("ingredient") ||
            safeSelector.includes("instruction") ||
            typeof safeSelector === "string"; // Default to returning list for any string selector

          if (shouldReturnList) {
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
        map: (callback) => {
          // Mock .map() function for cheerio collections
          const results = [];
          if (safeSelector.includes("li") || safeSelector.includes("ingredient") || safeSelector.includes("instruction")) {
            // Return mock ingredient/instruction objects
            results.push(callback(0, {
              textContent: "1 cup flour",
              text: () => "1 cup flour",
            }));
            results.push(callback(1, {
              textContent: "2 eggs",
              text: () => "2 eggs",
            }));
          }
          // Return object with get() method to match cheerio API
          return {
            get: () => results.filter(r => r !== undefined && r !== null),
          };
        },
        get: () => {
          // Mock .get() function to return array of elements
          if (safeSelector.includes("li") || safeSelector.includes("ingredient") || safeSelector.includes("instruction")) {
            return [
              { textContent: "1 cup flour", text: () => "1 cup flour" },
              { textContent: "2 eggs", text: () => "2 eggs" },
            ];
          }
          return [mockElement];
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
