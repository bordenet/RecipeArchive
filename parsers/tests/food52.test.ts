import { Food52Parser } from "../sites/food52";

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

  it.skip("should parse basic recipe structure", () => {
    // Test implementation to be added
    // NOTE: food52.com blocks automated access with Vercel Security Checkpoint
    // E2E tests are excluded for this parser
  });

  it.skip("should handle missing optional fields gracefully", () => {
    // Test implementation to be added
  });

  it.skip("should handle complex recipe with all fields", () => {
    // Test implementation to be added
  });
});

