import { LauraInTheKitchenParser } from "../sites/laurainthekitchen.com";

describe("LauraInTheKitchen Parser", () => {
  let parser: LauraInTheKitchenParser;

  beforeEach(() => {
    parser = new LauraInTheKitchenParser();
  });

  describe("canParse", () => {
    it("should identify LauraInTheKitchen URLs", () => {
      const url = "https://www.laurainthekitchen.com/recipes/stuffed-peppers/";
      expect(parser.canParse(url)).toBe(true);
    });

    it("should identify LauraInTheKitchen URLs without www", () => {
      const url = "https://laurainthekitchen.com/recipes/pasta/";
      expect(parser.canParse(url)).toBe(true);
    });

    it("should reject non-recipe LauraInTheKitchen URLs", () => {
      const url = "https://laurainthekitchen.com/about/";
      expect(parser.canParse(url)).toBe(false);
    });

    it("should reject other sites", () => {
      expect(parser.canParse("https://www.allrecipes.com/recipes/12345/")).toBe(false);
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
              "name": "Stuffed Peppers",
              "author": {"@type": "Person", "name": "Laura Vitale"},
              "recipeIngredient": ["4 bell peppers", "1 lb ground beef", "1 cup rice"],
              "recipeInstructions": [
                {"@type": "HowToStep", "text": "Cut tops off peppers"},
                {"@type": "HowToStep", "text": "Mix filling ingredients"},
                {"@type": "HowToStep", "text": "Stuff peppers and bake"}
              ],
              "image": "https://laurainthekitchen.com/image.jpg",
              "prepTime": "PT20M",
              "cookTime": "PT45M",
              "totalTime": "PT65M",
              "recipeYield": "4 servings"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://laurainthekitchen.com/recipes/stuffed-peppers/";

      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Stuffed Peppers");
      expect(recipe.author).toBe("Laura Vitale");
      expect(recipe.source).toBe(url);
      expect(recipe.ingredients.length).toBe(3);
      expect(recipe.instructions.length).toBe(3);
      expect(recipe.imageUrl).toBe("https://laurainthekitchen.com/image.jpg");
      expect(recipe.prepTime).toBe("PT20M");
      expect(recipe.cookTime).toBe("PT45M");
      expect(recipe.servings).toBe("4 servings");
    });

    it("should handle string instructions in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Simple Pasta",
              "recipeIngredient": ["pasta", "sauce"],
              "recipeInstructions": ["Boil pasta", "Add sauce", "Serve"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://laurainthekitchen.com/recipes/pasta/";

      const recipe = await parser.parse(html, url);

      expect(recipe.instructions.length).toBe(3);
      expect(recipe.instructions[0].stepNumber).toBe(1);
    });

    it("should handle author as string in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Test Recipe",
              "author": "Laura Vitale",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://laurainthekitchen.com/recipes/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.author).toBe("Laura Vitale");
    });

    it("should handle image as array in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Test Recipe",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://laurainthekitchen.com/recipes/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
    });

    it("should handle image object in array in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Test Recipe",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "image": [{"@type": "ImageObject", "url": "https://example.com/img.jpg"}]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://laurainthekitchen.com/recipes/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/img.jpg");
    });

    it("should handle image as object with url property in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Object Image Recipe",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "image": {"@type": "ImageObject", "url": "https://example.com/object-img.jpg"}
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://laurainthekitchen.com/recipes/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.imageUrl).toBe("https://example.com/object-img.jpg");
    });

    it("should default to Laura Vitale as author when author is missing", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "No Author Recipe",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://laurainthekitchen.com/recipes/test/";

      const recipe = await parser.parse(html, url);
      expect(recipe.author).toBe("Laura Vitale");
    });
  });
});
