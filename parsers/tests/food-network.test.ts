import { FoodNetworkParser } from "../sites/food-network";
import * as cheerio from "cheerio";

describe("FoodNetwork Parser", () => {
  let parser: FoodNetworkParser;

  beforeEach(() => {
    parser = new FoodNetworkParser();
  });

  it("should identify FoodNetwork URLs", () => {
    const url = "https://www.foodnetwork.com/recipes/best-chocolate-chip-cookies";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should identify FoodNetwork URLs without www", () => {
    const url = "https://foodnetwork.com/recipes/some-recipe";
    expect(parser.canParse(url)).toBe(true);
  });

  it("should reject non-FoodNetwork URLs", () => {
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
            "name": "Perfect Pancakes",
            "author": {"@type": "Person", "name": "Bobby Flay"},
            "recipeIngredient": ["2 cups flour", "2 eggs", "1 cup milk"],
            "recipeInstructions": [
              {"@type": "HowToStep", "text": "Mix dry ingredients"},
              {"@type": "HowToStep", "text": "Add wet ingredients"},
              {"@type": "HowToStep", "text": "Cook on griddle"}
            ],
            "image": "https://foodnetwork.com/image.jpg",
            "prepTime": "PT10M",
            "cookTime": "PT15M",
            "totalTime": "PT25M",
            "recipeYield": "4 servings"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.foodnetwork.com/recipes/perfect-pancakes";

    const recipe = await parser.parse(html, url);

    expect(recipe).toBeDefined();
    expect(recipe.title).toBe("Perfect Pancakes");
    expect(recipe.author).toBe("Bobby Flay");
    expect(recipe.source).toBe(url);
    expect(recipe.ingredients).toBeDefined();
    expect(recipe.ingredients.length).toBe(3);
    expect(recipe.instructions).toBeDefined();
    expect(recipe.instructions.length).toBe(3);
    expect(recipe.imageUrl).toBe("https://foodnetwork.com/image.jpg");
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
            "recipeInstructions": ["Step 1", "Step 2", "Step 3"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.foodnetwork.com/recipes/quick";

    const recipe = await parser.parse(html, url);

    expect(recipe.instructions.length).toBe(3);
    expect(recipe.instructions[0].stepNumber).toBe(1);
    expect(recipe.instructions[0].text).toBe("Step 1.");
    expect(recipe.instructions[2].stepNumber).toBe(3);
    expect(recipe.instructions[2].text).toBe("Step 3.");
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
    const url = "https://www.foodnetwork.com/recipes/minimal";

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
    const url = "https://www.foodnetwork.com/recipes/test";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
  });

  it("should handle object image format with url property", async () => {
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
    const url = "https://www.foodnetwork.com/recipes/test";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/image.jpg");
  });

  it("should handle array of image objects", async () => {
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
            "image": [
              {"@type": "ImageObject", "url": "https://example.com/img1.jpg"},
              {"@type": "ImageObject", "url": "https://example.com/img2.jpg"}
            ]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.foodnetwork.com/recipes/test";

    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/img1.jpg");
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
            "author": "Giada De Laurentiis",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.foodnetwork.com/recipes/test";

    const recipe = await parser.parse(html, url);

    expect(recipe.author).toBe("Giada De Laurentiis");
  });

  it("should default to Food Network as author when missing", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Recipe without Author",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://www.foodnetwork.com/recipes/test";

    const recipe = await parser.parse(html, url);

    expect(recipe.author).toBe("Food Network");
  });
});

