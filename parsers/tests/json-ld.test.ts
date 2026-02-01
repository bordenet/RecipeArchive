import { JsonLdParser } from "../sites/json-ld";

describe("JsonLd Parser", () => {
  let parser: JsonLdParser;

  beforeEach(() => {
    parser = new JsonLdParser();
  });

  it("should accept any URL (universal fallback parser)", () => {
    expect(parser.canParse("https://www.example.com/recipe/123")).toBe(true);
    expect(parser.canParse("https://www.allrecipes.com/recipe/12345/")).toBe(true);
    expect(parser.canParse("https://www.randomsite.com/some-recipe/")).toBe(true);
  });

  it("should accept URLs without protocol", () => {
    expect(parser.canParse("example.com/recipe")).toBe(true);
  });

  it("should accept empty string (universal parser)", () => {
    expect(parser.canParse("")).toBe(true);
  });

  it("should parse JSON-LD structured data", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Test Recipe",
            "recipeIngredient": ["flour", "sugar"],
            "recipeInstructions": ["Mix", "Bake"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://example.com/recipe";
    const recipe = await parser.parse(html, url);

    expect(recipe.title).toBe("Test Recipe");
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.instructions).toHaveLength(2);
  });

  it("should throw error when no JSON-LD found", async () => {
    const html = `
      <html>
        <head></head>
        <body>No recipe here</body>
      </html>
    `;
    const url = "https://example.com/page";

    await expect(parser.parse(html, url)).rejects.toThrow("No valid JSON-LD recipe found");
  });

  it("should handle complex JSON-LD with all fields", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Complete Recipe",
            "author": {"@type": "Person", "name": "Chef Bob"},
            "image": "https://example.com/img.jpg",
            "recipeIngredient": ["ingredient1"],
            "recipeInstructions": [{"@type": "HowToStep", "text": "Step one"}],
            "prepTime": "PT10M",
            "cookTime": "PT20M",
            "totalTime": "PT30M",
            "recipeYield": "4 servings",
            "description": "A delicious recipe"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://example.com/recipe";
    const recipe = await parser.parse(html, url);

    expect(recipe.title).toBe("Complete Recipe");
    expect(recipe.author).toBe("Chef Bob");
    expect(recipe.imageUrl).toBe("https://example.com/img.jpg");
    expect(recipe.prepTime).toBe("PT10M");
    expect(recipe.cookTime).toBe("PT20M");
    expect(recipe.totalTime).toBe("PT30M");
    expect(recipe.servings).toBe("4 servings");
    expect(recipe.notes).toEqual(["A delicious recipe"]);
  });

  it("should handle string author", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "String Author Recipe",
            "author": "Simple Author Name",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["step"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://example.com/recipe";
    const recipe = await parser.parse(html, url);

    expect(recipe.author).toBe("Simple Author Name");
  });

  it("should handle image as array", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Array Image Recipe",
            "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["step"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://example.com/recipe";
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
            "name": "Object Image Recipe",
            "image": {"@type": "ImageObject", "url": "https://example.com/object.jpg"},
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["step"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://example.com/recipe";
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
            "name": "Array of Objects Image",
            "image": [{"@type": "ImageObject", "url": "https://example.com/arr-obj.jpg"}],
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["step"]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const url = "https://example.com/recipe";
    const recipe = await parser.parse(html, url);

    expect(recipe.imageUrl).toBe("https://example.com/arr-obj.jpg");
  });
});

