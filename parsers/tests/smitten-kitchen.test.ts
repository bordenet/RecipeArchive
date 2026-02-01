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

  it("should handle instructions with name property instead of text", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe with Name Instructions",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": [
              {"@type": "HowToStep", "name": "First step using name"},
              {"@type": "HowToStep", "name": "Second step using name"}
            ]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/name-instructions/";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBe(2);
    expect(recipe.instructions[0].text).toContain("First step");
  });

  it("should handle instructions with description property", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe with Description Instructions",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": [
              {"@type": "HowToStep", "description": "Description based instruction"}
            ]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/desc-instructions/";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBe(1);
    expect(recipe.instructions[0].text).toContain("Description based");
  });

  it("should default author to Deb Perelman when missing", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "No Author Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/noauthor/";

    const recipe = await parser.parse(html, url);

    expect(recipe.author).toBe("Deb Perelman");
  });

  it("should handle author as string", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "String Author Recipe",
            "author": "Guest Blogger",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/guest/";

    const recipe = await parser.parse(html, url);

    expect(recipe.author).toBe("Guest Blogger");
  });

  it("should extract timing fields", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Timed Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "prepTime": "PT30M",
            "cookTime": "PT1H",
            "totalTime": "PT1H30M"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/timed/";

    const recipe = await parser.parse(html, url);

    expect(recipe.prepTime).toBe("PT30M");
    expect(recipe.cookTime).toBe("PT1H");
    expect(recipe.totalTime).toBe("PT1H30M");
  });

  it("should extract recipeYield as servings", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Servings Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "recipeYield": "12 cookies"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/servings/";

    const recipe = await parser.parse(html, url);

    expect(recipe.servings).toBe("12 cookies");
  });

  it("should handle image object in array format", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Array Object Image Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "image": [{"@type": "ImageObject", "url": "https://example.com/arrobj.jpg"}]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/arrobj/";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/arrobj.jpg");
  });

  it("should filter out JavaScript code from instructions", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe with JS in Instructions",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": [
              {"@type": "HowToStep", "text": "window.document.addEventListener"},
              {"@type": "HowToStep", "text": "function() { return true; }"},
              {"@type": "HowToStep", "text": "Actual cooking instruction"}
            ]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/jsfilter/";

    const recipe = await parser.parse(html, url);

    // Should filter out JS code and fallback to placeholder
    expect(recipe.instructions.some(i => i.text.includes("Actual cooking"))).toBe(true);
  });

  it("should handle recipeCategory as array", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Categorized Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "recipeCategory": ["Dessert", "Baking"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/categories/";

    const recipe = await parser.parse(html, url);

    expect(recipe.tags).toContain("Dessert");
    expect(recipe.tags).toContain("Baking");
  });

  it("should handle recipeCategory as string", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Single Category Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"],
            "recipeCategory": "Main Course"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/singlecat/";

    const recipe = await parser.parse(html, url);

    expect(recipe.tags).toContain("Main Course");
  });

  it("should handle instruction object with no valid text field", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Empty Instruction Object",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": [
              {"@type": "HowToStep", "invalidField": "no text here"},
              "Valid string instruction"
            ]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://smittenkitchen.com/recipe/emptyobj/";

    const recipe = await parser.parse(html, url);

    // Should include fallback for empty object and valid string
    expect(recipe.instructions.length).toBeGreaterThanOrEqual(1);
  });
});

