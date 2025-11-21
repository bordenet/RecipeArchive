import { EpicuriousParser } from "../sites/epicurious";
import { loadFixture } from "../../tests/unit/test-utils";

describe("Epicurious Parser", () => {
  let parser: EpicuriousParser;

  beforeEach(() => {
    parser = new EpicuriousParser();
  });

  it("should identify Epicurious URLs", () => {
    const url = "https://www.epicurious.com/recipes/food/views/pad-kee-mao";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify Epicurious URLs without www", () => {
    const url = "https://epicurious.com/recipes/food/views/some-recipe";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-Epicurious URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it("should parse basic recipe structure from HTML fixture", async () => {
    const html = await loadFixture("epicurious-sample.html");
    const url = "https://www.epicurious.com/recipes/food/views/test-recipe";

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
    const html = await loadFixture("epicurious-sample.html");
    const url = "https://www.epicurious.com/recipes/food/views/test-recipe";

    const recipe = await parser.parse(html, url);

    expect(recipe.ingredients.length).toBeGreaterThan(0);
    recipe.ingredients.forEach((ingredient) => {
      expect(ingredient.text).toBeDefined();
      expect(typeof ingredient.text).toBe("string");
      expect(ingredient.text.length).toBeGreaterThan(0);
    });
  });

  it("should extract instructions with step numbers", async () => {
    const html = await loadFixture("epicurious-sample.html");
    const url = "https://www.epicurious.com/recipes/food/views/test-recipe";

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

