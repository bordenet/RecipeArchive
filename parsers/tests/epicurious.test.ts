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

  describe("parse with JSON-LD", () => {
    it("should parse all JSON-LD fields", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Beef Wellington",
              "author": {"@type": "Person", "name": "Gordon Ramsay"},
              "image": "https://epicurious.com/img.jpg",
              "recipeIngredient": ["beef tenderloin", "puff pastry", "mushrooms"],
              "recipeInstructions": [{"@type": "HowToStep", "text": "Sear the beef"}, {"@type": "HowToStep", "text": "Wrap in pastry"}],
              "prepTime": "PT45M",
              "cookTime": "PT25M",
              "totalTime": "PT70M",
              "recipeYield": "6 servings",
              "description": "A classic British dish"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://epicurious.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Beef Wellington");
      expect(recipe.author).toBe("Gordon Ramsay");
      expect(recipe.imageUrl).toBe("https://epicurious.com/img.jpg");
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.prepTime).toBe("PT45M");
      expect(recipe.cookTime).toBe("PT25M");
      expect(recipe.totalTime).toBe("PT70M");
      expect(recipe.servings).toBe("6 servings");
      expect(recipe.notes).toEqual(["A classic British dish"]);
    });

    it("should handle string author", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Simple Recipe",
              "author": "Epicurious Staff",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://epicurious.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("Epicurious Staff");
    });

    it("should handle string instructions", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "String Steps",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["First step", "Second step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://epicurious.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.instructions[0].text).toContain("First step");
    });

    it("should handle image as array", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Array Images",
              "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://epicurious.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
    });

    it("should handle image as object", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Object Image",
              "image": {"@type": "ImageObject", "url": "https://example.com/object.jpg"},
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://epicurious.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/object.jpg");
    });

    it("should handle image as array of objects", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Array of Objects",
              "image": [{"@type": "ImageObject", "url": "https://example.com/arr-obj.jpg"}],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://epicurious.com/recipes/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/arr-obj.jpg");
    });
  });
});

