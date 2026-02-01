import { Food52Parser } from "../sites/food52";
import { loadFixture } from "../../tests/unit/test-utils";

describe("Food52 Parser", () => {
  let parser: Food52Parser;

  beforeEach(() => {
    parser = new Food52Parser();
  });

  it("should identify Food52 URLs", () => {
    const url = "https://food52.com/recipes/88657-best-chocolate-chip-cookies";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify Food52 URLs with www", () => {
    const url = "https://www.food52.com/recipes/some-recipe";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-Food52 URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it("should parse basic recipe structure from HTML fixture", async () => {
    // NOTE: food52.com blocks automated access with Vercel Security Checkpoint
    // E2E tests are excluded, but unit tests with fixtures work fine
    const html = await loadFixture("food52-Confit-Red-Pepper-and-Tomato-Pasta-Sauce-Recipe.html");
    const url = "https://food52.com/recipes/test-recipe";

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
    const html = await loadFixture("food52-Confit-Red-Pepper-and-Tomato-Pasta-Sauce-Recipe.html");
    const url = "https://food52.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    expect(recipe.ingredients.length).toBeGreaterThan(0);
    recipe.ingredients.forEach((ingredient) => {
      expect(ingredient.text).toBeDefined();
      expect(typeof ingredient.text).toBe("string");
      expect(ingredient.text.length).toBeGreaterThan(0);
    });
  });

  it("should extract instructions with step numbers", async () => {
    const html = await loadFixture("food52-Confit-Red-Pepper-and-Tomato-Pasta-Sauce-Recipe.html");
    const url = "https://food52.com/recipes/test-recipe";

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
    it("should parse author as string", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "author": "Jane Smith",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("Jane Smith");
    });

    it("should parse author as object with name", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "author": {"@type": "Person", "name": "John Doe"},
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("John Doe");
    });

    it("should parse keywords as array", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "keywords": ["vegan", "quick", "healthy"],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.tags).toEqual(["vegan", "quick", "healthy"]);
    });

    it("should parse keywords as comma-separated string", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "keywords": "dinner, pasta, italian",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.tags).toContain("dinner");
      expect(recipe.tags).toContain("pasta");
      expect(recipe.tags).toContain("italian");
    });

    it("should parse recipeCategory as array", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "recipeCategory": ["Main Course", "Dinner"],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.tags).toContain("Main Course");
      expect(recipe.tags).toContain("Dinner");
    });

    it("should parse recipeCategory as string", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "recipeCategory": "Dessert, Baking",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.tags).toContain("Dessert");
      expect(recipe.tags).toContain("Baking");
    });

    it("should combine keywords and recipeCategory into tags", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "keywords": ["healthy"],
              "recipeCategory": ["Lunch"],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.tags).toContain("healthy");
      expect(recipe.tags).toContain("Lunch");
    });

    it("should handle full recipe with all fields", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Amazing Pasta",
              "author": {"name": "Food52 Staff"},
              "image": "https://food52.com/img.jpg",
              "recipeIngredient": ["pasta", "olive oil"],
              "recipeInstructions": [{"text": "Boil water"}, {"text": "Cook pasta"}],
              "prepTime": "PT10M",
              "cookTime": "PT15M",
              "totalTime": "PT25M",
              "recipeYield": "4 servings",
              "description": "The best pasta ever"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://food52.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Amazing Pasta");
      expect(recipe.author).toBe("Food52 Staff");
      expect(recipe.imageUrl).toBe("https://food52.com/img.jpg");
      expect(recipe.ingredients).toHaveLength(2);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.prepTime).toBe("PT10M");
      expect(recipe.cookTime).toBe("PT15M");
      expect(recipe.totalTime).toBe("PT25M");
      expect(recipe.servings).toBe("4 servings");
      expect(recipe.notes).toEqual(["The best pasta ever"]);
    });
  });
});

