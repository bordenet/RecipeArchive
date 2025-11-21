import { DamnDeliciousParser } from "../sites/damn-delicious";

describe("DamnDelicious Parser", () => {
  let parser: DamnDeliciousParser;

  beforeEach(() => {
    parser = new DamnDeliciousParser();
  });

  it("should identify DamnDelicious URLs", () => {
    const url = "https://damndelicious.net/2023/01/15/best-chocolate-chip-cookies/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify DamnDelicious URLs with www", () => {
    const url = "https://www.damndelicious.net/some-recipe/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-DamnDelicious URLs", () => {
    const url = "https://www.allrecipes.com/recipe/12345/";
    expect(parser.canParse(url)).toBe(false);
  });

  it("should parse basic recipe structure with JSON-LD", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Chocolate Chip Cookies",
            "author": {"@type": "Person", "name": "Chungah Rhee"},
            "recipeIngredient": ["2 cups flour", "1 cup sugar"],
            "recipeInstructions": [
              {"@type": "HowToStep", "text": "Mix dry ingredients"},
              {"@type": "HowToStep", "text": "Bake at 350°F"}
            ]
          }
          </script>
        </head>
      </html>
    `;
    const url = "https://damndelicious.net/recipe/cookies/";

    const recipe = await parser.parse(html, url);

    expect(recipe.title).toBe("Chocolate Chip Cookies");
    expect(recipe.ingredients.length).toBe(2);
    expect(recipe.instructions.length).toBe(2);
  });

  it("should handle string instructions in JSON-LD", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Simple Recipe",
            "recipeIngredient": ["ingredient 1"],
            "recipeInstructions": ["Step 1.", "Step 2.", "Step 3."]
          }
          </script>
        </head>
      </html>
    `;
    const url = "https://damndelicious.net/recipe/simple/";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBe(3);
    expect(recipe.instructions[0].stepNumber).toBe(1);
    expect(recipe.instructions[0].text).toBe("Step 1.");
  });

  it("should handle missing optional fields gracefully", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Minimal Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
          </script>
        </head>
      </html>
    `;
    const url = "https://damndelicious.net/recipe/minimal/";

    const recipe = await parser.parse(html, url);

    expect(recipe.title).toBe("Minimal Recipe");
    expect(recipe.ingredients.length).toBe(1);
    expect(recipe.instructions.length).toBe(1);
    expect(recipe.imageUrl).toBeUndefined();
  });

  it("should handle array image format", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Test Recipe",
            "image": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
            "recipeIngredient": ["ingredient 1"],
            "recipeInstructions": ["step 1"]
          }
          </script>
        </head>
      </html>
    `;
    const url = "https://damndelicious.net/recipe/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/image1.jpg");
  });

  it("should handle object image format", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Test Recipe",
            "image": {"@type": "ImageObject", "url": "https://example.com/image.jpg"},
            "recipeIngredient": ["ingredient 1"],
            "recipeInstructions": ["step 1"]
          }
          </script>
        </head>
      </html>
    `;
    const url = "https://damndelicious.net/recipe/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/image.jpg");
  });
});

