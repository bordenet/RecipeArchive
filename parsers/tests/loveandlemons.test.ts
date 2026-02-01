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
});

