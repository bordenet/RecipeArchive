import { WashingtonPostParser } from "../sites/washington-post";
import * as cheerio from "cheerio";

describe("WashingtonPost Parser", () => {
  let parser: WashingtonPostParser;

  beforeEach(() => {
    parser = new WashingtonPostParser();
  });

  it("should identify WashingtonPost food URLs", () => {
    const url = "https://www.washingtonpost.com/food/recipes/best-chocolate-chip-cookies/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify WashingtonPost recipe URLs", () => {
    const url = "https://washingtonpost.com/recipes/some-recipe/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify WashingtonPost voraciously URLs", () => {
    const url = "https://www.washingtonpost.com/news/voraciously/recipe/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-WashingtonPost URLs", () => {
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
            "name": "Classic Chocolate Cake",
            "author": {"@type": "Person", "name": "Joe Yonan"},
            "recipeIngredient": ["2 cups flour", "1 cup cocoa powder", "2 cups sugar"],
            "recipeInstructions": [
              {"@type": "HowToStep", "text": "Preheat oven to 350°F"},
              {"@type": "HowToStep", "text": "Mix dry ingredients"},
              {"@type": "HowToStep", "text": "Bake for 30 minutes"}
            ],
            "image": "https://washingtonpost.com/image.jpg",
            "prepTime": "PT20M",
            "cookTime": "PT30M",
            "totalTime": "PT50M",
            "recipeYield": "8 servings"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.washingtonpost.com/food/recipes/chocolate-cake/";

    const recipe = await parser.parse(html, url);

    expect(recipe).toBeDefined();
    expect(recipe.title).toBe("Classic Chocolate Cake");
    expect(recipe.author).toBe("Joe Yonan");
    expect(recipe.source).toBe(url);
    expect(recipe.ingredients).toBeDefined();
    expect(recipe.ingredients.length).toBe(3);
    expect(recipe.instructions).toBeDefined();
    expect(recipe.instructions.length).toBe(3);
    expect(recipe.imageUrl).toBe("https://washingtonpost.com/image.jpg");
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
            "recipeIngredient": ["ingredient 1", "ingredient 2"],
            "recipeInstructions": ["Step 1", "Step 2"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.washingtonpost.com/food/recipes/quick/";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBe(2);
    expect(recipe.instructions[0].stepNumber).toBe(1);
    expect(recipe.instructions[0].text).toBe("Step 1");
    expect(recipe.instructions[1].stepNumber).toBe(2);
    expect(recipe.instructions[1].text).toBe("Step 2");
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
        <body></body>
      </html>
    `;
    const url = "https://www.washingtonpost.com/food/recipes/minimal/";

    const recipe = await parser.parse(html, url);

    expect(recipe.title).toBe("Minimal Recipe");
    expect(recipe.ingredients.length).toBe(1);
    expect(recipe.instructions.length).toBe(1);
    expect(recipe.imageUrl).toBeUndefined();
    expect(recipe.prepTime).toBeUndefined();
    expect(recipe.cookTime).toBeUndefined();
  });

  it("should handle array image format", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe with Images",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.washingtonpost.com/food/recipes/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
  });

  it("should handle object image format", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe with Image Object",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "image": {"@type": "ImageObject", "url": "https://example.com/image.jpg"}
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.washingtonpost.com/food/recipes/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/image.jpg");
  });

  it("should handle string author format", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe with String Author",
            "author": "Jane Doe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.washingtonpost.com/food/recipes/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.author).toBe("Jane Doe");
  });
});

