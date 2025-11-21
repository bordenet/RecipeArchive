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
});

