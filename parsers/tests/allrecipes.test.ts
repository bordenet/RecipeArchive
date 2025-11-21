import { AllRecipesParser } from "../sites/allrecipes";
import { loadFixture } from "../../tests/unit/test-utils";

describe("AllRecipes Parser", () => {
  let parser: AllRecipesParser;

  beforeEach(() => {
    parser = new AllRecipesParser();
  });

  it("should identify AllRecipes URLs", () => {
    const url = "https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should parse basic recipe structure from HTML fixture", async () => {
    const html = await loadFixture("allrecipes-sample.html");
    const url = "https://www.allrecipes.com/recipe/test-recipe/";

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
    const html = await loadFixture("allrecipes-sample.html");
    const url = "https://www.allrecipes.com/recipe/test-recipe/";

    const recipe = await parser.parse(html, url);

    expect(recipe.ingredients.length).toBeGreaterThan(0);
    recipe.ingredients.forEach((ingredient) => {
      expect(ingredient.text).toBeDefined();
      expect(typeof ingredient.text).toBe("string");
      expect(ingredient.text.length).toBeGreaterThan(0);
    });
  });

  it("should extract instructions with step numbers", async () => {
    const html = await loadFixture("allrecipes-sample.html");
    const url = "https://www.allrecipes.com/recipe/test-recipe/";

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
