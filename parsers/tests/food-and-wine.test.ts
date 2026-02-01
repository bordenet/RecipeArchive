import { FoodAndWineParser } from "../sites/food-and-wine";
import { loadFixture } from "../../tests/unit/test-utils";

describe("FoodAndWine Parser", () => {
  let parser: FoodAndWineParser;

  beforeEach(() => {
    parser = new FoodAndWineParser();
  });

  it("should identify FoodAndWine URLs", () => {
    const url = "https://www.foodandwine.com/recipes/best-chocolate-chip-cookies";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify FoodAndWine URLs without www", () => {
    const url = "https://foodandwine.com/recipes/some-recipe";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-FoodAndWine URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it("should parse basic recipe structure from HTML fixture", async () => {
    const html = await loadFixture("food-and-wine-sample.html");
    const url = "https://www.foodandwine.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    expect(recipe).toBeDefined();
    expect(recipe.title).toBeDefined();
    expect(recipe.title.length).toBeGreaterThan(0);
    expect(recipe.source).toBe(url);
    expect(recipe.ingredients).toBeDefined();
    expect(recipe.instructions).toBeDefined();
  });

  it("should extract ingredients with proper structure", async () => {
    const html = await loadFixture("food-and-wine-sample.html");
    const url = "https://www.foodandwine.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    // Verify ingredients array structure
    expect(Array.isArray(recipe.ingredients)).toBe(true);
    recipe.ingredients.forEach((ingredient) => {
      expect(ingredient.text).toBeDefined();
      expect(typeof ingredient.text).toBe("string");
    });
  });

  it("should extract instructions with step numbers", async () => {
    const html = await loadFixture("food-and-wine-sample.html");
    const url = "https://www.foodandwine.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    // Verify instructions array structure
    expect(Array.isArray(recipe.instructions)).toBe(true);
    recipe.instructions.forEach((instruction, index) => {
      expect(instruction.stepNumber).toBe(index + 1);
      expect(instruction.text).toBeDefined();
      expect(typeof instruction.text).toBe("string");
    });
  });

  it("should handle optional metadata fields", async () => {
    const html = await loadFixture("food-and-wine-sample.html");
    const url = "https://www.foodandwine.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    // These are optional - verify they're either undefined or properly typed
    if (recipe.author) expect(typeof recipe.author).toBe("string");
    if (recipe.imageUrl) expect(typeof recipe.imageUrl).toBe("string");
    if (recipe.prepTime) expect(typeof recipe.prepTime).toBe("string");
    if (recipe.cookTime) expect(typeof recipe.cookTime).toBe("string");
    if (recipe.totalTime) expect(typeof recipe.totalTime).toBe("string");
    if (recipe.servings) expect(typeof recipe.servings).toBe("string");
  });

  describe("parse with JSON-LD", () => {
    it("should parse all JSON-LD fields", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Grilled Steak",
              "author": {"@type": "Person", "name": "Justin Chapple"},
              "image": "https://foodandwine.com/img.jpg",
              "recipeIngredient": ["ribeye steak", "salt", "pepper"],
              "recipeInstructions": [{"@type": "HowToStep", "text": "Season the steak"}, {"@type": "HowToStep", "text": "Grill to perfection"}],
              "prepTime": "PT5M",
              "cookTime": "PT10M",
              "totalTime": "PT15M",
              "recipeYield": "2 servings",
              "description": "A perfectly grilled steak"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://foodandwine.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Grilled Steak");
      expect(recipe.author).toBe("Justin Chapple");
      expect(recipe.imageUrl).toBe("https://foodandwine.com/img.jpg");
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.prepTime).toBe("PT5M");
      expect(recipe.cookTime).toBe("PT10M");
      expect(recipe.totalTime).toBe("PT15M");
      expect(recipe.servings).toBe("2 servings");
      expect(recipe.notes).toEqual(["A perfectly grilled steak"]);
    });

    it("should handle string author", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Simple Recipe",
              "author": "Food & Wine Staff",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://foodandwine.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("Food & Wine Staff");
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
      const url = "https://foodandwine.com/recipes/test";
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
      const url = "https://foodandwine.com/recipes/test";
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
              "name": "Array of Objects",
              "image": [{"@type": "ImageObject", "url": "https://example.com/arr-obj.jpg"}],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://foodandwine.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/arr-obj.jpg");
    });

    it("should handle string instructions", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "String Steps",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["First step", "Second step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://foodandwine.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.instructions[0].text).toContain("First step");
    });
  });
});

