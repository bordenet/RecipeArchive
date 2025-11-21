import { SeriousEatsParser } from "../sites/serious-eats";

describe("SeriousEats Parser", () => {
  let parser: SeriousEatsParser;

  beforeEach(() => {
    parser = new SeriousEatsParser();
  });

  it("should identify SeriousEats URLs", () => {
    const url = "https://www.seriouseats.com/recipes/2023/01/best-chocolate-chip-cookies";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify SeriousEats URLs without www", () => {
    const url = "https://seriouseats.com/recipes/some-recipe";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-SeriousEats URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it.skip("should parse basic recipe structure", () => {
    // Test implementation to be added
  });

  it.skip("should handle missing optional fields gracefully", () => {
    // Test implementation to be added
  });

  it.skip("should handle complex recipe with all fields", () => {
    // Test implementation to be added
  });
});

