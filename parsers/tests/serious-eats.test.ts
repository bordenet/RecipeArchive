import { SeriousEatsParser } from "../sites/serious-eats";
import { loadFixture } from "../../tests/unit/test-utils";

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

  it("should parse basic recipe structure from HTML fixture", async () => {
    const html = await loadFixture("serious-eats-sample.html");
    const url = "https://www.seriouseats.com/recipes/test-recipe";

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
    const html = await loadFixture("serious-eats-sample.html");
    const url = "https://www.seriouseats.com/recipes/test-recipe";

    const recipe = await parser.parse(html, url);

    expect(recipe.ingredients.length).toBeGreaterThan(0);
    recipe.ingredients.forEach((ingredient) => {
      expect(ingredient.text).toBeDefined();
      expect(typeof ingredient.text).toBe("string");
      expect(ingredient.text.length).toBeGreaterThan(0);
    });
  });

  it("should extract instructions with step numbers", async () => {
    const html = await loadFixture("serious-eats-sample.html");
    const url = "https://www.seriouseats.com/recipes/test-recipe";

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
    it("should parse basic recipe structure with JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Kenji's Perfect Pan Pizza",
              "author": {"@type": "Person", "name": "J. Kenji López-Alt"},
              "recipeIngredient": ["500g flour", "350g water", "10g salt"],
              "recipeInstructions": [
                {"@type": "HowToStep", "text": "Mix the dough"},
                {"@type": "HowToStep", "text": "Let it rise overnight"},
                {"@type": "HowToStep", "text": "Shape and bake"}
              ]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/pan-pizza/";

      const recipe = await parser.parse(html, url);

      expect(recipe.title).toBe("Kenji's Perfect Pan Pizza");
      expect(recipe.author).toBe("J. Kenji López-Alt");
      expect(recipe.ingredients.length).toBe(3);
      expect(recipe.instructions.length).toBe(3);
    });

    it("should handle string instructions in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Quick Recipe",
              "recipeIngredient": ["ingredient 1"],
              "recipeInstructions": ["Step 1.", "Step 2.", "Step 3."]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/quick/";

      const recipe = await parser.parse(html, url);

      expect(recipe.instructions.length).toBe(3);
      expect(recipe.instructions[0].stepNumber).toBe(1);
      expect(recipe.instructions[0].text).toBe("Step 1.");
    });

    it("should handle author as string in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Author String Test",
              "author": "Daniel Gritzer",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/author/";

      const recipe = await parser.parse(html, url);

      expect(recipe.author).toBe("Daniel Gritzer");
    });

    it("should extract timing fields from JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Timed Recipe",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "prepTime": "PT20M",
              "cookTime": "PT45M",
              "totalTime": "PT1H5M"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/timed/";

      const recipe = await parser.parse(html, url);

      expect(recipe.prepTime).toBe("PT20M");
      expect(recipe.cookTime).toBe("PT45M");
      expect(recipe.totalTime).toBe("PT1H5M");
    });

    it("should extract description as notes from JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Recipe With Description",
              "description": "This is a detailed recipe that explains everything.",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/notes/";

      const recipe = await parser.parse(html, url);

      expect(recipe.notes).toBeDefined();
      expect(recipe.notes?.length).toBe(1);
      expect(recipe.notes?.[0]).toContain("detailed recipe");
    });

    it("should extract servings from recipeYield", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Servings Test",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "recipeYield": "6 servings"
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/servings/";

      const recipe = await parser.parse(html, url);

      expect(recipe.servings).toBe("6 servings");
    });

    it("should handle array image format in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Array Image Test",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/image/";

      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
    });

    it("should handle object image format in JSON-LD", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Object Image Test",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "image": {"@type": "ImageObject", "url": "https://example.com/object.jpg"}
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/objectimage/";

      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/object.jpg");
    });

    it("should handle image object in array format", async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Image Object Array Test",
              "recipeIngredient": ["ingredient"],
              "recipeInstructions": ["step"],
              "image": [{"@type": "ImageObject", "url": "https://example.com/arrobj.jpg"}]
            }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const url = "https://seriouseats.com/recipes/arrobj/";

      const recipe = await parser.parse(html, url);

      expect(recipe.imageUrl).toBe("https://example.com/arrobj.jpg");
    });
  });
});

