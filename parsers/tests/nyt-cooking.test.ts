import { NYTCookingParser } from "../sites/nyt-cooking";
import { loadFixture } from "../../tests/unit/test-utils";

describe("NYTCooking Parser", () => {
  let parser: NYTCookingParser;

  beforeEach(() => {
    parser = new NYTCookingParser();
  });

  it("should identify NYTCooking URLs", () => {
    const url = "https://cooking.nytimes.com/recipes/1024687-best-chocolate-chip-cookies";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify NYTCooking URLs with www", () => {
    const url = "https://www.cooking.nytimes.com/recipes/some-recipe";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-NYTCooking URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it("should parse basic recipe structure from HTML fixture", async () => {
    // Testing with improved cheerio mock that supports .map()
    const html = await loadFixture("nyt-cooking-sample.html");
    const url = "https://cooking.nytimes.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    expect(recipe).toBeDefined();
    expect(recipe.title).toBeDefined();
    expect(recipe.title.length).toBeGreaterThan(0);
    expect(recipe.source).toBe(url);
    expect(recipe.ingredients).toBeDefined();
    expect(recipe.ingredients.length).toBeGreaterThan(0);
    expect(recipe.instructions).toBeDefined();
    expect(recipe.instructions.length).toBeGreaterThan(0);
  });

  it("should extract ingredients with proper structure", async () => {
    const html = await loadFixture("nyt-cooking-sample.html");
    const url = "https://cooking.nytimes.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    expect(recipe.ingredients.length).toBeGreaterThan(0);
    recipe.ingredients.forEach((ingredient) => {
      expect(ingredient.text).toBeDefined();
      expect(typeof ingredient.text).toBe("string");
      expect(ingredient.text.length).toBeGreaterThan(0);
    });
  });

  it("should extract instructions with step numbers", async () => {
    const html = await loadFixture("nyt-cooking-sample.html");
    const url = "https://cooking.nytimes.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBeGreaterThan(0);
    recipe.instructions.forEach((instruction, index) => {
      expect(instruction.stepNumber).toBe(index + 1);
      expect(instruction.text).toBeDefined();
      expect(typeof instruction.text).toBe("string");
      expect(instruction.text.length).toBeGreaterThan(0);
    });
  });

  describe("parse with JSON-LD", () => {
    it("should parse all JSON-LD fields", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Chocolate Chip Cookies",
              "author": {"@type": "Person", "name": "Melissa Clark"},
              "image": "https://nytimes.com/img.jpg",
              "recipeIngredient": ["flour", "sugar", "butter"],
              "recipeInstructions": [{"@type": "HowToStep", "text": "Mix dry ingredients"}, {"@type": "HowToStep", "text": "Add wet ingredients"}],
              "prepTime": "PT15M",
              "cookTime": "PT12M",
              "totalTime": "PT27M",
              "recipeYield": "24 cookies",
              "description": "The best chocolate chip cookies you'll ever make"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://cooking.nytimes.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Chocolate Chip Cookies");
      expect(recipe.author).toBe("Melissa Clark");
      expect(recipe.imageUrl).toBe("https://nytimes.com/img.jpg");
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.prepTime).toBe("PT15M");
      expect(recipe.cookTime).toBe("PT12M");
      expect(recipe.totalTime).toBe("PT27M");
      expect(recipe.servings).toBe("24 cookies");
      expect(recipe.notes).toEqual(["The best chocolate chip cookies you'll ever make"]);
    });

    it("should handle string author", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Quick Recipe",
              "author": "Sam Sifton",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://cooking.nytimes.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("Sam Sifton");
    });

    it("should default to NYT Cooking author", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
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
      const url = "https://cooking.nytimes.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("NYT Cooking");
    });

    it("should handle string instructions", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "String Instructions",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["Step one", "Step two", "Step three"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://cooking.nytimes.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.instructions).toHaveLength(3);
      expect(recipe.instructions[0].text).toContain("Step one");
    });

    it("should handle image as array", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Array Images",
              "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://cooking.nytimes.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
    });

    it("should handle image as object", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Object Image",
              "image": {"@type": "ImageObject", "url": "https://example.com/object.jpg"},
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://cooking.nytimes.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/object.jpg");
    });

    it("should handle image as array of objects", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Array of Object Images",
              "image": [{"@type": "ImageObject", "url": "https://example.com/arr-obj.jpg"}],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://cooking.nytimes.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/arr-obj.jpg");
    });
  });
});

