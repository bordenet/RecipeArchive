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
});

