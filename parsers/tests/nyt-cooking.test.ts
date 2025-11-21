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
});

