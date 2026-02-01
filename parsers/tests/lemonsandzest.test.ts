import { LemonsAndZestParser } from "../sites/lemonsandzest";

describe("LemonsAndZest Parser", () => {
  let parser: LemonsAndZestParser;

  beforeEach(() => {
    parser = new LemonsAndZestParser();
  });

  describe("canParse", () => {
    it("should identify LemonsAndZest URLs", () => {
      const url = "https://lemonsandzest.com/easy-rotisserie-chicken-noodle-soup/";
      expect(parser.canParse(url)).toBe(true);
    });

    it("should identify LemonsAndZest URLs with www", () => {
      const url = "https://www.lemonsandzest.com/some-recipe/";
      expect(parser.canParse(url)).toBe(true);
    });

    it("should reject other sites", () => {
      expect(parser.canParse("https://allrecipes.com/recipe/123/")).toBe(false);
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
              "name": "Chicken Noodle Soup",
              "description": "A comforting soup recipe",
              "recipeIngredient": ["chicken", "noodles", "broth", "vegetables"],
              "recipeInstructions": [
                {"@type": "HowToStep", "text": "Cook chicken"},
                {"@type": "HowToStep", "text": "Add vegetables"},
                {"@type": "HowToStep", "text": "Add noodles"}
              ],
              "image": "https://lemonsandzest.com/soup.jpg",
              "prepTime": "PT15M",
              "cookTime": "PT30M",
              "recipeYield": "6 servings"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/chicken-noodle-soup/";

      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Chicken Noodle Soup");
      expect(recipe.source).toBe(url);
      expect(recipe.ingredients.length).toBe(4);
      expect(recipe.instructions.length).toBe(3);
      expect(recipe.notes).toContain("A comforting soup recipe");
    });

    it("should handle HowToSection with itemListElement", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Multi-Section Recipe",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": [
                {
                  "@type": "HowToSection",
                  "name": "Prep Section",
                  "itemListElement": [
                    {"@type": "HowToStep", "text": "Prep step 1"},
                    {"@type": "HowToStep", "text": "Prep step 2"}
                  ]
                },
                {
                  "@type": "HowToSection",
                  "name": "Cook Section",
                  "itemListElement": [
                    {"@type": "HowToStep", "name": "Cook step 1"}
                  ]
                }
              ]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/multi/";

      const recipe = await parser.parse(html, url);

      expect(recipe.instructions.length).toBe(3);
    });

    it("should handle string instructions", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Simple",
              "recipeIngredient": ["a"],
              "recipeInstructions": ["Step 1", "Step 2"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/simple/";

      const recipe = await parser.parse(html, url);
      expect(recipe.instructions.length).toBe(2);
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
              "image": ["https://example.com/1.jpg"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/1.jpg");
    });

    it("should handle image object in array", async () => {
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
              "image": [{"@type": "ImageObject", "url": "https://example.com/img.jpg"}]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/img.jpg");
    });

    it("should handle image as object with url", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Image Object Test",
              "recipeIngredient": ["a"],
              "recipeInstructions": ["b"],
              "image": {"@type": "ImageObject", "url": "https://example.com/direct-obj.jpg"}
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/direct-obj.jpg");
    });

    it("should handle HowToStep with name instead of text", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Name Steps Recipe",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": [
                {"@type": "HowToStep", "name": "Step using name field"},
                {"@type": "HowToStep", "name": "Another step"}
              ]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.instructions.length).toBe(2);
    });

    it("should handle all timing fields", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Timing Test",
              "recipeIngredient": ["a"],
              "recipeInstructions": ["b"],
              "prepTime": "PT15M",
              "cookTime": "PT30M",
              "totalTime": "PT45M"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://lemonsandzest.com/timing/";

      const recipe = await parser.parse(html, url);
      expect(recipe.prepTime).toBe("PT15M");
      expect(recipe.cookTime).toBe("PT30M");
      expect(recipe.totalTime).toBe("PT45M");
    });
  });
});