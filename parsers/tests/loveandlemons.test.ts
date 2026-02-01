import { LoveAndLemonsParser } from "../sites/loveandlemons";
import { loadFixture } from "../../tests/unit/test-utils";

describe("LoveAndLemons Parser", () => {
  let parser: LoveAndLemonsParser;

  beforeEach(() => {
    parser = new LoveAndLemonsParser();
  });

  it("should identify LoveAndLemons URLs", () => {
    const url = "https://www.loveandlemons.com/best-chocolate-chip-cookies/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify LoveAndLemons URLs without www", () => {
    const url = "https://loveandlemons.com/some-recipe/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-LoveAndLemons URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it("should parse basic recipe structure from HTML fixture", async () => {
    const html = await loadFixture("love-lemons-sample.html");
    const url = "https://www.loveandlemons.com/test-recipe/";

    const recipe = await parser.parse(html, url);

    expect(recipe).toBeDefined();
    expect(recipe.title).toBeDefined();
    expect(recipe.title.length).toBeGreaterThan(0);
    expect(recipe.source).toBe(url);
    expect(recipe.ingredients).toBeDefined();
    expect(recipe.instructions).toBeDefined();
  });

  it("should extract ingredients with proper structure", async () => {
    const html = await loadFixture("love-lemons-sample.html");
    const url = "https://www.loveandlemons.com/test-recipe/";

    const recipe = await parser.parse(html, url);

    expect(Array.isArray(recipe.ingredients)).toBe(true);
    recipe.ingredients.forEach((ingredient) => {
      expect(ingredient.text).toBeDefined();
      expect(typeof ingredient.text).toBe("string");
    });
  });

  it("should extract instructions with step numbers", async () => {
    const html = await loadFixture("love-lemons-sample.html");
    const url = "https://www.loveandlemons.com/test-recipe/";

    const recipe = await parser.parse(html, url);

    expect(Array.isArray(recipe.instructions)).toBe(true);
    recipe.instructions.forEach((instruction, index) => {
      expect(instruction.stepNumber).toBe(index + 1);
      expect(instruction.text).toBeDefined();
      expect(typeof instruction.text).toBe("string");
    });
  });

  it("should handle optional metadata fields", async () => {
    const html = await loadFixture("love-lemons-sample.html");
    const url = "https://www.loveandlemons.com/test-recipe/";

    const recipe = await parser.parse(html, url);

    if (recipe.author) expect(typeof recipe.author).toBe("string");
    if (recipe.imageUrl) expect(typeof recipe.imageUrl).toBe("string");
    if (recipe.prepTime) expect(typeof recipe.prepTime).toBe("string");
    if (recipe.cookTime) expect(typeof recipe.cookTime).toBe("string");
    if (recipe.totalTime) expect(typeof recipe.totalTime).toBe("string");
    if (recipe.servings) expect(typeof recipe.servings).toBe("string");
  });

  describe("parse with JSON-LD", () => {
    it("should parse recipe with all JSON-LD fields", async () => {
      const html = `
        <html>
          <head>
            <title>Test Recipe</title>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Lemon Pasta",
              "image": "https://loveandlemons.com/img.jpg",
              "recipeIngredient": ["pasta", "lemon juice", "olive oil"],
              "recipeInstructions": [{"@type": "HowToStep", "text": "Cook pasta"}, {"@type": "HowToStep", "text": "Add lemon"}],
              "prepTime": "PT10M",
              "cookTime": "PT20M",
              "totalTime": "PT30M",
              "recipeYield": "4 servings",
              "description": "A fresh and easy pasta dish"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://www.loveandlemons.com/lemon-pasta/";
      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Lemon Pasta");
      expect(recipe.imageUrl).toBe("https://loveandlemons.com/img.jpg");
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.prepTime).toBe("PT10M");
      expect(recipe.cookTime).toBe("PT20M");
      expect(recipe.totalTime).toBe("PT30M");
      expect(recipe.servings).toBe("4 servings");
      expect(recipe.notes).toEqual(["A fresh and easy pasta dish"]);
    });

    it("should handle string instructions", async () => {
      const html = `
        <html>
          <head><title>Test</title>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Simple Recipe",
              "recipeIngredient": ["ingredient 1"],
              "recipeInstructions": ["Step one", "Step two"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://www.loveandlemons.com/simple/";
      const recipe = await parser.parse(html, url);

      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.instructions[0].text).toContain("Step one");
    });

    it("should handle image as array of strings", async () => {
      const html = `
        <html>
          <head><title>Test</title>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://www.loveandlemons.com/test/";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
    });

    it("should handle image as array of objects", async () => {
      const html = `
        <html>
          <head><title>Test</title>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "image": [{"@type": "ImageObject", "url": "https://example.com/img.jpg"}],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://www.loveandlemons.com/test/";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/img.jpg");
    });

    it("should handle image as single object", async () => {
      const html = `
        <html>
          <head><title>Test</title>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "image": {"@type": "ImageObject", "url": "https://example.com/single.jpg"},
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://www.loveandlemons.com/test/";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/single.jpg");
    });
  });

  describe("JSON-LD edge cases", () => {
    it("should handle missing optional fields", async () => {
      const html = `
        <html>
          <head><title>Test</title>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Minimal Recipe",
              "recipeIngredient": ["one ingredient"],
              "recipeInstructions": ["one step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://www.loveandlemons.com/minimal/";
      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Minimal Recipe");
      expect(recipe.prepTime).toBeUndefined();
      expect(recipe.cookTime).toBeUndefined();
      expect(recipe.notes).toBeUndefined();
    });

    it("should handle numeric recipeYield", async () => {
      const html = `
        <html>
          <head><title>Test</title>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Serving Test",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "recipeYield": 4
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://www.loveandlemons.com/test/";
      const recipe = await parser.parse(html, url);

      expect(recipe.servings).toBe("4");
    });
  });
});

