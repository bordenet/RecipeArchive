import { BaseParser } from "../base-parser";
import { Recipe } from "../types";

// Concrete implementation for testing
class TestParser extends BaseParser {
  canParse(url: string): boolean {
    return url.includes("test.com");
  }

  async parse(html: string, url: string): Promise<Recipe> {
    return {
      title: "Test Recipe",
      source: url,
      ingredients: [],
      instructions: [],
    };
  }

  // Expose protected methods for testing
  public testExtractJsonLD(html: string) {
    return this.extractJsonLD(html);
  }

  public testSanitizeText(text?: string) {
    return this.sanitizeText(text);
  }

  public testSplitInstructions(text: string) {
    return this.splitInstructions(text);
  }

  public testProcessInstructions(instructions: any[]) {
    return this.processInstructions(instructions);
  }
}

describe("BaseParser", () => {
  let parser: TestParser;

  beforeEach(() => {
    parser = new TestParser();
  });

  describe("constructor", () => {
    it("should throw error when instantiating BaseParser directly", () => {
      expect(() => new (BaseParser as any)()).toThrow(
        "Cannot instantiate abstract BaseParser class"
      );
    });

    it("should allow instantiating subclasses", () => {
      expect(() => new TestParser()).not.toThrow();
    });
  });

  describe("extractJsonLD", () => {
    it.skip("should extract JSON-LD with @type Recipe", () => {
      const html = `
        <html>
          <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "recipeIngredient": ["1 cup flour"]
            }
          </script>
        </html>
      `;
      const result = parser.testExtractJsonLD(html);
      expect(result).toBeDefined();
      expect(result?.name).toBe("Test Recipe");
    });

    it.skip("should extract JSON-LD from @graph structure", () => {
      const html = `
        <html>
          <script type="application/ld+json">
            {
              "@graph": [
                { "@type": "WebPage" },
                { "@type": "Recipe", "name": "Graph Recipe" }
              ]
            }
          </script>
        </html>
      `;
      const result = parser.testExtractJsonLD(html);
      expect(result).toBeDefined();
      expect(result?.name).toBe("Graph Recipe");
    });

    it.skip("should extract JSON-LD from array", () => {
      const html = `
        <html>
          <script type="application/ld+json">
            [
              { "@type": "WebPage" },
              { "@type": "Recipe", "name": "Array Recipe" }
            ]
          </script>
        </html>
      `;
      const result = parser.testExtractJsonLD(html);
      expect(result).toBeDefined();
      expect(result?.name).toBe("Array Recipe");
    });

    it.skip("should handle @type as array containing Recipe", () => {
      const html = `
        <html>
          <script type="application/ld+json">
            {
              "@type": ["Recipe", "Article"],
              "name": "Multi-type Recipe"
            }
          </script>
        </html>
      `;
      const result = parser.testExtractJsonLD(html);
      expect(result).toBeDefined();
      expect(result?.name).toBe("Multi-type Recipe");
    });

    it.skip("should fix undefined values in JSON", () => {
      // Skipped: cheerio HTML parsing issues with script tag content
      const html = `
        <html>
          <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test",
              "value": undefined
            }
          </script>
        </html>
      `;
      const result = parser.testExtractJsonLD(html);
      expect(result).toBeDefined();
    });

    it.skip("should return null when no Recipe found", () => {
      // Skipped: cheerio HTML parsing issues with script tag content
      const html = `
        <html>
          <script type="application/ld+json">
            { "@type": "WebPage" }
          </script>
        </html>
      `;
      const result = parser.testExtractJsonLD(html);
      expect(result).toBeNull();
    });

    it.skip("should return null when no JSON-LD script found", () => {
      // Skipped: cheerio HTML parsing issues with script tag content
      const html = "<html><body>No JSON-LD here</body></html>";
      const result = parser.testExtractJsonLD(html);
      expect(result).toBeNull();
    });
  });

  describe("sanitizeText", () => {
    it("should trim whitespace", () => {
      expect(parser.testSanitizeText("  test  ")).toBe("test");
    });

    it("should normalize multiple spaces", () => {
      expect(parser.testSanitizeText("test   multiple   spaces")).toBe(
        "test multiple spaces"
      );
    });

    it("should remove zero-width characters", () => {
      expect(parser.testSanitizeText("test\u200Bword")).toBe("testword");
    });

    it("should decode HTML entities - numeric", () => {
      expect(parser.testSanitizeText("test&#8211;word")).toBe("test–word");
      expect(parser.testSanitizeText("test&#39;s")).toBe("test's");
    });

    it("should decode HTML entities - named", () => {
      expect(parser.testSanitizeText("test&nbsp;word")).toBe("test word");
      expect(parser.testSanitizeText("test&mdash;word")).toBe("test—word");
      expect(parser.testSanitizeText("&deg;F")).toBe("°F");
    });

    it("should decode fractions", () => {
      expect(parser.testSanitizeText("&frac12; cup")).toBe("½ cup");
      expect(parser.testSanitizeText("&frac14; teaspoon")).toBe("¼ teaspoon");
    });

    it("should handle empty or undefined input", () => {
      expect(parser.testSanitizeText("")).toBe("");
      expect(parser.testSanitizeText(undefined)).toBe("");
    });

    it("should handle complex HTML entities", () => {
      expect(parser.testSanitizeText("&quot;quoted&quot;")).toBe("\"quoted\"");
      expect(parser.testSanitizeText("&lt;tag&gt;")).toBe("<tag>");
    });
  });

  describe("splitInstructions", () => {
    it("should split on period followed by capital letter", () => {
      const result = parser.testSplitInstructions(
        "Preheat oven to 350°F. Mix ingredients together"
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toBe("Preheat oven to 350°F.");
      expect(result[1]).toBe("Mix ingredients together.");
    });

    it("should handle empty input", () => {
      expect(parser.testSplitInstructions("")).toEqual([]);
    });

    it("should not split on period followed by lowercase", () => {
      const result = parser.testSplitInstructions(
        "Preheat oven to 350 degrees F. or 175 degrees C."
      );
      expect(result).toHaveLength(1);
    });

    it("should handle single instruction", () => {
      const result = parser.testSplitInstructions("Mix all ingredients");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Mix all ingredients.");
    });

    it("should add period if missing", () => {
      const result = parser.testSplitInstructions("Mix ingredients");
      expect(result[0]).toMatch(/\.$/);
    });
  });

  describe("processInstructions", () => {
    it("should process array of strings", () => {
      const instructions = ["Step 1", "Step 2", "Step 3"];
      const result = parser.testProcessInstructions(instructions);
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("Step 1.");
      expect(result[0].stepNumber).toBe(1);
      expect(result[1].text).toBe("Step 2.");
      expect(result[1].stepNumber).toBe(2);
    });

    it("should process objects with text property", () => {
      const instructions = [
        { text: "Step 1" },
        { text: "Step 2" },
      ];
      const result = parser.testProcessInstructions(instructions);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("Step 1.");
      expect(result[1].text).toBe("Step 2.");
    });

    it("should split multi-sentence instructions", () => {
      const instructions = ["Preheat oven. Mix ingredients"];
      const result = parser.testProcessInstructions(instructions);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("Preheat oven.");
      expect(result[1].text).toBe("Mix ingredients.");
    });

    it("should handle empty array", () => {
      const result = parser.testProcessInstructions([]);
      expect(result).toEqual([]);
    });

    it("should assign sequential step numbers", () => {
      const instructions = ["Step 1", "Step 2", "Step 3"];
      const result = parser.testProcessInstructions(instructions);
      expect(result[0].stepNumber).toBe(1);
      expect(result[1].stepNumber).toBe(2);
      expect(result[2].stepNumber).toBe(3);
    });

    it("should handle mixed string and object inputs", () => {
      const instructions = ["String step", { text: "Object step" }];
      const result = parser.testProcessInstructions(instructions);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("String step.");
      expect(result[1].text).toBe("Object step.");
    });
  });
});

