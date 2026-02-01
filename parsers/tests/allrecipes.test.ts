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

  describe("parse with JSON-LD", () => {
    it("should parse all JSON-LD fields", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "World's Best Lasagna",
              "author": {"@type": "Person", "name": "John Chandler"},
              "image": "https://allrecipes.com/img.jpg",
              "recipeIngredient": ["ground beef", "ricotta", "pasta sheets"],
              "recipeInstructions": [{"@type": "HowToStep", "text": "Brown the meat"}, {"@type": "HowToStep", "text": "Layer the pasta"}],
              "prepTime": "PT30M",
              "cookTime": "PT2H30M",
              "totalTime": "PT3H",
              "recipeYield": "12 servings",
              "description": "The best lasagna recipe ever"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://allrecipes.com/recipe/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("World's Best Lasagna");
      expect(recipe.author).toBe("John Chandler");
      expect(recipe.imageUrl).toBe("https://allrecipes.com/img.jpg");
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.prepTime).toBe("PT30M");
      expect(recipe.cookTime).toBe("PT2H30M");
      expect(recipe.totalTime).toBe("PT3H");
      expect(recipe.servings).toBe("12 servings");
      expect(recipe.notes).toEqual(["The best lasagna recipe ever"]);
    });

    it("should handle string author", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Quick Recipe",
              "author": "AllRecipes Staff",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://allrecipes.com/recipe/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("AllRecipes Staff");
    });

    it("should handle array recipeYield", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Cookie Recipe",
              "recipeIngredient": ["flour"],
              "recipeInstructions": ["bake"],
              "recipeYield": ["8 servings", "4 large portions"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://allrecipes.com/recipe/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.servings).toBe("8 servings, 4 large portions");
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
              "recipeInstructions": ["First step", "Second step", "Third step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://allrecipes.com/recipe/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.instructions).toHaveLength(3);
      expect(recipe.instructions[0].text).toContain("First step");
    });

    it("should handle image as array of strings", async () => {
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
      const url = "https://allrecipes.com/recipe/test";
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
      const url = "https://allrecipes.com/recipe/test";
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
              "name": "Array of Object Images",
              "image": [{"@type": "ImageObject", "url": "https://example.com/arr-obj.jpg"}],
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://allrecipes.com/recipe/test";
      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/arr-obj.jpg");
    });
  });
});
