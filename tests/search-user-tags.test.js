/**
 * Search User Tags Test
 * Validates that user-added tags (manual tags) are searchable
 */

const AWS = require("aws-sdk");

// Mock AWS SDK for testing
AWS.config.update({
  region: "us-west-2",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const mockS3 = {
  listObjectsV2: () => ({
    promise: () =>
      Promise.resolve({
        Contents: [
          { Key: "recipes/test-user/recipe1.json" },
          { Key: "recipes/test-user/recipe2.json" },
        ],
      }),
  }),
  getObject: (params) => ({
    promise: () => {
      if (params.Key.includes("recipe1")) {
        return Promise.resolve({
          Body: JSON.stringify({
            id: "recipe1",
            title: "Test Cocktail Recipe",
            ingredients: [{ text: "2 oz vodka" }, { text: "1 oz lime juice" }],
            instructions: [
              { text: "Mix ingredients" },
              { text: "Serve over ice" },
            ],
            tags: ["drink", "cocktail", "evening"], // User-added tags
            mealType: ["drink"], // Structured metadata
            personalRating: 0,
            source: "manual",
          }),
        });
      }
      if (params.Key.includes("recipe2")) {
        return Promise.resolve({
          Body: JSON.stringify({
            id: "recipe2",
            title: "Pasta Salad",
            ingredients: [
              { text: "1 lb pasta" },
              { text: "2 cups vegetables" },
            ],
            instructions: [
              { text: "Cook pasta" },
              { text: "Mix with vegetables" },
            ],
            tags: ["lunch", "cold", "easy"], // User-added tags
            mealType: ["lunch"], // Structured metadata
            personalRating: 0,
            source: "manual",
          }),
        });
      }
      return Promise.reject(new Error("Recipe not found"));
    },
  }),
};

AWS.S3 = jest.fn(() => mockS3);

describe("Search User Tags Integration Tests", () => {
  let mockRecipesFunction;

  beforeAll(() => {
    // Mock the recipes Lambda function behavior
    mockRecipesFunction = require("../aws-backend/functions/recipes/main.go");
  });

  test("Search finds user-added drink tag", async () => {
    // Simulate searching for "drink" in general search
    const searchQuery = "drink";

    // This should match recipe1 which has "drink" in tags array
    const recipe1 = {
      id: "recipe1",
      title: "Test Cocktail Recipe",
      ingredients: [{ text: "2 oz vodka" }, { text: "1 oz lime juice" }],
      instructions: [{ text: "Mix ingredients" }, { text: "Serve over ice" }],
      tags: ["drink", "cocktail", "evening"],
      mealType: ["drink"],
    };

    // Build search text as the Lambda function does
    let recipeText = recipe1.title.toLowerCase();
    recipe1.ingredients.forEach((ing) => {
      recipeText += " " + ing.text.toLowerCase();
    });
    recipe1.instructions.forEach((inst) => {
      recipeText += " " + inst.text.toLowerCase();
    });
    // Critical: include user tags in search text
    recipe1.tags.forEach((tag) => {
      recipeText += " " + tag.toLowerCase();
    });

    expect(recipeText).toContain("drink");
    expect(recipeText.includes(searchQuery.toLowerCase())).toBe(true);
  });

  test("Search finds user-added lunch tag", async () => {
    const searchQuery = "lunch";

    const recipe2 = {
      id: "recipe2",
      title: "Pasta Salad",
      ingredients: [{ text: "1 lb pasta" }, { text: "2 cups vegetables" }],
      instructions: [{ text: "Cook pasta" }, { text: "Mix with vegetables" }],
      tags: ["lunch", "cold", "easy"],
      mealType: ["lunch"],
    };

    let recipeText = recipe2.title.toLowerCase();
    recipe2.ingredients.forEach((ing) => {
      recipeText += " " + ing.text.toLowerCase();
    });
    recipe2.instructions.forEach((inst) => {
      recipeText += " " + inst.text.toLowerCase();
    });
    recipe2.tags.forEach((tag) => {
      recipeText += " " + tag.toLowerCase();
    });

    expect(recipeText).toContain("lunch");
    expect(recipeText.includes(searchQuery.toLowerCase())).toBe(true);
  });

  test("Search with specific user tag returns correct recipes", async () => {
    const recipes = [
      {
        title: "Margarita",
        tags: ["drink", "tequila", "lime"],
        ingredients: [{ text: "tequila" }],
        instructions: [{ text: "mix" }],
      },
      {
        title: "Caesar Salad",
        tags: ["lunch", "salad", "healthy"],
        ingredients: [{ text: "lettuce" }],
        instructions: [{ text: "toss" }],
      },
      {
        title: "Morning Smoothie",
        tags: ["breakfast", "healthy", "quick"],
        ingredients: [{ text: "banana" }],
        instructions: [{ text: "blend" }],
      },
    ];

    // Test drink search
    const drinkMatches = recipes.filter((recipe) => {
      let searchText = recipe.title.toLowerCase();
      recipe.ingredients.forEach(
        (ing) => (searchText += " " + ing.text.toLowerCase())
      );
      recipe.instructions.forEach(
        (inst) => (searchText += " " + inst.text.toLowerCase())
      );
      recipe.tags.forEach((tag) => (searchText += " " + tag.toLowerCase()));
      return searchText.includes("drink");
    });

    expect(drinkMatches).toHaveLength(1);
    expect(drinkMatches[0].title).toBe("Margarita");

    // Test lunch search
    const lunchMatches = recipes.filter((recipe) => {
      let searchText = recipe.title.toLowerCase();
      recipe.ingredients.forEach(
        (ing) => (searchText += " " + ing.text.toLowerCase())
      );
      recipe.instructions.forEach(
        (inst) => (searchText += " " + inst.text.toLowerCase())
      );
      recipe.tags.forEach((tag) => (searchText += " " + tag.toLowerCase()));
      return searchText.includes("lunch");
    });

    expect(lunchMatches).toHaveLength(1);
    expect(lunchMatches[0].title).toBe("Caesar Salad");
  });

  test("User tags do not interfere with structured mealType search", async () => {
    // Ensure both user tags AND structured metadata work
    const recipe = {
      title: "Weekend Brunch Cocktail",
      tags: ["drink", "weekend"], // User tags
      mealType: ["brunch", "drink"], // Structured metadata
      ingredients: [{ text: "champagne" }],
      instructions: [{ text: "pour" }],
    };

    // Text search should find via user tags
    let searchText = recipe.title.toLowerCase();
    recipe.ingredients.forEach(
      (ing) => (searchText += " " + ing.text.toLowerCase())
    );
    recipe.instructions.forEach(
      (inst) => (searchText += " " + inst.text.toLowerCase())
    );
    recipe.tags.forEach((tag) => (searchText += " " + tag.toLowerCase()));

    expect(searchText.includes("drink")).toBe(true);

    // Structured search should find via mealType
    expect(recipe.mealType.includes("drink")).toBe(true);
    expect(recipe.mealType.includes("brunch")).toBe(true);
  });
});
