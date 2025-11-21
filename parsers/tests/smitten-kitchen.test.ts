import { SmittenKitchenParser } from "../sites/smitten-kitchen";
import * as cheerio from "cheerio";

describe("SmittenKitchen Parser", () => {
  let parser: SmittenKitchenParser;

  beforeEach(() => {
    parser = new SmittenKitchenParser();
  });

  it("should identify SmittenKitchen URLs", () => {
    const url = "https://smittenkitchen.com/2023/01/best-chocolate-chip-cookies/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify SmittenKitchen URLs with www", () => {
    const url = "https://www.smittenkitchen.com/some-recipe/";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-SmittenKitchen URLs", () => {
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
            "author": {"@type": "Person", "name": "Deb Perelman"},
            "recipeIngredient": ["2 cups flour", "1 cup sugar", "1 cup chocolate chips"],
            "recipeInstructions": [
              {"@type": "HowToStep", "text": "Mix dry ingredients"},
              {"@type": "HowToStep", "text": "Add wet ingredients"},
              {"@type": "HowToStep", "text": "Bake at 350°F"}
            ],
            "image": "https://smittenkitchen.com/image.jpg",
            "prepTime": "PT15M",
            "cookTime": "PT12M",
            "totalTime": "PT27M",
            "recipeYield": "24 cookies"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/chocolate-chip-cookies/";

    const recipe = await parser.parse(html, url);

    expect(recipe).toBeDefined();
    expect(recipe.title).toBe("Chocolate Chip Cookies");
    expect(recipe.author).toBe("Deb Perelman");
    expect(recipe.source).toBe(url);
    expect(recipe.ingredients).toBeDefined();
    expect(recipe.ingredients.length).toBe(3);
    expect(recipe.instructions).toBeDefined();
    expect(recipe.instructions.length).toBe(3);
    expect(recipe.imageUrl).toBe("https://smittenkitchen.com/image.jpg");
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
            "recipeInstructions": ["Step 1", "Step 2", "Step 3"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/simple/";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBe(3);
    expect(recipe.instructions[0].stepNumber).toBe(1);
    expect(recipe.instructions[0].text).toBe("Step 1.");
    expect(recipe.instructions[2].stepNumber).toBe(3);
    expect(recipe.instructions[2].text).toBe("Step 3.");
  });

  it("should handle instructions with special characters", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Test Recipe",
            "recipeIngredient": ["flour"],
            "recipeInstructions": [
              "Mix ingredients",
              "Bake at 350°F for 30 minutes",
              "Let cool & serve"
            ]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBe(3);
    expect(recipe.instructions[0].text).toBe("Mix ingredients.");
    expect(recipe.instructions[1].text).toContain("Bake at 350");
    expect(recipe.instructions[2].text).toContain("cool");
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
    const url = "https://smittenkitchen.com/recipe/minimal/";

    const recipe = await parser.parse(html, url);

    expect(recipe.title).toBe("Minimal Recipe");
    expect(recipe.ingredients.length).toBe(1);
    expect(recipe.instructions.length).toBe(1);
    expect(recipe.imageUrl).toBeUndefined();
    // prepTime and cookTime may be undefined or empty string
    expect(recipe.prepTime === undefined || recipe.prepTime === "").toBe(true);
    expect(recipe.cookTime === undefined || recipe.cookTime === "").toBe(true);
  });

  it("should handle array image format", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe with Image Array",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "image": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/image1.jpg");
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
    const url = "https://smittenkitchen.com/recipe/test/";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/image.jpg");
  });
});

