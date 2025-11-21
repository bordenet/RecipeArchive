import { WashingtonPostParser } from "../sites/washington-post";

describe("WashingtonPost Parser", () => {
  let parser: WashingtonPostParser;

  beforeEach(() => {
    parser = new WashingtonPostParser();
  });

  it("should identify WashingtonPost URLs", () => {
    const url = "https://www.washingtonpost.com/recipes/best-chocolate-chip-cookies/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify WashingtonPost URLs without www", () => {
    const url = "https://washingtonpost.com/recipes/some-recipe/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-WashingtonPost URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it.skip("should parse basic recipe structure", () => {
    // Test implementation to be added
    // NOTE: washington-post has HTTP/2 errors in E2E tests
  });

  it.skip("should handle missing optional fields gracefully", () => {
    // Test implementation to be added
  });

  it.skip("should handle complex recipe with all fields", () => {
    // Test implementation to be added
  });
});

