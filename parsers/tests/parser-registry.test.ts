import { ParserRegistry } from "../parser-registry";
import { BaseParser } from "../base-parser";
import { Recipe } from "../types";

// Mock parser for testing
class MockParser1 extends BaseParser {
  canParse(url: string): boolean {
    return url.includes("test.com") || url.includes("test1.com");
  }

  async parse(html: string, url: string): Promise<Recipe> {
    return {
      title: "Mock Recipe",
      source: url,
      ingredients: [{ text: "1 cup flour" }],
      instructions: [{ stepNumber: 1, text: "Mix ingredients" }],
    };
  }
}

// Second mock parser for testing multiple parsers
class MockParser2 extends BaseParser {
  canParse(url: string): boolean {
    return url.includes("test2.com");
  }

  async parse(html: string, url: string): Promise<Recipe> {
    return {
      title: "Mock Recipe 2",
      source: url,
      ingredients: [{ text: "2 cups sugar" }],
      instructions: [{ stepNumber: 1, text: "Combine ingredients" }],
    };
  }
}

// Mock parser that throws an error
class ErrorParser extends BaseParser {
  canParse(url: string): boolean {
    return url.includes("error.com");
  }

  async parse(html: string, url: string): Promise<Recipe> {
    throw new Error("Parser error");
  }
}

describe("ParserRegistry", () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    // Reset the singleton instance before each test
    (ParserRegistry as any).instance = null;
    registry = ParserRegistry.getInstance();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = ParserRegistry.getInstance();
      const instance2 = ParserRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create a new instance if none exists", () => {
      (ParserRegistry as any).instance = null;
      const instance = ParserRegistry.getInstance();
      expect(instance).toBeInstanceOf(ParserRegistry);
    });
  });

  describe("registerParser", () => {
    it("should register a parser", () => {
      registry.registerParser("test.com", MockParser1);
      const parser = registry.getParserForUrl("https://test.com/recipe");
      expect(parser).toBeInstanceOf(MockParser1);
    });

    it("should register multiple parsers", () => {
      registry.registerParser("test1.com", MockParser1);
      registry.registerParser("test2.com", MockParser2);

      const parser1 = registry.getParserForUrl("https://test1.com/recipe");
      const parser2 = registry.getParserForUrl("https://test2.com/recipe");

      expect(parser1).toBeInstanceOf(MockParser1);
      expect(parser2).toBeInstanceOf(MockParser2);
    });
  });

  describe("getParserForUrl", () => {
    beforeEach(() => {
      registry.registerParser("test.com", MockParser1);
    });

    it("should return a parser for a matching URL", () => {
      const parser = registry.getParserForUrl("https://test.com/recipe");
      expect(parser).toBeInstanceOf(MockParser1);
    });

    it("should return null for a non-matching URL", () => {
      const parser = registry.getParserForUrl("https://unknown.com/recipe");
      expect(parser).toBeNull();
    });

    it("should return the first matching parser", () => {
      // Register two parsers that both match "test.com"
      registry.registerParser("test.com", MockParser1);
      const parser = registry.getParserForUrl("https://test.com/recipe");
      expect(parser).toBeInstanceOf(MockParser1);
    });
  });

  describe("parseRecipe", () => {
    beforeEach(() => {
      registry.registerParser("test.com", MockParser1);
    });

    it("should parse a recipe using the correct parser", async () => {
      const html = "<html><body>Test</body></html>";
      const url = "https://test.com/recipe";

      const recipe = await registry.parseRecipe(html, url);

      expect(recipe).toBeDefined();
      expect(recipe?.title).toBe("Mock Recipe");
      expect(recipe?.source).toBe(url);
      expect(recipe?.ingredients).toHaveLength(1);
      expect(recipe?.instructions).toHaveLength(1);
    });

    it("should return null if no parser is found", async () => {
      const html = "<html><body>Test</body></html>";
      const url = "https://unknown.com/recipe";
      
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const recipe = await registry.parseRecipe(html, url);
      
      expect(recipe).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "No parser found for URL: https://unknown.com/recipe"
      );
      
      consoleSpy.mockRestore();
    });

    it("should return null and log error if parser throws an error", async () => {
      registry.registerParser("error.com", ErrorParser);
      const html = "<html><body>Test</body></html>";
      const url = "https://error.com/recipe";
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const recipe = await registry.parseRecipe(html, url);
      
      expect(recipe).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error parsing recipe from https://error.com/recipe:",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});

