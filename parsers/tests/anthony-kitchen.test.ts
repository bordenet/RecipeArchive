import { AnthonyKitchenParser } from "../sites/anthony-kitchen";

describe("AnthonyKitchen Parser", () => {
  let parser: AnthonyKitchenParser;

  beforeEach(() => {
    parser = new AnthonyKitchenParser();
  });

  describe("canParse", () => {
    it("should identify AnthonyKitchen URLs", () => {
      const url = "https://www.theanthonykitchen.com/recipes/best-chocolate-chip-cookies/";
      expect(parser.canParse(url)).toBe(true);
    });

    it("should identify AnthonyKitchen URLs without www", () => {
      const url = "https://theanthonykitchen.com/recipes/some-recipe/";
      expect(parser.canParse(url)).toBe(true);
    });

    it("should reject non-AnthonyKitchen URLs", () => {
      const url = "https://www.allrecipes.com/recipe/12345/";
      expect(parser.canParse(url)).toBe(false);
    });
  });

  describe("parse with JSON-LD", () => {
    it("should parse basic recipe structure from JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Chocolate Chip Cookies",
              "description": "The best homemade cookies",
              "recipeIngredient": ["2 cups flour", "1 cup butter", "1 cup chocolate chips"],
              "recipeInstructions": [
                {"@type": "HowToStep", "text": "Mix dry ingredients"},
                {"@type": "HowToStep", "text": "Add wet ingredients"},
                {"@type": "HowToStep", "text": "Bake at 350F"}
              ],
              "image": "https://theanthonykitchen.com/cookies.jpg",
              "prepTime": "PT15M",
              "cookTime": "PT12M",
              "totalTime": "PT27M",
              "recipeYield": "24 cookies"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://theanthonykitchen.com/recipes/cookies/";

      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Chocolate Chip Cookies");
      expect(recipe.source).toBe(url);
      expect(recipe.ingredients.length).toBe(3);
      expect(recipe.instructions.length).toBe(3);
      expect(recipe.imageUrl).toBe("https://theanthonykitchen.com/cookies.jpg");
      expect(recipe.prepTime).toBe("PT15M");
      expect(recipe.notes).toContain("The best homemade cookies");
    });

    it("should handle HowToSection with itemListElement", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Multi-section Recipe",
              "recipeIngredient": ["ingredient 1"],
              "recipeInstructions": [
                {
                  "@type": "HowToSection",
                  "name": "Prep",
                  "itemListElement": [
                    {"@type": "HowToStep", "text": "Step 1 in prep"},
                    {"@type": "HowToStep", "text": "Step 2 in prep"}
                  ]
                },
                {
                  "@type": "HowToSection",
                  "name": "Cook",
                  "itemListElement": [
                    {"@type": "HowToStep", "text": "Step 1 in cook"}
                  ]
                }
              ]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://theanthonykitchen.com/recipes/multi/";

      const recipe = await parser.parse(html, url);

      expect(recipe.instructions.length).toBe(3);
      expect(recipe.instructions[0].text).toContain("Step 1 in prep");
    });

    it("should handle string instructions directly", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Simple Recipe",
              "recipeIngredient": ["flour"],
              "recipeInstructions": ["Mix all", "Bake it", "Serve hot"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://theanthonykitchen.com/recipes/simple/";

      const recipe = await parser.parse(html, url);

      expect(recipe.instructions.length).toBe(3);
    });

    it("should handle image as array", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Test",
              "recipeIngredient": ["a"],
              "recipeInstructions": ["b"],
              "image": ["https://example.com/1.jpg", "https://example.com/2.jpg"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://theanthonykitchen.com/recipes/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/1.jpg");
    });

    it("should handle image as object", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Test",
              "recipeIngredient": ["a"],
              "recipeInstructions": ["b"],
              "image": {"@type": "ImageObject", "url": "https://example.com/img.jpg"}
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://theanthonykitchen.com/recipes/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/img.jpg");
    });

    it("should handle recipeYield as string", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Yield Test",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "recipeYield": "8 servings"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://theanthonykitchen.com/recipes/yield/";

      const recipe = await parser.parse(html, url);
      expect(recipe.servings).toBe("8 servings");
    });

    it("should handle recipeYield as array", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Yield Array Test",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "recipeYield": ["8 servings", "4 large portions"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://theanthonykitchen.com/recipes/yield2/";

      const recipe = await parser.parse(html, url);
      expect(recipe.servings).toBe("8 servings,4 large portions");
    });
  });
});
